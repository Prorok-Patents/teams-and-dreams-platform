"""
The Orchestrator — the brain of the scraping pipeline.

This module ties together the fetcher, extractor, and healer into
the complete self-healing scraping flow:

  1. Fetch the page (Raw HTTP → Headless escalation)
  2. Try deterministic extraction (CSS selectors)
  3. If extraction fails → trigger LLM Healer
  4. If healer succeeds → update profile, re-extract deterministically
  5. Store raw results in MongoDB, deduplicated results to Postgres
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    ProxyTier,
    ScrapedEvent,
    SiteProfile,
    SiteStrategy,
)
from .core.fetcher import FetchResult, get_fetcher
from .core.proxy import ProxyManager
from .extractors.deterministic import DeterministicExtractor, ExtractionError
from .extractors.deep import DeepExtractor
from .discovery.searcher import EventSearcher
from .healers.llm_healer import LLMHealer

logger = logging.getLogger(__name__)


class ScrapeResult:
    """Final result of a scraping run for a single site."""

    def __init__(
        self,
        site_id: str,
        events: list[ScrapedEvent],
        strategy_used: SiteStrategy,
        proxy_tier_used: ProxyTier,
        was_healed: bool = False,
        error: Optional[str] = None,
    ):
        self.site_id = site_id
        self.events = events
        self.strategy_used = strategy_used
        self.proxy_tier_used = proxy_tier_used
        self.was_healed = was_healed
        self.error = error
        self.scraped_at = datetime.utcnow()

    @property
    def is_success(self) -> bool:
        return len(self.events) > 0 and self.error is None


class Orchestrator:
    """
    The main pipeline orchestrator.

    Usage:
        orchestrator = Orchestrator()
        profile = load_profile("worldcurling_org")
        result = await orchestrator.scrape(profile)
    """

    def __init__(
        self,
        proxy_manager: Optional[ProxyManager] = None,
        llm_healer: Optional[LLMHealer] = None,
        profiles_dir: Optional[Path] = None,
    ):
        self.proxy_manager = proxy_manager or ProxyManager()
        self.healer = llm_healer or LLMHealer()
        self.deep_extractor = DeepExtractor(proxy_manager=self.proxy_manager)
        self.searcher = EventSearcher()
        self.profiles_dir = profiles_dir or Path(__file__).parent / "profiles"

    async def scrape(self, profile: SiteProfile, max_depth: Optional[int] = None) -> ScrapeResult:
        """
        Execute the full scraping pipeline for a single site.

        Flow:
          1. Fetch → 2. Extract → 3. (Heal if needed) → 4. Return
        """
        if max_depth is not None:
            logger.info(f"⚙️ Overriding profile max_depth to {max_depth}")
            profile.depth_config.max_depth = max_depth

        logger.info(f"{'='*60}")
        logger.info(f"Starting scrape: {profile.site_id}")
        logger.info(f"  Strategy: {profile.strategy.value}")
        logger.info(f"  Proxy: {profile.proxy_tier.value}")
        logger.info(f"  Max Depth: {profile.depth_config.max_depth}")
        logger.info(f"{'='*60}")

        # ----- Step 1: FETCH -----
        fetch_result = await self._fetch_with_escalation(profile)
        if fetch_result.is_blocked:
            return ScrapeResult(
                site_id=profile.site_id,
                events=[],
                strategy_used=fetch_result.strategy_used,
                proxy_tier_used=fetch_result.proxy_tier_used,
                error=f"Blocked after escalation (status={fetch_result.status_code})",
            )

        # ----- Step 2: DETERMINISTIC EXTRACT -----
        try:
            extractor = DeterministicExtractor(profile)
            events = extractor.extract(fetch_result.content)
            logger.info(f"✅ Deterministic extraction succeeded: {len(events)} events")

            # Update profile's success timestamp
            profile.last_successful_scrape = datetime.utcnow()
            profile.consecutive_failures = 0

            # Run deep extraction before returning
            events = await self._run_deep_extraction(events, profile)

            return ScrapeResult(
                site_id=profile.site_id,
                events=events,
                strategy_used=fetch_result.strategy_used,
                proxy_tier_used=fetch_result.proxy_tier_used,
            )

        except ExtractionError as e:
            logger.warning(f"Deterministic extraction failed: {e}")
            profile.consecutive_failures += 1

        # ----- Step 3: SELF-HEALING -----
        logger.info("🔧 Triggering self-healing pipeline...")
        heal_result = await self.healer.heal(fetch_result.content, profile)

        # ----- Step 3.5: LLM-GUIDED ESCALATION -----
        if getattr(heal_result, "requires_interaction", False) and profile.strategy != SiteStrategy.INTERACTIVE:
            logger.info("🧠 LLM detected interaction barrier. Escalating to INTERACTIVE strategy...")
            profile.strategy = SiteStrategy.INTERACTIVE
            profile.requires_interaction = True
            self._save_profile(profile)

            logger.info("🔄 Refetching interactively...")
            fetcher = get_fetcher(SiteStrategy.INTERACTIVE, self.proxy_manager)
            fetch_result = await fetcher.fetch(str(profile.events_url), profile)
            
            if not fetch_result.is_blocked:
                logger.info("🔧 Re-triggering self-healing pipeline on interactive DOM...")
                heal_result = await self.healer.heal(fetch_result.content, profile)

        if not heal_result.is_successful:
            return ScrapeResult(
                site_id=profile.site_id,
                events=[],
                strategy_used=fetch_result.strategy_used,
                proxy_tier_used=fetch_result.proxy_tier_used,
                was_healed=False,
                error=f"Self-healing failed: {heal_result.notes}",
            )

        # ----- Step 4: UPDATE PROFILE & RE-EXTRACT -----
        logger.info("Updating profile with new selectors from LLM...")
        profile.selectors = heal_result.selectors
        profile.last_healed_at = datetime.utcnow()

        # Save updated profile
        self._save_profile(profile)

        # Re-run deterministic extraction with new selectors
        try:
            extractor = DeterministicExtractor(profile)
            events = extractor.extract(fetch_result.content)
            logger.info(f"✅ Post-heal extraction succeeded: {len(events)} events")

            profile.last_successful_scrape = datetime.utcnow()
            profile.consecutive_failures = 0

            # Run deep extraction before returning
            events = await self._run_deep_extraction(events, profile)

            return ScrapeResult(
                site_id=profile.site_id,
                events=events,
                strategy_used=fetch_result.strategy_used,
                proxy_tier_used=fetch_result.proxy_tier_used,
                was_healed=True,
            )

        except ExtractionError as e:
            logger.error(f"Post-heal extraction still failed: {e}")
            return ScrapeResult(
                site_id=profile.site_id,
                events=[],
                strategy_used=fetch_result.strategy_used,
                proxy_tier_used=fetch_result.proxy_tier_used,
                was_healed=True,
                error=f"Post-heal extraction failed: {e}",
            )

    async def _run_deep_extraction(self, events: list[ScrapedEvent], profile: SiteProfile) -> list[ScrapedEvent]:
        """Iterate through events, apply dynamic depth rules, and deep-extract details."""
        cfg = profile.depth_config
        logger.info(
            f"📊 Deep extraction config -- max_depth: {cfg.max_depth}, "
            f"max_pages: {cfg.max_pages_per_run}, adaptive: {cfg.adaptive_depth}"
        )

        if cfg.max_depth < 1:
            logger.info("⏩ Skipping deep extraction: profile max_depth is 0 (list-page only).")
            return events

        import re
        enriched_events = []
        pages_fetched = 1  # Base listing page counts as 1 request

        for event in events:
            # 1. Page budget check
            if pages_fetched >= cfg.max_pages_per_run:
                logger.warning(
                    f"⚠️ Reached max_pages_per_run limit ({cfg.max_pages_per_run}). Skipping remaining deep hops."
                )
                enriched_events.append(event)
                continue

            # 2. Adaptive skip check
            if cfg.adaptive_depth:
                has_essential_fields = True
                if "venue_address" in cfg.skip_deep_if_fields_present and (not event.venue or not event.venue.address):
                    has_essential_fields = False
                if "start_date" in cfg.skip_deep_if_fields_present and not event.start_date:
                    has_essential_fields = False

                if has_essential_fields:
                    logger.info(f"⏩ Adaptive skip for '{event.name}': essential fields already present.")
                    enriched_events.append(event)
                    continue

            # 3. Determine target URL to hop
            url_to_hop = None
            if str(event.source_url) == str(profile.events_url) or str(event.source_url) == str(profile.base_url):
                logger.info(f"Event '{event.name}' has no specific link. Engaging Searcher...")
                discovered_url = await self.searcher.find_event_url(event)
                if discovered_url:
                    url_to_hop = discovered_url
                    event.source_url = discovered_url
            else:
                url_to_hop = str(event.source_url)

            # 4. URL Pattern Filtering
            if url_to_hop:
                if cfg.exclude_url_patterns and any(re.search(pat, url_to_hop) for pat in cfg.exclude_url_patterns):
                    logger.info(f"🚫 Skipping '{url_to_hop}': matched exclude_url_patterns.")
                    enriched_events.append(event)
                    continue

                if cfg.follow_url_patterns and not any(re.search(pat, url_to_hop) for pat in cfg.follow_url_patterns):
                    logger.info(f"🚫 Skipping '{url_to_hop}': did not match follow_url_patterns.")
                    enriched_events.append(event)
                    continue

                pages_fetched += 1
                event = await self.deep_extractor.extract(url_to_hop, event)

            enriched_events.append(event)

        return enriched_events

    async def _fetch_with_escalation(self, profile: SiteProfile) -> FetchResult:
        """
        Fetch with automatic strategy and proxy escalation.

        Escalation chain:
          Raw HTTP + Datacenter → Raw HTTP + Residential →
          Headless + Residential → Headless + Mobile
        """
        url = str(profile.events_url)

        # Attempt 1: Use profile's configured strategy & proxy
        fetcher = get_fetcher(profile.strategy, self.proxy_manager)
        result = await fetcher.fetch(url, profile)

        if not result.is_blocked:
            return result

        # Attempt 2: Escalate proxy tier
        new_tier = self.proxy_manager.escalate(profile.proxy_tier)
        if new_tier != profile.proxy_tier:
            profile.proxy_tier = new_tier
            result = await fetcher.fetch(url, profile)
            if not result.is_blocked:
                return result

        # Attempt 3: Escalate to headless browser
        if profile.strategy != SiteStrategy.HEADLESS:
            logger.info("Escalating to headless browser...")
            profile.strategy = SiteStrategy.HEADLESS
            fetcher = get_fetcher(SiteStrategy.HEADLESS, self.proxy_manager)
            result = await fetcher.fetch(url, profile)
            if not result.is_blocked:
                return result

            # Attempt 4: Headless + highest proxy tier
            new_tier = self.proxy_manager.escalate(profile.proxy_tier)
            if new_tier != profile.proxy_tier:
                profile.proxy_tier = new_tier
                result = await fetcher.fetch(url, profile)
                if not result.is_blocked:
                    return result

        # Attempt 5: Escalate to Firecrawl API
        if profile.strategy != SiteStrategy.FIRECRAWL:
            logger.info("Escalating to Firecrawl API...")
            profile.strategy = SiteStrategy.FIRECRAWL
            profile.proxy_tier = ProxyTier.NONE
            fetcher = get_fetcher(SiteStrategy.FIRECRAWL, self.proxy_manager)
            result = await fetcher.fetch(url, profile)

        return result

    def _save_profile(self, profile: SiteProfile) -> None:
        """Save the updated profile back to disk, archiving the old version first."""
        self.profiles_dir.mkdir(parents=True, exist_ok=True)
        filepath = self.profiles_dir / f"{profile.site_id}.json"
        
        # Archive old profile if it exists
        if filepath.exists():
            history_dir = self.profiles_dir / "history"
            history_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            archive_path = history_dir / f"{profile.site_id}_{timestamp}.json"
            
            import shutil
            shutil.copy2(filepath, archive_path)
            logger.info(f"Archived old profile to {archive_path}")

        filepath.write_text(profile.model_dump_json(indent=2))
        logger.info(f"Saved updated profile: {filepath}")


# ---------------------------------------------------------------------------
# Profile loading helper
# ---------------------------------------------------------------------------

def load_profile(site_id: str, profiles_dir: Optional[Path] = None) -> SiteProfile:
    """Load a site profile from the profiles directory."""
    profiles_dir = profiles_dir or Path(__file__).parent / "profiles"
    filepath = profiles_dir / f"{site_id}.json"

    if not filepath.exists():
        raise FileNotFoundError(f"No profile found for site '{site_id}' at {filepath}")

    return SiteProfile.model_validate_json(filepath.read_text())
