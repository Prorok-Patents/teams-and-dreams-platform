"""
Site Crawler — fetches real HTML from official websites using httpx or Playwright.

This replaces the old approach of inferring site structure from search snippets.
We actually visit the site and read its content, producing concrete facts instead
of LLM guesses.
"""

import logging
import asyncio
from typing import Optional, List, Dict
from dataclasses import dataclass
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

import httpx

from scraper.models import ProxyTier
from scraper.core.proxy import ProxyManager, get_random_headers

logger = logging.getLogger(__name__)


@dataclass
class CrawledPage:
    """Result of crawling a single page."""
    url: str
    final_url: str        # After redirects
    status_code: int
    html: str
    title: str
    links: List[Dict[str, str]]  # [{"href": ..., "text": ...}, ...]
    is_blocked: bool
    proxy_tier_used: ProxyTier


BLOCK_INDICATORS = [
    "captcha", "challenge-platform", "cf-browser-verification",
    "access denied", "blocked", "rate limit", "too many requests",
    "please verify you are a human", "enable javascript and cookies",
]

# Pages we want to find on every official sport org site
DISCOVERY_SLUGS = [
    "events", "calendar", "schedule", "fixtures", "competitions",
    "tournaments", "leagues", "members", "member-federations",
    "affiliated", "about", "organizations", "nations", "countries",
    "associations", "national-federations", "member-associations",
]


class SiteCrawler:
    """
    Crawls an official website to discover its real structure.
    Uses raw HTTP first, can escalate to Playwright if blocked.
    Integrates with ProxyManager for tiered IP rotation (Smartproxy).
    """

    def __init__(self, use_playwright: bool = False, proxy_manager: Optional[ProxyManager] = None):
        self.use_playwright = use_playwright
        self.proxy_manager = proxy_manager or ProxyManager()
        self.headers = get_random_headers()

    async def crawl_page(self, url: str, tier: ProxyTier = ProxyTier.DATACENTER) -> Optional[CrawledPage]:
        """Fetch a single page and extract its structure. Escalates proxy if blocked."""
        try:
            if self.use_playwright:
                result = await self._crawl_playwright(url, tier)
            else:
                result = await self._crawl_httpx(url, tier)
                
            if result and result.is_blocked and tier != ProxyTier.MOBILE:
                # Escalate to next tier and retry once
                next_tier = self.proxy_manager.escalate(tier)
                logger.info(f"Retrying crawl of {url} with escalated proxy: {next_tier.value}")
                return await self.crawl_page(url, next_tier)
                
            return result
        except Exception as e:
            logger.error(f"Failed to crawl {url} on tier {tier.value}: {e}")
            if tier != ProxyTier.MOBILE:
                next_tier = self.proxy_manager.escalate(tier)
                logger.info(f"Retrying crawl of {url} with escalated proxy due to error: {next_tier.value}")
                return await self.crawl_page(url, next_tier)
            return None

    async def _crawl_httpx(self, url: str, tier: ProxyTier) -> Optional[CrawledPage]:
        """Fetch with raw httpx."""
        proxy_url = self.proxy_manager.get_proxy(tier)
        
        async with httpx.AsyncClient(
            proxy=proxy_url,
            headers=self.headers,
            follow_redirects=True,
            timeout=30.0,
            verify=False,
        ) as client:
            response = await client.get(url)

        html = response.text
        is_blocked = self._detect_block(response.status_code, html)

        if is_blocked:
            logger.warning(f"Block detected on {url} (tier={tier.value})")

        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        links = self._extract_links(soup, str(response.url))

        return CrawledPage(
            url=url,
            final_url=str(response.url),
            status_code=response.status_code,
            html=html,
            title=title,
            links=links,
            is_blocked=is_blocked,
            proxy_tier_used=tier,
        )

    async def _crawl_playwright(self, url: str, tier: ProxyTier) -> Optional[CrawledPage]:
        """Fetch with Playwright for JS-heavy sites."""
        from playwright.async_api import async_playwright

        proxy_url = self.proxy_manager.get_proxy(tier)
        proxy_config = None
        if proxy_url:
            proxy_config = {"server": proxy_url}

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                proxy=proxy_config
            )
            page = await browser.new_page(
                user_agent=self.headers["User-Agent"],
                viewport={"width": 1920, "height": 1080},
            )
            response = await page.goto(url, wait_until="networkidle", timeout=60000)
            html = await page.content()
            final_url = page.url
            status_code = response.status if response else 0
            await browser.close()

        is_blocked = self._detect_block(status_code, html)
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        links = self._extract_links(soup, final_url)

        return CrawledPage(
            url=url,
            final_url=final_url,
            status_code=status_code,
            html=html,
            title=title,
            links=links,
            is_blocked=is_blocked,
            proxy_tier_used=tier,
        )

    async def discover_site_pages(self, base_url: str) -> Dict[str, CrawledPage]:
        """
        Crawl the homepage, then try to find key pages (events, members, etc.)
        by probing common URL slugs and following links.
        
        Returns a dict of {page_type: CrawledPage}.
        """
        discovered = {}

        # 1. Crawl the homepage
        homepage = await self.crawl_page(base_url)
        if not homepage:
            return discovered
        discovered["homepage"] = homepage

        # 2. Find candidate URLs from homepage links
        candidate_urls = {}
        for link in homepage.links:
            href_lower = link["href"].lower()
            text_lower = link["text"].lower()
            for slug in DISCOVERY_SLUGS:
                if slug in href_lower or slug in text_lower:
                    page_type = self._classify_slug(slug)
                    if page_type not in candidate_urls:
                        candidate_urls[page_type] = link["href"]

        # 3. Also probe common URL patterns directly
        parsed = urlparse(base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        for slug in DISCOVERY_SLUGS:
            page_type = self._classify_slug(slug)
            if page_type not in candidate_urls:
                candidate_urls[page_type] = f"{base}/{slug}"

        # 4. Crawl the candidates (with concurrency limit)
        sem = asyncio.Semaphore(3)

        async def crawl_with_sem(page_type: str, url: str):
            async with sem:
                await asyncio.sleep(1.0)  # Politeness delay
                result = await self.crawl_page(url)
                if result and result.status_code == 200 and not result.is_blocked:
                    discovered[page_type] = result

        tasks = [
            crawl_with_sem(ptype, url)
            for ptype, url in candidate_urls.items()
            if ptype not in discovered
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

        logger.info(
            f"Discovered {len(discovered)} pages on {base_url}: "
            f"{list(discovered.keys())}"
        )
        return discovered

    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[Dict[str, str]]:
        """Extract all <a> links with their text and resolved hrefs."""
        links = []
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            # Resolve relative URLs
            if href.startswith("/") or not href.startswith("http"):
                href = urljoin(base_url, href)
            # Skip anchors, javascript, mailto
            if href.startswith(("javascript:", "mailto:", "tel:", "#")):
                continue
            text = a_tag.get_text(strip=True)[:200]  # Cap text length
            links.append({"href": href, "text": text})
        return links

    def _classify_slug(self, slug: str) -> str:
        """Map a URL slug to a page type category."""
        if slug in ("events", "calendar", "schedule", "fixtures", "competitions", "tournaments", "leagues"):
            return "events"
        if slug in ("members", "member-federations", "affiliated", "national-federations", 
                     "member-associations", "nations", "countries", "associations", "organizations"):
            return "members"
        if slug in ("about",):
            return "about"
        return slug

    @staticmethod
    def _detect_block(status_code: int, content: str) -> bool:
        if status_code in (403, 429, 503):
            return True
        content_lower = content.lower()[:5000]
        return any(indicator in content_lower for indicator in BLOCK_INDICATORS)
