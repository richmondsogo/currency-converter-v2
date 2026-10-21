# Step 02: Behavior Specification & Consolidated Pipeline

- **Branch**: `step/02-behavior-spec`
- **Target Branch**: `main`
- **Status**: IN PROGRESS (Docs Only)

---

> [!IMPORTANT]
> **Web Store & Add-on Listing Notice (Privacy & Permissions)**  
> Recent updates to [`PRIVACY_POLICY.md`](../../PRIVACY_POLICY.md) and [`README.md`](../../README.md) describe host permissions (`<all_urls>`), `tabs` permission, and the local read-only price detector shipping in **Step 05** (`detector.js`). These policy disclosures **must not be published** to the Chrome Web Store or Mozilla Add-ons listing until Step 05 is completed and deployed.

---

## 1. Schema Truth & Site Mode Migration

### Ground Truth: Active v2.0.0 Storage Schema (`src/shared/settings.js`)
The extension stores user preferences in browser storage (`chrome.storage.local` / `browser.storage.local`) under the constant:
```javascript
export const SETTINGS_STORAGE_KEY = 'currency_converter_settings_v2';
export const CURRENT_SCHEMA_VERSION = 2;
```

The real `DEFAULT_SETTINGS` object in `src/shared/settings.js` is:
```javascript
export const DEFAULT_SETTINGS = {
  schemaVersion: CURRENT_SCHEMA_VERSION, // 2
  targetCurrency: 'USD',
  lastUsedTarget: 'USD',
  pinnedCurrencies: ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'],
  displayMode: 'replace', // 'replace' | 'append' | 'replace_highlight'
  roundWhole: false,
  ambiguousDollar: 'USD',
  showCrypto: false,
  showInPageBar: true,
  autoConvertAll: false,
  theme: 'system', // 'system' | 'light' | 'dark'
  perSite: {} // { [hostname]: { autoConvert?: boolean, neverConvert?: boolean, assumedCurrency?: string } }
};
```

### The Per-Site Key is `perSite` (Not `siteSettings`)
In v2.0.0, per-site configurations are stored under the object key **`perSite`** (e.g., `settings.perSite[hostname]`). The legacy shape uses two independent, contradictory booleans:
```typescript
interface LegacyPerSiteRule {
  autoConvert?: boolean;
  neverConvert?: boolean;
  assumedCurrency?: string;
}
```

### Target v2.1.0 Storage Schema (Schema Version 3)
To eliminate contradictory states (`autoConvert: true` and `neverConvert: true` simultaneously) and provide an explicit default state for unconfigured sites where the user should be prompted, `schemaVersion` is bumped to `3` and `perSite` entries transition to a strict tri-state enum:
```typescript
type SiteMode = 'ask' | 'always' | 'never';

interface PerSiteRuleV3 {
  mode: SiteMode;
  assumedCurrency: string | null;
}

interface StoredSettingsV3 {
  schemaVersion: 3;
  targetCurrency: string;
  lastUsedTarget: string;
  pinnedCurrencies: string[];
  displayMode: 'replace' | 'append' | 'replace_highlight';
  roundWhole: boolean;
  ambiguousDollar: string;
  showCrypto: boolean;
  showInPageBar: boolean;
  autoConvertAll: boolean; // Retained as global default site mode fallback
  theme: 'system' | 'light' | 'dark';
  perSite: Record<string, PerSiteRuleV3>;
}
```

### Migration Specification (`SettingsManager.migrateSettings()`)
When `SettingsManager.getSettings()` or `migrateSettings(raw)` executes:
1. If `raw.schemaVersion === 3`, return validated settings directly.
2. If `raw.schemaVersion === 2` or unversioned:
   - Set `schemaVersion = 3`.
   - Preserve all global keys (`targetCurrency`, `lastUsedTarget`, `pinnedCurrencies`, `displayMode`, `roundWhole`, `ambiguousDollar`, `showCrypto`, `showInPageBar`, `autoConvertAll`, `theme`).
   - Migrate each entry in `raw.perSite`:
     - If `rule.autoConvert === true` -> `mode = 'always'`.
     - Else if `rule.neverConvert === true` -> `mode = 'never'`.
     - Else -> `mode = 'ask'`.
     - `assumedCurrency = rule.assumedCurrency || null`.
     - Delete legacy keys `autoConvert` and `neverConvert`.
   - For any unconfigured hostname queried at runtime:
     - If `settings.autoConvertAll === true`, default mode is `'always'`.
     - If `settings.autoConvertAll === false`, default mode is `'ask'`.
     - Default rule is `{ mode: settings.autoConvertAll ? 'always' : 'ask', assumedCurrency: null }`.

#### Concrete Storage Example

**Before Migration (`chrome.storage.local['currency_converter_settings_v2']`):**
```json
{
  "currency_converter_settings_v2": {
    "schemaVersion": 2,
    "targetCurrency": "USD",
    "lastUsedTarget": "USD",
    "pinnedCurrencies": ["NGN", "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"],
    "displayMode": "replace",
    "roundWhole": false,
    "ambiguousDollar": "USD",
    "showCrypto": false,
    "showInPageBar": true,
    "autoConvertAll": false,
    "theme": "system",
    "perSite": {
      "amazon.de": {
        "autoConvert": true,
        "neverConvert": false,
        "assumedCurrency": "EUR"
      },
      "bank.example.com": {
        "autoConvert": false,
        "neverConvert": true,
        "assumedCurrency": null
      },
      "jumia.com.ng": {
        "autoConvert": false,
        "neverConvert": false,
        "assumedCurrency": "NGN"
      }
    }
  }
}
```

**After Migration (`chrome.storage.local['currency_converter_settings_v2']`):**
```json
{
  "currency_converter_settings_v2": {
    "schemaVersion": 3,
    "targetCurrency": "USD",
    "lastUsedTarget": "USD",
    "pinnedCurrencies": ["NGN", "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"],
    "displayMode": "replace",
    "roundWhole": false,
    "ambiguousDollar": "USD",
    "showCrypto": false,
    "showInPageBar": true,
    "autoConvertAll": false,
    "theme": "system",
    "perSite": {
      "amazon.de": {
        "mode": "always",
        "assumedCurrency": "EUR"
      },
      "bank.example.com": {
        "mode": "never",
        "assumedCurrency": null
      },
      "jumia.com.ng": {
        "mode": "ask",
        "assumedCurrency": "NGN"
      }
    }
  }
}
```

---

## 2. Messaging Contract (`src/shared/messaging.js`)

All communication across content scripts, background worker, and popup uses the typed `MSG` dictionary in `src/shared/messaging.js`.

### Existing Constants in Active Codebase
```javascript
export const MSG = {
  // Page scanning & conversion
  CONVERT_PAGE: 'CC_CONVERT_PAGE',
  REVERT_PAGE: 'CC_REVERT_PAGE',
  GET_PAGE_STATUS: 'CC_GET_PAGE_STATUS',
  PAGE_STATUS: 'CC_PAGE_STATUS',
  PAGE_MUTATION_CONVERT: 'CC_PAGE_MUTATION_CONVERT',

  // Rates
  GET_RATES: 'CC_GET_RATES',
  RATES_DATA: 'CC_RATES_DATA',

  // Settings
  GET_SETTINGS: 'CC_GET_SETTINGS',
  SETTINGS_DATA: 'CC_SETTINGS_DATA',
  UPDATE_SETTINGS: 'CC_UPDATE_SETTINGS',
  SET_SITE_RULE: 'CC_SET_SITE_RULE',

  // UI Bar & Tooltip events
  BAR_DISMISSED: 'CC_BAR_DISMISSED',
  CHANGE_TARGET_CURRENCY: 'CC_CHANGE_TARGET_CURRENCY',

  // Selection conversion
  CONVERT_SELECTION: 'CC_CONVERT_SELECTION',

  // Permissions & Auto-convert orchestration (legacy)
  REQUEST_ORIGIN_PERMISSION: 'CC_REQUEST_ORIGIN_PERMISSION',
  CHECK_ORIGIN_PERMISSION: 'CC_CHECK_ORIGIN_PERMISSION'
};
```

### Planned New Message Types for Detector & Handoff (Step 05)
```javascript
  // Planned for Step 05: Detector & Offer Handoff
  OFFER_REQUESTED: 'CC_OFFER_REQUESTED',           // detector -> background: candidate threshold reached
  SHOW_OFFER: 'CC_SHOW_OFFER',                     // background -> content.js: mount InPageUI in OFFER state
  OFFER_ACCEPTED: 'CC_OFFER_ACCEPTED',             // InPageUI -> background/content: user clicked [Convert]
  OFFER_DECLINED: 'CC_OFFER_DECLINED',             // InPageUI -> background: user clicked [Not now] or pressed Escape
  SET_SESSION_SUPPRESSION: 'CC_SET_SESSION_SUPPRESSION' // content/ui -> background: persist host in chrome.storage.session
```

---

## 3. Retirement of Legacy Auto-Convert Paths

### Problem in Current Codebase
In `src/background.js`, v2.0.0 implements two competing mechanisms for auto-conversion:
1. `syncAutoConvertRules()` (lines 301–336): attempts to call `api.scripting.registerContentScripts` with ID `'cc-autoconvert-sites'` to dynamically inject `content.js` on approved hostnames.
2. `tabs.onUpdated` listener (lines 339–358): listens for `status === 'complete'`, evaluates `rule.autoConvert || (settings.autoConvertAll && !rule.neverConvert)`, and calls `convertPageOnTab(tabId)`.

Having multiple auto-conversion paths causes duplicate script execution, race conditions on page load, and architectural inconsistency across Chrome and Firefox.

### Required Architecture: Exactly ONE Conversion Mechanism
Under v2.1.0, **the static detector (`detector.js`) is the sole mechanism that initiates conversion for `'always'` sites**.
- No dynamic scripting registrations.
- No `tabs.onUpdated` conversion triggering.

### Deletion Schedule (Step 05)
In **Step 05**:
1. **Delete `syncAutoConvertRules()`**: Remove the entire function from `src/background.js`.
2. **Unregister Legacy Dynamic Scripts**: In `runtime.onInstalled`, execute `api.scripting.unregisterContentScripts({ ids: ['cc-autoconvert-sites'] })` to cleanly purge legacy scripts previously registered by v2.0.0 installations.
3. **Delete `tabs.onUpdated` auto-convert branch**: Remove the conversion trigger from `tabs.onUpdated` in `src/background.js`. Retain `tabs.onUpdated` solely for tab URL tracking or status map maintenance if needed.
4. **Global `autoConvertAll` Decision**:
   - The user preference "Auto-convert on all sites" (`autoConvertAll`) **survives**.
   - However, it is **defined strictly as a global default site mode fallback**, not a separate execution code path.
   - When `detector.js` inspects an unconfigured site (not present in `perSite`), it resolves the site mode as:
     ```javascript
     const effectiveMode = perSite[hostname]?.mode || (settings.autoConvertAll ? 'always' : 'ask');
     ```
   - If `effectiveMode === 'always'`, `detector.js` immediately messages the background script to execute the conversion pipeline. Exactly one path handles all conversions.

---

## 4. Detector & Dynamic Island Pill Architecture (ADR 0013)

The handoff architecture is formally recorded in [`docs/adr/0013-detector-and-dynamic-island-pill-handoff-architecture.md`](../adr/0013-detector-and-dynamic-island-pill-handoff-architecture.md).

### Evaluated Alternatives
- **Option A (Bundle pill UI into `detector.js`)**: Expands `detector.js` to ~35–40 KB. Duplicates `InPageUI` and `ui.css` across two content scripts, creating two owners for `#cc-dynamic-island-host` and causing DOM synchronization race conditions.
- **Option B (Tiny detector + separate on-demand UI bundle via `chrome.scripting`)**: Creates 3 separate script lifecycles (`detector.js` -> background -> UI bundle -> conversion engine), increasing architectural surface area.
- **Option C (Selected — Single Canonical Host with Full Engine On-Demand Injection)**:
  - `detector.js` is kept strictly minimal (~8–10 KB), containing only read-only `countCandidates()` and the regex parser. It mounts zero DOM elements and attaches no Shadow Roots.
  - When candidate count $\ge \text{MIN\_PRICES}$ on an unconfigured site (`mode === 'ask'`), `detector.js` messages `background.js` via `MSG.OFFER_REQUESTED`.
  - `background.js` checks session suppression; if eligible, it injects `content.js` with payload `{ initialPillState: 'OFFER' }`.
  - `content.js` attaches the single canonical `#cc-dynamic-island-host` and mounts `InPageUI` in the `OFFER` state.
  - When user clicks `[Convert]`, `InPageUI` transitions directly in place (`OFFER` $\to$ `WORKING` $\to$ `CONVERTED`) and runs `PageScanner.convert()`.
  - If user clicks `[Not now]` or presses scoped `Escape`, `InPageUI` unmounts `#cc-dynamic-island-host` and notifies `background.js` to record session suppression.

### Measured Bundle Sizes
Based on esbuild production builds (`node build.js`):
- `dist/chrome/content.js`: **131,007 bytes** (~131 KB) (includes 170+ currency dataset `currencies-data.js`, `PageScanner`, `InPageUI`, inlined `ui.css`, formatters).
- `dist/chrome/background.js`: **78,471 bytes** (~78 KB) (includes `RatesEngine`, `SettingsManager`, cross-rates calculation).
- Target `dist/chrome/detector.js` (dry-run scanner + regex parser only): **~8 KB – 10 KB** (measured against isolated prototype).

### Zero-Flash / Single Host Guarantee
Because `content.js` is the sole owner of `#cc-dynamic-island-host`, exactly one Shadow Root is ever attached to `document.body`. There is zero DOM handoff friction, zero duplicate mounting, and zero flash of unstyled content between `OFFER`, `WORKING`, and `CONVERTED`.

---

## 5. Candidate Counting & Exact Result Contract

### Counting ONLY What Would Change
`countCandidates()` must count only prices that `convert()` would actually modify. A price is only convertible if its detected source currency differs from the active target currency (`sourceISO !== targetISO`).

### Reusing Scanner's Page Context & Currency Detection
`countCandidates()` directly leverages `PageScanner`'s existing context initialization (`_initializePageContext()`):
1. **Structured Hints & Meta Tags**: Checks `<meta property="og:price:currency">`, `<meta property="product:price:currency">`, `<meta itemprop="priceCurrency">`, and `[itemprop="priceCurrency"]`.
2. **JSON-LD**: Parses `<script type="application/ld+json">` for `"priceCurrency": "XYZ"`.
3. **HTML Lang & TLD**: Reads `document.documentElement.lang` and `location.hostname` (e.g. `.uk` -> GBP, `.ca` -> CAD, `.de` -> EUR).
4. **Per-Site Override**: Inspects `settings.perSite[hostname]?.assumedCurrency`.
5. **Contextual Resolution**: When ambiguous symbols (e.g., `$`, `£`, `kr`) are detected, `detectCurrency(sym, context)` resolves the symbol using the gathered page context and user `ambiguousDollar` setting.

### Scanner Counters & Exact Decision Logic
To eliminate the confusing bug where 0-price pages reported `"Page is already in USD"`, `countCandidates()` and `convert()` track two distinct counters:
1. `candidateCount`: Prices detected where `sourceISO !== targetISO` (convertible foreign prices).
2. `alreadyTargetCount`: Prices detected where `sourceISO === targetISO` (valid prices skipped because they already match the target currency).

```javascript
// Candidate counting iteration in scanner.js
for (const price of extractedPrices) {
  const sourceISO = price.currency ? price.currency.toUpperCase() : null;
  const targetISO = this.targetCurrency.toUpperCase();

  if (!sourceISO) continue;

  if (sourceISO === targetISO) {
    this.alreadyTargetCount++;
  } else {
    this.candidateCount++;
  }
}
```

### The Explicit Result Contract
The response from `convert()` or `countCandidates()` returns an explicit `reason`:
```typescript
interface ConvertResult {
  success: boolean;
  count: number;
  alreadyTargetCount: number;
  reason: 'ok' | 'no_prices' | 'already_target' | 'error';
  error?: string;
  targetCurrency: string;
  sourceCurrency?: string | null;
  detectedCurrencies: string[];
}
```

**Exact Decision Logic:**
- If an unhandled exception occurred or rates could not be fetched: `reason = 'error'`.
- Else if `count > 0` (or `candidateCount > 0`): `reason = 'ok'`.
- Else if `count === 0` and `candidateCount === 0`:
  - If `alreadyTargetCount > 0` (or inferred page currency === `targetCurrency`): `reason = 'already_target'`.
  - Else: `reason = 'no_prices'`.

---

## 6. Single Page Application (SPA) Client-Side Navigation

### The Challenge
Modern web applications (e.g. Amazon, eBay, Shopify storefronts) frequently navigate between product listings, search queries, and product details using client-side routing (HTML5 History API) without triggering a browser-level page reload (`document_idle`).

### Navigation API vs. Observer Polling (Cross-Browser Investigation)
- **Navigation API (`window.navigation`)**:  
  In Chromium 102+, `window.navigation` is available to content scripts and provides a native `'navigate'` event ([Chrome Navigation API Guide](https://developer.chrome.com/docs/web-platform/navigation-api/)).  
  *However, the Navigation API is not supported in Firefox* ([MDN Navigation API Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)).
- **Standard History Events (`popstate`, `hashchange`)**:  
  While supported cross-browser, page scripts calling `history.pushState()` or `history.replaceState()` do not dispatch `popstate` events to content scripts in isolated worlds.
- **Robust Solution: Progressive Enhancement + MutationObserver URL Tracking**:
  1. Attach `window.navigation?.addEventListener('navigate', onRouteTransition)` for immediate detection in Chromium.
  2. Attach `window.addEventListener('popstate', onRouteTransition)` and `window.addEventListener('hashchange', onRouteTransition)` for standard history events.
  3. Inside the debounced `MutationObserver` (which already runs on dynamic DOM updates), track `lastObservedHref = location.href`. When a mutation batch arrives, if `location.href !== lastObservedHref`, trigger `onRouteTransition()`.

### Reset Rules on Route Change
When a client-side route change is detected (`location.href` changed):
1. **Once-Per-Page Gate Reset**: `hasOfferedOnPage = false` resets to `false`. This allows the detector to evaluate candidate prices on the newly rendered route.
2. **Pill Reset**: If the pill is currently in `OFFER` state from the previous route, it is cleanly unmounted or hidden.
3. **Session Suppression Persistence**: Session suppression (`suppress_offer_${hostname}` in `chrome.storage.session`) is scoped to the **hostname**, not the route URL. If the user clicked `[Not now]` or pressed scoped `Escape` on this site earlier in the session, suppression persists across SPA route changes within that host.

---

## 7. Dynamic Island Pill Presentation & Scoped Escape Dismissal

### State Machine & Visual Tokens
The Dynamic Island pill strictly obeys the editorial tokens in [`DESIGN.md`](../../DESIGN.md):
- Mounted inside open Shadow DOM root (`#cc-dynamic-island-host`).
- Top-center fixed: `top: 14px; left: 50%; transform: translate3d(-50%, 0, 0)`.
- Specular hairline border: `1px solid rgba(255, 255, 255, 0.12)`.
- Floating depth shadow: `0 10px 28px -6px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.25)`.
- Zero heavy `backdrop-filter: blur()`.

| State | Status Dot | Content & Interactive Elements | Auto-Timer Allowed? | Escape Key Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **OFFER** | **Neutral `#71717A`**<br>(strictly zero glow, no box-shadow) | Left: `"Convert to USD?"`<br>Right: tactile `[Convert]` button (`#27272a`), quiet `[Not now]` link (`#a1a1aa`). | **STRICTLY NONE**.<br>Never auto-hides on a timer. | Scoped to pill focus. Pressing Escape inside Shadow DOM dismisses pill and sets session suppression. |
| **WORKING** | **Neutral `#71717A`**<br>(gentle pulse, zero glow) | Typographic label: `"Converting..."`. Interactive elements disabled. | None. | Ignored while DOM conversion is actively mutating. |
| **CONVERTED** | **Emerald `#10B981`**<br>(strictly reserved for converted state) | Compact: `EUR → USD · 14`.<br>Hover/Focus expands: live rate (`1 EUR = 1.08 USD` in `--font-mono`), toggle `[Original \| Converted]`, currency picker, `×` close button.<br>Follow-up row (if entered from offer): `"Always convert on <host>? [Always] [Just this time]"`. | Compact capsule remains visible persistently.<br>Follow-up row **never** auto-resolves on a timer. | Scoped to pill focus. Closes/minimizes pill. |
| **ORIGINAL** | Neutral `#71717A` | Compact capsule: `"Showing original prices"`. Segmented toggle indicates `[Original]` active. | None. | Scoped to pill focus. Closes pill. |
| **NOTHING_FOUND** | Neutral `#71717A` | `"No prices found on page"`. Quiet `×` close button. Only triggered by manual popup/context menu clicks. | **4.0s auto-dismiss**. | Scoped to pill focus. Dismisses immediately. |
| **ERROR** | Amber `#F59E0B` | Concise failure message (e.g. `"Rates unavailable"`). | None. | Scoped to pill focus. Dismisses immediately. |

### Strict Escape Key Scoping
- **Rule**: Escape dismisses the pill **only when keyboard focus is inside the pill's shadow root**.
- **Forbidden**: Attaching a global or capture-phase `keydown` listener to the host page `window` or `document` is strictly forbidden.
- **Implementation**: The keydown event listener is attached strictly to the Shadow Root container:
  ```javascript
  this.shadowRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.dismiss();
    }
  });
  ```

---

## 8. Open Decisions for Repository Owner

1. **Pill Dragging Repositioning (`_setupDragging`)**:
   - `src/content/ui.js` currently implements pointer drag listeners (`_setupDragging`) that allow the user to click and drag the pill to custom coordinates on the screen.
   - However, `DESIGN.md` explicitly models the component as an Apple-style Dynamic Island fixed at top-center (`top: 14px; left: 50%`).
   - *Decision Status*: **Open for Owner Review**. Drag repositioning is preserved in code for now so existing functionality is not broken, but will be reviewed with the owner in Step 06 to decide whether free-floating drag should be retained or removed in favor of a strictly anchored Dynamic Island.

---

## 9. Implementation Roadmap: Steps 03 to 08

All steps below are **PLANNED, not started**. Each step represents an isolated scope executed on its own branch, verified independently, and landed via standard merge commits.

### Step 03: Site-Mode Model + Migration + Tests
- **Branch**: `step/03-site-mode-migration`
- **Scope**:
  - Update `src/shared/settings.js` to bump `CURRENT_SCHEMA_VERSION = 3` and migrate `perSite` from dual-boolean to `mode: 'ask' | 'always' | 'never'`.
  - Implement idempotent migration in `migrateSettings()`.
  - Update options page (`src/options/options.js`, `options.html`) and popup (`src/popup/popup.js`) to bind to `mode`.
  - Add comprehensive unit tests in `tests/settings.test.js` validating defaults, migration matrix, and serialization.
- **Acceptance Criteria**:
  - `npm test` passes 100%.
  - Settings load cleanly from v1, v2.0.0 dual-boolean, and empty state.
  - Options UI displays site rules with tri-state selection.

### Step 04: Scanner Split (Read-Only Dry-Run) + Result Reason Fix
- **Branch**: `step/04-scanner-split-and-result-reason`
- **Scope**:
  - Add `countCandidates({ maxLookups = 50 })` to `src/content/scanner.js` counting only convertible prices (`sourceISO !== targetISO`) without mutating DOM nodes.
  - Add `alreadyTargetCount` tracking to distinguish `already_target` from `no_prices`.
  - Implement new `ConvertResult` contract with explicit `reason: 'ok' | 'no_prices' | 'already_target' | 'error'`.
  - Update `src/content/content.js` and `src/popup/popup.js` to consume the explicit reason code.
  - Add unit tests in `tests/scanner.test.js` verifying that `countCandidates()` mutates zero nodes and matches subsequent `convert()` counts.
- **Acceptance Criteria**:
  - Dry-run count mutates 0 nodes (verified by DOM equality before and after).
  - Popup displays "No prices found" when 0 prices exist and "Page is already in USD" only when target matches detected currency.

### Step 05: Detector Bundle + Static Manifest Registration + Legacy Cleanup
- **Branch**: `step/05-detector-bundle`
- **Scope**:
  - Create entrypoint `src/content/detector.js` implementing the detector flow (settling delay, `countCandidates`, threshold check, bounded observer, SPA navigation tracking).
  - Delete legacy auto-convert paths: remove `syncAutoConvertRules()` and delete `tabs.onUpdated` auto-convert trigger from `src/background.js`. Unregister legacy content script `'cc-autoconvert-sites'`.
  - Define `autoConvertAll` as a global default site mode fallback.
  - Update `build.js` to compile `detector.js` as an independent lightweight bundle (~8–10 KB) in `dist/chrome/` and `dist/firefox/`.
  - Add static `content_scripts` registration in `build.js` manifests for `detector.js` (`all_frames: false`, `run_at: "document_idle"`).
  - Implement messaging in `src/shared/messaging.js` for offer display, acceptance, decline, and session suppression.
- **Acceptance Criteria**:
  - Manifest includes `detector.js` statically.
  - Exactly ONE conversion mechanism exists across the extension.
  - `npm run build` succeeds and produces clean bundles.
  - `npm test` passes.

### Step 06: Pill State Machine + Accessibility & Motion Performance Audits
- **Branch**: `step/06-pill-states-and-a11y`
- **Scope**:
  - Implement `OFFER`, `WORKING`, `NOTHING_FOUND`, and `ERROR` states in `src/content/ui.js` and `src/content/ui.css`.
  - Implement neutral `#71717A` status dot for `OFFER` and `WORKING` (no glow); reserve emerald `#10B981` strictly for `CONVERTED`.
  - Implement follow-up row `"Always convert on <host>?"` with `[Always]` and `[Just this time]`.
  - Scope Escape key listener strictly to focus inside pill's shadow root.
  - Eliminate grid column layout thrashing; refactor morphing animation to compositor properties (`transform`, `opacity`).
  - Run `fixing-accessibility` audit on `ui.js` and `ui.css` (keyboard navigation, ARIA roles, focus management).
  - Run `fixing-motion-performance` audit on `ui.css` (confirm zero layout reflows during expand/collapse).
- **Acceptance Criteria**:
  - Pill handles all states cleanly with zero `innerHTML`.
  - A11y and motion audit criteria verified.

### Step 07: Unified Trigger Pipeline Wiring
- **Branch**: `step/07-unified-trigger-pipeline`
- **Scope**:
  - Unify all three triggers (context menu, popup button, detector offer acceptance) into a single execution pipeline in `src/background.js`.
  - Ensure context menu and keyboard shortcut (`Alt+Shift+C`) route feedback through the in-page Dynamic Island pill.
  - Handle edge cases: restricted pages (`chrome://`, webstore), pages without permissions, rapid successive triggers.
- **Acceptance Criteria**:
  - Context menu click triggers pill in tab.
  - Keyboard shortcut triggers pill in tab.
  - All entry points produce identical conversion and state behavior.

### Step 08: End-to-End Tests & Browser Verification
- **Branch**: `step/08-e2e-verification`
- **Scope**:
  - Create Playwright end-to-end test suite in `tests/e2e/` loading the unpacked extension in Chromium.
  - Test against local fixture pages in `tests/fixtures/`:
    - E-commerce catalog page (verifies automatic offer trigger and acceptance).
    - Blog page with 1 price (verifies no offer triggered).
    - Site with `mode === 'never'` (verifies immediate bailout).
    - Site with `mode === 'always'` (verifies automatic silent conversion).
  - Execute manual smoke test on eBay product search page.
  - Record visual screenshots as evidence in `screenshots/`.
- **Acceptance Criteria**:
  - Playwright test suite passes in CI/local runs.
  - Real-world eBay smoke test passes with screenshots demonstrating detection, offer, conversion, and revert.
