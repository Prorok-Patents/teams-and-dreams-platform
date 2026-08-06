import httpx
from typing import Dict, Any, List
from scraper.discovery.config import settings

class SerperClient:
    """Wrapper for the Serper.dev API for web searches."""
    
    BASE_URL = "https://google.serper.dev/search"
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.serper_api_key
        if not self.api_key:
            raise ValueError("SERPER_API_KEY is not set.")
            
    async def search(self, query: str, num_results: int = 10) -> Dict[str, Any]:
        """Perform a Google search using Serper."""
        headers = {
            "X-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "q": query,
            "num": num_results
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.BASE_URL, 
                headers=headers, 
                json=payload,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
            
    async def get_top_links(self, query: str, num_results: int = 5) -> List[str]:
        """Return just the URLs of the top organic results."""
        results = await self.search(query, num_results)
        links = []
        for item in results.get("organic", []):
            if "link" in item:
                links.append(item["link"])
        return links
