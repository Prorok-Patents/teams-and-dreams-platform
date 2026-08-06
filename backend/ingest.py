import asyncio
import logging
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from database import engine, AsyncSessionLocal
from models import Venue, Event
from services.geocoder import geocode_location

# Add root path so we can import scraper as a package
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from scraper.orchestrator import Orchestrator, load_profile

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def process_events(site_id: str):
    logger.info(f"Running scraper for {site_id}")
    
    profile = load_profile(site_id)
    orchestrator = Orchestrator()
    result = await orchestrator.scrape(profile)
    
    if not result.is_success:
        logger.error(f"Scraper failed for {site_id}: {result.error}")
        return
        
    events = result.events
    logger.info(f"Found {len(events)} events to process")
    
    # We don't need to instantiate geocoder service, we can use the function directly
    # geocode_location uses MAPBOX_TOKEN from environment if set
    
    async with AsyncSessionLocal() as session:
        for event_data in events:
            try:
                start_date = event_data.start_date
                end_date = event_data.end_date
                
                venue_name = event_data.venue.name if event_data.venue else "Unknown Venue"
                address = event_data.venue.address if event_data.venue else None
                city = event_data.venue.city if event_data.venue else ""
                region = event_data.venue.region if event_data.venue else None
                country = event_data.venue.country if event_data.venue else ""
                
                # Check if venue exists (matching by name and city for simplicity)
                stmt = select(Venue).where(Venue.name == venue_name).where(Venue.city == city)
                venue_result = await session.execute(stmt)
                venue = venue_result.scalar_one_or_none()
                
                if not venue:
                    # Create new venue
                    venue = Venue(
                        name=venue_name,
                        address=address,
                        city=city,
                        region=region,
                        country=country
                    )
                    
                    # Geocode
                    if city:
                        location_str = f"{city}, {country}" if country else city
                        logger.info(f"Geocoding location: {location_str}")
                        geo_result = await geocode_location(city, country)
                        if geo_result:
                            lon, lat = geo_result
                            venue.geom = f"POINT({lon} {lat})"
                            venue.geocoded_at = datetime.utcnow()
                            logger.info(f"Successfully geocoded to {lat}, {lon}")
                        else:
                            logger.warning(f"Failed to geocode location: {location_str}")
                    
                    session.add(venue)
                    await session.flush() # flush to get venue.id
                    
                # Deduplication: check if an event with the same content hash
                # already exists. If so, just bump its scraped_at timestamp.
                hash_value = event_data.content_hash()
                dup_stmt = select(Event).where(Event.content_hash == hash_value)
                dup_result = await session.execute(dup_stmt)
                existing_event = dup_result.scalar_one_or_none()

                if existing_event:
                    existing_event.scraped_at = datetime.utcnow()
                    logger.info(f"Duplicate skipped (hash match), updated scraped_at: {event_data.name}")
                    continue

                # Create event
                event = Event(
                    venue_id=venue.id,
                    name=event_data.name,
                    description=event_data.description,
                    organizer_raw=event_data.organizer,
                    tags=event_data.tags,
                    sport_name_raw=event_data.sport.value if event_data.sport else "curling",
                    event_type=event_data.event_type,
                    level=event_data.level.value if event_data.level else None,
                    status=event_data.status.value if event_data.status else "scheduled",
                    start_date=start_date,
                    end_date=end_date,
                    source_site=site_id,
                    source_url=str(event_data.source_url) if event_data.source_url else None,
                    content_hash=hash_value,
                    extraction_method="llm_healed" if result.was_healed else "deterministic",
                    extraction_confidence=1.0 if not result.was_healed else 0.8  # Could be pulled from heal_result
                )
                session.add(event)
                logger.info(f"Added event: {event.name}")
                
            except Exception as e:
                logger.error(f"Error processing event {event_data.name}: {e}", exc_info=True)
                
        # Commit transaction
        await session.commit()
        logger.info("Transaction committed successfully.")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(process_events("worldcurling_org"))
