# Anti-Bot & Proxy Strategy Learnings

**Date:** July 15, 2026
**Context:** Attempting to scrape highly protected sites like IOF Eventor (`eventor.orienteering.sport`), which are aggressively guarded by Cloudflare.

## Executive Summary
Standard headless browsers (even when routed through high-quality residential proxies) are easily detected by modern Cloudflare instances. When dealing with extreme anti-bot protection, third-party scraping APIs like Firecrawl and Airtop offer a potential solution, but they come with strict limitations regarding custom proxy integration.

## Key Findings

### 1. Firecrawl
- **Proxy Capabilities:** Firecrawl's API **does not support "Bring Your Own Proxy" (BYO Proxy)**. If you attempt to inject a custom proxy URL (like Smartproxy) into the payload, the API will reject the request. Firecrawl forces you to rely exclusively on their internal proxy tiers (`basic`, `stealth`, or `enhanced`).
- **Cloudflare Bypass:** Despite not being able to use our custom Smartproxy IPs, Firecrawl's internal network is surprisingly effective. It was able to successfully bypass Cloudflare on Eventor and retrieve the page content.
- **Critical Technical Detail (HTML vs. Markdown):** Firecrawl defaults to returning parsed Markdown. However, if your scraping pipeline relies on deterministic DOM extraction (CSS/XPath selectors), you **must** configure Firecrawl to return raw `html` (`"formats": ["html"]`). Attempting to run CSS selectors against Markdown will result in silent failures where no elements are found.

### 2. Airtop
- **Proxy Capabilities:** Airtop natively supports custom proxy configuration. However, **the Airtop Free Tier explicitly prohibits the use of custom proxies.** Attempting to pass a custom proxy URL results in an HTTP 400 error: `"Custom proxies are not allowed on this plan"`.
- **Cloudflare Bypass:** Without the ability to inject our Smartproxy residential IPs, Airtop's standard headless sessions were unable to bypass Eventor's Cloudflare protections during our tests.

### 3. Local Headless Scraping (Playwright) + Smartproxy
- **Proxy Capabilities:** Fully supported. We successfully routed Playwright through Smartproxy's residential IP network.
- **Cloudflare Bypass:** **Failed.** Cloudflare's bot detection does not solely rely on IP reputation. It employs JS challenges, TLS fingerprinting, and Canvas fingerprinting. A raw headless Playwright instance, even when appearing as a residential user, is immediately flagged and blocked by Cloudflare. To defeat Cloudflare locally, advanced stealth plugins (like `playwright-stealth`) or specialized anti-detect browsers are required.

## Final Architecture Decision for Protected Sites
For sites with aggressive Cloudflare protection (like Eventor):
1. Use **Firecrawl** as the designated fetcher strategy.
2. Request `"formats": ["html"]` from Firecrawl to ensure compatibility with our deterministic CSS extraction pipeline.
3. Use our `LLMHealer` to automatically generate CSS selectors against the raw HTML returned by Firecrawl.
4. Reserve our Smartproxy pool for local `RawHTTP` and `Headless` fetchers targeting less aggressively protected sites.
