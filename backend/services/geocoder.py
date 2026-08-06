import os
import httpx
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Provide Mapbox Token via env variable
MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", "MOCK_TOKEN")

async def geocode_location(city: str, country: str) -> Optional[Tuple[float, float]]:
    """
    Given a city and country, returns (longitude, latitude) by querying Mapbox.
    We return Longitude first because PostGIS and GeoJSON use (lon, lat) order.
    """
    if MAPBOX_TOKEN == "MOCK_TOKEN":
        logger.warning("Using mock geocoder. Mapbox token not configured.")
        # Return a mock coordinate somewhere in the Atlantic Ocean
        return (-30.0, 30.0)

    query = f"{city}, {country}"
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
    
    params = {
        "access_token": MAPBOX_TOKEN,
        "types": "place,region,country",
        "limit": 1
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "features" in data and len(data["features"]) > 0:
                # Mapbox returns geometry.coordinates as [longitude, latitude]
                lon, lat = data["features"][0]["geometry"]["coordinates"]
                return (lon, lat)
    except Exception as e:
        logger.error(f"Geocoding failed for {query}: {e}")
        
    return None
