import uuid
from typing import Optional
from scraper.models.knowledge_graph import Organization, Competition
from scraper.discovery.entity_store import EntityStore
from scraper.discovery.sport_intelligence_report import OrgMention, CompetitionMention

class EntityResolver:
    """
    Standardizes entity names and attempts to resolve duplicates or 
    match LLM string mentions to canonical EntityStore objects.
    """
    
    def __init__(self, store: EntityStore):
        self.store = store
        
    def _sanitize_org_type(self, val: str) -> str:
        if not val:
            return "other"
        v = val.lower().strip()
        if "governing" in v or "global federation" in v or "world federation" in v:
            return "governing_body"
        if "continental" in v or "confederation" in v:
            return "continental_confederation"
        if "national" in v or "federation" in v or "association" in v:
            return "national_federation"
        if "league" in v:
            return "league_operator"
        if "tournament" in v or "organizer" in v:
            return "tournament_organizer"
        if "club" in v:
            return "club"
        if "commission" in v:
            return "athletic_commission"
        if "promoter" in v:
            return "promoter"
        if "sanctioning" in v:
            return "sanctioning_body"
        if "publisher" in v:
            return "game_publisher"
        
        valid = {"governing_body", "continental_confederation", "national_federation", "league_operator", "tournament_organizer", "club", "athletic_commission", "promoter", "sanctioning_body", "game_publisher", "other"}
        if v in valid:
            return v
        return "other"

    def _sanitize_scope(self, val: str) -> str:
        if not val:
            return "national"
        v = val.lower().strip()
        if "global" in v or "international" in v or "world" in v:
            return "global"
        if "continental" in v:
            return "continental"
        if "national" in v:
            return "national"
        if "regional" in v or "provincial" in v:
            return "regional"
        if "local" in v:
            return "local"
        
        valid = {"global", "continental", "national", "regional", "local"}
        if v in valid:
            return v
        return "national"

    def _sanitize_competition_type(self, val: str) -> str:
        if not val:
            return "knockout_tournament"
        v = val.lower().strip()
        if "league" in v:
            return "league"
        if "grand slam" in v or "tour" in v or "circuit" in v or "bonspiel" in v:
            return "circuit_tour"
        if "hybrid" in v or "playoff" in v:
            return "hybrid_league_playoff"
        if "knockout" in v or "tournament" in v or "championship" in v or "cup" in v:
            return "knockout_tournament"
        if "multi" in v or "olympics" in v or "games" in v:
            return "multi_sport_event"
        if "stage" in v or "race" in v:
            return "stage_race"
        if "exhibition" in v or "friendly" in v:
            return "exhibition"
        if "challenge" in v:
            return "challenge_series"
            
        valid = {"league", "knockout_tournament", "hybrid_league_playoff", "circuit_tour", "multi_sport_event", "stage_race", "exhibition", "challenge_series"}
        if v in valid:
            return v
        return "knockout_tournament"

    def _sanitize_url(self, url: Optional[str]) -> Optional[str]:
        if not url:
            return None
        u = url.strip()
        if not u or not u.startswith("http"):
            return None
        return u

    def _sanitize_relationship_type(self, val: str) -> str:
        if not val:
            return "membership"
        v = val.lower().strip().replace("-", "_").replace(" ", "_")
        
        # Simple mapping/heuristics
        if "member" in v or "membership" in v:
            return "membership"
        if "sanction" in v:
            return "sanctioning"
        if "license" in v or "licensing" in v:
            return "licensing"
        if "affiliate" in v or "affiliation" in v:
            return "affiliation"
        if "partner" in v or "partnership" in v:
            return "partnership"
        if "owner" in v or "ownership" in v:
            return "ownership"
        if "co_sanction" in v:
            return "co_sanctioning"
        if "rival" in v or "rivalry" in v:
            return "competition_rivalry"
        if "regulate" in v or "regulatory" in v or "oversight" in v:
            return "regulatory_oversight"
        if "delegate" in v or "delegation" in v:
            return "delegation"
            
        valid = {"membership", "sanctioning", "licensing", "affiliation", "partnership", "ownership", "co_sanctioning", "competition_rivalry", "regulatory_oversight", "delegation"}
        if v in valid:
            return v
        return "membership"


    def resolve_organization(self, mention: OrgMention) -> Optional[Organization]:
        """Finds or creates an organization from a mention."""
        if not mention or not mention.name:
            return None
            
        # Check if banned organization
        name_lower = mention.name.lower()
        if "guinness" in name_lower:
            logger.info(f"Skipping banned organization: {mention.name}")
            return None

        # Check if already exists in store by exact name match
        existing = self.store.get_organization_by_name(mention.name)
        if existing:
            # If we have a website url now but didn't before, update it
            web_url = self._sanitize_url(mention.website_url)
            if web_url and not existing.website_url:
                existing.website_url = web_url
            return existing
            
        slug = mention.name.lower().replace(" ", "-").replace(".", "")
        org = Organization(
            name=mention.name,
            acronym=mention.acronym,
            slug=slug,
            org_type=self._sanitize_org_type(mention.inferred_type),
            scope=self._sanitize_scope(mention.inferred_scope),
            website_url=self._sanitize_url(mention.website_url),
            wikipedia_url=self._sanitize_url(mention.wikipedia_url)
        )
        return self.store.add_organization(org)

    def resolve_competition(self, mention: CompetitionMention) -> Competition:
        """Finds or creates a competition from a mention."""
        # Simple slug match
        comp_slug = mention.name.lower().replace(" ", "-")
        if comp_slug in self.store.competitions:
            return self.store.competitions[comp_slug]
            
        # Try to resolve the organizer if provided
        organizer_id = None
        if mention.organizer_name:
            org = self.store.get_organization_by_name(mention.organizer_name)
            if org:
                organizer_id = org.id
                 
        # If sport doesn't exist yet, this might fail, we expect it to be set
        slug = mention.name.lower().replace(" ", "-").replace(".", "")
        comp = Competition(
            name=mention.name,
            sport_id=self.store.sport.id if self.store.sport else None,
            organizer_id=organizer_id,
            competition_type=self._sanitize_competition_type(mention.competition_type),
            tier_level=1,
            website_url=self._sanitize_url(mention.website_url)
        )
        return self.store.add_competition(comp)

    def resolve_member_org(
        self,
        member_name: str,
        parent_org: Organization,
        relationship_type: str = "membership",
        acronym: Optional[str] = None,
        country: Optional[str] = None,
        website_url: Optional[str] = None
    ) -> Optional[Organization]:
        """Resolves a member organization and maps its relationship to the parent organization."""
        if not member_name:
            return None
            
        # Check if banned organization
        if "guinness" in member_name.lower():
            logger.info(f"Skipping banned member organization: {member_name}")
            return None

        # Check if already exists
        existing = self.store.get_organization_by_name(member_name)
        if existing:
            web_url = self._sanitize_url(website_url)
            if web_url and not existing.website_url:
                existing.website_url = web_url
            member_org = existing
        else:
            # Create a new member org
            slug = member_name.lower().replace(" ", "-").replace(".", "")
            member_org = Organization(
                name=member_name,
                acronym=acronym,
                slug=slug,
                org_type="national_federation",  # Default type for member orgs
                scope="national",                # Default scope for member orgs
                country=country,
                website_url=self._sanitize_url(website_url)
            )
            member_org = self.store.add_organization(member_org)
            
        # Add the relationship to the parent
        self.store.add_relationship(
            parent_id=parent_org.id,
            child_id=member_org.id,
            rel_type=self._sanitize_relationship_type(relationship_type)
        )
        
        return member_org

