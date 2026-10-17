# Changelog

All notable changes to **Currency Convertr** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-10-17

### Added
- **In-Page Price Conversion ("Google Translate for Prices")**:
  - One-click page-wide price conversion via action popup button, keyboard shortcut (`Alt+Shift+C`), or context menu.
  - Three configurable display modes:
    - `Replace`: In-place conversion showing target currency only, with hover tooltip showing original price.
    - `Append`: Shows original and converted price side-by-side (e.g. `$20.00 (≈ ₦30,512)`).
    - `Replace + Highlight`: Subtle styled highlight on converted prices.
  - 100% byte-for-byte reversible DOM: original text values and DocumentFragments for multi-element split prices are retained in a `WeakMap`, guaranteeing exact restoration when clicking "Show original".
  - Split-price element detection: handles complex e-commerce layouts (such as Amazon's symbol + whole + decimal + fraction spans, `<sup>` cents, and nested spans).
  - Open Shadow DOM support: scans and converts prices inside open shadow roots.
  - Dynamic content handling: batched `MutationObserver` with 150ms debounce and loop prevention for SPAs and infinite scroll pages.
- **In-Page Floating Translate Bar & Custom Tooltip**:
  - Floating pill bar isolated inside an open Shadow DOM (`#currency-convertr-root`) to prevent host page CSS conflicts.
  - Displays converted currency, "Show original" button, quick target currency changer, and session dismissal.
  - Dark-mode aware, keyboard-accessible, and causes zero page layout shift (`position: fixed`).
  - Interactive tooltip on hover showing original amount, source currency, rate used, and rate date.
- **170+ Currencies & Enhanced Metadata**:
  - Full support for 162 ISO 4217 currencies and 14 major cryptocurrencies.
  - Static metadata generator (`scripts/generate-currencies.js`) leveraging `Intl.supportedValuesOf('currency')` with curated overrides.
  - Searchable combobox picker in popup and options with "Pinned", "Recent", and "All currencies" grouping.
- **Next-Generation Currency Detection**:
  - Unambiguous explicit token matching (ISO codes, `US$`, `CA$`, `AU$`, `NZ$`, `₦`, `€`, `zł`, `Kč`, `฿`, `₺`, etc.).
  - Structured data extraction: checks JSON-LD `priceCurrency`, OpenGraph `og:price:currency`, `product:price:currency`, and microdata `[itemprop="priceCurrency"]`.
  - Country-code TLD resolution table (.ca &rarr; CAD, .co.uk &rarr; GBP, .ng &rarr; NGN, .jp &rarr; JPY, etc.) and `<html lang>` region detection.
  - Per-site currency overrides and user-configurable default for ambiguous symbols (`$`, `¥`, `kr`).
- **3-Tier Rates Engine**:
  - Unified single rate table fetch with base EUR and cross-rate calculation: `rate(A -> B) = r[B] / r[A]`.
  - Primary tier: European Central Bank (ECB) via Frankfurter API.
  - Secondary tier: Fawaz Ahmed Currency API via jsDelivr CDN.
  - Tertiary fallback: Fawaz Ahmed Currency API via Cloudflare Pages.
  - Caching in `chrome.storage.local` with 6-hour TTL, stale-while-revalidate, in-flight fetch deduplication, and offline fallback.
- **Toolbar Action Popup & Options Page**:
  - Compact, modern popup (~340px) with live status, site auto-convert toggles, and rate freshness indicators.
  - Dedicated Options page: target currency, display mode, rounding, crypto visibility, up to 8 pinned currencies, per-site rule management, and JSON settings export/import.
- **Dynamic Site Scripting & Least-Privilege Permissions**:
  - `activeTab` + `scripting.executeScript` for manual conversion.
  - Dynamic content script registration (`scripting.registerContentScripts`) for auto-convert sites approved by user gesture with `optional_host_permissions: ["<all_urls>"]`.
- **Testing & Security**:
  - Full automated test suite (40 unit and DOM integration tests using `node:test` and `jsdom`).
  - Build output test asserting manifests, permissions, and zip archives.
  - Zero `innerHTML` usage across extension code for complete XSS prevention and clean `web-ext lint` validation.

### Changed
- Refactored entire codebase into modular ES modules bundled with `esbuild`.
- Preserved 100% backwards compatibility for v1 right-click context menu selection conversion and desktop notification.
- Updated documentation: `README.md`, `DESIGN.md`, `PRIVACY_POLICY.md`, `CHROMEWEBSTORE.md`.
