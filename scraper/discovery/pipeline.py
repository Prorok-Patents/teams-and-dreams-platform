"""
Discovery Pipeline v2 — Official Sources, Deterministic Re-runs.

Run 1 (Discovery):
  Wikipedia → Serper → Crawl Official Sites → LLM Analyzes Real HTML → Flush to DB

Run 2+ (Deterministic):
  Load from DB → Crawl Known Event URLs → Extract Events with Known Selectors
  (LLM only called if selectors break — self-healing)
"""

import logging
import asyncio
import json
from typing import Optional

from scraper.discovery.config import settings

from scraper.models.knowledge_graph import Sport
from scraper.discovery.entity_store import EntityStore
from scraper.discovery.sport_intelligence import SportIntelligenceEngine
from scraper.discovery.site_mapper import SiteMapper
from scraper.discovery.entity_resolver import EntityResolver
from scraper.discovery.relationship_mapper import RelationshipMapper
from scraper.discovery.persistence import PipelinePersistence
from scraper.discovery.profile_generator import ProfileGenerator
from scraper.discovery.sport_intelligence_report import CompetitionMention


logger = logging.getLogger(__name__)


class DiscoveryPipeline:
    """
    The main orchestrator for the Sports Knowledge Graph discovery process.

    Principle: Wikipedia orients, official sites are the source of truth.
    """

    def __init__(self, use_playwright: bool = False):
        self.intelligence_engine = SportIntelligenceEngine()
        self.site_mapper = SiteMapper(use_playwright=use_playwright)
        self.store = EntityStore()
        self.resolver = EntityResolver(self.store)
        self.relationship_mapper = RelationshipMapper(self.store)
        self.persistence = PipelinePersistence()

    async def run(
        self, 
        sport_name: str, 
        wiki_title: Optional[str] = None, 
        force_rediscover: bool = False,
        extra_orgs: Optional[list] = None
    ):
        """
        Run the full discovery pipeline for a given sport.

        If the sport already exists in the DB and force_rediscover is False,
        we load from the DB and skip Wikipedia/Serper entirely (deterministic).
        """
        sport_slug = sport_name.lower().replace(" ", "-")

        # ---------------------------------------------------------------
        # CHECK: Has this sport been discovered before?
        # ---------------------------------------------------------------
        if not force_rediscover and await self.persistence.sport_exists(sport_slug):
            logger.info(f"Sport '{sport_name}' already discovered in DB. Loading existing data...")
            return await self._load_existing(sport_slug, sport_name)

        # ---------------------------------------------------------------
        # RUN 1: Full Discovery
        # ---------------------------------------------------------------
        logger.info(f"=== Starting FRESH Discovery for '{sport_name}' ===")

        # Phase 1: Wikipedia + Serper for orientation
        report = await self.intelligence_engine.run_discovery(sport_name, wiki_title)

        # Merge extra_orgs passed from intake / API if present
        if extra_orgs:
            from scraper.discovery.sport_intelligence_report import OrgMention
            for extra in extra_orgs:
                if isinstance(extra, str):
                    org_dict = {"name": extra, "org_type": "governing_body", "scope": "international"}
                elif isinstance(extra, dict):
                    org_dict = extra
                else:
                    continue
                if not any(o.name.lower() == org_dict.get("name", "").lower() for o in report.organizations):
                    report.organizations.append(OrgMention(**org_dict))
                    logger.info(f"Merged intake organization: {org_dict.get('name')}")

        # Merge manual seeds from seeds.json if it exists
        import os
        import json
        seeds_path = os.path.join(os.path.dirname(__file__), "seeds.json")
        if os.path.exists(seeds_path):
            try:
                with open(seeds_path, "r", encoding="utf-8") as f:
                    seeds_data = json.load(f)
                
                # Parse and merge orgs
                manual_orgs = seeds_data.get("organizations", [])
                for org_dict in manual_orgs:
                    if not any(o.name.lower() == org_dict["name"].lower() for o in report.organizations):
                        from scraper.discovery.sport_intelligence_report import OrgMention
                        report.organizations.append(OrgMention(**org_dict))
                        logger.info(f"Loaded manual seed organization: {org_dict['name']}")
                        
                # Parse and merge comps
                manual_comps = seeds_data.get("competitions", [])
                for comp_dict in manual_comps:
                    if not any(c.name.lower() == comp_dict["name"].lower() for c in report.competitions):
                        from scraper.discovery.sport_intelligence_report import CompetitionMention
                        report.competitions.append(CompetitionMention(**comp_dict))
                        logger.info(f"Loaded manual seed competition: {comp_dict['name']}")
            except Exception as e:
                logger.error(f"Failed to load seeds.json: {e}")

        # Phase 2: Create the Sport entity
        glossary_dict = {item.term: item.definition for item in report.glossary}
        
        # Clean and map sport_category to a valid SportCategory enum value
        valid_categories = {"team", "individual", "combat", "motorsport", "esports", "racquet", "aquatic", "winter", "athletics", "cycling", "equestrian", "other"}
        category_clean = report.sport_category.lower().strip()
        if category_clean not in valid_categories:
            if "winter" in category_clean or "ice" in category_clean or "snow" in category_clean:
                category_clean = "winter"
            elif "team" in category_clean:
                category_clean = "team"
            elif "motorsport" in category_clean or "motor" in category_clean or "racing" in category_clean:
                category_clean = "motorsport"
            elif "racquet" in category_clean or "tennis" in category_clean:
                category_clean = "racquet"
            elif "combat" in category_clean or "fight" in category_clean or "martial" in category_clean:
                category_clean = "combat"
            else:
                category_clean = "other"

        self.store.sport = Sport(
            name=report.sport_name,
            slug=sport_slug,
            category=category_clean,
            glossary=glossary_dict,
        )

        # Phase 3: Resolve seed entities from the intelligence report
        for org_mention in report.organizations:
            self.resolver.resolve_organization(org_mention)

        for comp_mention in report.competitions:
            self.resolver.resolve_competition(comp_mention)

        # Pre-flush seed entities to DB so that they have resolved DB IDs before crawling starts
        logger.info("Pre-flushing seed entities to database...")
        await self.persistence.flush_store(self.store)

        # Phase 4: CRAWL OFFICIAL SITES and discover real relationships
        await self._crawl_official_sites(sport_name)

        # Phase 5: Flush everything to the database
        logger.info("Flushing discovered data to database...")
        await self.persistence.flush_store(self.store)

        # Phase 6: Auto-generate scraper profiles
        logger.info("Auto-generating scraper profiles from discovered event sources...")
        profile_gen = ProfileGenerator()
        profiles_created = profile_gen.generate_all(self.store, sport_name)
        logger.info(f"Generated {profiles_created} new scraper profiles.")

        logger.info(f"=== Discovery COMPLETE for '{sport_name}' ===")
        logger.info(
            f"TOTAL: {len(self.store.organizations)} orgs, "
            f"{len(self.store.competitions)} competitions, "
            f"{len(self.store.relationships)} relationships"
        )

        return self.store

    async def _crawl_official_sites(self, sport_name: str):
        """
        For every org with a website URL, actually visit the site,
        crawl its pages, and discover relationships + event sources.
        
        This is the key difference from v1: we read real HTML, not search snippets.
        """
        orgs_to_crawl = [
            org for org in self.store.organizations.values()
            if org.website_url
        ]

        logger.info(f"Crawling {len(orgs_to_crawl)} official websites...")

        for org in orgs_to_crawl:
            try:
                site_report = await self.site_mapper.map_site(
                    org_name=org.name,
                    base_url=str(org.website_url),
                    sport_name=sport_name,
                )

                new_orgs = []
                if site_report:
                    logger.info(f"LLM Site Analysis for {org.name}:")
                    logger.info(json.dumps(site_report.model_dump(), indent=2))
                    
                    # 4b. Extract discovered event sources
                    org.metadata["site_intelligence"] = site_report.model_dump()
                    if site_report.event_sources:
                        org.metadata["event_sources"] = [
                            es.model_dump() for es in site_report.event_sources
                        ]

                    for es in site_report.event_sources:
                        # Convert to a minimal competition string for now
                        self.resolver.resolve_competition(
                            CompetitionMention(
                                name=es.page_title or "Events",
                                competition_type="knockout_tournament",
                                website_url=es.url
                            )
                        )
                        
                    # 4c. Extract discovered member federations
                    for member in site_report.member_organizations:
                        self.resolver.resolve_member_org(
                            member_name=member.name,
                            parent_org=org,
                            relationship_type=member.relationship_type,
                            acronym=member.acronym,
                            country=member.country,
                            website_url=member.website_url
                        )
                        
                    # 4d. Persist the site knowledge back to the database
                    await self.persistence.upsert_site_knowledge(site_report, str(org.website_url), org.id)
                    
                    # If member orgs were discovered with their own website URLs,
                    # we should crawl those too (one level deep)
                    new_orgs = [
                        self.store.get_organization_by_name(m.name)
                        for m in site_report.member_organizations
                        if m.website_url
                    ]
                    new_orgs = [o for o in new_orgs if o is not None]


                for new_org in new_orgs[:settings.max_sub_org_crawl]:  # Configurable depth limit
                    await asyncio.sleep(settings.crawl_delay_seconds)
                    logger.info(f"  Following member link: {new_org.name} -> {new_org.website_url}")
                    sub_report = await self.site_mapper.map_site(
                        org_name=new_org.name,
                        base_url=str(new_org.website_url),
                        sport_name=sport_name,
                    )
                    if sub_report:
                        new_org.metadata["site_intelligence"] = sub_report.model_dump()
                        if sub_report.event_sources:
                            new_org.metadata["event_sources"] = [
                                es.model_dump() for es in sub_report.event_sources
                            ]
                        # Persist the site knowledge back to the database for sub orgs
                        await self.persistence.upsert_site_knowledge(sub_report, str(new_org.website_url), new_org.id)

            except Exception as e:
                logger.error(f"Error crawling {org.name} ({org.website_url}): {e}")

    async def _load_existing(self, sport_slug: str, sport_name: str) -> EntityStore:
        """
        Load an already-discovered sport from the database.
        This is the deterministic path — no Wikipedia, no Serper, no LLM.
        """
        sport_id = await self.persistence.load_sport_id(sport_slug)
        if not sport_id:
            raise ValueError(f"Sport {sport_slug} not found in DB")

        # Reconstitute the EntityStore from DB
        self.store.sport = Sport(
            id=sport_id,
            name=sport_name,
            slug=sport_slug,
            category="other",  # Valid enum value
        )

        # Load orgs
        from scraper.models.knowledge_graph import Organization
        org_rows = await self.persistence.load_organizations(sport_id)
        for row in org_rows:
            org = Organization(
                id=row["id"],
                name=row["name"],
                acronym=row.get("acronym"),
                slug=row["slug"],
                org_type=row["org_type"],
                scope=row["scope"],
                country=row.get("country"),
                website_url=row.get("website_url"),
                wikipedia_url=row.get("wikipedia_url"),
                metadata=row.get("metadata_json") or {},
            )
            self.store.add_organization(org)

        # Load competitions
        from scraper.models.knowledge_graph import Competition
        comp_rows = await self.persistence.load_competitions(sport_id)
        for row in comp_rows:
            comp = Competition(
                id=row["id"],
                name=row["name"],
                sport_id=sport_id,
                organizer_id=row.get("organizer_id"),
                competition_type=row["competition_type"],
                tier_level=row.get("tier_level", 1),
                website_url=row.get("website_url"),
            )
            self.store.add_competition(comp)

        # Load relationships
        from scraper.models.knowledge_graph import OrgRelationship
        rel_rows = await self.persistence.load_relationships(sport_id)
        for row in rel_rows:
            rel = OrgRelationship(
                parent_org_id=row["parent_org_id"],
                child_org_id=row["child_org_id"],
                relationship_type=row["relationship_type"],
                status=row.get("status", "active"),
            )
            self.store.relationships.append(rel)

        logger.info(
            f"Loaded from DB: {len(self.store.organizations)} orgs, "
            f"{len(self.store.competitions)} competitions, "
            f"{len(self.store.relationships)} relationships"
        )

        return self.store


# Quick test hook
if __name__ == "__main__":
    import asyncio
    from dotenv import load_dotenv

    load_dotenv()
    logging.basicConfig(level=logging.INFO)

    async def main():
        pipeline = DiscoveryPipeline()
        store = await pipeline.run("Curling")
        print(f"\nOrgs: {len(store.organizations)}")
        print(f"Competitions: {len(store.competitions)}")
        print(f"Relationships: {len(store.relationships)}")

    asyncio.run(main())
