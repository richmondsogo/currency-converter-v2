# 0004. Multi-Tier Rate Fallback Architecture

Date: 2026-03-01
Status: Accepted

## Context
Third-party rate APIs can encounter outages, rate-limiting, or domain blocking. A resilient currency converter must ensure users never experience broken conversions when a single external host fails.

## Decision
Implement a 3-tier fallback hierarchy normalized to EUR base currency:
1. **Primary**: European Central Bank (ECB) via Frankfurter API (`https://api.frankfurter.dev/v1/latest?base=EUR`).
2. **Secondary**: Fawaz Ahmed Currency API via jsDelivr CDN (`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`).
3. **Tertiary**: Fawaz Ahmed Currency API via Cloudflare Pages fallback host (`https://latest.currency-api.pages.dev/v1/currencies/eur.json`).

Cross-rate computation for pair $(A \to B)$ is derived as:
$$\text{rate}(A \to B) = \frac{\text{rate}(EUR \to B)}{\text{rate}(EUR \to A)}$$

- **Merge Precedence**: Central bank rates from ECB take precedence for major currencies; exotic/regional currencies (e.g. NGN, GHS, KES) and crypto are filled from Fawaz Ahmed.
- **Cache Policy**: Stored in `chrome.storage.local` with a 6-hour TTL. Implements stale-while-revalidate: if expired, cached rates are returned immediately while refreshing in the background. If all tiers fail, stale rates continue to be used with a timestamp label.

## Rationale
- Maximizes availability: 3 independent hosts provide near-100% uptime.
- Breadth & Accuracy: Merging ECB with Fawaz covers 170+ fiat currencies and major crypto with central-bank precision.
- Stale-while-revalidate prevents network latency from blocking in-page rendering.

## Consequences
- Requires host permissions for the three rate providers in `manifest.json`.
