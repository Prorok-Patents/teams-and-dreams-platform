"""
Command-line interface for the scraper pipeline.

Usage:
  python -m scraper.cli run worldcurling_org
  python -m scraper.cli test https://worldcurling.org/events/
"""

import argparse
import asyncio
import logging
from pprint import pprint
import dotenv

# Load environment variables from .env file
dotenv.load_dotenv(override=True)

from .orchestrator import Orchestrator, load_profile
from .discovery.pipeline import DiscoveryPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

async def run_profile(site_id: str, max_depth: int = None):
    """Run the orchestrator against a specific site profile."""
    orchestrator = Orchestrator()
    profile = load_profile(site_id)
    
    result = await orchestrator.scrape(profile, max_depth=max_depth)
    
    if result.is_success:
        print(f"\n[SUCCESS] Scrape Successful! Found {len(result.events)} events.")
        if result.events:
            print("Sample event:")
            pprint(result.events[0].model_dump())
    else:
        print(f"\n[ERROR] Scrape Failed: {result.error}")

async def run_discovery(sport_name: str, wiki_title: str = None, force: bool = False, use_playwright: bool = False):
    """Run the sport intelligence discovery pipeline."""
    pipeline = DiscoveryPipeline(use_playwright=use_playwright)
    store = await pipeline.run(sport_name, wiki_title, force_rediscover=force)
    print(f"\n[SUCCESS] Discovery complete for {sport_name}.")
    print(f"Orgs: {len(store.organizations)}")
    print(f"Competitions: {len(store.competitions)}")
    print(f"Relationships: {len(store.relationships)}")
    
    # Print a summary of what we found
    print("\n--- Organizations ---")
    for org in store.organizations.values():
        event_count = len(org.metadata.get("event_sources", []))
        print(f"  {org.name} ({org.org_type}) -> {org.website_url or 'no website'}")
        if event_count:
            print(f"    +-- {event_count} event source(s) found")
    
    print(f"\n--- Relationships ({len(store.relationships)}) ---")
    for rel in store.relationships:
        parent = next((o for o in store.organizations.values() if o.id == rel.parent_org_id), None)
        child = next((o for o in store.organizations.values() if o.id == rel.child_org_id), None)
        if parent and child:
            print(f"  {parent.name} --[{rel.relationship_type}]--> {child.name}")

def main():
    parser = argparse.ArgumentParser(description="Teams and Dreams Scraper")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Run command
    run_parser = subparsers.add_parser("run", help="Run a site profile")
    run_parser.add_argument("site_id", help="The ID of the site profile (e.g. worldcurling_org)")
    run_parser.add_argument("-d", "--max-depth", type=int, help="Override maximum scrape/hop depth (e.g. 0 for list-only, 1 for deep hops)")
    
    # Discover command
    discover_parser = subparsers.add_parser("discover", help="Run sport intelligence discovery")
    discover_parser.add_argument("--sport", required=True, help="The name of the sport (e.g. curling)")
    discover_parser.add_argument("--wiki", help="Optional Wikipedia page title if it differs from the sport name")
    discover_parser.add_argument("--force", action="store_true", help="Force re-discovery even if sport exists in DB")
    discover_parser.add_argument("--playwright", action="store_true", help="Use Playwright for JS-heavy sites")
    
    args = parser.parse_args()
    
    if args.command == "run":
        asyncio.run(run_profile(args.site_id, max_depth=args.max_depth))
    elif args.command == "discover":
        asyncio.run(run_discovery(args.sport, args.wiki, args.force, args.playwright))

if __name__ == "__main__":
    main()
