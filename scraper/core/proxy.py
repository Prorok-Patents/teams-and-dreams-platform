"""
Proxy management with tiered escalation.

Strategy:
  1. Try with no proxy (dev) or datacenter proxy (cheapest)
  2. If blocked (403, CAPTCHA), escalate to residential
  3. If still blocked, escalate to mobile (most expensive, hardest to detect)

Smartproxy integration is configured via environment variables.
"""

from __future__ import annotations

import logging
import os
import random
from dataclasses import dataclass, field
from typing import Optional

from ..models import ProxyTier

logger = logging.getLogger(__name__)


@dataclass
class SmartproxyConfig:
    """
    Smartproxy connection configuration.
    Reads credentials from environment variables.
    """
    username: str = field(default_factory=lambda: os.getenv("SMARTPROXY_USER", ""))
    password: str = field(default_factory=lambda: os.getenv("SMARTPROXY_PASS", ""))

    # Smartproxy gateway endpoints (overridden by env variables if set)
    datacenter_host: str = field(default_factory=lambda: os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net"))
    datacenter_port: int = field(default_factory=lambda: int(os.getenv("SMARTPROXY_PORT", "3120")))
    residential_host: str = field(default_factory=lambda: os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net"))
    residential_port: int = field(default_factory=lambda: int(os.getenv("SMARTPROXY_PORT", "3120")))
    mobile_host: str = field(default_factory=lambda: os.getenv("SMARTPROXY_HOST", "proxy.smartproxy.net"))
    mobile_port: int = field(default_factory=lambda: int(os.getenv("SMARTPROXY_PORT", "3120")))

    def get_proxy_url(self, tier: ProxyTier) -> Optional[str]:
        """Build the proxy URL for the given tier."""
        enforce = os.getenv("ENFORCE_PROXIES", "false").lower() == "true"

        # If proxies are strictly enforced, elevate NONE to DATACENTER to protect local IP
        if tier == ProxyTier.NONE and enforce:
            tier = ProxyTier.DATACENTER

        if tier != ProxyTier.NONE:
            if not self.username or not self.password:
                raise RuntimeError(
                    "CRITICAL: Proxy requested or enforced, but Smartproxy credentials are not set "
                    "(SMARTPROXY_USER and SMARTPROXY_PASS are empty). Aborting request to prevent scraping with local IP."
                )

        if tier == ProxyTier.NONE:
            return None

        host_map = {
            ProxyTier.DATACENTER: (self.datacenter_host, self.datacenter_port),
            ProxyTier.RESIDENTIAL: (self.residential_host, self.residential_port),
            ProxyTier.MOBILE: (self.mobile_host, self.mobile_port),
        }
        host, port = host_map[tier]
        return f"http://{self.username}:{self.password}@{host}:{port}"


class ProxyManager:
    """
    Manages proxy selection and tier escalation.

    Usage:
        manager = ProxyManager()
        proxy = manager.get_proxy(ProxyTier.DATACENTER)
        # ... if request fails with 403 ...
        proxy = manager.escalate(current_tier=ProxyTier.DATACENTER)
    """

    ESCALATION_ORDER = [
        ProxyTier.NONE,
        ProxyTier.DATACENTER,
        ProxyTier.RESIDENTIAL,
        ProxyTier.MOBILE,
    ]

    def __init__(self, config: Optional[SmartproxyConfig] = None):
        self.config = config or SmartproxyConfig()
        self._request_count = {tier: 0 for tier in ProxyTier}

    def get_proxy(self, tier: ProxyTier) -> Optional[str]:
        """Get the proxy URL for the specified tier."""
        proxy = self.config.get_proxy_url(tier)
        self._request_count[tier] += 1
        if proxy:
            logger.debug(f"Using {tier.value} proxy (request #{self._request_count[tier]})")
        return proxy

    def escalate(self, current_tier: ProxyTier) -> ProxyTier:
        """
        Escalate to the next proxy tier after a block/failure.
        Returns the new tier (does NOT return the proxy URL).
        """
        current_idx = self.ESCALATION_ORDER.index(current_tier)
        if current_idx < len(self.ESCALATION_ORDER) - 1:
            new_tier = self.ESCALATION_ORDER[current_idx + 1]
            logger.info(f"Escalating proxy: {current_tier.value} → {new_tier.value}")
            return new_tier
        else:
            logger.warning(f"Already at highest proxy tier ({current_tier.value}). Cannot escalate.")
            return current_tier

    def get_stats(self) -> dict[str, int]:
        """Return request counts per proxy tier for monitoring."""
        return {tier.value: count for tier, count in self._request_count.items()}


# ---------------------------------------------------------------------------
# User-Agent rotation
# ---------------------------------------------------------------------------

# A curated list of real, modern browser User-Agent strings.
# Rotated randomly per request to avoid fingerprinting.
USER_AGENTS = [
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Chrome on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Firefox on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    # Firefox on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
    # Safari on macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    # Edge on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
]


def get_random_user_agent() -> str:
    """Return a random User-Agent string."""
    return random.choice(USER_AGENTS)


def get_random_headers() -> dict[str, str]:
    """
    Return a realistic set of HTTP headers for a browser request.
    Rotates User-Agent and includes common headers to avoid detection.
    """
    ua = get_random_user_agent()
    return {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }
