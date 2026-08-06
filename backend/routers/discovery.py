import os
import sys
import logging
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Ensure scraper package can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from scraper.discovery.pipeline import DiscoveryPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/discovery", tags=["Discovery"])


class OrganizationInitData(BaseModel):
    name: str
    acronym: Optional[str] = None
    scope: Optional[str] = "international"
    org_type: Optional[str] = "governing_body"
    website_url: Optional[str] = None


class GraphNode(BaseModel):
    id: str
    type: str # "sport", "organization", "competition", "web_source", "scraper_config"
    label: str
    data: Dict[str, Any] = {}

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None

class DiscoveryRunRequest(BaseModel):
    sport_name: str
    wiki_title: Optional[str] = None
    major_orgs: Optional[List[Union[str, OrganizationInitData, Dict[str, Any]]]] = None
    custom_competitions: Optional[List[Dict[str, Any]]] = None
    custom_sites: Optional[List[Dict[str, Any]]] = None
    graph_nodes: Optional[List[GraphNode]] = None
    graph_edges: Optional[List[GraphEdge]] = None
    force_rediscover: bool = False
    use_playwright: bool = False


# In-memory discovery status tracking
discovery_jobs: Dict[str, Dict[str, Any]] = {}


@router.post("/validate-graph")
async def validate_graph(nodes: List[GraphNode], edges: List[GraphEdge]):
    """
    Validate a user-configured sport intake graph before execution.
    """
    errors = []
    warnings = []
    
    sport_nodes = [n for n in nodes if n.type == "sport"]
    if not sport_nodes:
        errors.append("Graph must contain at least one Sport node.")
    
    org_nodes = [n for n in nodes if n.type == "organization"]
    if not org_nodes:
        warnings.append("No Organization nodes defined. Discovery will rely purely on Wikipedia/auto-search.")
        
    comp_nodes = [n for n in nodes if n.type == "competition"]
    site_nodes = [n for n in nodes if n.type == "web_source"]
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "sports": len(sport_nodes),
            "organizations": len(org_nodes),
            "competitions": len(comp_nodes),
            "web_sources": len(site_nodes),
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        }
    }


@router.post("/run")
async def trigger_discovery(request: DiscoveryRunRequest, background_tasks: BackgroundTasks):
    """
    Trigger the discovery pipeline for a sport and its governing bodies/organizations/custom graph seeds.
    """
    if not request.sport_name.strip():
        raise HTTPException(status_code=400, detail="sport_name is required")

    sport_slug = request.sport_name.lower().strip().replace(" ", "-")
    job_id = f"discovery_{sport_slug}"

    discovery_jobs[job_id] = {
        "job_id": job_id,
        "sport_name": request.sport_name,
        "status": "running",
        "logs": ["Discovery initiated from Sport Builder..."],
        "completed_nodes": [],
        "summary": None,
        "error": None
    }

    async def run_discovery_task():
        try:
            pipeline = DiscoveryPipeline(use_playwright=request.use_playwright)
            
            formatted_orgs = []
            
            # Extract orgs from graph_nodes if provided
            if request.graph_nodes:
                for n in request.graph_nodes:
                    if n.type == "organization":
                        formatted_orgs.append({
                            "name": n.label,
                            "acronym": n.data.get("acronym"),
                            "scope": n.data.get("scope", "international"),
                            "org_type": n.data.get("org_type", "governing_body"),
                            "website_url": n.data.get("website_url")
                        })
            
            # Also append major_orgs if explicitly provided
            if request.major_orgs:
                for org in request.major_orgs:
                    if isinstance(org, str):
                        formatted_orgs.append({"name": org, "org_type": "governing_body", "scope": "international"})
                    elif isinstance(org, dict):
                        formatted_orgs.append(org)
                    elif hasattr(org, "model_dump"):
                        formatted_orgs.append(org.model_dump())

            discovery_jobs[job_id]["logs"].append(f"Running pipeline for '{request.sport_name}' with {len(formatted_orgs)} initial orgs...")
            
            store = await pipeline.run(
                sport_name=request.sport_name,
                wiki_title=request.wiki_title,
                force_rediscover=request.force_rediscover,
                extra_orgs=formatted_orgs
            )

            discovery_jobs[job_id]["status"] = "completed"
            discovery_jobs[job_id]["summary"] = {
                "organizations_count": len(store.organizations),
                "competitions_count": len(store.competitions),
                "relationships_count": len(store.relationships)
            }
            discovery_jobs[job_id]["logs"].append("Discovery completed successfully.")

        except Exception as e:
            logger.error(f"Discovery pipeline failed for {request.sport_name}: {e}", exc_info=True)
            discovery_jobs[job_id]["status"] = "failed"
            discovery_jobs[job_id]["error"] = str(e)
            discovery_jobs[job_id]["logs"].append(f"Error: {e}")

    background_tasks.add_task(run_discovery_task)

    return {
        "job_id": job_id,
        "status": "started",
        "sport_name": request.sport_name,
        "message": f"Discovery pipeline launched for {request.sport_name}"
    }


@router.get("/status/{job_id}")
async def get_discovery_status(job_id: str):
    """
    Check the status and logs of a running discovery job.
    """
    if job_id not in discovery_jobs:
        raise HTTPException(status_code=404, detail="Discovery job not found")
    return discovery_jobs[job_id]

