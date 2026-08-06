"""
Unit tests for dynamic scrape depth configuration and URL filtering rules.
"""

from datetime import datetime
from pydantic import HttpUrl
from scraper.models import SiteProfile, DepthConfig, ScrapedEvent, Venue
from scraper.orchestrator import Orchestrator


async def test_depth_config_max_depth_zero_skips_deep():
    """Verify max_depth=0 bypasses deep extraction entirely."""
    profile = SiteProfile(
        site_id="test_site",
        base_url="https://example.com",
        events_url="https://example.com/events",
        depth_config=DepthConfig(max_depth=0)
    )
    orchestrator = Orchestrator()
    events = [
        ScrapedEvent(
            source_site="test_site",
            name="Curling Championship 2026",
            source_url="https://example.com/events/1",
            start_date=datetime(2026, 3, 1)
        )
    ]
    
    result_events = await orchestrator._run_deep_extraction(events, profile)
    assert len(result_events) == 1
    # Deep extraction should be skipped, so venue remains unpopulated
    assert result_events[0].venue is None


async def test_depth_config_adaptive_skip():
    """Verify adaptive_depth skips deep hops if essential fields are present."""
    profile = SiteProfile(
        site_id="test_site",
        base_url="https://example.com",
        events_url="https://example.com/events",
        depth_config=DepthConfig(
            max_depth=1,
            adaptive_depth=True,
            skip_deep_if_fields_present=["venue_address", "start_date"]
        )
    )
    orchestrator = Orchestrator()
    events = [
        ScrapedEvent(
            source_site="test_site",
            name="Curling Masters 2026",
            source_url="https://example.com/events/2",
            start_date=datetime(2026, 4, 10),
            venue=Venue(name="Ice Rink", address="123 Main St, Ottawa")
        )
    ]
    
    result_events = await orchestrator._run_deep_extraction(events, profile)
    assert len(result_events) == 1
    assert result_events[0].venue.address == "123 Main St, Ottawa"


async def test_depth_config_exclude_url_patterns():
    """Verify exclude_url_patterns blocks matching links from deep extraction."""
    profile = SiteProfile(
        site_id="test_site",
        base_url="https://example.com",
        events_url="https://example.com/events",
        depth_config=DepthConfig(
            max_depth=1,
            adaptive_depth=False,
            exclude_url_patterns=[r"\.pdf$", r"/sponsor/"]
        )
    )
    orchestrator = Orchestrator()
    events = [
        ScrapedEvent(
            source_site="test_site",
            name="PDF Event Schedule",
            source_url="https://example.com/events/flyer.pdf",
            start_date=datetime(2026, 5, 1)
        )
    ]
    
    result_events = await orchestrator._run_deep_extraction(events, profile)
    assert len(result_events) == 1
    assert result_events[0].venue is None


async def test_runtime_max_depth_override():
    """Verify runtime override changes profile max_depth."""
    profile = SiteProfile(
        site_id="test_site",
        base_url="https://example.com",
        events_url="https://example.com/events",
        depth_config=DepthConfig(max_depth=1)
    )
    orchestrator = Orchestrator()
    
    # Override depth to 0
    profile.depth_config.max_depth = 0
    events = [
        ScrapedEvent(
            source_site="test_site",
            name="Overridden Event",
            source_url="https://example.com/events/3",
            start_date=datetime(2026, 6, 1)
        )
    ]
    result_events = await orchestrator._run_deep_extraction(events, profile)
    assert result_events[0].venue is None


if __name__ == "__main__":
    import asyncio
    print("Running test_depth_config_max_depth_zero_skips_deep...")
    asyncio.run(test_depth_config_max_depth_zero_skips_deep())
    print("Running test_depth_config_adaptive_skip...")
    asyncio.run(test_depth_config_adaptive_skip())
    print("Running test_depth_config_exclude_url_patterns...")
    asyncio.run(test_depth_config_exclude_url_patterns())
    print("Running test_runtime_max_depth_override...")
    asyncio.run(test_runtime_max_depth_override())
    print("All depth configuration tests passed successfully! [SUCCESS]")

