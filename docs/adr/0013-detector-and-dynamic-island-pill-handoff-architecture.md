# 0013. Detector and Dynamic Island Pill Handoff Architecture

Date: 2026-10-21
Status: Accepted

## Context
Currency Convertr must offer automatic conversion on pages where foreign prices are detected. The architecture requires a lightweight static detector content script (`detector.js`) running on every HTTP/HTTPS webpage at `document_idle`.

A key architectural challenge is deciding how the `OFFER` Dynamic Island pill is rendered on the page, and how it transitions to the full conversion engine (`content.js`, `PageScanner`, `rates.js`) without UI flash, duplicate host roots, or excessive memory overhead across non-shopping websites.

---

## Evaluated Alternatives

### Option A: Bundle the Pill UI into `detector.js`
In this approach, `detector.js` imports `InPageUI` and `ui.css` directly. When candidate prices are found, `detector.js` immediately creates `#cc-dynamic-island-host` and renders the `OFFER` pill. Upon user acceptance, `detector.js` messages the background worker to inject `content.js`, which then takes over the mounted DOM or mounts a second UI.
- **Bundle Size**: `detector.js` expands to ~35 KB - 40 KB (including `ui.css`, SVG icons, and UI rendering logic).
- **Pros**: Instant rendering of the OFFER pill without an asynchronous background message round-trip.
- **Cons**: Duplicates UI rendering logic between `detector.js` and `content.js`. Creating two distinct scripts that manipulate the same Shadow DOM root introduces race conditions, state synchronization complexity, and potential double-mounting.

### Option B: Ultra-Tiny Detector with On-Demand UI Bundle via `chrome.scripting`
`detector.js` contains solely the read-only candidate counter (~8 KB). When $\ge \text{MIN\_PRICES}$ are detected, it notifies `background.js`. The background worker uses `chrome.scripting.executeScript` to inject a standalone UI bundle.
- **Bundle Size**: `detector.js` is ultra-light (~8 KB).
- **Pros**: Minimizes initial memory footprint on pages without prices.
- **Cons**: Spawns multiple script injection lifecycles (detector -> background -> UI bundle -> conversion engine), increasing architectural surface area.

### Option C (Selected): Single Canonical Host with On-Demand Full Engine Injection
`detector.js` is kept strictly minimal (~8 KB - 10 KB), packaging only the dry-run `countCandidates()` logic and regex parser. It mounts zero DOM elements and attaches no Shadow Roots.
- When `countCandidates() >= MIN_PRICES` on an unconfigured site (`mode === 'ask'`):
  1. `detector.js` sends `MSG.OFFER_REQUESTED` (`{ type: MSG.OFFER_REQUESTED, count, detectedCurrency }`) to `background.js`.
  2. `background.js` verifies eligibility (site not in session suppression, not in `perSite` as `'never'`).
  3. `background.js` injects the complete conversion engine `content.js` into the tab (or sends `MSG.SHOW_OFFER` if already injected).
  4. `content.js` attaches the single canonical `#cc-dynamic-island-host` and mounts `InPageUI` in the `OFFER` state.
  5. When the user clicks `[Convert]`, `InPageUI` transitions directly in place (`OFFER` $\to$ `WORKING` $\to$ `CONVERTED`) and executes `PageScanner.convert()`.
  6. If the user clicks `[Not now]` or presses `Escape` while focused on the pill, `InPageUI` fades out, unmounts `#cc-dynamic-island-host`, and registers session suppression in `chrome.storage.session`.

---

## Measured & Estimated Bundle Sizes

Based on active production builds (`node build.js` with `esbuild`):
- `dist/chrome/content.js`: **131,007 bytes** (~131 KB) (includes 170+ currency dataset `currencies-data.js`, `PageScanner`, `InPageUI`, inlined `ui.css`, and formatters).
- `dist/chrome/background.js`: **78,471 bytes** (~78 KB) (includes `RatesEngine`, `SettingsManager`, cross-rates calculation).
- Target `dist/chrome/detector.js` (dry-run scanner + regex parser only): **~8 KB – 10 KB** (measured against isolated esbuild entry prototype).

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
   - On the vast majority of web browsing pages (blogs, news, search results, documentation) where fewer than 3 prices exist, only the ~8 KB `detector.js` runs at idle, consuming negligible memory and zero DOM overhead.

---

## Consequences
- Requires a standard message passing flow: `detector.js` $\to$ `background.js` $\to$ `content.js`.
- `content.js` must support an initialization payload indicating whether to start directly in `OFFER` state or execute immediate conversion (for `'always'` sites and manual triggers).
