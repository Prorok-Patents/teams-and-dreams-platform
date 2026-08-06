import httpx
import logging
from typing import Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class UrlValidator:
    """Validates and normalizes URLs discovered during the intelligence phase."""
    
    @staticmethod
    def normalize_url(url: str) -> Optional[str]:
        """Ensures the URL has a scheme and is generally well-formed."""
        if not url:
            return None
        
        url = url.strip()
        if not url.startswith("http"):
            url = f"https://{url}"
            
        try:
            parsed = urlparse(url)
            if not parsed.netloc:
                return None
            return url
        except Exception:
            return None

    @staticmethod
    async def validate(url: str) -> Tuple[bool, Optional[str]]:
        """
        Check if a URL is reachable and resolves properly.
        Returns (is_valid, final_url)
        """
        normalized = UrlValidator.normalize_url(url)
        if not normalized:
            return False, None
            
        try:
            # We use GET with a small timeout, ignoring SSL errors, following redirects
            async with httpx.AsyncClient(verify=False, follow_redirects=True, timeout=10.0) as client:
                # Add a realistic user agent to avoid basic blocks
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                
                # Fetch a small chunk just to check headers/status
                async with client.stream("GET", normalized, headers=headers) as response:
                    # Some sites return 403 for generic scrapers but might work in Playwright.
                    # We'll allow 403 as "valid but protected", but block 404.
                    if response.status_code == 404:
                        return False, None
                        
                    # Return the URL we landed on after redirects
                    return True, str(response.url)
                    
        except httpx.RequestError as e:
            logger.debug(f"URL validation failed for {url}: {e}")
            return False, None
        except Exception as e:
            logger.debug(f"Unexpected error validating {url}: {e}")
            return False, None
