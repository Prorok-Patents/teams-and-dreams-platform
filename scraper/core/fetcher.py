"""
Base fetcher classes implementing the Raw HTTP → Headless escalation strategy.

The fetcher is responsible ONLY for getting the raw content (HTML or JSON)
from a URL. Parsing is handled separately by the extractors.

Strategy hierarchy:
  1. RawHTTPFetcher  — httpx GET, fastest, cheapest
  2. HeadlessFetcher — Playwright render, for JS-heavy sites
  3. APIFetcher      — Direct API call when we've intercepted the endpoint
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

import httpx

from ..models import ProxyTier, SiteProfile, SiteStrategy
from .proxy import ProxyManager, get_random_headers

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Fetch result container
# ---------------------------------------------------------------------------

@dataclass
class FetchResult:
    """Container for the result of a fetch operation."""
    url: str
    status_code: int
    content: str                    # Raw HTML or JSON string
    content_type: str               # e.g. "text/html", "application/json"
    strategy_used: SiteStrategy
    proxy_tier_used: ProxyTier
    elapsed_ms: float
    is_blocked: bool = False        # True if we detected an anti-bot block


# ---------------------------------------------------------------------------
# Block detection heuristics
# ---------------------------------------------------------------------------

BLOCK_INDICATORS = [
    "captcha",
    "challenge-platform",
    "cf-browser-verification",
    "access denied",
    "blocked",
    "rate limit",
    "too many requests",
    "please verify you are a human",
    "enable javascript and cookies",
]


def detect_block(status_code: int, content: str) -> bool:
    """
    Heuristic check: did the target site block us?
    Returns True if we suspect a block.
    """
    if status_code in (403, 429, 503):
        return True
    content_lower = content.lower()
    return any(indicator in content_lower for indicator in BLOCK_INDICATORS)


# ---------------------------------------------------------------------------
# Abstract base fetcher
# ---------------------------------------------------------------------------

class BaseFetcher(ABC):
    """Abstract base class for all fetchers."""

    def __init__(self, proxy_manager: Optional[ProxyManager] = None):
        self.proxy_manager = proxy_manager or ProxyManager()

    @abstractmethod
    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        """Fetch content from the given URL."""
        ...

    def _apply_jitter(self, profile: SiteProfile) -> None:
        """
        Sleep for a random duration between the profile's min/max delay.
        This implements "politeness" to avoid triggering DDoS protection.
        """
        delay = random.uniform(profile.request_delay_min, profile.request_delay_max)
        logger.debug(f"Politeness jitter: sleeping {delay:.2f}s")
        time.sleep(delay)


# ---------------------------------------------------------------------------
# Raw HTTP Fetcher (Strategy 1 — default)
# ---------------------------------------------------------------------------

class RawHTTPFetcher(BaseFetcher):
    """
    Fetches pages using raw HTTP requests via httpx.
    ~100x faster and cheaper than headless rendering.
    This should always be attempted first.
    """

    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        self._apply_jitter(profile)

        proxy_url = self.proxy_manager.get_proxy(profile.proxy_tier)
        headers = get_random_headers()

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(
                proxy=proxy_url,
                headers=headers,
                follow_redirects=True,
                timeout=30.0,
            ) as client:
                response = await client.get(url)

            elapsed = (time.monotonic() - start) * 1000
            content = response.text
            status_code = response.status_code
            content_type = response.headers.get("content-type", "text/html")
            is_blocked = detect_block(status_code, content)

            if is_blocked:
                logger.warning(f"Block detected on {url} (status={status_code})")
        except httpx.RequestError as e:
            logger.warning(f"RequestError on {url}: {e}")
            elapsed = (time.monotonic() - start) * 1000
            content = str(e)
            status_code = 0
            content_type = "text/plain"
            is_blocked = True

        return FetchResult(
            url=url,
            status_code=status_code,
            content=content,
            content_type=content_type,
            strategy_used=SiteStrategy.RAW_HTTP,
            proxy_tier_used=profile.proxy_tier,
            elapsed_ms=elapsed,
            is_blocked=is_blocked,
        )


# ---------------------------------------------------------------------------
# Headless Fetcher (Strategy 2 — fallback for JS-heavy sites)
# ---------------------------------------------------------------------------

class HeadlessFetcher(BaseFetcher):
    """
    Renders pages using Playwright (headless Chromium).
    More expensive but handles JavaScript-rendered content and
    advanced anti-bot systems like Cloudflare Turnstile.

    Requires: pip install playwright && playwright install chromium
    """

    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        self._apply_jitter(profile)

        # Lazy import — Playwright is heavy and not needed for most sites
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise RuntimeError(
                "Playwright is required for headless fetching. "
                "Install it with: pip install playwright && playwright install chromium"
            )

        proxy_url = self.proxy_manager.get_proxy(profile.proxy_tier)
        proxy_config = None
        if proxy_url:
            proxy_config = {"server": proxy_url}

        start = time.monotonic()

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                proxy=proxy_config,
            )
            context = await browser.new_context(
                user_agent=get_random_headers()["User-Agent"],
                viewport={"width": 1920, "height": 1080},
            )
            page = await context.new_page()

            # Navigate and wait for network to settle
            response = await page.goto(url, wait_until="networkidle", timeout=60000)
            content = await page.content()
            status_code = response.status if response else 0

            await browser.close()

        elapsed = (time.monotonic() - start) * 1000
        is_blocked = detect_block(status_code, content)

        if is_blocked:
            logger.warning(f"Block detected (headless) on {url} (status={status_code})")

        return FetchResult(
            url=url,
            status_code=status_code,
            content=content,
            content_type="text/html",
            strategy_used=SiteStrategy.HEADLESS,
            proxy_tier_used=profile.proxy_tier,
            elapsed_ms=elapsed,
            is_blocked=is_blocked,
        )


# ---------------------------------------------------------------------------
# API Fetcher (Strategy 3 — when we've discovered a hidden JSON API)
# ---------------------------------------------------------------------------

class APIFetcher(BaseFetcher):
    """
    Directly calls a discovered JSON API endpoint.
    The cleanest, fastest, most reliable strategy — but only works
    when we've successfully intercepted and reverse-engineered the API.
    """

    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        self._apply_jitter(profile)

        # Use the discovered API endpoint, not the page URL
        api_url = str(profile.api_endpoint) if profile.api_endpoint else url

        proxy_url = self.proxy_manager.get_proxy(profile.proxy_tier)
        headers = get_random_headers()
        # API calls typically expect JSON
        headers["Accept"] = "application/json"

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(
                proxy=proxy_url,
                headers=headers,
                follow_redirects=True,
                timeout=30.0,
            ) as client:
                response = await client.get(api_url)

            elapsed = (time.monotonic() - start) * 1000
            content = response.text
            status_code = response.status_code
            content_type = response.headers.get("content-type", "application/json")
            is_blocked = detect_block(status_code, content)
        except httpx.RequestError as e:
            logger.warning(f"RequestError on API {api_url}: {e}")
            elapsed = (time.monotonic() - start) * 1000
            content = str(e)
            status_code = 0
            content_type = "text/plain"
            is_blocked = True

        return FetchResult(
            url=api_url,
            status_code=status_code,
            content=content,
            content_type=content_type,
            strategy_used=SiteStrategy.API_INTERCEPT,
            proxy_tier_used=profile.proxy_tier,
            elapsed_ms=elapsed,
            is_blocked=is_blocked,
        )


# ---------------------------------------------------------------------------
# Firecrawl Fetcher (Strategy 5 - Markdown API + Cloudflare bypass)
# ---------------------------------------------------------------------------

class FirecrawlFetcher(BaseFetcher):
    """
    Uses the Firecrawl API to fetch and render pages, bypassing Cloudflare
    and automatically converting HTML to clean Markdown for the LLM.
    """

    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        import os
        import dotenv
        api_key = os.getenv("FIRECRAWL_API_KEY") or dotenv.dotenv_values(".env").get("FIRECRAWL_API_KEY")
        if not api_key:
            raise ValueError("FIRECRAWL_API_KEY environment variable is required for Firecrawl strategy.")

        self._apply_jitter(profile)

        start = time.monotonic()
        
        # We don't use proxies with Firecrawl because they handle it internally
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "url": url,
                    "formats": ["html"]
                }
            )

        elapsed = (time.monotonic() - start) * 1000
        
        if response.status_code == 200:
            data = response.json()
            content = data.get("data", {}).get("html", "")
            is_blocked = False
        else:
            content = response.text
            is_blocked = True
            logger.warning(f"Firecrawl failed for {url} (status={response.status_code}): {content}")

        return FetchResult(
            url=url,
            status_code=response.status_code,
            content=content,
            content_type="text/html",
            strategy_used=SiteStrategy.FIRECRAWL,
            proxy_tier_used=ProxyTier.NONE, # Firecrawl handles its own proxies
            elapsed_ms=elapsed,
            is_blocked=is_blocked,
        )


# ---------------------------------------------------------------------------
# Airtop Fetcher (Strategy 6 - Airtop native scrape content)
# ---------------------------------------------------------------------------

class AirtopFetcher(BaseFetcher):
    """
    Uses the Airtop API to fetch and render pages.
    """

    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        import os
        import dotenv
        api_key = os.getenv("AIRTOP_API_KEY") or dotenv.dotenv_values(".env").get("AIRTOP_API_KEY")
        if not api_key:
            raise ValueError("AIRTOP_API_KEY environment variable is required for Airtop strategy.")

        self._apply_jitter(profile)
        
        try:
            from airtop import AsyncAirtop
        except ImportError:
            raise RuntimeError(
                "Airtop SDK is required for Airtop fetching. "
                "Install it with: pip install airtop"
            )

        start = time.monotonic()
        
        # Configure residential proxy inside Airtop if possible, else standard session
        client = AsyncAirtop(api_key=api_key)
        
        # NOTE: Due to a bug in the Python SDK with dictionary conversion, we use a basic session
        session = await client.sessions.create()
        window = await client.windows.create(session_id=session.data.id, url=url)
        
        # Wait a moment for dynamic content and CF checks
        import asyncio
        await asyncio.sleep(15)
        
        try:
            content_response = await client.windows.scrape_content(
                session_id=session.data.id, 
                window_id=window.data.window_id
            )
            content = content_response.data.model_response.scraped_content.text
            
            # Since scrape_content returns markdown
            content_type = "text/markdown"
            is_blocked = detect_block(200, content)
            
            # Special check for Cloudflare native page returned as text
            if "Just a moment..." in content or "Cloudflare" in content or "Performing security verification" in content:
                is_blocked = True
        except Exception as e:
            logger.error(f"Airtop scrape failed: {e}")
            content = ""
            content_type = "text/plain"
            is_blocked = True
        finally:
            try:
                await client.sessions.terminate(id=session.data.id)
            except Exception:
                pass

        elapsed = (time.monotonic() - start) * 1000

        return FetchResult(
            url=url,
            status_code=403 if is_blocked else 200,
            content=content,
            content_type=content_type,
            strategy_used=SiteStrategy.AIRTOP,
            proxy_tier_used=ProxyTier.NONE, 
            elapsed_ms=elapsed,
            is_blocked=is_blocked,
        )


# ---------------------------------------------------------------------------
# Interactive Fetcher (Strategy 4 — LLM-guided browser interaction)
# ---------------------------------------------------------------------------

class InteractiveFetcher(BaseFetcher):
    """
    Renders pages and interacts with them using Browser-Use and an LLM.
    Used when deterministic selectors fail and LLM detects interaction barriers
    (like 'Load More', infinite scroll, or cookie gates).
    """

    async def fetch(self, url: str, profile: SiteProfile) -> FetchResult:
        self._apply_jitter(profile)

        try:
            import os
            from browser_use import Agent
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            raise RuntimeError(
                "Browser-use and langchain are required for interactive fetching. "
                "Install them with: pip install browser-use langchain-google-genai"
            )

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not set. Cannot run InteractiveFetcher.")
            return FetchResult(
                url=url, status_code=500, content="", content_type="text/html",
                strategy_used=SiteStrategy.INTERACTIVE, proxy_tier_used=profile.proxy_tier,
                elapsed_ms=0, is_blocked=False
            )

        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key)
        
        prompt = (
            f"Navigate to {url}. "
            f"Find the list of {profile.sport.value} events. "
            "If there is a cookie banner, dismiss it. "
            "If there is a 'Load More' button, click it repeatedly until no more events load. "
            "If it is an infinite scroll page, scroll to the bottom 3 times. "
            "Finally, output 'Done'."
        )

        start = time.monotonic()
        agent = Agent(task=prompt, llm=llm)
        
        # We would ideally keep the browser open and grab the HTML, 
        # but for this pipeline, we will extract the text/DOM from the agent's final state.
        history = await agent.run()
        
        # Extract the final DOM state as a string (browser-use keeps a DOM tree)
        if history.is_successful() and history.history and history.history[-1].state:
            content = str(history.history[-1].state.dom_items)
        else:
            content = "<html>No content retrieved by browser-use</html>"
            
        elapsed = (time.monotonic() - start) * 1000

        return FetchResult(
            url=url,
            status_code=200,
            content=content,
            content_type="text/html",
            strategy_used=SiteStrategy.INTERACTIVE,
            proxy_tier_used=profile.proxy_tier,
            elapsed_ms=elapsed,
            is_blocked=False,
        )


# ---------------------------------------------------------------------------
# Fetcher factory
# ---------------------------------------------------------------------------

def get_fetcher(strategy: SiteStrategy, proxy_manager: Optional[ProxyManager] = None) -> BaseFetcher:
    """Factory function to get the right fetcher for a given strategy."""
    fetchers = {
        SiteStrategy.RAW_HTTP: RawHTTPFetcher,
        SiteStrategy.HEADLESS: HeadlessFetcher,
        SiteStrategy.API_INTERCEPT: APIFetcher,
        SiteStrategy.INTERACTIVE: InteractiveFetcher,
        SiteStrategy.FIRECRAWL: FirecrawlFetcher,
        SiteStrategy.AIRTOP: AirtopFetcher,
    }
    fetcher_cls = fetchers[strategy]
    return fetcher_cls(proxy_manager=proxy_manager)
