"""
Event Discovery Module ("The Searcher").

When a federation site lists an event but doesn't provide a direct link to the 
event's detail page, this module uses web search (DuckDuckGo) and an LLM to 
discover the official event URL.
"""

import logging
import os
from typing import Optional
from pydantic import BaseModel, Field

from ..models import ScrapedEvent

logger = logging.getLogger(__name__)

class SearchResultEvaluation(BaseModel):
    is_official: bool = Field(description="True if this URL appears to be the official event homepage or registration page.")
    confidence: float = Field(description="Confidence from 0.0 to 1.0")
    reasoning: str = Field(description="Why this URL was chosen or rejected.")


class EventSearcher:
    def __init__(self, llm_provider: str = "gemini"):
        self.llm_provider = llm_provider
        
    async def find_event_url(self, event: ScrapedEvent) -> Optional[str]:
        """
        Attempt to find the official URL for an event using a web search.
        Returns the URL if found with high confidence, else None.
        """
        logger.info(f"🔍 Searching for missing URL for event: {event.name}")
        
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            logger.error("duckduckgo-search is not installed. Cannot perform discovery.")
            return None
            
        year = event.start_date.year if event.start_date else ""
        query = f'"{event.name}" {event.sport.value} {year} official site'
        
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
        except Exception as e:
            logger.error(f"Search failed for {event.name}: {e}")
            return None
            
        if not results:
            logger.debug(f"No search results found for: {query}")
            return None
            
        return await self._evaluate_results(event, results)

    async def _evaluate_results(self, event: ScrapedEvent, search_results: list[dict]) -> Optional[str]:
        """Use the LLM to pick the official site from the search results."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY missing. Cannot evaluate search results.")
            # Fallback: just return the first result if we have no LLM (risky)
            return None
            
        try:
            import instructor
            import google.generativeai as genai
        except ImportError:
            return None
            
        genai.configure(api_key=api_key)
        client = instructor.from_gemini(
            client=genai.GenerativeModel(model_name="gemini-2.5-flash"),
            mode=instructor.Mode.GEMINI_JSON,
        )
        
        # We evaluate the top 3 results
        for result in search_results[:3]:
            prompt = (
                f"Event Name: {event.name}\n"
                f"Sport: {event.sport.value}\n"
                f"Date: {event.start_date}\n\n"
                "We did a web search to find the OFFICIAL event website. Is the following search result the official site?\n"
                f"Title: {result.get('title')}\n"
                f"URL: {result.get('href')}\n"
                f"Snippet: {result.get('body')}\n\n"
                "Reject Wikipedia, news articles, and generic aggregator sites. We want the club site, event site, or federation registration page."
            )
            
            try:
                eval_result = client.messages.create(
                    messages=[{"role": "user", "content": prompt}],
                    response_model=SearchResultEvaluation,
                )
                
                if eval_result.is_official and eval_result.confidence > 0.7:
                    logger.info(f"✅ Found official URL: {result.get('href')} (Confidence: {eval_result.confidence:.2f})")
                    return result.get('href')
            except Exception as e:
                logger.error(f"LLM evaluation failed: {e}")
                
        logger.info("❌ Could not confidently identify an official URL from search results.")
        return None
