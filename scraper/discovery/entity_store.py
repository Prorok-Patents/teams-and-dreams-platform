import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel
from scraper.models.knowledge_graph import Organization, Competition, OrgRelationship, Sport

class EntityStore(BaseModel):
    """
    In-memory accumulator for the Knowledge Graph entities as they are discovered
    and resolved during the pipeline. Once the pipeline finishes, this store
    is flushed to the database.
    """
    sport: Optional[Sport] = None
    organizations: Dict[str, Organization] = {} # Keyed by slug
    competitions: Dict[str, Competition] = {}   # Keyed by slug or name
    relationships: List[OrgRelationship] = []
    
    def add_organization(self, org: Organization) -> Organization:
        if org.slug not in self.organizations:
            self.organizations[org.slug] = org
        return self.organizations[org.slug]
        
    def add_competition(self, comp: Competition) -> Competition:
        # A simple slugification for the key
        comp_slug = comp.name.lower().replace(" ", "-")
        if comp_slug not in self.competitions:
            self.competitions[comp_slug] = comp
        return self.competitions[comp_slug]
        
    def add_relationship(self, parent_id: uuid.UUID, child_id: uuid.UUID, rel_type: str):
        # Prevent duplicates
        for rel in self.relationships:
            if rel.parent_org_id == parent_id and rel.child_org_id == child_id and rel.relationship_type == rel_type:
                return rel
        
        new_rel = OrgRelationship(
            parent_org_id=parent_id,
            child_org_id=child_id,
            relationship_type=rel_type
        )
        self.relationships.append(new_rel)
        return new_rel
        
    def get_organization_by_name(self, name: str) -> Optional[Organization]:
        import difflib
        import re
        
        name_clean = re.sub(r'[^a-z0-9]', '', name.lower())
        
        # 1. Exact match first
        for org in self.organizations.values():
            if org.name.lower() == name.lower():
                return org
            if org.acronym and org.acronym.lower().replace(".", "") == name.lower().replace(".", ""):
                return org
                
        # 2. Fuzzy match
        best_ratio = 0
        best_org = None
        for org in self.organizations.values():
            org_clean = re.sub(r'[^a-z0-9]', '', org.name.lower())
            ratio = difflib.SequenceMatcher(None, name_clean, org_clean).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_org = org
                
        if best_ratio > 0.85:
            return best_org
            
        return None
        
    def merge_organization(self, keep: Organization, discard: Organization):
        """Merge metadata from discard into keep, then remove discard."""
        if discard.website_url and not keep.website_url:
            keep.website_url = discard.website_url
        if discard.wikipedia_url and not keep.wikipedia_url:
            keep.wikipedia_url = discard.wikipedia_url
            
        # Merge event sources
        keep_events = keep.metadata.get("event_sources", [])
        discard_events = discard.metadata.get("event_sources", [])
        if discard_events:
            keep.metadata["event_sources"] = keep_events + discard_events
            
        # Update relationships
        for rel in self.relationships:
            if rel.parent_org_id == discard.id:
                rel.parent_org_id = keep.id
            if rel.child_org_id == discard.id:
                rel.child_org_id = keep.id
                
        if discard.slug in self.organizations:
            del self.organizations[discard.slug]
