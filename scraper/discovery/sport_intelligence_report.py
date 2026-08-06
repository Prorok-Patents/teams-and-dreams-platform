from typing import List, Optional
from pydantic import BaseModel, Field

class GlossaryEntry(BaseModel):
    model_config = {"extra": "forbid"}
    term: str
    definition: str

class OrgMention(BaseModel):
    model_config = {"extra": "forbid"}
    name: str
    acronym: Optional[str] = None
    role_description: str
    inferred_type: str # From OrgType enum
    inferred_scope: str # From OrgScope enum
    website_url: Optional[str] = None
    wikipedia_url: Optional[str] = None

class CompetitionMention(BaseModel):
    model_config = {"extra": "forbid"}
    name: str
    competition_type: str # From CompetitionType enum
    organizer_name: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None

class SportIntelligenceReport(BaseModel):
    """
    The output of the deep-research phase for a given sport.
    This serves as the foundational knowledge base before we start
    crawling specific websites.
    """
    model_config = {"extra": "forbid"}
    sport_name: str
    sport_category: str
    
    # A list of sport-specific terms (e.g., "Grand Slam", "PGA", "Bonspiel") 
    # and their general meanings to help the scraper.
    glossary: List[GlossaryEntry] = Field(default_factory=list)
    
    # Orgs discovered during research (Global, Continental, National, etc.)
    organizations: List[OrgMention] = Field(default_factory=list)
    
    # Major competitions discovered during research
    competitions: List[CompetitionMention] = Field(default_factory=list)
    
    # A list of key URLs that the LLM identified as official sources
    official_websites: List[str] = Field(default_factory=list)
    
    # Any structural notes (e.g., "Boxing has 4 major sanctioning bodies that do not organize events directly")
    structural_notes: str = ""
