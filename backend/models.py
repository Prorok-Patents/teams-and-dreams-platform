import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_mixin
from geoalchemy2 import Geometry
from database import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

@declarative_mixin
class TimestampMixin:
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class Sport(Base, TimestampMixin):
    __tablename__ = "sports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    category = Column(String, nullable=False)
    wikipedia_url = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    glossary = Column(JSONB, default=dict)
    
    organizations = relationship("Organization", back_populates="sport", cascade="all, delete-orphan")
    competitions = relationship("Competition", back_populates="sport", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="sport", cascade="all, delete-orphan")

class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    acronym = Column(String, nullable=True)
    slug = Column(String, nullable=False, unique=True, index=True)
    org_type = Column(String, nullable=False, index=True)
    scope = Column(String, nullable=False)
    sport_id = Column(UUID(as_uuid=True), ForeignKey("sports.id"), nullable=True, index=True)
    country = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    wikipedia_url = Column(String, nullable=True)
    metadata_json = Column(JSONB, default=dict)

    sport = relationship("Sport", back_populates="organizations")
    
    # We will query org_relationships via explicit joins/CTEs for graph traversals, 
    # but we can set up basic relationship links
    competitions_organized = relationship("Competition", back_populates="organizer", cascade="all, delete-orphan")

class OrgRelationship(Base, TimestampMixin):
    __tablename__ = "org_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    child_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    relationship_type = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="active")
    
    parent_org = relationship("Organization", foreign_keys=[parent_org_id])
    child_org = relationship("Organization", foreign_keys=[child_org_id])

class Competition(Base, TimestampMixin):
    __tablename__ = "competitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    sport_id = Column(UUID(as_uuid=True), ForeignKey("sports.id"), nullable=False, index=True)
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    competition_type = Column(String, nullable=False)
    tier_level = Column(Integer, default=1)
    gender = Column(String, nullable=True)
    age_group = Column(String, nullable=True)
    format = Column(String, nullable=True)
    website_url = Column(String, nullable=True)

    sport = relationship("Sport", back_populates="competitions")
    organizer = relationship("Organization", back_populates="competitions_organized")
    seasons = relationship("Season", back_populates="competition", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="competition", cascade="all, delete-orphan")
    sanctioners = relationship("CompetitionSanctioner", back_populates="competition", cascade="all, delete-orphan")

class CompetitionSanctioner(Base, TimestampMixin):
    __tablename__ = "competition_sanctioners"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    competition_id = Column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    role = Column(String, nullable=True)

    competition = relationship("Competition", back_populates="sanctioners")
    organization = relationship("Organization")

class Season(Base, TimestampMixin):
    __tablename__ = "seasons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    competition_id = Column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=True, index=True)
    end_date = Column(DateTime, nullable=True, index=True)
    status = Column(String, nullable=False, default="scheduled")
    
    competition = relationship("Competition", back_populates="seasons")
    events = relationship("Event", back_populates="season", cascade="all, delete-orphan")

class Venue(Base, TimestampMixin):
    __tablename__ = "venues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    region = Column(String, nullable=True)
    country = Column(String, nullable=True)
    venue_type = Column(String, nullable=True)
    capacity = Column(Integer, nullable=True)
    
    # Store latitude/longitude as a geographic point (SRID=4326 is standard WGS84 GPS)
    geom = Column(Geometry(geometry_type='POINT', srid=4326, spatial_index=True), nullable=True)
    geocoded_at = Column(DateTime, nullable=True)

    events = relationship("Event", back_populates="venue", cascade="all, delete-orphan")

class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    
    sport_id = Column(UUID(as_uuid=True), ForeignKey("sports.id"), nullable=True, index=True)
    competition_id = Column(UUID(as_uuid=True), ForeignKey("competitions.id"), nullable=True, index=True)
    season_id = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=True, index=True)
    venue_id = Column(UUID(as_uuid=True), ForeignKey("venues.id"), nullable=True, index=True)
    
    # We keep string 'sport' for backwards compatibility with raw scraped events before linking
    sport_name_raw = Column(String, nullable=True) 
    event_type = Column(String, nullable=True)
    level = Column(String, nullable=True)
    description = Column(String, nullable=True)
    organizer_raw = Column(String, nullable=True)
    tags = Column(JSONB, default=list)
    status = Column(String, nullable=True)
    
    start_date = Column(DateTime, nullable=True, index=True)
    end_date = Column(DateTime, nullable=True, index=True)
    
    source_site = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    scraped_at = Column(DateTime, default=utc_now)

    # SHA-256 hash of core event content for deduplication across scraper runs
    content_hash = Column(String, unique=True, nullable=True, index=True)

    extraction_confidence = Column(Float, nullable=True)
    extraction_method = Column(String, nullable=True)
    review_status = Column(String, default="pending")

    venue = relationship("Venue", back_populates="events")
    sport = relationship("Sport", back_populates="events")
    competition = relationship("Competition", back_populates="events")
    season = relationship("Season", back_populates="events")

class DiscoverySource(Base, TimestampMixin):
    __tablename__ = "discovery_sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String, nullable=False, index=True) # "organization", "competition", etc.
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    source_type = Column(String, nullable=False) # "wikipedia", "serper", "manual", "llm"
    source_url = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    verified = Column(Boolean, default=False)
    discovered_at = Column(DateTime, default=utc_now)

class ScraperRun(Base, TimestampMixin):
    __tablename__ = "scraper_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default="running") # running, success, failed
    start_time = Column(DateTime, default=utc_now)
    end_time = Column(DateTime, nullable=True)
    events_found = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    was_healed = Column(Boolean, default=False)
    healing_confidence = Column(Float, nullable=True)

class LLMUsage(Base, TimestampMixin):
    __tablename__ = "llm_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scraper_run_id = Column(UUID(as_uuid=True), ForeignKey("scraper_runs.id"), nullable=True, index=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_estimate_usd = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=utc_now)

class SiteKnowledge(Base, TimestampMixin):
    __tablename__ = "site_knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id = Column(String, nullable=False, unique=True, index=True)  # e.g. "worldcurling_org"
    base_url = Column(String, nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)

    # The page type map - JSON structure of discovered page types
    page_types = Column(JSONB, default=list)  # [{type, label, url_pattern, example_url, description, icon, status}]
    # Navigation flow between page types
    page_flows = Column(JSONB, default=list)  # [{from_type, to_type, link_text, description}]

    # Site intelligence summary
    site_type = Column(String, nullable=True)  # governing_body, league, etc.
    has_events = Column(Boolean, default=False)
    has_members = Column(Boolean, default=False)
    has_results = Column(Boolean, default=False)

    # Scraper knowledge
    strategy = Column(String, nullable=True)  # raw_http, headless, firecrawl
    proxy_tier = Column(String, nullable=True)
    selectors_json = Column(JSONB, default=dict)

    # Metadata
    discovered_at = Column(DateTime, default=utc_now)
    last_mapped_at = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)

    organization = relationship("Organization")
