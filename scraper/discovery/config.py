import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class DiscoveryConfig(BaseSettings):
    """Configuration for the Sports Knowledge Graph discovery pipeline."""
    
    # API Keys
    serper_api_key: str = os.getenv("SERPER_API_KEY", "")
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "") # For Gemini
    
    # LLM Settings
    model_name: str = "gemini-2.5-flash"
    
    # Discovery Limits
    max_search_results: int = 10
    max_wikipedia_depth: int = 2
    max_sub_org_crawl: int = 80
    max_crawl_depth: int = 2
    crawl_delay_seconds: float = 1.5
    
    # Concurrency
    max_concurrent_requests: int = 5
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = DiscoveryConfig()
