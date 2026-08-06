"""
LLM-based self-healing module.

This module implements the Two-Pass Healer Pipeline:
1. Pass 1: Extract data from Markdown to save tokens.
2. Pass 2: Generate CSS selectors from minified HTML snippet.

It also detects if a site requires browser interaction (e.g., infinite scroll).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from ..models import ScrapedEvent, SelectorSet, SiteProfile

logger = logging.getLogger(__name__)

class SelfHealingResult:
    """Result from a self-healing operation."""

    def __init__(
        self,
        events: list[dict],
        selectors: Optional[SelectorSet],
        confidence: float,
        notes: str,
        requires_interaction: bool = False,
    ):
        self.events = events
        self.selectors = selectors
        self.confidence = confidence
        self.notes = notes
        self.requires_interaction = requires_interaction

    @property
    def is_successful(self) -> bool:
        return self.confidence >= 0.5 and len(self.events) > 0 and self.selectors is not None


class ExtractionTarget(BaseModel):
    events: list[dict] = Field(description="List of extracted events matching the schema")
    requires_interaction: bool = Field(
        description="True if events are hidden behind a 'Load More' button, infinite scroll, or cookie gate."
    )
    notes: str


class SelectorTarget(BaseModel):
    selectors: SelectorSet
    confidence: float = Field(description="Confidence from 0.0 to 1.0 in these selectors")


class LLMHealer:
    def __init__(self, llm_provider: str = "gemini"):
        self.llm_provider = llm_provider
        logger.info(f"LLM Healer initialized with provider: {llm_provider}")

    def _html_to_markdown(self, html: str) -> str:
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")
            for tag in soup(["script", "style", "svg", "noscript"]):
                tag.decompose()
            return soup.get_text(separator="\n", strip=True)
        except ImportError:
            return html[:50000]
            
    def _minify_html(self, html: str) -> str:
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "lxml")
            for tag in soup(["script", "style", "svg", "noscript", "meta", "link"]):
                tag.decompose()
            for tag in soup.find_all(True):
                attrs_to_keep = {}
                for attr in ['class', 'id', 'href']:
                    if attr in tag.attrs:
                        attrs_to_keep[attr] = tag.attrs[attr]
                tag.attrs = attrs_to_keep
            return str(soup)
        except ImportError:
            return html[:50000]

    async def heal(self, html: str, profile: SiteProfile) -> SelfHealingResult:
        logger.info(f"🔧 Self-healing triggered for site: {profile.site_id}")

        try:
            from ..core.llm import llm_manager
        except ImportError as e:
            logger.error(f"Missing core LLM manager or dependencies: {e}")
            return SelfHealingResult(events=[], selectors=None, confidence=0.0, notes="Dependencies missing")

        # PASS 1: Extract Data & Detect Interaction
        logger.info("Pass 1: Extracting events from Markdown...")
        markdown_content = self._html_to_markdown(html)[:50000]
        
        prompt1 = (
            f"Site: {profile.site_id}\nSport: {profile.sport.value}\n"
            "Extract all events from this markdown text into the required schema. "
            "If you cannot find events, look closely for text indicating a 'Load More' button, "
            "search form, or cookie wall. If you find such barriers, set requires_interaction to true.\n\n"
            f"{markdown_content}"
        )
        
        try:
            pass1_result, pass1_usage = await llm_manager.get_structured_completion(
                messages=[{"role": "user", "content": prompt1}],
                response_model=ExtractionTarget,
                purpose="extraction"
            )
        except Exception as e:
            logger.error(f"Pass 1 failed: {e}")
            return SelfHealingResult(events=[], selectors=None, confidence=0.0, notes=str(e))
            
        if pass1_result.requires_interaction or not pass1_result.events:
            logger.info("Interaction barrier detected or no events found.")
            return SelfHealingResult(
                events=[], 
                selectors=None, 
                confidence=0.0, 
                notes=pass1_result.notes,
                requires_interaction=pass1_result.requires_interaction
            )

        # PASS 2: Generate Selectors
        logger.info("Pass 2: Generating selectors from minified HTML...")
        minified_html = self._minify_html(html)[:50000]
        first_event = pass1_result.events[0]
        
        prompt2 = (
            "Here is the first event we extracted:\n"
            f"{json.dumps(first_event, indent=2)}\n\n"
            "Here is the minified HTML of the page. Generate robust CSS selectors that would extract "
            "this event (and others like it) deterministically.\n\n"
            f"{minified_html}"
        )
        
        try:
            pass2_result, pass2_usage = await llm_manager.get_structured_completion(
                messages=[{"role": "user", "content": prompt2}],
                response_model=SelectorTarget,
                purpose="selectors"
            )
        except Exception as e:
            logger.error(f"Pass 2 failed: {e}")
            return SelfHealingResult(
                events=pass1_result.events, 
                selectors=None, 
                confidence=0.0, 
                notes=str(e)
            )
            
        logger.info(f"✅ Self-healing successful! Extracted {len(pass1_result.events)} events. Model used: {pass2_usage['model_used']}")
        
        result = SelfHealingResult(
            events=pass1_result.events,
            selectors=pass2_result.selectors,
            confidence=pass2_result.confidence,
            notes=pass1_result.notes
        )
        result.prompt_tokens = pass1_usage["prompt_tokens"] + pass2_usage["prompt_tokens"]
        result.completion_tokens = pass1_usage["completion_tokens"] + pass2_usage["completion_tokens"]
        result.cost_usd = pass1_usage["cost_usd"] + pass2_usage["cost_usd"]
        
        return result
