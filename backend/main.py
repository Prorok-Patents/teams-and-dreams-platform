from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from geoalchemy2.functions import ST_MakeEnvelope, ST_Intersects, ST_AsGeoJSON
import json
from contextlib import asynccontextmanager

from database import engine, Base, get_db
from models import Event, Venue, ScraperRun, LLMUsage
from routers import scraper, knowledge_graph, site_knowledge, discovery

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()

app = FastAPI(title="SportMap API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scraper.router)
app.include_router(knowledge_graph.router)
app.include_router(site_knowledge.router)
app.include_router(discovery.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/v1/events/list")
async def get_events_list(
    page: int = 1,
    limit: int = 50,
    status: str = None,
    review_status: str = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    
    # Calculate offset
    offset = (page - 1) * limit
    
    query = select(Event, Venue.name.label("venue_name")).join(Venue, Event.venue_id == Venue.id)
    
    if status:
        query = query.where(Event.status == status)
    if review_status:
        query = query.where(Event.review_status == review_status)
        
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total_events = total_result.scalar_one_or_none() or 0
        
    query = query.order_by(Event.start_date.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    
    events = []
    for event_obj, venue_name in result.all():
        events.append({
            "id": str(event_obj.id),
            "name": event_obj.name,
            "sport": event_obj.sport_name_raw,
            "level": event_obj.level,
            "status": event_obj.status,
            "start_date": event_obj.start_date.isoformat() if event_obj.start_date else None,
            "end_date": event_obj.end_date.isoformat() if event_obj.end_date else None,
            "extraction_method": event_obj.extraction_method,
            "extraction_confidence": event_obj.extraction_confidence,
            "review_status": event_obj.review_status,
            "venue_name": venue_name
        })
        
    return {
        "events": events,
        "total": total_events,
        "page": page,
        "pages": (total_events + limit - 1) // limit if limit > 0 else 1
    }

@app.get("/api/v1/events")
async def get_events(
    min_lon: float = Query(..., description="Bottom-left longitude"),
    min_lat: float = Query(..., description="Bottom-left latitude"),
    max_lon: float = Query(..., description="Top-right longitude"),
    max_lat: float = Query(..., description="Top-right latitude"),
    sport: str = Query(None, description="Filter by sport slug"),
    db: AsyncSession = Depends(get_db)
):
    # Construct a PostGIS bounding box polygon (SRID 4326)
    bbox = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    
    # Query events where the venue's geometry intersects the bounding box
    query = (
        select(Event, Venue, ST_AsGeoJSON(Venue.geom).label("geojson"))
        .join(Venue, Event.venue_id == Venue.id)
        .where(ST_Intersects(Venue.geom, bbox))
    )
    
    if sport:
        query = query.where(Event.sport_name_raw == sport)
        
    result = await db.execute(query)
    
    # Convert results into a GeoJSON FeatureCollection
    features = []
    for row in result.all():
        event_obj, venue_obj, geojson_str = row
        
        feature = {
            "type": "Feature",
            "geometry": json.loads(geojson_str) if geojson_str else None,
            "properties": {
                "event_id": str(event_obj.id),
                "name": event_obj.name,
                "sport": event_obj.sport_name_raw,
                "level": event_obj.level,
                "status": event_obj.status,
                "start_date": event_obj.start_date.isoformat() if event_obj.start_date else None,
                "end_date": event_obj.end_date.isoformat() if event_obj.end_date else None,
                "source_url": event_obj.source_url,
                "venue_name": venue_obj.name,
                "city": venue_obj.city,
                "country": venue_obj.country
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }

from pydantic import BaseModel

class EventReviewUpdate(BaseModel):
    review_status: str

@app.patch("/api/v1/events/{event_id}/review")
async def review_event(
    event_id: str,
    update_data: EventReviewUpdate,
    db: AsyncSession = Depends(get_db)
):
    import uuid
    try:
        event_uuid = uuid.UUID(event_id)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid event ID")
        
    query = select(Event).where(Event.id == event_uuid)
    result = await db.execute(query)
    event = result.scalar_one_or_none()
    
    if not event:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Event not found")
        
    event.review_status = update_data.review_status
    await db.commit()
    
    return {"status": "success", "review_status": event.review_status}

@app.get("/api/v1/dashboard/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    
    # Active Scrapers
    active_scrapers_query = select(func.count()).where(ScraperRun.status == "running")
    active_scrapers_result = await db.execute(active_scrapers_query)
    active_scrapers = active_scrapers_result.scalar() or 0
    
    # Total Events
    events_query = select(func.count()).select_from(Event)
    events_result = await db.execute(events_query)
    total_events = events_result.scalar() or 0
    
    # AI Heal Rate (Healed runs / Total runs * 100)
    total_runs_query = select(func.count()).select_from(ScraperRun)
    total_runs_result = await db.execute(total_runs_query)
    total_runs = total_runs_result.scalar() or 0
    
    healed_runs_query = select(func.count()).where(ScraperRun.was_healed == True)
    healed_runs_result = await db.execute(healed_runs_query)
    healed_runs = healed_runs_result.scalar() or 0
    
    heal_rate = 0
    if total_runs > 0:
        heal_rate = round((healed_runs / total_runs) * 100, 1)
        
    # Failed Runs
    failed_runs_query = select(func.count()).where(ScraperRun.status == "failed")
    failed_runs_result = await db.execute(failed_runs_query)
    failed_runs = failed_runs_result.scalar() or 0
    
    # Total LLM Costs
    cost_query = select(func.sum(LLMUsage.cost_estimate_usd))
    cost_result = await db.execute(cost_query)
    total_cost = cost_result.scalar() or 0.0
    
    return {
        "active_scrapers": active_scrapers,
        "total_events": total_events,
        "heal_rate": heal_rate,
        "failed_runs": failed_runs,
        "total_cost_usd": total_cost
    }
