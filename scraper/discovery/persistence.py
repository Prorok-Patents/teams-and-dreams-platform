"""
Persistence layer for the Discovery Pipeline.

Handles flushing the in-memory EntityStore to Postgres after run 1,
and loading it back on subsequent runs so we skip Wikipedia/Serper/Gemini
and go straight to deterministic crawling.
"""

import json
import logging
import os
import sys
from typing import Optional
import uuid
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, text

logger = logging.getLogger(__name__)

# We need access to the backend models — add backend to path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def _get_session_factory():
    """Create a session factory using the same DB URL as the backend."""
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://sportmap:sportmap_password@localhost:5433/sportmap_db",
    )
    engine = create_async_engine(db_url, echo=False)
    return async_sessionmaker(engine, expire_on_commit=False)


class PipelinePersistence:
    """
    Flush EntityStore -> Postgres and load it back.
    This is what makes run 2+ deterministic.
    """

    def __init__(self):
        self._session_factory = _get_session_factory()

    async def sport_exists(self, sport_slug: str) -> bool:
        """Check if a sport has already been discovered."""
        async with self._session_factory() as session:
            result = await session.execute(
                text("SELECT id FROM sports WHERE slug = :slug"),
                {"slug": sport_slug},
            )
            return result.scalar_one_or_none() is not None

    async def load_sport_id(self, sport_slug: str) -> Optional[UUID]:
        """Load an existing sport's UUID."""
        async with self._session_factory() as session:
            result = await session.execute(
                text("SELECT id FROM sports WHERE slug = :slug"),
                {"slug": sport_slug},
            )
            row = result.scalar_one_or_none()
            return row if row else None

    async def load_organizations(self, sport_id: UUID) -> list:
        """Load all organizations for a sport from the database."""
        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT id, name, acronym, slug, org_type, scope, country, "
                    "website_url, wikipedia_url, metadata_json "
                    "FROM organizations WHERE sport_id = :sid"
                ),
                {"sid": sport_id},
            )
            return [dict(row._mapping) for row in result.all()]

    async def load_competitions(self, sport_id: UUID) -> list:
        """Load all competitions for a sport from the database."""
        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT id, name, competition_type, tier_level, organizer_id, website_url "
                    "FROM competitions WHERE sport_id = :sid"
                ),
                {"sid": sport_id},
            )
            return [dict(row._mapping) for row in result.all()]

    async def load_relationships(self, sport_id: UUID) -> list:
        """Load all org relationships for a sport from the database."""
        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT r.id, r.parent_org_id, r.child_org_id, r.relationship_type, r.status "
                    "FROM org_relationships r "
                    "JOIN organizations p ON r.parent_org_id = p.id "
                    "WHERE p.sport_id = :sid"
                ),
                {"sid": sport_id},
            )
            return [dict(row._mapping) for row in result.all()]

    async def flush_store(self, store) -> None:
        """
        Write the entire EntityStore to Postgres in a single transaction.
        Uses upsert-style logic: skip if slug already exists.
        """
        async with self._session_factory() as session:
            async with session.begin():
                # 1. Upsert Sport and resolve its database ID
                sport_id = store.sport.id if store.sport else None
                if store.sport:
                    existing = await session.execute(
                        text("SELECT id FROM sports WHERE slug = :slug"),
                        {"slug": store.sport.slug},
                    )
                    existing_sport_id = existing.scalar_one_or_none()
                    if existing_sport_id is not None:
                        sport_id = existing_sport_id
                        store.sport.id = existing_sport_id
                    else:
                        await session.execute(
                            text(
                                "INSERT INTO sports (id, name, slug, category, wikipedia_url, icon, glossary) "
                                "VALUES (:id, :name, :slug, :category, :wikipedia_url, :icon, :glossary)"
                            ),
                            {
                                "id": store.sport.id,
                                "name": store.sport.name,
                                "slug": store.sport.slug,
                                "category": store.sport.category,
                                "wikipedia_url": str(store.sport.wikipedia_url) if store.sport.wikipedia_url else None,
                                "icon": store.sport.icon,
                                "glossary": json.dumps(store.sport.glossary),
                            },
                        )
                        logger.info(f"Inserted sport: {store.sport.name}")

                # 2. Resolve Organization IDs and update memory objects
                org_id_map = {}
                for org in list(store.organizations.values()):
                    existing = await session.execute(
                        text("SELECT id FROM organizations WHERE slug = :slug"),
                        {"slug": org.slug},
                    )
                    existing_id = existing.scalar_one_or_none()
                    if existing_id is not None:
                        org_id_map[org.id] = existing_id
                        org.id = existing_id
                    else:
                        org_id_map[org.id] = org.id
                        metadata_val = json.dumps(org.metadata) if org.metadata else "{}"
                        await session.execute(
                            text(
                                "INSERT INTO organizations "
                                "(id, name, acronym, slug, org_type, scope, sport_id, "
                                "country, website_url, wikipedia_url, metadata_json) "
                                "VALUES (:id, :name, :acronym, :slug, :org_type, :scope, :sport_id, "
                                ":country, :website_url, :wikipedia_url, :metadata_json)"
                            ),
                            {
                                "id": org.id,
                                "name": org.name,
                                "acronym": org.acronym,
                                "slug": org.slug,
                                "org_type": org.org_type,
                                "scope": org.scope,
                                "sport_id": sport_id,
                                "country": org.country,
                                "website_url": str(org.website_url) if org.website_url else None,
                                "wikipedia_url": str(org.wikipedia_url) if org.wikipedia_url else None,
                                "metadata_json": metadata_val,
                            },
                        )
                        logger.info(f"Inserted org: {org.name}")

                # Update dictionary keys in store.organizations to match new IDs
                store.organizations = {org.id: org for org in store.organizations.values()}

                # 3. Update all organization/sport references in competitions
                for comp in store.competitions.values():
                    comp.sport_id = sport_id
                    if comp.organizer_id in org_id_map:
                        comp.organizer_id = org_id_map[comp.organizer_id]
                    
                    existing = await session.execute(
                        text("SELECT id FROM competitions WHERE name = :name AND sport_id = :sport_id"),
                        {"name": comp.name, "sport_id": sport_id},
                    )
                    existing_id = existing.scalar_one_or_none()
                    if existing_id is not None:
                        comp.id = existing_id
                    else:
                        await session.execute(
                            text(
                                "INSERT INTO competitions "
                                "(id, name, sport_id, organizer_id, competition_type, tier_level, website_url) "
                                "VALUES (:id, :name, :sport_id, :organizer_id, :competition_type, :tier_level, :website_url) "
                                "ON CONFLICT DO NOTHING"
                            ),
                            {
                                "id": comp.id,
                                "name": comp.name,
                                "sport_id": comp.sport_id,
                                "organizer_id": comp.organizer_id,
                                "competition_type": comp.competition_type.value if hasattr(comp.competition_type, "value") else comp.competition_type,
                                "tier_level": comp.tier_level,
                                "website_url": str(comp.website_url) if comp.website_url else None,
                            },
                        )

                # 4. Update parent/child references in relationships and insert
                for rel in store.relationships:
                    if rel.parent_org_id in org_id_map:
                        rel.parent_org_id = org_id_map[rel.parent_org_id]
                    if rel.child_org_id in org_id_map:
                        rel.child_org_id = org_id_map[rel.child_org_id]
                        
                    await session.execute(
                        text(
                            "INSERT INTO org_relationships "
                            "(id, parent_org_id, child_org_id, relationship_type, status) "
                            "VALUES (:id, :parent_id, :child_id, :rel_type, :status) "
                            "ON CONFLICT DO NOTHING"
                        ),
                        {
                            "id": (rel.id if hasattr(rel, 'id') and rel.id else None) or uuid.uuid4(),
                            "parent_id": rel.parent_org_id,
                            "child_id": rel.child_org_id,
                            "rel_type": rel.relationship_type.value if hasattr(rel.relationship_type, 'value') else rel.relationship_type,
                            "status": rel.status,
                        },
                    )

                # 5. Record discovery sources
                for org in store.organizations.values():
                    if org.website_url:
                        await session.execute(
                            text(
                                "INSERT INTO discovery_sources "
                                "(id, entity_type, entity_id, source_type, source_url, confidence, verified) "
                                "VALUES (:id, 'organization', :eid, 'official_site', :url, 1.0, true) "
                                "ON CONFLICT DO NOTHING"
                            ),
                            {"id": uuid.uuid4(), "eid": org.id, "url": str(org.website_url)},
                        )

            logger.info(
                f"Flushed to DB: {len(store.organizations)} orgs, "
                f"{len(store.competitions)} competitions, "
                f"{len(store.relationships)} relationships"
            )

    async def upsert_site_knowledge(self, site_report: 'SiteIntelligenceReport', base_url: str, org_id: UUID) -> None:
        """Upserts a discovered site intelligence report directly into the site_knowledge table."""
        from sqlalchemy.dialects.postgresql import insert
        from models import SiteKnowledge

        # Basic ID mapping logic for site_id
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        site_id = parsed.netloc.replace("www.", "").replace(".", "_")

        async with self._session_factory() as session:
            async with session.begin():
                stmt = insert(SiteKnowledge).values(
                    site_id=site_id,
                    base_url=base_url,
                    organization_id=org_id,
                    page_types=[p.model_dump() for p in site_report.page_types] if hasattr(site_report, "page_types") else [],
                    page_flows=[f.model_dump(by_alias=True) for f in site_report.page_flows] if hasattr(site_report, "page_flows") else [],
                    site_type=site_report.site_type,
                    has_events=1 if site_report.has_direct_events else 0,
                    has_members=1 if len(site_report.member_organizations) > 0 else 0,
                    has_results=0,
                    strategy="firecrawl" if site_report.has_direct_events else "raw_http",
                    discovered_at=text("now()"),
                    last_mapped_at=text("now()"),
                    notes=site_report.summary
                )
                
                # On conflict do update
                do_update_stmt = stmt.on_conflict_do_update(
                    index_elements=['site_id'],
                    set_=dict(
                        base_url=stmt.excluded.base_url,
                        organization_id=stmt.excluded.organization_id,
                        page_types=stmt.excluded.page_types,
                        page_flows=stmt.excluded.page_flows,
                        site_type=stmt.excluded.site_type,
                        has_events=stmt.excluded.has_events,
                        has_members=stmt.excluded.has_members,
                        strategy=stmt.excluded.strategy,
                        last_mapped_at=stmt.excluded.last_mapped_at,
                        notes=stmt.excluded.notes
                    )
                )
                
                await session.execute(do_update_stmt)
                logger.info(f"Upserted site knowledge for {site_id}")

