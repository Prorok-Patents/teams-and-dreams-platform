"""
Deep Extractor Module ("The Reader").

Once we "hop" to an external event URL, this module parses the 
unstructured HTML using Crawl4AI and Gemini (via Instructor) to extract 
precise details (exact times, exact venue location, coordinates) that 
were missing from the main federation list.
"""

import logging
import os
from typing import Optional

from pydantic import BaseModel, Field

from ..models import GeoPoint, ScrapedEvent, Venue
from ..core.fetcher import get_fetcher, FetchResult
from ..models import SiteProfile, SiteStrategy, ProxyTier

logger = logging.getLogger(__name__)

class DeepExtractionResult(BaseModel):
    """The precise data we want to extract from the external site."""
    exact_start_time: Optional[str] = Field(description="ISO 8601 string or HH:MM string if date is known")
    exact_end_time: Optional[str] = Field(description="ISO 8601 string or HH:MM string")
    venue_name: Optional[str] = Field(description="Precise name of the club, arena, or facility")
    venue_address: Optional[str] = Field(description="Full street address if available")
    venue_city: Optional[str] = Field(description="City")
    venue_country: Optional[str] = Field(description="Country")
    latitude: Optional[float] = Field(description="Latitude if explicitly mentioned or parsable from a map link")
    longitude: Optional[float] = Field(description="Longitude if explicitly mentioned")
    description: Optional[str] = Field(description="A brief 1-2 sentence description of the event format or details")


class DeepExtractor:
    def __init__(self, proxy_manager=None, llm_provider: str = "gemini"):
        self.proxy_manager = proxy_manager
        self.llm_provider = llm_provider
        
    def _html_to_markdown(self, html: str) -> str:
        """Simplified HTML to Markdown (replace with actual Crawl4AI call in production)"""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")
            for tag in soup(["script", "style", "svg", "noscript"]):
                tag.decompose()
            return soup.get_text(separator="\n", strip=True)
        except ImportError:
            return html[:50000]

    async def extract(self, url: str, base_event: ScrapedEvent) -> ScrapedEvent:
        """
        Fetch the external URL and enrich the base_event with deep details.
        """
        logger.info(f"📖 Deep Extracting details from: {url}")
        
        # 1. Fetch the page
        # We create a dummy profile just for the fetcher to use our escalation logic if needed
        # We start with headless because external sites often have React/Vue rendering
        dummy_profile = SiteProfile(
            site_id="external_hop",
            base_url=url,
            events_url=url,
            strategy=SiteStrategy.HEADLESS,
            proxy_tier=ProxyTier.DATACENTER
        )
        
        fetcher = get_fetcher(SiteStrategy.HEADLESS, self.proxy_manager)
        fetch_result = await fetcher.fetch(url, dummy_profile)
        
        if fetch_result.is_blocked:
            logger.warning(f"Blocked while deep fetching {url}. Returning base event.")
            return base_event
            
        markdown_content = self._html_to_markdown(fetch_result.content)[:60000]
        
        # 2. Extract Data via LLM
        try:
            from ..core.llm import llm_manager
        except ImportError:
            logger.warning("Missing core LLM manager or dependencies. Cannot perform deep extraction.")
            return base_event
            
        prompt = (
            f"Event: {base_event.name}\n"
            f"Known Date: {base_event.start_date}\n\n"
            "Extract precise event details from the following markdown scraped from the official event page:\n"
            f"{markdown_content}"
        )
        
        try:
            result, usage = await llm_manager.get_structured_completion(
                messages=[{"role": "user", "content": prompt}],
                response_model=DeepExtractionResult,
                purpose="extraction"
            )
            
            # 3. Merge data into base_event
            if result.venue_name or result.venue_city:
                geo = None
                if result.latitude and result.longitude:
                    geo = GeoPoint(latitude=result.latitude, longitude=result.longitude)
                    
                base_event.venue = Venue(
                    name=result.venue_name or (base_event.venue.name if base_event.venue else "Unknown Venue"),
                    address=result.venue_address,
                    city=result.venue_city or (base_event.venue.city if base_event.venue else None),
                    country=result.venue_country or (base_event.venue.country if base_event.venue else None),
                    geo=geo
                )
                
            if result.description:
                base_event.description = result.description
                
            logger.info(f"✅ Deep extraction successful for {base_event.name}")
            
        except Exception as e:
            logger.error(f"Deep extraction LLM call failed: {e}")
            
        return base_event
