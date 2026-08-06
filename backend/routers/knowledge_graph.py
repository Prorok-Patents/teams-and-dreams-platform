from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Any, Dict, Optional
import uuid
import math
from pydantic import BaseModel

from database import get_db
from models import Sport, Organization, Competition, OrgRelationship

router = APIRouter(prefix="/api/knowledge-graph", tags=["Knowledge Graph"])

class SportCreate(BaseModel):
    name: str
    category: str
    wikipedia_url: Optional[str] = None
    icon: Optional[str] = None

@router.post("/sports")
async def create_sport(sport_data: SportCreate, db: AsyncSession = Depends(get_db)):
    """Create a new sport root entity."""
    # Generate a slug from name
    slug = sport_data.name.lower().replace(" ", "-")
    
    # Check if exists
    existing = await db.execute(select(Sport).where(Sport.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Sport with this name/slug already exists")
        
    new_sport = Sport(
        name=sport_data.name,
        slug=slug,
        category=sport_data.category,
        wikipedia_url=sport_data.wikipedia_url,
        icon=sport_data.icon
    )
    db.add(new_sport)
    await db.commit()
    await db.refresh(new_sport)
    return new_sport

@router.get("/sports")
async def get_sports(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sport))
    return result.scalars().all()

@router.get("/sports/{sport_id}/organizations")
async def get_sport_organizations(sport_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.sport_id == sport_id))
    return result.scalars().all()

@router.get("/sports/{sport_id}/competitions")
async def get_sport_competitions(sport_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Competition).where(Competition.sport_id == sport_id))
    return result.scalars().all()

@router.get("/sports/{sport_id}/graph")
async def get_sport_graph(sport_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """
    Returns nodes (sport, organizations, competitions) and edges (relationships)
    for a given sport to render in a UI graph visualization.
    """
    # Get Sport
    sport_result = await db.execute(select(Sport).where(Sport.id == sport_id))
    sport = sport_result.scalar_one_or_none()
    if not sport:
        raise HTTPException(status_code=404, detail="Sport not found")

    # Get Orgs
    orgs_result = await db.execute(select(Organization).where(Organization.sport_id == sport_id))
    orgs = orgs_result.scalars().all()
    
    # Get Competitions
    comps_result = await db.execute(select(Competition).where(Competition.sport_id == sport_id))
    comps = comps_result.scalars().all()
    
    # Get Relationships (where both parent and child belong to this sport)
    org_ids = [org.id for org in orgs]
    rels = []
    if org_ids:
        rels_result = await db.execute(
            select(OrgRelationship).where(
                OrgRelationship.parent_org_id.in_(org_ids) & 
                OrgRelationship.child_org_id.in_(org_ids)
            )
        )
        rels = rels_result.scalars().all()
    
    nodes = []
    edges = []
    
    # Root sport node
    nodes.append({
        "id": f"sport_{sport.id}",
        "label": sport.name,
        "type": "sport",
        "x": 100,
        "y": 300,
        "data": {
            "category": sport.category,
            "wikipedia_url": sport.wikipedia_url,
            "icon": sport.icon
        }
    })
    
    # Organization nodes
    for idx, org in enumerate(orgs):
        nodes.append({
            "id": f"org_{org.id}",
            "label": org.name,
            "type": "organization",
            "x": 400,
            "y": 100 + (idx * 120),
            "data": {
                "org_type": org.org_type,
                "scope": org.scope,
                "website_url": org.website_url,
                "acronym": org.acronym
            }
        })
        # Link root sport to org
        edges.append({
            "id": f"edge_sport_{org.id}",
            "source": f"sport_{sport.id}",
            "target": f"org_{org.id}",
            "label": "governed by"
        })
        
    # Competition nodes
    for idx, comp in enumerate(comps):
        nodes.append({
            "id": f"comp_{comp.id}",
            "label": comp.name,
            "type": "competition",
            "x": 750,
            "y": 100 + (idx * 100),
            "data": {
                "tier": comp.tier_level,
                "competition_type": comp.competition_type,
                "gender": comp.gender,
                "url": comp.website_url
            }
        })
        # If competition has an organizer, add an edge
        if comp.organizer_id:
            edges.append({
                "id": f"edge_org_{comp.organizer_id}_comp_{comp.id}",
                "source": f"org_{comp.organizer_id}",
                "target": f"comp_{comp.id}",
                "label": "organizes"
            })
            
    # Relationships
    for rel in rels:
        edges.append({
            "id": f"edge_rel_{rel.id}",
            "source": f"org_{rel.parent_org_id}",
            "target": f"org_{rel.child_org_id}",
            "label": rel.relationship_type
        })
        
    return {
        "nodes": nodes,
        "edges": edges
    }
