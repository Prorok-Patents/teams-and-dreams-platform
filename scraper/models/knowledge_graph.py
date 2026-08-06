"""
Pydantic models for the Sports Knowledge Graph.

These models define the intermediate representation of entities discovered
during the intelligence gathering phase, before they are flushed to the DB.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, Dict
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl

# ---------------------------------------------------------------------------
# Enums (Mapped to DB Enums)
# ---------------------------------------------------------------------------

class OrgType(str, Enum):
    GOVERNING_BODY = "governing_body"
    CONTINENTAL_CONFEDERATION = "continental_confederation"
    NATIONAL_FEDERATION = "national_federation"
    LEAGUE_OPERATOR = "league_operator"
    TOURNAMENT_ORGANIZER = "tournament_organizer"
    CLUB = "club"
    ATHLETIC_COMMISSION = "athletic_commission"
    PROMOTER = "promoter"
    SANCTIONING_BODY = "sanctioning_body"
    GAME_PUBLISHER = "game_publisher"
    OTHER = "other"

class OrgScope(str, Enum):
    GLOBAL = "global"
    CONTINENTAL = "continental"
    NATIONAL = "national"
    REGIONAL = "regional"
    LOCAL = "local"

class RelationshipType(str, Enum):
    MEMBERSHIP = "membership"
    SANCTIONING = "sanctioning"
    LICENSING = "licensing"
    AFFILIATION = "affiliation"
    PARTNERSHIP = "partnership"
    OWNERSHIP = "ownership"
    CO_SANCTIONING = "co_sanctioning"
    COMPETITION_RIVALRY = "competition_rivalry"
    REGULATORY_OVERSIGHT = "regulatory_oversight"
    DELEGATION = "delegation"

class CompetitionType(str, Enum):
    LEAGUE = "league"
    KNOCKOUT_TOURNAMENT = "knockout_tournament"
    HYBRID_LEAGUE_PLAYOFF = "hybrid_league_playoff"
    CIRCUIT_TOUR = "circuit_tour"
    MULTI_SPORT_EVENT = "multi_sport_event"
    STAGE_RACE = "stage_race"
    EXHIBITION = "exhibition"
    CHALLENGE_SERIES = "challenge_series"

class SportCategory(str, Enum):
    TEAM = "team"
    INDIVIDUAL = "individual"
    COMBAT = "combat"
    MOTORSPORT = "motorsport"
    ESPORTS = "esports"
    RACQUET = "racquet"
    AQUATIC = "aquatic"
    WINTER = "winter"
    ATHLETICS = "athletics"
    CYCLING = "cycling"
    EQUESTRIAN = "equestrian"
    OTHER = "other"

class EventType(str, Enum):
    MATCH = "match"
    RACE = "race"
    FIGHT_CARD = "fight_card"
    STAGE = "stage"
    SESSION = "session"
    CEREMONY = "ceremony"
    ROUND = "round"
    BOUT = "bout"
    TOURNAMENT = "tournament" # Often used for weekend events

# ---------------------------------------------------------------------------
# Core Entity Models
# ---------------------------------------------------------------------------

class Sport(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    slug: str
    category: SportCategory
    wikipedia_url: Optional[HttpUrl] = None
    icon: Optional[str] = None
    glossary: Dict[str, str] = Field(default_factory=dict)
    
class Organization(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    acronym: Optional[str] = None
    slug: str
    org_type: OrgType
    scope: OrgScope
    sport_id: Optional[UUID] = None
    country: Optional[str] = None
    website_url: Optional[HttpUrl] = None
    wikipedia_url: Optional[HttpUrl] = None
    metadata: Dict = Field(default_factory=dict)

class OrgRelationship(BaseModel):
    parent_org_id: UUID
    child_org_id: UUID
    relationship_type: RelationshipType
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str = "active"

class Competition(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    name: str
    sport_id: UUID
    organizer_id: Optional[UUID] = None
    competition_type: CompetitionType
    tier_level: int = 1
    gender: Optional[str] = None
    age_group: Optional[str] = None
    format: Optional[str] = None
    website_url: Optional[HttpUrl] = None

class Season(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    competition_id: UUID
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str = "scheduled"

# Re-exporting from existing models to keep imports clean later, or
# these would replace the basic ones. We will adapt the existing ScrapedEvent
# to link to these.
