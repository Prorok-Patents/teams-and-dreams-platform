"""
Pydantic data models for the scraping pipeline.

These models define the canonical schema that ALL scraped data must conform to,
regardless of the source site. The self-healing LLM and deterministic parsers
both target these models.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SportSlug(str, Enum):
    """Canonical sport identifiers. Expand as we add sports."""
    CURLING = "curling"
    ORIENTEERING = "orienteering"
    # Future expansions:
    # HOCKEY = "hockey"
    # BASKETBALL = "basketball"
    # PICKLEBALL = "pickleball"


class EventLevel(str, Enum):
    """Competitive tier of the event."""
    PROFESSIONAL = "professional"
    SEMI_PRO = "semi-pro"
    COLLEGE = "college"
    AMATEUR = "amateur"
    YOUTH = "youth"
    INTERNATIONAL = "international"
    OLYMPIC = "olympic"
    PARALYMPIC = "paralympic"


class EventStatus(str, Enum):
    """Current state of the event."""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class SiteStrategy(str, Enum):
    """How should the scraper approach this site?"""
    RAW_HTTP = "raw_http"           # Simple httpx GET — fastest & cheapest
    HEADLESS = "headless"           # Playwright render — for JS-heavy sites
    API_INTERCEPT = "api_intercept" # Sniff XHR/Fetch calls for hidden JSON APIs
    INTERACTIVE = "interactive"     # Autonomous browser-use (LLM guided)
    FIRECRAWL = "firecrawl"         # Cloudflare bypass + Markdown API
    AIRTOP = "airtop"

class ProxyTier(str, Enum):
    """Proxy escalation levels, cheapest first."""
    NONE = "none"                   # Direct connection (dev/test only)
    DATACENTER = "datacenter"       # Cheap, fast, easily blocked
    RESIDENTIAL = "residential"     # Smartproxy residential pool
    MOBILE = "mobile"               # Smartproxy mobile pool — hardest to detect


# ---------------------------------------------------------------------------
# Core Data Models
# ---------------------------------------------------------------------------

class GeoPoint(BaseModel):
    """Geographic coordinates for a venue."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class Venue(BaseModel):
    """A physical location where events take place."""
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None  # state / province / county
    country: Optional[str] = None
    geo: Optional[GeoPoint] = None  # Populated by geocoding step


class ScrapedEvent(BaseModel):
    """
    The canonical event model that every scraper must produce.

    This is the "contract" between the scraper and the backend.
    The self-healing LLM will be given this schema as a JSON target.
    """
    # Identity
    source_url: HttpUrl
    source_site: str  # e.g. "worldcurling.org"

    # Event details
    name: str
    sport: SportSlug = SportSlug.CURLING
    event_type: Optional[str] = None
    level: Optional[EventLevel] = None
    status: EventStatus = EventStatus.SCHEDULED

    # Timing
    start_date: datetime
    end_date: Optional[datetime] = None

    # Location
    venue: Optional[Venue] = None

    # Metadata
    description: Optional[str] = None
    organizer: Optional[str] = None
    tags: list[str] = Field(default_factory=list)

    # Scrape metadata
    scraped_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Event name cannot be empty")
        return v.strip()

    def content_hash(self) -> str:
        """
        Generate a deterministic hash of the event's core content.
        Used for deduplication — if the hash matches yesterday's run,
        we skip the database write.
        """
        payload = {
            "name": self.name,
            "source_url": str(self.source_url),
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "venue_name": self.venue.name if self.venue else None,
            "venue_city": self.venue.city if self.venue else None,
        }
        raw = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Site Profile — configuration for each target website
# ---------------------------------------------------------------------------

class DepthConfig(BaseModel):
    """
    Dynamic scrape depth & traversal rules for a site profile.
    """
    max_depth: int = Field(default=1, ge=0, description="Maximum crawl/hop depth. 0=list page only, 1=list+detail page, 2+=multi-hub traversal")
    max_pages_per_run: int = Field(default=30, ge=1, description="Hard cap on total HTTP/browser requests per site run across all hops")
    follow_url_patterns: list[str] = Field(default_factory=list, description="Regex/substring patterns for URLs allowed for deep extraction")
    exclude_url_patterns: list[str] = Field(default_factory=list, description="Regex/substring patterns for URLs explicitly blocked from deep extraction")
    skip_deep_if_fields_present: list[str] = Field(
        default_factory=lambda: ["venue_address", "start_date"],
        description="Skip deep extraction hop if the initial listing already extracted these essential fields"
    )
    adaptive_depth: bool = Field(default=True, description="Dynamically downgrade depth if event data is already comprehensive or cached")


class SelectorSet(BaseModel):
    """
    Deterministic selectors for a specific site.
    Generated by the LLM Healer and stored in the profile registry.
    """
    event_container: Optional[str] = None   # CSS selector for the list of events
    event_name: Optional[str] = None        # CSS selector for event title
    event_date: Optional[str] = None        # CSS selector for date string
    event_location: Optional[str] = None    # CSS selector for venue/location
    event_link: Optional[str] = None        # CSS selector for detail page URL
    pagination_next: Optional[str] = None   # CSS selector for "next page" button


class SiteProfile(BaseModel):
    """
    Configuration for a single target website.
    Stored as JSON in the profiles/ directory.
    """
    # Identity
    site_id: str                            # Unique slug, e.g. "worldcurling_org"
    base_url: HttpUrl
    events_url: HttpUrl                     # The page/endpoint to scrape

    # Strategy
    strategy: SiteStrategy = SiteStrategy.RAW_HTTP
    proxy_tier: ProxyTier = ProxyTier.DATACENTER
    requires_javascript: bool = False
    requires_interaction: bool = False

    # Rate limiting & Scrape Depth
    request_delay_min: float = 1.0          # Minimum seconds between requests
    request_delay_max: float = 3.0          # Maximum seconds (jitter)
    respect_robots_txt: bool = True
    depth_config: DepthConfig = Field(default_factory=DepthConfig)

    # Extraction
    selectors: Optional[SelectorSet] = None
    api_endpoint: Optional[HttpUrl] = None  # If strategy == API_INTERCEPT

    # Healing
    last_successful_scrape: Optional[datetime] = None
    consecutive_failures: int = 0
    last_healed_at: Optional[datetime] = None

    # Metadata & Discovery
    sport: SportSlug = SportSlug.CURLING
    notes: Optional[str] = None
    
    # Newly added fields for the Discovery Pipeline
    org_id: Optional[str] = None            # UUID of the Organization in the KG
    competition_id: Optional[str] = None    # UUID of the Competition in the KG
    site_type: Optional[str] = None         # "governing_body", "league", "tournament"
    has_direct_events: Optional[bool] = None# True if events are listed directly on this site
    delegates_to: list[str] = Field(default_factory=list) # Links to sub-organizations or leagues

