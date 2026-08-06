import os
import glob
import json
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid

logger = logging.getLogger(__name__)

from database import get_db
from models import ScraperRun
from scraper_manager import ScraperManager

router = APIRouter(prefix="/api/v1/scraper", tags=["scraper"])

PROFILES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scraper", "profiles"))

@router.get("/profiles")
async def list_profiles():
    """List available scraper profiles."""
    if not os.path.exists(PROFILES_DIR):
        return []
    
    profiles = []
    for file_path in glob.glob(os.path.join(PROFILES_DIR, "*.json")):
        basename = os.path.basename(file_path)
        site_id = basename.replace(".json", "")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                profiles.append({"site_id": site_id, **data})
        except Exception:
            profiles.append({"site_id": site_id})
        
    return profiles

@router.post("/run/{site_id}")
async def run_scraper(site_id: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Starts the scraper for a specific site_id."""
    # Verify profile exists
    profile_path = os.path.join(PROFILES_DIR, f"{site_id}.json")
    if not os.path.exists(profile_path):
        raise HTTPException(status_code=404, detail="Profile not found")

    run_id = str(uuid.uuid4())
    
    # Create DB record
    new_run = ScraperRun(id=uuid.UUID(run_id), site_id=site_id, status="running")
    db.add(new_run)
    await db.commit()
    
    # We need a new session for the background task to avoid sharing session across tasks
    # However, since FastAPI depends on yield for db session, we can create one directly
    from database import AsyncSessionLocal
    
    async def background_run(run_id_val: str, site_id_val: str):
        async with AsyncSessionLocal() as bg_db:
            await ScraperManager.run_scraper(run_id_val, site_id_val, bg_db)

    background_tasks.add_task(background_run, run_id, site_id)
    
    return {"run_id": run_id, "status": "started"}

@router.get("/runs")
async def list_runs(db: AsyncSession = Depends(get_db)):
    """List historical runs."""
    query = select(ScraperRun).order_by(desc(ScraperRun.start_time)).limit(50)
    result = await db.execute(query)
    runs = result.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "site_id": r.site_id,
            "status": r.status,
            "start_time": r.start_time.isoformat() if r.start_time else None,
            "end_time": r.end_time.isoformat() if r.end_time else None,
            "events_found": r.events_found,
            "error_message": r.error_message
        }
        for r in runs
    ]

@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get status and logs for a specific run."""
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run_id format")

    query = select(ScraperRun).where(ScraperRun.id == run_uuid)
    result = await db.execute(query)
    run = result.scalars().first()
    
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    logs = ScraperManager.get_logs(run_id)
    
    return {
        "id": str(run.id),
        "site_id": run.site_id,
        "status": run.status,
        "start_time": run.start_time.isoformat() if run.start_time else None,
        "end_time": run.end_time.isoformat() if run.end_time else None,
        "events_found": run.events_found,
        "error_message": run.error_message,
        "was_healed": run.was_healed,
        "healing_confidence": run.healing_confidence,
        "logs": logs
    }

from fastapi import WebSocket, WebSocketDisconnect
import asyncio

@router.websocket("/runs/{run_id}/stream")
async def websocket_stream_logs(websocket: WebSocket, run_id: str):
    """Stream live logs via WebSocket."""
    await websocket.accept()
    log_file_path = os.path.join(ScraperManager.LOGS_DIR, f"{run_id}.log")
    
    try:
        # Wait for file to exist
        for _ in range(30):
            if os.path.exists(log_file_path):
                break
            await asyncio.sleep(1)
            
        if not os.path.exists(log_file_path):
            await websocket.send_text("Log file not found or timeout.")
            await websocket.close()
            return
            
        with open(log_file_path, "r", encoding="utf-8") as f:
            while True:
                line = f.readline()
                if line:
                    await websocket.send_text(line)
                else:
                    await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from log stream {run_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()

@router.get("/profiles/{site_id}")
async def get_profile(site_id: str):
    profile_path = os.path.join(PROFILES_DIR, f"{site_id}.json")
    if not os.path.exists(profile_path):
        raise HTTPException(status_code=404, detail="Profile not found")
    with open(profile_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.post("/profiles")
async def create_profile(profile_data: dict, db: AsyncSession = Depends(get_db)):
    site_id = profile_data.get("site_id")
    if not site_id:
        raise HTTPException(status_code=400, detail="site_id is required")
    
    # Sanitize site_id slug
    site_id = site_id.lower().replace(" ", "_").replace("-", "_")
    profile_data["site_id"] = site_id

    os.makedirs(PROFILES_DIR, exist_ok=True)
    profile_path = os.path.join(PROFILES_DIR, f"{site_id}.json")
    with open(profile_path, "w", encoding="utf-8") as f:
        json.dump(profile_data, f, indent=2)

    try:
        from models import SiteKnowledge
        result = await db.execute(select(SiteKnowledge).where(SiteKnowledge.site_id == site_id))
        entry = result.scalars().first()
        if not entry:
            entry = SiteKnowledge(
                site_id=site_id,
                base_url=profile_data.get("base_url", f"https://{site_id}.org"),
                site_type=profile_data.get("site_type", "governing_body"),
                strategy=profile_data.get("strategy", "playwright"),
                proxy_tier=profile_data.get("proxy_tier", "datacenter"),
                has_events=1,
                selectors_json={
                    **profile_data.get("selectors", {}),
                    "pipeline_stage": profile_data.get("pipeline_stage", "discover")
                },
                notes=profile_data.get("org_name", profile_data.get("sport_name", ""))
            )
            db.add(entry)
        else:
            entry.base_url = profile_data.get("base_url", entry.base_url)
            entry.strategy = profile_data.get("strategy", entry.strategy)
            current_selectors = entry.selectors_json or {}
            entry.selectors_json = {
                **current_selectors,
                **profile_data.get("selectors", {}),
                "pipeline_stage": profile_data.get("pipeline_stage", current_selectors.get("pipeline_stage", "discover"))
            }
        await db.commit()
    except Exception as e:
        logger.warning(f"Could not update SiteKnowledge DB record: {e}")

    return {"status": "success", "site_id": site_id, "profile": profile_data}

@router.put("/profiles/{site_id}")
async def update_profile(site_id: str, profile_data: dict):
    profile_path = os.path.join(PROFILES_DIR, f"{site_id}.json")
    # Archive before saving
    if os.path.exists(profile_path):
        import shutil
        history_dir = os.path.join(PROFILES_DIR, "history")
        os.makedirs(history_dir, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        shutil.copy2(profile_path, os.path.join(history_dir, f"{site_id}_{timestamp}.json"))
        
    with open(profile_path, "w", encoding="utf-8") as f:
        json.dump(profile_data, f, indent=2)
    return {"status": "success", "message": "Profile updated"}

from models import LLMUsage
from sqlalchemy import func

@router.get("/costs")
async def get_costs_summary(db: AsyncSession = Depends(get_db)):
    query = select(func.sum(LLMUsage.cost_estimate_usd).label("total_cost"))
    result = await db.execute(query)
    total_cost = result.scalar() or 0.0
    return {"total_cost_usd": total_cost}

