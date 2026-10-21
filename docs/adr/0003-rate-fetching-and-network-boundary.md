# 0003. Rate Fetching and Network Boundary

Date: 2026-03-01
Status: Accepted

## Context
E-commerce websites frequently deploy strict Content Security Policies with restrictive `connect-src` directives that block in-page scripts from sending network requests to external API endpoints. Furthermore, multiple open tabs on the same origin could trigger redundant network fetches if rates were requested from the content script directly.

## Decision
All network requests for exchange rates are strictly performed by the background service worker. Content scripts and popup pages communicate with the background worker using typed message passing (`messaging.js`) to request rate data and conversions.

## Rationale
- CSP Bypass: Background service workers are not constrained by host-page `connect-src` policies.
- Centralized Caching: Rates are cached centrally in `chrome.storage.local`, making them instantly available to all active tabs.
- Request Deduplication: In-flight network requests are deduplicated centrally so that simultaneous tab requests share a single external fetch.

## Consequences
- Requires an asynchronous messaging round-trip between content scripts and the background worker before conversions can proceed.
