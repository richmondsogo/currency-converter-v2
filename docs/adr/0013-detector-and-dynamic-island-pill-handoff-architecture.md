# 0013. Detector and Dynamic Island Pill Handoff Architecture

Date: 2026-10-21
Status: Accepted

## Context
Currency Convertr must offer automatic conversion on pages where foreign prices are detected. The architecture requires a lightweight static detector content script (`detector.js`) running on every HTTP/HTTPS webpage at `document_idle`.

A key architectural challenge is deciding how the `OFFER` Dynamic Island pill is rendered on the page, and how it transitions to the full conversion engine (`content.js`, `PageScanner`, `rates.js`) without UI flash, duplicate host roots, or excessive memory overhead across non-shopping websites.

---

## Evaluated Alternatives

### Option A: Bundle the Pill UI into `detector.js`
In this approach, `detector.js` imports `InPageUI` and `ui.css` directly. When candidate prices are found, `detector.js` creates `#cc-dynamic-island-host` and renders the `OFFER` pill. Upon user acceptance, `detector.js` messages the background worker to inject `content.js`, which then takes over the mounted DOM or mounts a second UI.
- **Bundle Size**: ~35 KB - 40 KB minified [ESTIMATED / UNVERIFIED].
- **Pros**: Instant rendering of the OFFER pill without an asynchronous background message round-trip.
- **Cons**: Duplicates UI rendering logic between `detector.js` and `content.js`. Creating two distinct scripts that manipulate the same Shadow DOM root introduces race conditions, state synchronization complexity, and potential double-mounting.

### Option B: Ultra-Tiny Detector with On-Demand UI Bundle via `chrome.scripting`
`detector.js` contains solely the candidate counter. When $\ge \text{MIN\_PRICES}$ are detected, it notifies `background.js`. The background worker uses `chrome.scripting.executeScript` to inject a standalone UI bundle.
- **Bundle Size**: ~8 KB - 10 KB minified [ESTIMATED / UNVERIFIED].
- **Pros**: Minimizes initial memory footprint on pages without prices.
- **Cons**: Spawns multiple script injection lifecycles (detector -> background -> UI bundle -> conversion engine), increasing architectural surface area.

### Option C (Selected): Single Canonical Host with On-Demand Full Engine Injection
`detector.js` is kept strictly minimal, packaging only the dry-run `countCandidates()` logic and regex parser. It mounts zero DOM elements and attaches no Shadow Roots.
- When `countCandidates() >= MIN_PRICES` on an unconfigured site (`mode === 'ask'`):
  1. `detector.js` sends `MSG.OFFER_REQUESTED` (`{ type: MSG.OFFER_REQUESTED, hostname, count, detectedCurrency }`) to `background.js`.
  2. `background.js` verifies eligibility against `chrome.storage.session` suppression and site mode in `chrome.storage.local`.
  3. `background.js` injects the complete conversion engine `content.js` into the tab (or sends `MSG.SHOW_OFFER` if already present).
  4. `content.js` attaches the single canonical `#cc-dynamic-island-host` and mounts `InPageUI` in the `OFFER` state.
  5. When the user clicks `[Convert]`, `InPageUI` transitions directly in place (`OFFER` $\to$ `WORKING` $\to$ `CONVERTED`) and executes `PageScanner.convert()`.
  6. If the user clicks `[Not now]` or presses scoped `Escape`, `InPageUI` unmounts `#cc-dynamic-island-host`, and sends `MSG.SET_SESSION_SUPPRESSION` to `background.js` to persist in `chrome.storage.session`.

---

## Measured & Estimated Bundle Sizes

Bundle size measurements obtained via `esbuild` (`build.js` and throwaway prototype in scratch):
- `dist/chrome/content.js`: **131,007 bytes** (~131.0 KB minified) [MEASURED via active build]. Contains 170+ currency dataset `currencies-data.js`, `PageScanner`, `InPageUI`, inlined `ui.css`, and formatters.
- `dist/chrome/background.js`: **78,471 bytes** (~78.5 KB minified) [MEASURED via active build]. Contains `RatesEngine`, `SettingsManager`, and cross-rates calculation.
- Throwaway `detector.js` prototype (importing `src/shared/parser.js` with full `currencies-data.js`): **30,500 bytes** (~30.5 KB minified, 61,030 bytes unminified) [MEASURED via esbuild metafile].
  - Input breakdown: `currencies-data.js` (44.6 KB raw), `parser.js` (13.0 KB raw), `currencies.js` (5.1 KB raw).
- Potential future trimmed-down detector (major currencies only, without full 170+ currency dataset): **~8 KB – 10 KB** [ESTIMATED / UNVERIFIED].

---

## Session Storage Access Pattern

According to the official [Chrome Storage API Documentation](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session):
> *"By default, it's not exposed to content scripts, but this behavior can be changed by calling browser.storage.session.setAccessLevel()."*

In Mozilla Firefox (supported since Firefox 115), `StorageArea.setAccessLevel()` is **not supported**.

Therefore, directly accessing `storage.session` from content scripts is not cross-browser portable. Under Option C, all session suppression checks and writes are **routed through `background.js`**:
1. When `detector.js` detects $\ge 3$ candidate prices, it messages `background.js` via `MSG.OFFER_REQUESTED`.
2. `background.js` (which has direct unrestricted access to `chrome.storage.session`) checks whether the host is suppressed.
3. When the user clicks `[Not now]` or presses scoped `Escape` in the pill, `content.js` sends `MSG.SET_SESSION_SUPPRESSION` to `background.js` to store the host suppression key in `chrome.storage.session`.

---

## Decision

Adopt **Option C**.

1. **Clean Separation of Concerns**:
   - `detector.js`: Strictly a lightweight, read-only observer that detects whether prices exist on unconfigured sites. It never creates a DOM node.
   - `content.js`: The authoritative, single owner of `#cc-dynamic-island-host` and all in-page UI states (`OFFER`, `WORKING`, `CONVERTED`, `ORIGINAL`, `NOTHING_FOUND`, `ERROR`).
2. **Guaranteed Single Host Element**:
   - Exactly one `#cc-dynamic-island-host` is created.
   - Zero flash of unstyled content, zero race conditions, and zero DOM handoff friction between separate content scripts.
3. **95% Web Cleanliness**:
   - On the vast majority of web browsing pages (blogs, news, search results, documentation) where fewer than 3 foreign prices exist, only `detector.js` runs at idle, consuming zero DOM overhead.

---

## Consequences
- Standard message passing flow: `detector.js` $\to$ `background.js` $\to$ `content.js`.
- `content.js` accepts an initialization message (`MSG.SHOW_OFFER`) indicating whether to mount the pill in `OFFER` state or perform immediate conversion (for `'always'` sites and manual triggers).
