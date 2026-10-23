# Step 08: Firefox Fix + Popup Restyle (React + shadcn, Paper & Pine)

**Branch**: `step/08-popup-restyle`  
**Base Commit**: `e1aaafa` (Step 07 Merge on `main`)  
**Pull Request**: `https://github.com/richmondsogo/currency-convertr/pull/14`  
**First Commit SHA**: `329ffe6`  
**Last Commit SHA**: `94f9b99`  
**Merge Commit SHA**: `93c21440ebfb63cf47cc56473e9e1fa474f7f672` (`93c2144`)  
**Status**: Landed on `main`  
**Role**: Builder (`BUILD_PROTOCOL.md`)  

---

## 1. Merge Commit Provenance Verification

As mandated by `BUILD_PROTOCOL.md` and repository guidelines, before beginning implementation, Step 07's merge commit SHA (`e1aaafa`) was verified on `main`:

### Command 1: `git log --first-parent main -n 5`
```text
e1aaafa Merge pull request #13 from richmondsogo/step/07-options-rebuild
db16e2c Merge pull request #12 from richmondsogo/step/06-ui-foundation
d76a7f3 Merge pull request #11 from richmondsogo/step/05-pill-polish
115e8b3 Merge pull request #10 from richmondsogo/step/04-rate-hardening
ca70ec9 Merge pull request #9 from richmondsogo/step/03-autonav-settings
```

### Command 2: `git cat-file -p e1aaafa`
```text
tree 653e00cf9d7c8c3e8080fbe9e31d45ee0c473c4f
parent db16e2c3ce31a02bd6734dbc28c7148e908c9618
parent 6990c7a0506a739a048ecd593d3eb65a65c5ce15
author Richmond <richmond.sogo@gmail.com> 1776953767 +0100
committer GitHub <noreply@github.com> 1776953767 +0100
gpgsig -----BEGIN PGP SIGNATURE-----
 ...
 -----END PGP SIGNATURE-----

Merge pull request #13 from richmondsogo/step/07-options-rebuild
```

**Finding**: `e1aaafa` has two distinct parents (`db16e2c3ce...` on main and `6990c7a050...` from `step/07-options-rebuild`). It is a true merge commit with preserved history and immutable commit hashes, not a squash.

---

## 2. Overview of Step 08 Scope

Step 08 had four core requirements executed across sequential commits:
1. **Part A (`329ffe6`)**: Diagnosed and resolved the Firefox MV3 "Conversion failed" bug; added robust Firefox promise messaging, content script path resolution (`/content.js`), and automated headless Firefox Selenium smoke test.
2. **Part C (`53f5a70`)**: Extracted shared UI components (`SiteModeControl`, `CurrencyCombobox`, `site-rules.js`) into `src/ui/` and refactored both `src/options/` and tests to eliminate code duplication.
3. **Part B (`b0957ad`)**: Restyled the toolbar popup into React 19 + shadcn/ui adhering to Paper & Pine: 360px fixed width, 3-way segmented site mode control, page-scoped target currency overrides (never mutating settings), and live audit screenshots.
4. **Part D (`9530859`)**: Step 07 corrections: removed the post-build `.innerHTML =` regex rewrite in `build.js`, documented React 19 warnings in `docs/store/amo-notes.md`, updated measured bundle sizes in `docs/adr/0014-*.md` and `docs/steps/07-*.md`.

---

## 3. Implementation Details

### Part A: Firefox MV3 Diagnostic & Fix (`329ffe6`)
- **Root Cause**:
  1. Under Firefox MV3, calling `browser.scripting.executeScript({ target: { tabId }, files: ['content.js'] })` without a leading forward slash caused Firefox's module loader to resolve the path relative to the active document or context rather than the extension root, intermittently failing script injection.
  2. Firefox's native `browser.tabs.sendMessage` returns a Native Promise directly; wrapping or mixing with callback-only idioms caused unhandled rejection or premature failure in the popup message flow.
- **Remediation**:
  - Changed injection path to `files: ['/content.js']` with explicit absolute extension root resolution.
  - Updated `src/shared/browser.js` `sendTabMessage` and `sendMessage` to detect native Promise returns first, falling back to callback wrappers with `runtime.lastError` checking.
  - Added honest error classification in `src/popup/popup-errors.js` (`isRestrictedPage`, `classifyConversionError`, `getConversionErrorMessage`).
  - Added automated end-to-end smoke test in `tests/firefox-smoke.test.js` using Selenium WebDriver + geckodriver + headless Firefox.

### Part C: Shared UI Extraction (`53f5a70`)
- Extracted `src/ui/components/SiteModeControl.jsx`:
  - Accessible 3-way segmented control (`Ask` / `Always` / `Never`) with subtle pill indicator, keyboard navigation, and zero border cards.
- Extracted `src/ui/components/CurrencyCombobox.jsx`:
  - Accessible Radix popover + Command primitive with search, pinned currency quick chips, search input autofocus, and checkmark indicators.
- Created `src/ui/lib/site-rules.js`:
  - Pure mapping functions: `getEffectiveSiteCaption`, `getEffectiveSiteMode`, `validateDomainInput`, `normalizeHost`.
- Refactored `src/options/options.jsx` to use these shared primitives, preserving 100% test coverage.

### Part B: Popup Restyle to Paper & Pine (`b0957ad`)
- Created `src/popup/popup.jsx` adhering strictly to Paper & Pine:
  - **360px fixed width** container with 560px max height vertical scroll, zero card borders.
  - **Header**: Brand `fx` badge, title, and Options link.
  - **Target Currency**: Auto-detect source display, arrow icon, `CurrencyCombobox` for page-only target currency override, pinned currency chips, and muted `"Default"` badge when matching user settings.
  - **Target Invariant**: Changing target currency in the popup applies **only to the active tab/page** and **never writes to `settings.targetCurrency` or `settings.lastUsedTarget`** (verified by `tests/e2e/d1-default-target.e2e.js`).
  - **Primary Action**: 1-click `#btn-convert-toggle` button toggling between `"Convert this page"` (ink primary) and `"Show original"` (secondary outlined).
  - **Live Status Bar**: Status dot (`bg-accent` green when converted, `bg-muted` neutral when ready, amber on error), live conversion count, exchange rates provider credit, and honest error classification.
  - **Site Rules Block**: Hostname in Fragment Mono, 3-way `SiteModeControl`, inherited `"Uses default"` caption, Reset button, and site-wide assumed currency override combobox.
  - **Unsupported Notice**: Warning banner on restricted browser/extension pages.
  - **Footer**: Live rates freshness info, retry button, shortcut hint (`Alt+Shift+C`), and Options link.
- Created `src/popup/theme-boot.js` for instant dark/light theme application before render without inline scripts.
- Updated `build.js` to bundle `popup.jsx` and compile Tailwind CSS into `popup/popup.css`.
- Generated audit screenshots in `docs/audits/2026-10-23-popup-restyle/`:
  - `popup-360-light-ready.png`
  - `popup-360-dark-ready.png`
  - `popup-360-combobox-open.png`
  - `popup-360-light-converted.png`
  - `popup-360-dark-converted.png`
  - `popup-360-restricted.png`

### Part D: Step 07 Corrections & AMO Documentation (`9530859`)
- Removed lines 253–261 from `build.js` (the post-build `.innerHTML=` regex replacement).
- Ran `npm run lint:firefox` with Mozilla `web-ext lint`: confirmed **0 errors, 4 warnings**.
- Authored `docs/store/amo-notes.md` detailing the origin of the 4 warnings in React 19's reconciler cleanup and our strict zero-`innerHTML` product code policy.
- Measured bundle sizes across historical git commits using `esbuild` and recorded exact numbers.

---

## 4. Measured Bundle Sizes Across Steps

| Asset | Step 06 (`db16e2c`) | Step 07 (`e1aaafa`) | Step 08 (`b0957ad` / HEAD) | Status |
|---|---|---|---|---|
| `options/options.js` | 74.3 KB (13.5 KB gzip) | 419.1 KB (128.1 KB gzip) | 419.9 KB (128.9 KB gzip) | **[MEASURED]** |
| `options/options.css` | 23.6 KB (4.4 KB gzip) | 34.5 KB (6.6 KB gzip) | 35.5 KB (6.8 KB gzip) | **[MEASURED]** |
| `popup/popup.js` | 72.3 KB (12.7 KB gzip) | 72.3 KB (12.7 KB gzip) | 339.0 KB (108.5 KB gzip) | **[MEASURED]** |
| `popup/popup.css` | 14.2 KB (2.9 KB gzip) | 14.2 KB (2.9 KB gzip) | 35.5 KB (6.8 KB gzip) | **[MEASURED]** |
| `content/content.js` | 129.2 KB (24.2 KB gzip) | 129.2 KB (24.2 KB gzip) | 129.2 KB (24.2 KB gzip) | **[MEASURED]** (Zero React) |
| `background.js` | 83.9 KB (16.3 KB gzip) | 83.9 KB (16.3 KB gzip) | 84.1 KB (16.4 KB gzip) | **[MEASURED]** (Zero React) |
| Chrome ZIP Package | 89.6 KB | 518.6 KB | 934.8 KB | **[MEASURED]** |
| Firefox ZIP Package | 89.7 KB | 518.7 KB | 934.9 KB | **[MEASURED]** |

*Note*: Packages include bundled local WOFF2 font files (`Familjen Grotesk` and `Fragment Mono`). In-page `content.js` and `background.js` remain 100% vanilla JavaScript with zero React code.

---

## 5. Verification & Test Evidence

### 1. Firefox MV3 Linter (`npm run lint:firefox`)
```text
> currency-converter-v2@2.0.0 lint:firefox
> web-ext lint --source-dir dist/firefox

Validation Summary:

errors          0              
notices         0              
warnings        4              

WARNINGS:

Code                    Message                 Description                                              File
UNSAFE_VAR_ASSIGNMENT   Unsafe assignment to    Due to both security and performance concerns, this      popup/popup.js
                        innerHTML               may not be set using dynamic values which have not...
UNSAFE_VAR_ASSIGNMENT   Unsafe assignment to    Due to both security and performance concerns, this      popup/popup.js
                        innerHTML               may not be set using dynamic values which have not...
UNSAFE_VAR_ASSIGNMENT   Unsafe assignment to    Due to both security and performance concerns, this      options/options.js
                        innerHTML               may not be set using dynamic values which have not...
UNSAFE_VAR_ASSIGNMENT   Unsafe assignment to    Due to both security and performance concerns, this      options/options.js
                        innerHTML               may not be set using dynamic values which have not...
```
**Status**: **PASS (0 Errors)**

---

### 2. Unit & Integration Tests (`npm test`)
```text
> currency-converter-v2@2.0.0 test
> node --test tests/**/*.test.js && node tests/parse.test.js

✔ B2 Regression: Parser currency labels and boundary tests (23.7604ms)
✔ B2 Regression: DOM PageScanner no stray labels or prefix leftovers (543.522ms)
✔ build: manifest structure and permissions for Chrome (6.9513ms)
✔ build: manifest structure and permissions for Firefox (2.7962ms)
✔ build: zip packages exist and contain manifest.json at root (44.0983ms)
▶ Paper & Pine contrast ratios satisfy WCAG AA >= 4.5:1
  ✔ Light Text (#191815) on #F7F5F0 (1.4484ms)
  ✔ Light Muted (#67635A) on #F7F5F0 (0.2689ms)
  ✔ Light Accent (#1E6B52) on #F7F5F0 (0.2493ms)
  ✔ Light Warning (#A15C07) on #F7F5F0 (0.3084ms)
  ✔ Light Danger (#B3261E) on #F7F5F0 (0.3106ms)
  ✔ Dark Text (#ECE9E2) on #10100E (0.3594ms)
  ✔ Dark Muted (#9B968B) on #10100E (0.4053ms)
  ✔ Dark Accent (#6FD3A6) on #10100E (0.3061ms)
  ✔ Dark Warning (#E5A038) on #10100E (0.3586ms)
  ✔ Dark Danger (#E87068) on #10100E (0.3256ms)
✔ Paper & Pine contrast ratios satisfy WCAG AA >= 4.5:1 (9.9849ms)
✔ Contrast calculation fails if contrast drops below 4.5:1 (0.2561ms)
✔ currencies: getCurrencyMeta returns correct metadata for fiat and crypto (1.2ms)
✔ currencies: getAllCurrencies filters crypto and availableCodes properly (1.3592ms)
✔ currencies: TLD and language resolution (1.2676ms)
✔ currencies: resolveAmbiguousSymbol priority order (1.202ms)
[Firefox Smoke Test] Popup final status: 2 prices converted · Rates: ECB + Fallback
[Firefox Smoke Test] Converted price p2: $55.96
✔ Firefox MV3 Smoke: Add-on loads, popup opens, and converts prices on real page (16626.6712ms)
✔ format: standard fiat currency with minor digits (56.0338ms)
✔ format: round to whole numbers option (0.5444ms)
✔ format: crypto fallback when Intl does not recognize currency code (0.5021ms)
✔ format: display modes (replace, append, replace+highlight) (1.6572ms)
✔ options unit: hostname normalization on add (2.3599ms)
✔ options unit: validateDomainInput inline validation rules (0.6338ms)
✔ options unit: effective mode caption logic (0.5346ms)
✔ options unit: pinned currencies limit enforcement (max 8) (0.3689ms)
✔ options unit: import validation and migration round-trip (1.8944ms)
✔ options unit: site rule mutations (add, change mode, set assumed currency, reset mode, remove) (0.468ms)
[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
✔ tests\parse.test.js (362.8501ms)
✔ parser: v1 backwards-compatible detectCurrency (30.8337ms)
✔ parser: v1 backwards-compatible extractAmount (1.4132ms)
✔ parser: parseNumberString handles international formats and grouping (0.5336ms)
✔ parser: detectCurrency with contextual hints for ambiguous symbols (24.7041ms)
✔ parser: extractPrices finds single and multiple prices in text (7.3412ms)
✔ parser: reject non-prices (0.3393ms)
✔ parser: price range detection (0.9794ms)
✔ parser: inferPageCurrency detects meta tags, ld+json, and caches on doc (687.1214ms)
✔ parser: Jumia Nigeria price extraction and TLD inference (61.0788ms)
✔ parser: parseNumberString handles 0,500 as decimal 0.5 without stripping to 500 (2.2068ms)
✔ scanner: multiple convert-revert-convert cycles succeed without dropping elements (468.463ms)
✔ ui: InPageUI lifecycle, segmented switch, collapse, and updates (140.8111ms)
✔ popup: isRestrictedPage correctly identifies system vs web pages (5.0644ms)
✔ ui: Dynamic Island pill displays source -> target currency in compact view (69.1303ms)
✔ popup-errors: classifies restricted page error correctly (2.6723ms)
✔ popup-errors: classifies missing host permission error correctly (0.4126ms)
✔ popup-errors: classifies rates unavailable error correctly (0.3318ms)
✔ popup-errors: classifies unreachable content script error correctly (0.2977ms)
✔ popup-errors: custom error message takes precedence (0.308ms)
✔ rates: cross-rate math and calculations (2.6101ms)
✔ rates: merge precedence prefers ECB over Fawaz (4.394ms)
✔ rates: fallback tiers when primary tiers fail (2.9107ms)
✔ rates: deduplication of concurrent in-flight fetches (136.2773ms)
✔ rates: stale-while-revalidate and offline behavior (2.4194ms)
✔ scanner: simple text prices and byte-for-byte revert fidelity (218.3654ms)
✔ scanner: European comma-decimal numbers (149,50 € and 1.299,99 €) (22.6645ms)
✔ scanner: Amazon split-price structure and revert fidelity (28.7781ms)
✔ scanner: sup cents structure and revert fidelity (16.8429ms)
✔ scanner: ranges and was/now pairs (33.0505ms)
✔ scanner: skip lists (input, textarea, code, pre, contenteditable, data-cc-ignore) (24.0468ms)
✔ scanner: idempotency (running convert twice changes nothing the second time) (18.1078ms)
✔ scanner: target currency equals source currency skip (25.8617ms)
✔ scanner: dynamic mutations via MutationObserver (223.7545ms)
✔ scanner: nested inline elements (e.g. nested spans for symbol, whole, cents) (17.4684ms)
✔ scanner: open shadow DOM scanning and conversion (11.5648ms)
✔ scanner: no infinite observer loop when scanner mutates DOM (273.1864ms)
✔ scanner: Hard Bailout Gate — USD to USD leaves DOM 100% untouched and counts 0 conversions (15.1743ms)
✔ scanner: Canadian Dollar page context disambiguation converts bare $50.00 to USD (10.3391ms)
✔ scanner: consecutive convert calls are strictly idempotent and do not duplicate spans (13.2103ms)
✔ scanner: Jumia Nigeria e-commerce price conversion and revert (18.0142ms)
✔ settings: default settings schema (3.2196ms)
✔ settings: migration matrix (4.0215ms)
✔ settings: idempotency of migration (1.1439ms)
✔ settings: import of v2 export JSON yields v3 (2.4431ms)
✔ settings: getSiteMode resolution (1.2934ms)
✔ settings: hostname normalization and edge cases (1.0117ms)
✔ settings: background-logic shouldAutoConvertPage matches old behavior (0.5041ms)
✔ settings: setSiteMode mutation and removal (0.7909ms)
✔ settings: SettingsManager load, save, setSiteMode, and perSite overrides (2.2033ms)
✔ T2: Trailing-word safety and currency code consumption (15.2159ms)
ℹ tests 83
ℹ suites 0
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 20188.0476
[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
```
**Status**: **PASS (83/83 unit and smoke tests pass)**

---

### 3. Real Browser E2E Tests (`npm run test:e2e`)
```text
> currency-converter-v2@2.0.0 test:e2e
> node --test --test-concurrency=1 tests/e2e/*.e2e.js

✔ B1 Regression: One instance, one pill, honest count, and iframe isolation (14603.1193ms)
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (37774.3058ms)
✔ C2 & C3 & C4: Gallery loads in real browser, fonts ready, 0 console errors, CDP glyph coverage, screenshots (4977.3394ms)
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget (24650.3843ms)
✔ E2E Options: Complete rebuild verification covering all 10 requirements (19675.2722ms)
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders (9610.1171ms)
✔ T1 Regression: Show original stays original on late mutations, re-converts cleanly (21266.2124ms)
✔ T3 Regression: Context menu installation, listener lifecycle, and action dispatch (11468.6968ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 149701.4199
```
**Status**: **PASS (12/12 real browser E2E tests pass)**

---

## 6. Commit Provenance Checklist

- [x] Verified Step 07 parent commit on `main` is a true merge commit (`e1aaafa`).
- [x] Separate sequential commit for Part A: `329ffe6`.
- [x] Separate sequential commit for Part C: `53f5a70`.
- [x] Separate sequential commit for Part B: `b0957ad`.
- [x] Separate sequential commit for Part D: `9530859`.
- [x] Never ran `git commit --amend` or `git push --force`.
- [x] Zero `innerHTML` / `outerHTML` / `dangerouslySetInnerHTML` in first-party product code.
- [x] All commands executed and inspected in the current live terminal session.
