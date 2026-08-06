import os
import json
import logging
from urllib.parse import urlparse
from scraper.discovery.entity_store import EntityStore

logger = logging.getLogger(__name__)

class ProfileGenerator:
    """Generates scraper profile skeletons from discovered event sources."""
    
    def __init__(self, profiles_dir: str = "scraper/profiles"):
        self.profiles_dir = profiles_dir
        
    def generate_all(self, store: EntityStore, sport_name: str) -> int:
        """
        Iterates over organizations in the store. If they have event_sources in metadata,
        generates a new SiteProfile JSON for each if it doesn't already exist.
        Returns the number of profiles created.
        """
        os.makedirs(self.profiles_dir, exist_ok=True)
        created_count = 0
        
        for org in store.organizations.values():
            event_sources = org.metadata.get("event_sources", [])
            for source in event_sources:
                url = source.get("url")
                if not url: continue
                
                # Derive site_id from domain
                try:
                    domain = urlparse(url).netloc
                    site_id = domain.replace("www.", "").replace(".", "_").replace("-", "_")
                except Exception:
                    continue
                    
                profile_path = os.path.join(self.profiles_dir, f"{site_id}.json")
                if os.path.exists(profile_path):
                    continue
                    
                # Scaffold a new profile
                profile = {
                    "site_id": site_id,
                    "base_url": str(org.website_url) if org.website_url else f"https://{domain}",
                    "events_url": str(url),
                    "strategy": "raw_http",
                    "proxy_tier": "datacenter",
                    "requires_javascript": False,
                    "selectors": {
                        "event_container": "article.event",
                        "event_name": "h3.title",
                        "event_date": "div.date",
                        "event_location": "div.location",
                        "event_link": "a",
                        "pagination_next": None
                    },
                    "sport": sport_name.lower().replace(" ", "-"),
                    "notes": f"Auto-generated from discovery of {org.name}"
                }
                
                try:
                    with open(profile_path, 'w', encoding='utf-8') as f:
                        json.dump(profile, f, indent=2)
                    created_count += 1
                    logger.info(f"Generated new profile: {site_id}.json")
                except Exception as e:
                    logger.error(f"Failed to generate profile for {site_id}: {e}")
                    
        return created_count
