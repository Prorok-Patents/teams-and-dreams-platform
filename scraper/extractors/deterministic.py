"""
Deterministic extraction engine.

Given a SiteProfile (with CSS/XPath selectors) and raw HTML,
this module extracts structured ScrapedEvent objects using fast,
cheap, deterministic parsing — no LLM needed.

When these selectors fail (site layout changed), the self-healing
module kicks in to regenerate them.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from ..models import (
    EventStatus,
    ScrapedEvent,
    SelectorSet,
    SiteProfile,
    SportSlug,
    Venue,
)

logger = logging.getLogger(__name__)


class ExtractionError(Exception):
    """Raised when deterministic extraction fails — triggers self-healing."""
    pass


class DeterministicExtractor:
    """
    Extracts events from HTML using CSS selectors defined in a SiteProfile.

    If extraction fails (no events found, or structural validation fails),
    raises ExtractionError to trigger the LLM Healer.
    """

    def __init__(self, profile: SiteProfile):
        self.profile = profile
        self.selectors = profile.selectors

    def extract(self, html: str) -> list[ScrapedEvent]:
        """
        Extract events from raw HTML using the profile's selectors.

        Raises ExtractionError if:
          - No selectors are configured
          - No event containers are found
          - Zero events are successfully parsed
        """
        if not self.selectors:
            raise ExtractionError(
                f"No selectors configured for site '{self.profile.site_id}'. "
                "LLM Healer must generate initial selectors."
            )

        soup = BeautifulSoup(html, "html.parser")

        # Find all event containers
        if not self.selectors.event_container:
            raise ExtractionError("No event_container selector defined.")

        containers = soup.select(self.selectors.event_container)
        if not containers:
            raise ExtractionError(
                f"No elements found for selector '{self.selectors.event_container}' "
                f"on site '{self.profile.site_id}'. Site layout may have changed."
            )

        events: list[ScrapedEvent] = []
        parse_errors = 0

        for container in containers:
            try:
                event = self._parse_container(container)
                if event:
                    events.append(event)
            except Exception as e:
                parse_errors += 1
                logger.debug(f"Failed to parse event container: {e}")

        if not events:
            raise ExtractionError(
                f"Found {len(containers)} containers but extracted 0 events "
                f"({parse_errors} parse errors). Selectors are likely stale."
            )

        logger.info(
            f"Extracted {len(events)} events from {self.profile.site_id} "
            f"({parse_errors} parse errors)"
        )
        return events

    def _parse_container(self, container: Tag) -> Optional[ScrapedEvent]:
        """Parse a single event container element into a ScrapedEvent."""

        # Extract event name
        name = self._select_text(container, self.selectors.event_name)
        if not name:
            return None

        # Extract date string and parse it
        date_str = self._select_text(container, self.selectors.event_date)
        start_date = self._parse_date(date_str) if date_str else None
        if not start_date:
            logger.debug(f"Could not parse date '{date_str}' for event '{name}'")
            start_date = datetime.utcnow()  # Fallback — will be flagged for review

        # Extract location
        location_str = self._select_text(container, self.selectors.event_location)
        venue = self._parse_location(location_str) if location_str else None

        # Extract detail link
        link = self._select_href(container, self.selectors.event_link)
        source_url = urljoin(str(self.profile.base_url), link) if link else str(self.profile.events_url)

        return ScrapedEvent(
            source_url=source_url,
            source_site=self.profile.site_id,
            name=name,
            sport=self.profile.sport,
            start_date=start_date,
            venue=venue,
            status=EventStatus.SCHEDULED,
        )

    @staticmethod
    def _select_text(element: Tag, selector: Optional[str]) -> Optional[str]:
        """Extract text content from the first element matching a CSS selector."""
        if not selector:
            return None
        found = element.select_one(selector)
        if found:
            return found.get_text(strip=True)
        return None

    @staticmethod
    def _select_href(element: Tag, selector: Optional[str]) -> Optional[str]:
        """Extract href attribute from the first <a> matching a CSS selector."""
        if not selector:
            return None
        found = element.select_one(selector)
        if found and found.name == "a":
            return found.get("href")
        # If the selector points to a non-anchor, look for an <a> inside it
        if found:
            a_tag = found.find("a")
            if a_tag:
                return a_tag.get("href")
        return None

    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        """
        Attempt to parse a date string using common formats.
        Returns None if parsing fails.
        """
        # Clean up the string
        date_str = date_str.strip()
        # Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
        date_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)

        # Common date formats found on sports sites
        formats = [
            "%d %B %Y",          # 3 September 2026
            "%B %d, %Y",         # September 3, 2026
            "%d %b %Y",          # 3 Sep 2026
            "%b %d, %Y",         # Sep 3, 2026
            "%Y-%m-%d",          # 2026-09-03
            "%d/%m/%Y",          # 03/09/2026
            "%m/%d/%Y",          # 09/03/2026
            "%d-%m-%Y",          # 03-09-2026
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        # Try to extract just a date from a range like "3-6 September 2026"
        range_match = re.match(
            r'(\d{1,2})\s*[-–]\s*\d{1,2}\s+(\w+)\s+(\d{4})',
            date_str,
        )
        if range_match:
            day, month, year = range_match.groups()
            try:
                return datetime.strptime(f"{day} {month} {year}", "%d %B %Y")
            except ValueError:
                pass

        return None

    @staticmethod
    def _parse_location(location_str: str) -> Optional[Venue]:
        """
        Parse a location string into a Venue object.
        Handles formats like "City, Country" or just "City".
        """
        if not location_str:
            return None

        parts = [p.strip() for p in location_str.split(",")]

        if len(parts) >= 2:
            return Venue(
                name=location_str,
                city=parts[0],
                country=parts[-1],
            )
        else:
            return Venue(name=location_str, city=parts[0])
