import httpx
from bs4 import BeautifulSoup
from typing import Optional

from scraper.core.proxy import ProxyManager, ProxyTier

class WikipediaParser:
    """Fetches and parses Wikipedia pages for sports to extract context."""
    
    BASE_URL = "https://en.wikipedia.org/w/api.php"
    
    def __init__(self):
        self.proxy_manager = ProxyManager()
        self.headers = {
            "User-Agent": "SportsEventDiscovery/1.0 (willprorok@gmail.com; educational research client)"
        }
        
    async def get_page_summary(self, title: str) -> Optional[str]:
        """Get the plain text summary (intro) of a Wikipedia page."""
        params = {
            "action": "query",
            "format": "json",
            "prop": "extracts",
            "exintro": True,
            "explaintext": True,
            "titles": title
        }
        
        async with httpx.AsyncClient(headers=self.headers, verify=False, timeout=30.0) as client:
            response = await client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            pages = data.get("query", {}).get("pages", {})
            for page_id, page_data in pages.items():
                if page_id == "-1":
                    return None
                return page_data.get("extract", "")
        return None
        
    async def get_full_text(self, title: str) -> Optional[str]:
        """Get the full text of a Wikipedia page (stripped of HTML)."""
        params = {
            "action": "parse",
            "format": "json",
            "page": title,
            "prop": "text",
            "disableeditsection": True
        }
        
        async with httpx.AsyncClient(headers=self.headers, verify=False, timeout=30.0) as client:
            response = await client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            if "error" in data:
                return None
                
            html_content = data["parse"]["text"]["*"]
            soup = BeautifulSoup(html_content, "html.parser")
            
            # Remove references and navboxes to save tokens
            for element in soup.select(".reference, .navbox, .metadata, style, script"):
                element.decompose()
                
            return soup.get_text(separator="\n", strip=True)

    async def fetch_related_pages(self, urls: list[str]) -> str:
        """Fetches multiple Wikipedia pages concurrently and returns their concatenated text."""
        import asyncio
        import re
        
        # Extract titles from URLs
        titles = []
        for url in urls:
            if not url: continue
            match = re.search(r'/wiki/([^#?]+)', url)
            if match:
                titles.append(match.group(1))
            elif not url.startswith('http'):
                titles.append(url)
                
        # Deduplicate and limit to prevent massive fetches
        titles = list(set(titles))[:15]
        
        results = []
        for i, title in enumerate(titles):
            if i > 0:
                await asyncio.sleep(0.2) # WMF rate limit respect
            text = await self.get_full_text(title)
            if text:
                results.append(f"--- Wikipedia Page: {title} ---\n{text}")
                
        return "\n\n".join(results)
