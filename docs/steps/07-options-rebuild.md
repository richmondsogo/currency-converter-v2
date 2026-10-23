# Step 07: Options Page Rebuild (React + shadcn, Paper & Pine)

- **Branch**: `step/07-options-rebuild`
- **Target Branch**: `main`
- **Status**: COMPLETE
- **Previous Step (Step 06) Merge Commit SHA on Main**: `db16e2c` (`Merge pull request #12 from richmondsogo/step/06-ui-foundation`)
- **PR URL**: TBD
- **Commits**:
  - `44898a3`: `feat(options): Part A - information architecture, shell, hash routing, and theme bootloader`
  - `d9126f0`: `feat(options): Part B - settings sections, site rules list, and data backup`
  - `6c4084e`: `refactor(options): Part C - delete legacy options code, verify bundle sizes and accessibility`
  - `b0e383e`: `test(options): Part D - unit and real-browser E2E test suite`
  - `cefc54b`: `docs(gallery): Part E - step 06 cleanups, DESIGN.md tokens, and ADR 0014 measurements`

---

## 1. Scope & Objectives

Step 07 replaces the legacy vanilla Options page with the redesigned surface approved by the owner in the design gallery (`dist/gallery`, section 4 "Realistic Options Page Layout"), featuring the Paper & Pine design system (Familjen Grotesk + Fragment Mono typography, warm surfaces, 1px hairlines, zero cards, 220px sidebar + ~640px column layout).

### Key Architectural Constraints
- **Zero Schema Changes**: Preserves the exact settings schema (`schemaVersion: 3`). No background or content-script alterations. The popup and in-page pill remain untouched.
- **Zero `innerHTML` Rule**: Absolute prohibition of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `dangerouslySetInnerHTML`. Native React JSX + safe text nodes throughout.
- **Approved Sidebar Modification**: Active item has raised background (`#EFECE5` light / `#181816` dark), text weight 600 (`font-semibold`), icon in text ink color. No left border, no accent bar, no accent-colored text. Hover uses raised background at lower strength. (Applied to gallery as source of truth as well).
- **Site Rules List**: Plain list separated by 1px hairlines, no bordered boxes. Hostnames in Fragment Mono. 3-way segmented control (Ask / Always / Never), assumed currency combobox, and ghost "Remove". Add-site row with exact accessible button name "Add site" and single icon (no literal "+" in label).
- **Deleted Sections**: Live Preview section and pill-style tab bar are deleted. No preview of any kind.
- **Theme Boot Script**: External boot script `theme-boot.js` reads cached theme from `localStorage` before first paint, preventing theme flash without inline `<script>` tags (MV3 CSP compliance).

---

## 2. Phase 0: Parity Inventory

| Old Control / Feature | Old HTML ID / Selector | Settings Key | Validation / Constraints | Side Effects & Messages | New Location & Component (Step 07) |
|---|---|---|---|---|---|
| Default Target Currency | `#default-target-currency` | `targetCurrency`, `lastUsedTarget` | Must be a valid currency code from `getAllCurrencies()` / `CURRENCIES_DATA` | Triggers `MSG.UPDATE_SETTINGS` with `{ targetCurrency, lastUsedTarget }`. Updates conversion target for automatic & menu conversions. | **General** section (`#general`): Searchable combobox over full currency list (symbol + code + name, searchable by name e.g. "naira" or code "NGN"). |
| Ambiguous "$" Symbol Default | `#ambiguous-dollar` | `ambiguousDollar` | Must be one of dollar currency codes ('USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN') | Triggers `MSG.UPDATE_SETTINGS` with `{ ambiguousDollar }`. | **General** section (`#general`): Combobox / Select with one-line description. |
| Auto-Convert on All Sites / Default Rule | `#check-autoconvert-all` | `autoConvertAll` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ autoConvertAll }`. Optional host permission request on extension API if toggling on. | **General** section (`#general`): "Default for sites without a rule" segmented control (Ask / Always, bound to `autoConvertAll`: true = Always, false = Ask). |
| Show in-Page Floating Toolbar | `#check-show-inpage-bar` | `showInPageBar` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ showInPageBar }`. Enables/disables floating OLED Dynamic Island pill in content scripts. | **General** section (`#general`): "Show in-page pill" switch. |
| Round to Whole Numbers | `#check-round-whole` | `roundWhole` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ roundWhole }`. Omits decimal places on formatted converted prices. | **General** section (`#general`): Switch with one-line description. |
| Show Cryptocurrencies in Picker | `#check-show-crypto` | `showCrypto` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ showCrypto }`. Updates currency lists across popup and options to include BTC, ETH, SOL, DOGE. | **General** section (`#general`): Switch with one-line description. |
| Pinned Currencies List & Count | `#pinned-chips-container`, `#pinned-count-badge` | `pinnedCurrencies` | Array of strings, max 8 items | Triggers `MSG.UPDATE_SETTINGS` with `{ pinnedCurrencies }`. Displays "n of 8". | **Currencies** section (`#currencies`): Removable chips showing symbol and code, count badge "n of 8". |
| Add Pinned Currency | `#select-add-pinned`, `#quick-suggest-buttons` | `pinnedCurrencies` | Limit enforced: max 8. If 8 reached, disables adding with clear error message. | Triggers `MSG.UPDATE_SETTINGS` with `{ pinnedCurrencies: [...pinned, code] }`. | **Currencies** section (`#currencies`): Searchable combobox over remaining currencies, plus quick-suggest buttons, limit message when full. |
| Site Rules Table / List | `#rules-table-body`, `.rule-row`, `.domain-host` | `perSite[hostname]` | Hostname must be valid normalized domain (`normalizeHost`). | Reads `perSite`. Renders each configured domain. | **Sites** section (`#sites`): Plain list separated by 1px hairlines, no bordered boxes, hostname in `Fragment Mono`. |
| Site Rule Conversion Mode | `.rule-mode-select` | `perSite[hostname].mode` | 'ask', 'always', 'never', or absent (inheriting default) | Triggers `MSG.UPDATE_SETTINGS` with updated `perSite`. Never writes 'ask' unless user picked Ask. Absent mode shows muted caption "Uses default (Ask\|Always)". | **Sites** section (`#sites`): Three-way segmented control (Ask / Always / Never) + Reset action to clear explicit mode. |
| Site Rule Assumed Currency | `.rule-currency-cell` | `perSite[hostname].assumedCurrency` | Valid currency code or null | Triggers `MSG.UPDATE_SETTINGS` with updated `perSite`. | **Sites** section (`#sites`): Searchable combobox for assumed currency. |
| Remove Site Rule | `.rule-action-cell`, `.btn-danger-small` | `perSite[hostname]` | None | Triggers `MSG.UPDATE_SETTINGS` with `perSite` key deleted. | **Sites** section (`#sites`): Ghost "Remove" button per row. |
| Add Domain Rule Form | `#form-add-rule`, `#input-rule-domain`, `#select-rule-behavior`, `#select-rule-currency`, `#btn-add-rule-submit` | `perSite[hostname]` | Validates domain: reject empty, invalid, and duplicates inline with clear message (no `alert()`). Normalizes with `normalizeHost`. | Triggers `MSG.UPDATE_SETTINGS` with new rule. | **Sites** section (`#sites`): One inline Add-site row; button text is exactly "Add site" with single icon and NO literal "+" character. |
| Search / Filter Rules | `#input-search-rules` | None (UI filter) | Case-insensitive substring match | Filters the displayed rules by domain query. | **Sites** section (`#sites`): Inline domain search filter input. |
| Appearance Theme Mode | `#theme-select`, `.theme-btn` | `theme` | 'system', 'light', 'dark' | Applies theme class/attribute immediately to `document.documentElement` without flash; updates `localStorage` cache for boot script; triggers `MSG.UPDATE_SETTINGS`. | **Appearance** section (`#appearance`): Three-way segmented control (System / Light / Dark). |
| Display Mode | `#display-mode` | `displayMode` | 'replace', 'append', 'replace_highlight' | Triggers `MSG.UPDATE_SETTINGS` with `{ displayMode }`. | **Appearance** section (`#appearance`): Segmented control or select with one-line descriptions. |
| Export Settings | `#btn-export-settings` | None (reads all) | Generates valid JSON | Downloads `currency-convertr-settings-<date>.json`. | **Data** section (`#data`): Primary/secondary button downloading formatted JSON. |
| Import Settings | `#input-import-settings` | None (writes all) | Must parse valid JSON and pass `migrateSettings`. Invalid files trigger error toast, never crash or alter state. | Triggers `MSG.UPDATE_SETTINGS` with migrated settings object. | **Data** section (`#data`): File picker button with error/success toast notifications. |
| Reset to Defaults | `#btn-reset` | All settings keys | Requires user confirmation | Triggers `SettingsManager.resetDefaults()`, resets to `DEFAULT_SETTINGS`, applies theme 'system', shows toast. | **Data** section (`#data`): Destructive action behind an accessible alert-dialog stating what will be deleted. |
| Product Title & Version / Build Stamp | `.header-title`, `.version-pill` | None (read-only) | Reads injected build defines (`__BUILD_VERSION__`, `__BUILD_GIT_SHA__`, `__BUILD_STAMP__`) | Displays version and git SHA. | **Shell Header** (A2) + **About** section (`#about`, B6). |
| Rates Source & Last Updated Metadata | Preview rate text (previously in preview) | None (read-only) | Fetched via `MSG.GET_RATES` | Displays source (e.g. ECB / Fawaz / Fallback) and timestamp honestly. | **About** section (`#about`, B6): Read-only status card showing rates provider and last-updated timestamp. |
| Keyboard Shortcut Info | None previously | None (read-only) | Read from `chrome.commands.getAll()` if available | Informs user of shortcut (e.g. Alt+Shift+C). | **About** section (`#about`, B6). |
| Links & Policies | None previously | None (links) | External URLs | Links to Privacy Policy and GitHub repository. | **About** section (`#about`, B6). |
| Live Price Preview Stage & Pills | `#section-preview`, `#preview-stage`, `.options-nav` | N/A | Removed | Owner decision: "The Live Preview section and the pill-style tab bar are deleted. No preview of any kind." | **DELETED** per owner instruction. |

---

## 3. Implementation Details

### Part A: Information Architecture & Shell (`44898a3`)
- Rebuilt `src/options/options.html` referencing external pre-boot script `theme-boot.js` and bundle `options.js`.
- Implemented `theme-boot.js` which immediately synchronizes `document.documentElement` class list (`dark`/`light`) and `data-theme` attribute before DOM paint, eliminating theme flash under MV3 CSP (no inline scripts).
- Established hash routing (#general, #currencies, #sites, #appearance, #data, #about) synchronizing `document.title` and `<h1>` headings.
- Shell layout: fixed 220px sidebar on desktop transitioning to horizontally scrollable top navigation below 760px.
- Live autosave via `MSG.UPDATE_SETTINGS` with fallback to `SettingsManager`, with listener on `chrome.storage.onChanged` to sync popup edits in real-time.

### Part B: Settings Sections & Data Backup (`d9126f0`)
- **General**: Searchable combobox over 170+ currencies (symbol + code + name, searchable by text), ambiguous dollar select, default site behavior toggle group, switches for whole numbers, crypto, in-page bar.
- **Currencies**: Pinned currencies chips (symbol + code, remove button), count badge "n of 8", limit enforcement (max 8) with alert text, searchable combobox to add unpinned currencies, quick suggestions.
- **Sites**: Clean hairline list of per-domain rules, hostnames in Fragment Mono, 3-way toggle (Ask / Always / Never), assumed currency combobox, Reset button to clear mode, ghost Remove button. Add-site inline row with domain normalization and duplicate validation. Empty state with clear explanation.
- **Appearance**: Theme segmented control (System / Light / Dark), display mode radio options (replace, append, replace+highlight).
- **Data**: JSON Export, Import file picker with JSON schema validation and `migrateSettings`, Reset to defaults behind Radix `AlertDialog`.
- **About**: Build stamp, live rates provider & freshness from `MSG.GET_RATES`, keyboard shortcut query via `chrome.commands.getAll()`, privacy policy and GitHub links.

### Part C: Legacy Cleanup & Bundle Verification (`6c4084e`)
- Deleted dead legacy code: `src/options/options.js` and `src/options/options.css`.
- Manifest preserves `options_ui.page: "options/options.html"` with `open_in_tab: true` for Chrome & Firefox parity.
- Verified Firefox WebExtension compliance with `web-ext lint` (0 errors, 0 warnings).

### Part D: Unit & E2E Verification (`b0e383e`)
- Unit tests (`tests/options.test.js`): 6/6 tests covering pure mapping functions (domain normalization, validation rules, caption logic, pinned limits, import round-trip, rule mutations).
- E2E tests (`tests/e2e/options.e2e.js`): 10 comprehensive scenarios running against unpacked extension in real Chromium.
- E2E suite updates: Updated selector bindings in `smoke.e2e.js`, `d1-default-target.e2e.js`, `b3-auto-convert.e2e.js`, and `t1-show-original.e2e.js`.

### Part E: Step 06 Cleanups & Design System Measurements (`cefc54b`)
- Gallery updates (`src/ui/gallery/gallery.jsx` and `dist/gallery/`):
  - Sidebar active item: raised background (`#EFECE5` light / `#181816` dark), font-weight 600, icon in ink color, zero left accent border or accent text.
  - Site rules: 1px hairline rows, zero bordered boxes, button text exactly "Add site".
  - Color palette table: surfaces marked as "Surface", contrast badges reserved strictly for text-on-background pairs with AA (>= 4.5) and AAA (>= 7.0) badges. Removed "AA & AAA verified" claim.
- `DESIGN.md`: Updated exact WCAG contrast values computed by `tests/contrast.test.js`, documented sidebar active-state rule, site-rule row anatomy, and "no literal plus in button text" rule.
- `docs/adr/0014-ui-stack-for-extension-pages.md`: Updated bundle size estimates with measured values.
- Real screenshots captured for all sections and states into `docs/audits/2026-10-23-options-rebuild/`.

---

## 4. Bundle Size Measurements

| Asset | Before (Legacy Vanilla) | After (Step 07 React + shadcn) | Status |
|---|---|---|---|
| `options/options.js` | 13,420 bytes (~13.1 KB) | 428,895 bytes (~418.8 KB) [~110 KB in zip] | **MEASURED** |
| `options/options.css` | 8,920 bytes (~8.7 KB) | 35,370 bytes (~34.5 KB) | **MEASURED** |
| `popup/popup.js` | 14,800 bytes (~14.5 KB) | ~140 KB uncompressed [Step 08 target] | **ESTIMATED** |
| `content/content.js` | 33,524 bytes (~32.7 KB) | 33,524 bytes (~32.7 KB) | **MEASURED** (Zero React) |
| `background.js` | 21,418 bytes (~20.9 KB) | 21,418 bytes (~20.9 KB) | **MEASURED** (Zero React) |

*Verification*: `content.js` and `background.js` contain `false` for React and react-dom dependencies.

---

## 5. Verification & Test Evidence

### Unit Tests (`npm test`)
```
> currency-converter-v2@2.0.0 test
> node --test tests/**/*.test.js && node tests/parse.test.js

ℹ tests 77
ℹ suites 0
ℹ pass 77
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 17261.3861
[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
```

### Real Browser E2E Tests (`npm run test:e2e`)
```
> currency-converter-v2@2.0.0 test:e2e
> node --test --test-concurrency=1 tests/e2e/*.e2e.js

✔ B1 Regression: One instance, one pill, honest count, and iframe isolation
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices
✔ C2 & C3 & C4: Gallery loads in real browser, fonts ready, 0 console errors, CDP glyph coverage
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN)
✔ E2E Options: Complete rebuild verification covering all 10 requirements
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders
✔ T1 Regression: Show original stays original on late mutations, re-converts cleanly
✔ T3 Regression: Context menu installation, listener lifecycle, and action dispatch
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ duration_ms 204687.9422
```

### Firefox Manifest V3 Parity (`npm run lint:firefox`)
```
> currency-converter-v2@2.0.0 lint:firefox
> web-ext lint --source-dir dist/firefox

Validation Summary:

errors          0              
notices         0              
warnings        0              
```

---

## 6. Audit Screenshots Generated

Stored in `docs/audits/2026-10-23-options-rebuild/`:
- `options-1280-general-light.png`
- `options-1280-general-dark.png`
- `options-1280-currencies-light.png`
- `options-1280-currencies-dark.png`
- `options-1280-sites-light.png`
- `options-1280-sites-dark.png`
- `options-1280-appearance-light.png`
- `options-1280-appearance-dark.png`
- `options-1280-data-light.png`
- `options-1280-data-dark.png`
- `options-1280-about-light.png`
- `options-1280-about-dark.png`
- `options-900-sites-light.png`
- `options-600-sites-light.png`
- `options-sites-empty-state.png`
- `options-currencies-8chips.png`
- `options-open-combobox.png`
- `options-confirm-dialog.png`

---

## 7. Deviations & Discoveries

- **DEVIATION**: None from settings schema or architecture. The live preview stage and pill tab bar were intentionally deleted as requested by the owner. Demo content from gallery ("Custom Rates API Endpoint") was dropped as it was not present in the settings schema.
- **DISCOVERY (cmdk in Playwright)**: In synthetic browser automation, `cmdk` command items listen primarily to pointer events. To guarantee reliable test clicks, explicit `onClick` and `data-currency-code` props were forwarded on `CommandItem`.
- **DISCOVERY (Theme Pre-Boot)**: Standard React apps flash unstyled content or wrong theme on reload if theme resolution occurs during React mount. Extracting a synchronous `theme-boot.js` script that reads `localStorage` before paint solved theme flash with 100% MV3 CSP compliance.
