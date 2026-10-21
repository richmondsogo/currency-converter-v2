# Step 05: Stability Fixes & Repo Hygiene

- **Branch**: `step/05-stability-fixes`
- **Target Branch**: `main`
- **Status**: COMPLETE
- **Previous Step (Step 04) Merge Commit SHA on Main**: `db6be37`
- **PR URL**: (Recorded upon PR creation)
- **First Commit SHA (Part A)**: `4e38e85`
- **Last Content Commit SHA (Part B)**: (Recorded upon commit)

---

## 1. Scope & Objectives

The goal of Step 05 is to address root-cause stability issues identified during real-browser diagnosis (Step 04 / Owner Feedback) and establish strict repository hygiene.

### Part A: Repo Hygiene
- **A1: Provenance**:
  - Corrected `docs/steps/03-site-mode-migration.md` to reflect PR #7, merge commit `f4c9baa`, and the true first/last commits (`fb9ed84..f107f61`), explicitly noting that branch history was rewritten by a force-push prior to merge.
  - In `docs/steps/04-browser-harness-diagnosis.md`, recorded merge SHA `db6be37`.
- **A2: Untrack `dist/`**:
  - Untracked `dist/` via `git rm -r --cached dist` and added `dist/` to `.gitignore`.
  - Updated `README.md`, `CONTEXT.md`, and `AGENTS.md` instructions: "run `npm run build`, then load `dist/chrome`; `dist/` is not tracked".
  - Verified clean clone test in temp directory (`npm ci && npm test`) passing 56/56 tests.
  - Updated `tests/build.test.js` to compile fresh distribution bundles during test execution rather than assuming pre-existing committed files.
- **A3: Split E2E from Unit Tests**:
  - Renamed E2E tests to `tests/e2e/*.e2e.js` so `npm test` runs exclusively unit tests.
  - Added `"test:e2e": "node --test tests/e2e/*.e2e.js"` to `package.json`.
  - Updated `scripts/launch-browser.js` so that every test run builds the extension into an OS temporary directory (`os.tmpdir()`), ensuring zero dependence on leftover build artifacts.
  - Documented `npx playwright install chromium` in `README.md`.

### Part B: Stability Fixes
- **B1: One Instance, One Pill, Honest Count (R1, R3)**:
  - Guard on `window.__CC_CONTENT_SCRIPT_INJECTED__` makes `content.js` re-injection a strict no-op.
  - Guard `if (window !== window.top) return;` guarantees content script runs in top frame only.
  - Added `ensureInjected(tabId)` in `src/shared/browser.js` which pings `CC_GET_PAGE_STATUS` and only injects if no listener responds, with `allFrames: false`.
  - `InPageUI.mount()` enforces a single `#cc-dynamic-island-host` in the document, replacing any existing host.
  - Status dot is green if and only if `isConverted` is true (`.cc-status-inactive` applied when not converted). Honest count is maintained across repeated convert requests.
- **B2: Currency Labels Next to Prices (R2)**:
  - Adjacent trailing ISO code is authoritative and consumed together with the price (`$25 CAD` -> CAD 25).
  - Country prefix plus `$` is consumed whole (`US $133.00`, `CA $25`, `AU $25`).
  - Word boundaries ensure `USDA`, `USDC` etc. are never touched, and `/mo` is preserved (`or as low as $24.73/mo`).
- **B3: One Auto-Convert Mechanism (R4)**:
  - Retired `syncAutoConvertRules` and registered content scripts (`cc-autoconvert-sites`). Added cleanup on `runtime.onInstalled` and `runtime.onStartup`.
  - Single auto-convert path via `tabs.onUpdated` (`changeInfo.status === 'complete'`).
  - `content.js` does not convert automatically on load; injection has zero side effects.
  - MutationObserver starts and stays active even if initial scan finds 0 prices, enabling late-rendered prices (e.g. injected 1500ms after load) to convert cleanly.
  - Tested with Playwright request routing on fake hosts (`shop.test`, `www.shop.test`, `sub.shop.test`, `other.test`, `never.test`).
  - Verified target currency matches `lastUsedTarget` / `targetCurrency` (tested with target `NGN`).
- **B4: Pill Dropdown STOPGAP (R5)**:
  - CSS-only styling for `.cc-select option` with dark background `#18181b` and white text `#fafafa` inside the OLED pill.
  - Verified with real browser screenshot showing the full open dropdown list.

---

## 2. Key Architecture & Design Decisions

### Decision 1: Superseding Retirement Timing for Legacy Auto-Convert (B3)
In `docs/steps/02-behavior-spec.md`, retirement of `syncAutoConvertRules` and registered content scripts was scheduled for Step 06/07 when the detector lands.
**Superseding Decision**: Step 04 live diagnosis proved that registered content scripts caused silent race conditions, stale registrations across rule changes, duplicate injections, and dual execution with `tabs.onUpdated`. Step 05 immediately deletes `syncAutoConvertRules`, removes the `'cc-autoconvert-sites'` content script registration, unregisters legacy IDs on startup/install, and consolidates auto-conversion into a single deterministic path: `api.tabs.onUpdated` checking `shouldAutoConvertPage(settings, url.hostname)` when `changeInfo.status === 'complete'`.

### Decision 2: Authoritative Adjacent Currency Code Tokenization (B2)
When an ambiguous symbol like `$` is paired with an adjacent trailing ISO code (e.g. `$25 CAD`) or preceded by a country prefix (e.g. `US $133.00`, `CA $25`, `AU $25`), the explicit code/prefix takes precedence over default symbol resolution. The entire compound token (`US $133.00` or `$25 CAD`) is consumed as a single unit so that no orphan prefix ("US") or suffix ("USD", "CAD") remains in the DOM text node.

### Decision 3: Top-Frame Only In-Page UI (B1)
To prevent nested pills and duplicate hosts when visiting complex e-commerce pages with advertising or analytics iframes, in-page UI injection is restricted strictly to `top` frames:
1. `chrome.scripting.executeScript` specifies `allFrames: false`.
2. `src/content/content.js` begins with `if (window !== window.top) return;`.

### Decision 4: STOPGAP Dropdown Styling (B4)
Per owner feedback, native select menus on Windows Chromium rendered white-on-white text inside dark Shadow DOM. Step 05 applies a CSS-only stopgap on `.cc-select option` (`background-color: #18181b; color: #fafafa;`). The full searchable combobox component is planned for a subsequent design overhaul step.

---

## 3. Test-First Regression Evidence (Failing vs Passing)

### Part A: Clean-Clone Evidence (A2)
```text
=== Clean Clone Test in Temp Directory ===
Cloning repo to C:\Users\Richmond\AppData\Local\Temp\cc-clean-1776777498701...
Running npm ci...
Running npm test...

> currency-converter-v2@2.0.0 test
> node --test tests/**/*.test.js && node tests/parse.test.js

[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
✔ tests\parse.test.js (198.8173ms)
✔ build: manifest structure and permissions for Chrome (8.8085ms)
...
ℹ tests 56
ℹ suites 0
ℹ pass 56
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9726.8402
=== Clean clone test PASSED ===
```

---

### B1: Instance Idempotency, One Pill, Honest Count

#### 1. Failing Run (Unfixed Code)
Ran `node --test tests/e2e/b1-instance-idempotency.e2e.js`:
```text
✖ B1 Regression: One instance, one pill, honest count, and iframe isolation (15214.3921ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  2 !== 1
  at C:\Users\Richmond\Downloads\currency-converter-v2\tests\e2e\b1-instance-idempotency.e2e.js:107:12
```
*Failure analysis*: Re-injection created duplicate `#cc-dynamic-island-host` elements in the DOM and inside child iframes.

#### 2. Passing Run (Fixed Code)
```text
✔ B1 Regression: One instance, one pill, honest count, and iframe isolation (23933.2096ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
```
*Verified*:
- Exactly 1 `#cc-dynamic-island-host` in top frame.
- 0 hosts mounted in child iframe.
- Re-injection and second convert call kept identical count and active green dot.

---

### B2: Currency Labels Next to Prices

#### 1. Failing Run (Unfixed Code)
Ran `node --test tests/b2-currency-labels.test.js`:
```text
✖ B2 Regression: Parser currency labels and boundary tests (8.5412ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  'USD' !== 'CAD'
  at TestContext.<anonymous> (C:\Users\Richmond\Downloads\currency-converter-v2\tests\b2-currency-labels.test.js:32:14)
```
*Failure analysis*: `$25 CAD` was parsed as USD with stray `CAD` text; `US $133.00` left orphan `US ` in text node.

#### 2. Passing Run (Fixed Code)
```text
✔ B2 Regression: Parser currency labels and boundary tests (20.5481ms)
✔ B2 Regression: DOM PageScanner no stray labels or prefix leftovers (568.1543ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
```
*Verified*:
- `US $133.00` -> USD 133.00 (prefix consumed).
- `+US $15.50 shipping` -> USD 15.50 (` shipping` untouched).
- `$399.00 USD` -> USD 399.00 (trailing USD consumed).
- `$1,107.92 USD` inside `<s>` -> consumed, strikethrough preserved.
- `$25 CAD` -> CAD 25 (trailing code wins over ambiguous `$`).
- `CA $25`, `AU $25` -> CAD / AUD.
- `US $10 - US $20` -> USD range, both consumed.
- `$25 USDA` -> USD 25 (` USDA` untouched).
- `or as low as $24.73/mo` -> converts, `/mo` untouched.
- `From $ To` with no digits -> untouched.

---

### B3: Auto-Convert Trigger, Hostname Routing, and Late-Rendered Prices

#### 1. Failing Run (Unfixed Code)
Ran `node --test tests/e2e/b3-auto-convert.e2e.js`:
```text
✖ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (18420.1042ms)
  AssertionError [ERR_ASSERTION]: Late-rendered price must convert to NGN, got: '$49.99'
  at C:\Users\Richmond\Downloads\currency-converter-v2\tests\e2e\b3-auto-convert.e2e.js:158:12
```
*Failure analysis*: `PageScanner.isConverted` was false when initial scan found 0 prices, causing the MutationObserver to ignore subsequent DOM additions. Furthermore, content scripts registered via `syncAutoConvertRules` conflicted with tabs navigation.

#### 2. Passing Run (Fixed Code)
```text
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (27225.2586ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
```
*Verified*:
- Configured `shop.test -> always` and target `NGN` via options UI.
- `www.shop.test` and `sub.shop.test` auto-converted cleanly to NGN with exactly 1 pill.
- `other.test` did not convert.
- `never.test` with `never` mode did not convert even with `autoConvertAll: true`.
- Late prices inserted 1500ms after load converted automatically to NGN via MutationObserver.

---

### B4: Pill Dropdown STOPGAP (R5)

#### Evidence & Styles
- **Screenshot Evidence**: `docs/steps/screenshots/b4-stopgap-dropdown.png`
- **Computed Styles**:
  - `select.backgroundColor`: `rgba(255, 255, 255, 0.08)`
  - `select.color`: `rgb(250, 250, 250)`
  - `option.backgroundColor`: `rgb(24, 24, 27)` (`#18181b`)
  - `option.color`: `rgb(250, 250, 250)` (`#fafafa`)
- **Verified**: All native option items (`AED`, `AFN`, `ALL`, `AMD`, etc.) render with high contrast, legible white text on dark surface.

---

## 4. Key Diffs of Product Changes

### 1. `src/content/content.js`: Idempotency Guard & Top Frame Guard
```diff
+// Strict top-frame isolation: prices inside child iframes are not converted for now
+if (window !== window.top) {
+  // Do not mount or listen inside subframes
+  // (Known limitation: iframe prices not converted)
+  return;
+}
+
+// Global idempotency guard: re-injection is a strict no-op leaving existing instance intact
+if (window.__CC_CONTENT_SCRIPT_INJECTED__) {
+  return;
+}
+window.__CC_CONTENT_SCRIPT_INJECTED__ = true;
```

### 2. `src/shared/browser.js`: `ensureInjected` Ping Helper
```diff
+export async function ensureInjected(tabId) {
+  try {
+    const status = await sendMessage(tabId, { type: MSG.GET_PAGE_STATUS });
+    if (status) {
+      return true; // Already listening
+    }
+  } catch (e) {
+    // No listener responded; proceed to inject
+  }
+  await getBrowserAPI().scripting.executeScript({
+    target: { tabId, allFrames: false },
+    files: ['content.js']
+  });
+  return true;
+}
```

### 3. `src/background.js`: Retirement of Legacy Script Registration & Unification
```diff
-// syncAutoConvertRules removed. cc-autoconvert-sites unregistered.
-api.scripting.registerContentScripts(...)
+if (api && api.runtime) {
+  const unregisterLegacy = async () => {
+    if (api.scripting && api.scripting.unregisterContentScripts) {
+      try {
+        await api.scripting.unregisterContentScripts({ ids: ['cc-autoconvert-sites'] });
+      } catch (_) {}
+    }
+  };
+  api.runtime.onInstalled.addListener(unregisterLegacy);
+  api.runtime.onStartup.addListener(unregisterLegacy);
+}
+
+// Single auto-convert path via tabs.onUpdated
+if (api && api.tabs && api.tabs.onUpdated) {
+  api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
+    if (changeInfo.status === 'complete') {
+      const rawUrl = tab?.url || changeInfo?.url;
+      if (rawUrl && rawUrl.startsWith('http')) {
+        const url = new URL(rawUrl);
+        const settings = await settingsManager.getSettings();
+        if (shouldAutoConvertPage(settings, url.hostname)) {
+          const target = settings.lastUsedTarget || settings.targetCurrency || 'USD';
+          await convertPageOnTab(tabId, target);
+        }
+      }
+    }
+  });
+}
```

### 4. `src/shared/parser.js`: Currency Labels & Adjacent Code Parsing
```diff
+// Pattern for compound country prefixes: US $, CA $, AU $, etc.
+const PREFIX_COMPOUND_REGEX = /\b(US|CA|AU|NZ|HK|SG)\s*\$/gi;
+// Pattern for trailing currency code: $25 CAD, $399.00 USD
+const TRAILING_CODE_REGEX = /\s+([A-Z]{3})\b/g;
```

---

## 5. Known Limitations & Discoveries

### Known Limitations
1. **Prices Inside Iframes Not Converted**:
   - `content.js` enforces `window === window.top` and `allFrames: false`. Prices embedded inside cross-origin or same-origin `<iframe>` elements (e.g. embedded payment widgets or ad frames) are intentionally not converted to prevent broken layout or duplicate Dynamic Island hosts.

### Discoveries
1. **Options Page Button Label ("+ + Add Rule")**:
   - The options page HTML contains `<button id="btn-add-rule-submit"><svg .../><span>+ Add Rule</span></button>`, rendering as `+ + Add Rule`. This was documented in Step 04 audit (R6) and confirmed during Step 05 E2E testing. Deferred to the options redesign step.
2. **Offline Fallback Resilience**:
   - Exchange rate network calls during offline/isolated E2E tests gracefully fall back to the built-in rates table in `background.js` without unhandled rejections.
3. **MutationObserver on 0 Initial Prices**:
   - When converting a page that initially has 0 prices, the scanner's MutationObserver must still be initialized so dynamically added nodes (such as single-page app asynchronous product catalogs) convert as soon as they appear.

---

## 6. Screenshots
1. `docs/steps/screenshots/b4-stopgap-dropdown.png`: Legible dark OLED option styling with high-contrast white text for native currency select dropdown.
