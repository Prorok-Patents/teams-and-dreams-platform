"""
Site Mapper v2 — Analyzes official websites using REAL crawled HTML.

Instead of guessing from Serper search snippets, we:
1. Actually crawl the site (homepage, events page, members page)
2. Feed the real HTML to Gemini for structured extraction
3. Discover member orgs, events pages, and relationships from actual content
"""

import json
import logging
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from scraper.discovery.config import settings
from scraper.discovery.site_crawler import SiteCrawler, CrawledPage

logger = logging.getLogger(__name__)

async def generate_content_with_fallback(client, model, prompt, mime_type="application/json") -> str:
    import os
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type=mime_type,
                temperature=0.1
            ),
        )
        return response.text
    except Exception as e:
        api_key = os.getenv("OPENROUTER_API_KEY")
        if api_key:
            logging.getLogger(__name__).warning(f"Native Gemini call failed: {e}. Falling back to OpenRouter...")
            try:
                import openai
                or_client = openai.OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=api_key
                )
                or_model = model
                if "/" not in or_model:
                    if "gemini-3.5" in or_model or "gemini-2.5" in or_model or "gemini-flash" in or_model:
                        or_model = "google/gemini-2.5-flash"
                    elif "gemini-2.0-flash-lite" in or_model:
                        or_model = "google/gemini-2.0-flash-lite"
                    else:
                        or_model = f"google/{or_model}"
                
                response = or_client.chat.completions.create(
                    model=or_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"} if mime_type == "application/json" else None,
                    max_tokens=4000,
                    temperature=0.1
                )
                return response.choices[0].message.content
            except Exception as or_err:
                logging.getLogger(__name__).error(f"OpenRouter fallback failed: {or_err}")
        raise e



class DiscoveredEventSource(BaseModel):
    """A concrete URL where events are listed, discovered from the actual site."""
    url: str
    page_title: Optional[str] = ""
    description: Optional[str] = ""
    event_format: Optional[str] = ""  # "calendar", "list", "table", "api_json"


class DiscoveredMemberOrg(BaseModel):
    """A member organization discovered from parsing a real 'members' page."""
    name: str
    acronym: Optional[str] = ""
    country: Optional[str] = ""
    website_url: Optional[str] = ""
    relationship_type: Optional[str] = "membership"  # From the RelationshipType enum


class PageTypeNode(BaseModel):
    """A specific type of page discovered on the site."""
    id: str
    type: str = Field(description="e.g. homepage, events_listing, event_detail, members, blog, results, about, tournaments, standings, media, other")
    label: str
    url_pattern: str
    example_url: str
    description: str
    status: str = "discovered"
    is_scrapeable: bool


class PageFlow(BaseModel):
    """Navigation flow from one page type to another."""
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    link_text: str



class SiteIntelligenceReport(BaseModel):
    """
    LLM analysis of a website based on its REAL HTML content.
    Everything here is sourced from an official site, not from LLM guesses.
    """
    site_type: str = Field(
        description="One of: governing_body, league, tournament_organizer, "
                    "national_federation, club, promoter, news, other"
    )
    has_direct_events: bool = Field(
        description="True if the site directly lists scheduled sporting events "
                    "that we can scrape."
    )
    event_sources: List[DiscoveredEventSource] = Field(
        default_factory=list,
        description="Concrete URLs where events are listed on this site."
    )
    member_organizations: List[DiscoveredMemberOrg] = Field(
        default_factory=list,
        description="Member orgs/federations discovered from the site's own pages."
    )
    delegated_competitions: List[str] = Field(
        default_factory=list,
        description="Names of competitions that this org delegates to member bodies."
    )
    summary: str = Field(
        description="Brief summary of the site's role in the sport."
    )
    page_types: List[PageTypeNode] = Field(
        default_factory=list,
        description="The structural map of page types on this site."
    )
    page_flows: List[PageFlow] = Field(
        default_factory=list,
        description="Navigation pathways between the page types."
    )


class SiteMapper:
    """
    Analyzes an official website by actually crawling it and feeding
    real HTML to Gemini. Produces verifiable, source-backed intelligence.
    """

    def __init__(self, use_playwright: bool = False):
        self.crawler = SiteCrawler(use_playwright=use_playwright)
        self.client = genai.Client(api_key=settings.google_api_key)
        self.model = settings.model_name

    async def map_site(
        self, org_name: str, base_url: str, sport_name: str
    ) -> Optional[SiteIntelligenceReport]:
        """
        Crawl the official site and analyze its real content.
        """
        logger.info(f"Mapping site {base_url} for {org_name} ({sport_name})")

        # 1. Crawl the site and discover key pages
        pages = await self.crawler.discover_site_pages(base_url)
        if not pages:
            logger.warning(f"Could not crawl any pages from {base_url}")
            return None

        # 2. Build context from real HTML
        context_parts = []

        # Homepage context
        if "homepage" in pages:
            hp = pages["homepage"]
            context_parts.append(
                f"=== HOMEPAGE ({hp.final_url}) ===\n"
                f"Title: {hp.title}\n"
                f"Navigation links found: {len(hp.links)}\n"
                f"Sample navigation links:\n"
                + "\n".join(
                    f"  - [{l['text']}]({l['href']})"
                    for l in hp.links[:30]
                )
            )

        # Events page context — include more detail here
        if "events" in pages:
            ep = pages["events"]
            # Truncate HTML but keep enough for the LLM to see structure
            html_excerpt = self._extract_meaningful_html(ep.html, max_chars=15000)
            context_parts.append(
                f"\n=== EVENTS PAGE ({ep.final_url}) ===\n"
                f"Title: {ep.title}\n"
                f"HTML excerpt:\n{html_excerpt}"
            )

        # Members page context — this is where relationships live
        if "members" in pages:
            mp = pages["members"]
            html_excerpt = self._extract_meaningful_html(mp.html, max_chars=15000)
            context_parts.append(
                f"\n=== MEMBERS/FEDERATIONS PAGE ({mp.final_url}) ===\n"
                f"Title: {mp.title}\n"
                f"HTML excerpt:\n{html_excerpt}"
            )

        # About page for structural context
        if "about" in pages:
            ap = pages["about"]
            html_excerpt = self._extract_meaningful_html(ap.html, max_chars=5000)
            context_parts.append(
                f"\n=== ABOUT PAGE ({ap.final_url}) ===\n"
                f"Title: {ap.title}\n"
                f"Content excerpt:\n{html_excerpt}"
            )

        context = "\n\n".join(context_parts)

        # 3. Ask Gemini to analyze the REAL content
        prompt = f"""You are analyzing the official website for "{org_name}" in {sport_name}.
You have been given REAL HTML content crawled from their actual website.

Your job:
1. Determine what type of organization this is (governing_body, continental_confederation, league, etc.)
2. Identify if the site directly lists sporting events we can scrape
3. Find the EXACT URLs where events/schedules/calendars are listed
4. If there is a members/federations page, extract EVERY member organization listed:
   - Their name, acronym, country, and website URL (if linked)
   - The relationship type (membership, affiliation, etc.)
5. Note any competitions that are delegated to member organizations
6. Build a structural map of the site. Identify all major `page_types` (like events_listing, members, homepage, results) and how they link to each other (`page_flows`).
   - For `is_scrapeable`, set true if the page contains a structured list or table of data (like events or results).

CRITICAL: Only report what you can see in the actual HTML. Do NOT guess or infer
organizations that are not explicitly mentioned on the site.

Crawled Content:
{context}
"""

        prompt += """\n\nReturn the result strictly as a JSON object adhering to this structure:
{
  "site_type": "string",
  "has_direct_events": true,
  "event_sources": [{"url": "string", "page_title": "string", "description": "string", "event_format": "string"}],
  "member_organizations": [{"name": "string", "acronym": "string", "country": "string", "website_url": "string", "relationship_type": "string"}],
  "delegated_competitions": ["string"],
  "summary": "string",
  "page_types": [{"id": "string", "type": "string", "label": "string", "url_pattern": "string", "example_url": "string", "description": "string", "status": "discovered", "is_scrapeable": true}],
  "page_flows": [{"from": "string", "to": "string", "link_text": "string"}]
}"""
        import asyncio
        response = None
        for attempt in range(6):
            try:
                response_text = await generate_content_with_fallback(
                    client=self.client,
                    model=self.model,
                    prompt=prompt,
                    mime_type="application/json"
                )
                break
            except Exception as e:
                if attempt == 5:
                    raise
                sleep_time = 10 * (attempt + 1)
                logger.warning(f"Gemini API call failed (attempt {attempt + 1}/6) with error: {e}. Retrying in {sleep_time}s...")
                await asyncio.sleep(sleep_time)

        try:
            report_data = json.loads(response_text)
            report = SiteIntelligenceReport(**report_data)
            logger.info(
                f"Site intelligence for {org_name}: type={report.site_type}, "
                f"events={report.has_direct_events}, "
                f"members={len(report.member_organizations)}, "
                f"event_sources={len(report.event_sources)}"
            )
            return report
        except Exception as e:
            logger.error(f"Failed to parse site intelligence for {base_url}: {e}. Raw response was:\n{response_text}")
            return None

    def _extract_meaningful_html(self, html: str, max_chars: int = 10000) -> str:
        """
        Strip scripts, styles, and noise from HTML to keep the
        meaningful content within token limits.
        """
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Remove noise
        for tag in soup.find_all(["script", "style", "noscript", "svg", "iframe"]):
            tag.decompose()

        # Get text with basic structure preserved
        text = soup.get_text(separator="\n", strip=True)

        # Cap length
        if len(text) > max_chars:
            text = text[:max_chars] + "\n... [truncated]"

        return text
