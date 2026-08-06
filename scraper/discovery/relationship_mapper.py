"""
Relationship Mapper v2 — discovers relationships from REAL site content.

Instead of relying on LLM string inferences, this version:
1. Takes the member_organizations list from the SiteIntelligenceReport
   (which was extracted from the actual members/federations page HTML)
2. Creates or resolves the member orgs in the EntityStore
3. Creates typed relationship edges between parent and child orgs
"""

import logging
import uuid
from typing import Optional

from scraper.models.knowledge_graph import Organization, OrgRelationship
from scraper.discovery.entity_store import EntityStore
from scraper.discovery.site_mapper import SiteIntelligenceReport, DiscoveredMemberOrg

logger = logging.getLogger(__name__)


class RelationshipMapper:
    """
    Creates relationship edges from official-source data.
    All relationships are backed by actual content on official websites.
    """

    def __init__(self, store: EntityStore):
        self.store = store

    def map_from_site_report(
        self, parent_org: Organization, report: SiteIntelligenceReport
    ):
        """
        Process member organizations discovered from an official site's
        members/federations page.
        
        Each DiscoveredMemberOrg has a name, country, and sometimes a
        website URL — all extracted from the real HTML.
        """
        members_added = 0

        for member in report.member_organizations:
            child_org = self._resolve_or_create_member(member, parent_org)
            if child_org and child_org.id != parent_org.id:
                self.store.add_relationship(
                    parent_id=parent_org.id,
                    child_id=child_org.id,
                    rel_type=member.relationship_type or "membership",
                )
                members_added += 1

        if members_added:
            logger.info(
                f"Mapped {members_added} member relationships "
                f"for {parent_org.name} from official site"
            )

    def _resolve_or_create_member(
        self, member: DiscoveredMemberOrg, parent_org: Organization
    ) -> Optional[Organization]:
        """Find an existing org in the store or create a new one from the member data."""
        # Try to match by name first
        existing = self.store.get_organization_by_name(member.name)
        if existing:
            # Enrich with website if we found one on the parent's members page
            if member.website_url and not existing.website_url:
                existing.website_url = member.website_url
            if member.country and not existing.country:
                existing.country = member.country
            return existing

        # Also try matching by acronym
        if member.acronym:
            existing = self.store.get_organization_by_name(member.acronym)
            if existing:
                if member.website_url and not existing.website_url:
                    existing.website_url = member.website_url
                return existing

        # Create a new org from the member data
        slug = member.name.lower().replace(" ", "-").replace(".", "")

        # Infer the child's type from the parent's type
        child_type = "national_federation"
        if parent_org.org_type == "national_federation":
            child_type = "club"
        elif parent_org.org_type == "continental_confederation":
            child_type = "national_federation"

        child_scope = "national"
        if member.country:
            child_scope = "national"
        elif parent_org.scope == "national":
            child_scope = "regional"

        new_org = Organization(
            name=member.name,
            acronym=member.acronym if member.acronym else None,
            slug=slug,
            org_type=child_type,
            scope=child_scope,
            sport_id=self.store.sport.id if self.store.sport else None,
            country=member.country if member.country else None,
            website_url=member.website_url if member.website_url else None,
        )

        return self.store.add_organization(new_org)
