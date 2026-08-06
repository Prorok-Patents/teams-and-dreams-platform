from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Any, Optional
from pydantic import BaseModel
import uuid
import datetime

from database import get_db
from models import SiteKnowledge


router = APIRouter(prefix="/api/site-knowledge", tags=["Site Knowledge"])


# --- Pydantic schemas ---

class SiteKnowledgeCreate(BaseModel):
    site_id: str
    base_url: str
    organization_id: Optional[str] = None
    page_types: Optional[list] = None
    page_flows: Optional[list] = None
    site_type: Optional[str] = None
    has_events: int = 0
    has_members: int = 0
    has_results: int = 0
    strategy: Optional[str] = None
    proxy_tier: Optional[str] = None
    selectors_json: Optional[dict] = None
    notes: Optional[str] = None


# --- Endpoints ---

@router.get("/")
async def list_site_knowledge(db: AsyncSession = Depends(get_db)):
    """List all site knowledge entries."""
    result = await db.execute(select(SiteKnowledge))
    entries = result.scalars().all()

    return [
        {
            "id": str(entry.id),
            "site_id": entry.site_id,
            "base_url": entry.base_url,
            "organization_id": str(entry.organization_id) if entry.organization_id else None,
            "site_type": entry.site_type,
            "has_events": entry.has_events,
            "has_members": entry.has_members,
            "has_results": entry.has_results,
            "strategy": entry.strategy,
            "page_types_count": len(entry.page_types) if entry.page_types else 0,
            "page_flows_count": len(entry.page_flows) if entry.page_flows else 0,
            "discovered_at": entry.discovered_at.isoformat() if entry.discovered_at else None,
            "last_mapped_at": entry.last_mapped_at.isoformat() if entry.last_mapped_at else None,
        }
        for entry in entries
    ]


@router.get("/{site_id}")
async def get_site_knowledge(site_id: str, db: AsyncSession = Depends(get_db)):
    """Get the full knowledge pack for a specific site."""
    result = await db.execute(
        select(SiteKnowledge).where(SiteKnowledge.site_id == site_id)
    )
    entry = result.scalars().first()

    if not entry:
        raise HTTPException(status_code=404, detail="Site knowledge not found")

    return {
        "id": str(entry.id),
        "site_id": entry.site_id,
        "base_url": entry.base_url,
        "organization_id": str(entry.organization_id) if entry.organization_id else None,
        "page_types": entry.page_types or [],
        "page_flows": entry.page_flows or [],
        "site_type": entry.site_type,
        "has_events": entry.has_events,
        "has_members": entry.has_members,
        "has_results": entry.has_results,
        "strategy": entry.strategy,
        "proxy_tier": entry.proxy_tier,
        "selectors_json": entry.selectors_json or {},
        "discovered_at": entry.discovered_at.isoformat() if entry.discovered_at else None,
        "last_mapped_at": entry.last_mapped_at.isoformat() if entry.last_mapped_at else None,
        "notes": entry.notes,
        # Computed fields
        "page_types_count": len(entry.page_types) if entry.page_types else 0,
        "page_flows_count": len(entry.page_flows) if entry.page_flows else 0,
        "capabilities": {
            "has_events": bool(entry.has_events),
            "has_members": bool(entry.has_members),
            "has_results": bool(entry.has_results),
        },
    }


@router.post("/")
async def upsert_site_knowledge(
    data: SiteKnowledgeCreate, db: AsyncSession = Depends(get_db)
):
    """Create or update site knowledge (upsert by site_id)."""
    result = await db.execute(
        select(SiteKnowledge).where(SiteKnowledge.site_id == data.site_id)
    )
    entry = result.scalars().first()

    if entry:
        # Update existing
        entry.base_url = data.base_url
        if data.organization_id:
            entry.organization_id = uuid.UUID(data.organization_id)
        if data.page_types is not None:
            entry.page_types = data.page_types
        if data.page_flows is not None:
            entry.page_flows = data.page_flows
        if data.site_type is not None:
            entry.site_type = data.site_type
        entry.has_events = data.has_events
        entry.has_members = data.has_members
        entry.has_results = data.has_results
        if data.strategy is not None:
            entry.strategy = data.strategy
        if data.proxy_tier is not None:
            entry.proxy_tier = data.proxy_tier
        if data.selectors_json is not None:
            entry.selectors_json = data.selectors_json
        if data.notes is not None:
            entry.notes = data.notes
        entry.last_mapped_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(entry)
        return {"status": "updated", "id": str(entry.id), "site_id": entry.site_id}
    else:
        # Create new
        new_entry = SiteKnowledge(
            site_id=data.site_id,
            base_url=data.base_url,
            organization_id=uuid.UUID(data.organization_id) if data.organization_id else None,
            page_types=data.page_types or [],
            page_flows=data.page_flows or [],
            site_type=data.site_type,
            has_events=data.has_events,
            has_members=data.has_members,
            has_results=data.has_results,
            strategy=data.strategy,
            proxy_tier=data.proxy_tier,
            selectors_json=data.selectors_json or {},
            notes=data.notes,
        )
        db.add(new_entry)
        await db.commit()
        await db.refresh(new_entry)
        return {"status": "created", "id": str(new_entry.id), "site_id": new_entry.site_id}


class StageUpdate(BaseModel):
    pipeline_stage: str


@router.patch("/{site_id}/stage")
async def update_pipeline_stage(
    site_id: str, stage_data: StageUpdate, db: AsyncSession = Depends(get_db)
):
    """Update pipeline stage for a site."""
    result = await db.execute(
        select(SiteKnowledge).where(SiteKnowledge.site_id == site_id)
    )
    entry = result.scalars().first()

    if not entry:
        raise HTTPException(status_code=404, detail="Site knowledge not found")

    current_selectors = entry.selectors_json or {}
    entry.selectors_json = {
        **current_selectors,
        "pipeline_stage": stage_data.pipeline_stage,
    }
    await db.commit()

    # Also update profile file if present
    try:
        from routers.scraper import PROFILES_DIR
        import os, json
        profile_path = os.path.join(PROFILES_DIR, f"{site_id}.json")
        if os.path.exists(profile_path):
            with open(profile_path, "r", encoding="utf-8") as f:
                prof = json.load(f)
            prof["pipeline_stage"] = stage_data.pipeline_stage
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump(prof, f, indent=2)
    except Exception as e:
        print(f"Could not update profile stage file: {e}")

    return {"status": "success", "site_id": site_id, "pipeline_stage": stage_data.pipeline_stage}

