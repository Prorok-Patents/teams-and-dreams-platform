from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from uuid import UUID
from database import get_db
import models

router = APIRouter(prefix="/api/v1/research", tags=["Research"])

class ResearchNoteCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    note_text: str
    tags: List[str] = []

class ResearchNoteResponse(ResearchNoteCreate):
    id: UUID
    class Config:
        from_attributes = True

class GraphSnapshotCreate(BaseModel):
    sport_id: UUID
    snapshot_name: str
    description: Optional[str] = None
    graph_json: Dict[str, Any]

class GraphSnapshotResponse(GraphSnapshotCreate):
    id: UUID
    class Config:
        from_attributes = True

@router.post("/notes", response_model=ResearchNoteResponse)
async def create_note(note: ResearchNoteCreate, db: AsyncSession = Depends(get_db)):
    db_note = models.ResearchNote(**note.model_dump())
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    return db_note

@router.get("/notes", response_model=List[ResearchNoteResponse])
async def get_notes(
    entity_type: Optional[str] = None, 
    entity_id: Optional[UUID] = None, 
    db: AsyncSession = Depends(get_db)
):
    query = select(models.ResearchNote)
    if entity_type:
        query = query.where(models.ResearchNote.entity_type == entity_type)
    if entity_id:
        query = query.where(models.ResearchNote.entity_id == entity_id)
    
    result = await db.execute(query.order_by(models.ResearchNote.created_at.desc()))
    return result.scalars().all()

@router.post("/snapshots", response_model=GraphSnapshotResponse)
async def create_snapshot(snapshot: GraphSnapshotCreate, db: AsyncSession = Depends(get_db)):
    db_snapshot = models.GraphSnapshot(**snapshot.model_dump())
    db.add(db_snapshot)
    await db.commit()
    await db.refresh(db_snapshot)
    return db_snapshot

@router.get("/snapshots", response_model=List[GraphSnapshotResponse])
async def get_snapshots(sport_id: Optional[UUID] = None, db: AsyncSession = Depends(get_db)):
    query = select(models.GraphSnapshot)
    if sport_id:
        query = query.where(models.GraphSnapshot.sport_id == sport_id)
        
    result = await db.execute(query.order_by(models.GraphSnapshot.created_at.desc()))
    return result.scalars().all()

@router.get("/export")
async def export_graph(sport_id: UUID, format: str = "json", db: AsyncSession = Depends(get_db)):
    # Basic export functionality placeholder. 
    # Can be expanded to output Mermaid or CSV logic.
    if format != "json":
        raise HTTPException(status_code=400, detail="Only JSON export is currently supported")
        
    # Get all the entities for this sport to dump
    query = select(models.Sport).where(models.Sport.id == sport_id)
    result = await db.execute(query)
    sport = result.scalar_one_or_none()
    if not sport:
        raise HTTPException(status_code=404, detail="Sport not found")
        
    # In a real export we would fetch organizations, competitions, etc. and format them
    return {"sport_id": str(sport.id), "name": sport.name, "message": "JSON export successful"}
