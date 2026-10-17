# Architecture & Implementation Decisions (v2.0.0)

This document records key technical decisions, trade-offs, and justifications made during the v2.0.0 evolution of Currency Convertr ("Google Translate for prices").

---

## 1. Bundling and Modular Architecture
- **Decision**: Use `esbuild` as a devDependency to bundle pure ESM modules from `src/shared/`, `src/content/`, `src/popup/`, and `src/options/` into self-contained IIFE/worker bundles in `dist/`.
- **Rationale**: Keeps runtime dependencies at zero, ensures zero remote code, and allows strict CSP in Manifest V3 without inline script execution or dynamic imports in browsers that don't support them.
- **Targets**:
  - `background.js`: Universal background script/worker.
  - `content.js`: In-page content script injected dynamically via `scripting.executeScript` or registered content scripts.
  - `popup/popup.js`: Toolbar extension popup logic.
  - `options/options.js`: Dedicated options/preferences page.

## 2. In-Page UI and CSS Isolation
- **Decision**: Isolate the Translate-style floating bar and custom price tooltips inside an open Shadow DOM attached to a custom container element (`<div id="currency-convertr-root">`).
- **Rationale**: Host pages often have aggressive global CSS resets or conflicting typography/colors. Shadow DOM guarantees that the extension's UI is pixel-perfect and cannot be broken by page styles, while preventing extension styles from polluting the host page.
- **In-Page CSS**: `ui.css` is injected directly into the Shadow Root via `<style>` tag.

## 3. Rate Fetching and Network Boundary
- **Decision**: All network requests for exchange rates are strictly performed by the background worker. Content scripts communicate with the background worker using typed message passing (`messaging.js`) to request rate data and conversions.
- **Rationale**: Many e-commerce sites enforce strict `connect-src` Content Security Policies that would block content scripts from calling external APIs. Centralizing rate fetching in the background guarantees 100% bypass of host page CSP restrictions, enables centralized caching in `chrome.storage.local`, deduplicates concurrent fetches across multiple tabs, and implements 3-tier fallback with stale-while-revalidate.

## 4. Multi-Tier Rate Fallback Architecture
- **Decision**: 3-Tier fallback hierarchy:
  1. Primary: European Central Bank (ECB) via Frankfurter API (`https://api.frankfurter.dev/v1/latest?base=EUR`).
  2. Secondary: Fawaz Ahmed Currency API via jsDelivr CDN (`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json`).
  3. Tertiary: Fawaz Ahmed Currency API via Cloudflare Pages fallback host (`https://latest.currency-api.pages.dev/v1/currencies/eur.json`).
- **Merge Precedence**: Base currency is EUR. We normalize all rates to EUR. For any pair $(A \to B)$, cross-rate is computed as $r[B] / r[A]$. Rates present in ECB take precedence for central-bank accuracy; regional and exotic currencies (e.g. NGN, GHS, KES) and crypto are filled from Fawaz.
- **Cache Policy**: Stored in `chrome.storage.local` with a 6-hour TTL. Stale-while-revalidate: if cache is expired, return cached data immediately and trigger a background refresh. If all network tiers fail, continue using stale data and flag "Using rates from <date>".

## 5. Permission Footprint and Dynamic Scripting
- **Decision**: Keep manifest `permissions` strictly to `["contextMenus", "notifications", "storage", "activeTab", "scripting"]`. Do NOT request `<all_urls>` statically. Set `optional_host_permissions: ["<all_urls>"]`.
- **Auto-Convert Execution**:
  - When a user enables "Always convert on this site", request origin permission via `chrome.permissions.request({ origins: [origin + '/*'] })`.
  - In Chromium and Firefox MV3, use `chrome.scripting.registerContentScripts` for approved origins where supported.
  - Fallback: Listen to `chrome.tabs.onUpdated` in the background worker for approved origins and execute `scripting.executeScript({ target: { tabId }, files: ['content.js'] })`.
  - Manual "Convert this page" click in popup or keyboard shortcut uses `activeTab` + `scripting.executeScript`.

## 6. Page Price Detection and Scanning
- **Decision**: Two-phase DOM scanner:
  1. Text node scanning with regex boundary checks, avoiding blacklisted tags (`script`, `style`, `noscript`, `textarea`, `input`, `select`, `option`, `code`, `pre`, `svg`, `canvas`, `[contenteditable]`, `[data-cc-ignore]`).
  2. Split-price element assembly: For elements whose `textContent` is short (<40 chars) matching a price pattern across multiple child elements (e.g., Amazon's symbol + whole + decimal + fraction spans), convert the element as a unit and store original child nodes in a `WeakMap<Element, DocumentFragment>` for byte-for-byte fidelity upon revert.
- **Performance & Batching**: Batched DOM walking with `requestIdleCallback` (or `setTimeout` fallback) in chunks of ~200 nodes.
- **MutationObserver**: Debounced by ~150ms. Ignores mutations triggered by our own DOM changes using data attributes and internal markers to prevent infinite loops.

## 7. Currency Metadata Generation
- **Decision**: Build `scripts/generate-currencies.js` using Node's `Intl.supportedValuesOf('currency')`, `Intl.DisplayNames`, and `Intl.NumberFormat`, merged with a curated override map for symbols, aliases, and ccTLD mappings, generating `src/shared/currencies-data.js`.
- **Static Artifact**: Committed to the repository so the runtime extension has zero build-time dependency on live external metadata.

## 8. Zero `innerHTML` and XSS Prevention
- **Decision**: Ban `innerHTML` completely across all extension entry points (`content/ui.js`, `popup/popup.js`, `options/options.js`). Build all elements strictly using native DOM APIs (`document.createElement()`, `document.createTextNode()`, `element.replaceChildren()`, `element.textContent`).
- **Rationale**: Eliminates the risk of script injection from untrusted web page contents or malformed price strings. Guarantees 100% compliance with Mozilla Add-on Review Policies and passes `web-ext lint` with zero errors, zero notices, and zero warnings.

## 9. Innermost-First Split Price Assembly
- **Decision**: When detecting split prices across sibling/child tags (such as Amazon product blocks or nested currency/decimal spans), candidate elements are sorted ascending by descendant element count (`getElementsByTagName('*').length`), evaluating innermost elements first. Additionally, any element that contains an already-converted child or whose ancestor is already converted is skipped.
- **Rationale**: Prevents outer wrapper containers (like a whole card or price container `<div>`) from wiping out sibling markup when only an inner `<span>` is the true split-price unit. Ensures 100% byte-for-byte fidelity when reverting prices.

## 10. Open Shadow DOM Traversal
- **Decision**: Implement recursive shadow root discovery via `_findAllRoots()`. Both TreeWalker text node scans and split-price candidate selections iterate across light DOM and all open shadow DOM trees attached to host elements.
- **Rationale**: Modern web applications and web components frequently encapsulate checkout or catalog UI inside Shadow DOM. Scanning open shadow roots ensures prices in modern web components are converted seamlessly.

## 11. Firefox MV3 & Cross-Browser Shim
- **Decision**: Use `src/shared/browser.js` to provide unified promise-based access to `chrome.*` and `browser.*` APIs. Firefox uses `background.scripts: ["background.js"]` and preserves the gecko add-on ID `currency-converter-fx@richmond.addons`, while Chrome uses `background.service_worker: "background.js"`.
- **Rationale**: Ensures full parity and idiomatic Manifest V3 compliance across Chromium engines (Chrome, Edge, Brave, Opera) and Mozilla Gecko (Firefox).

