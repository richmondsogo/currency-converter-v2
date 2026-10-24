# Step 11: Theme-Aware Pill & Decluttered Popup

- **Branch**: `step/11-pill-theme-and-popup-redesign`
- **Target branch**: `main`
- **Pull Request**: `https://github.com/richmondsogo/currency-convertr/pull/17`
- **First Commit SHA**: `b225a7e`
- **Last Commit SHA**: `b225a7e`
- **Merge Commit SHA**: `a48dec6`
- **Status**: Landed on `main`
- **Approved by owner**: 2026-10-24
- **Base Commit**: `fc472e0` (`main`)

---

## Goal

1. **Pill follows the general theme**: The in-page Dynamic Island capsule previously used hard-coded OLED black (`#09090b` / `#fafafa` zinc) and emerald green (`#10b981`), ignoring user Theme settings (`system` | `light` | `dark`). It now uses **Paper & Pine** tokens scoped to `.cc-island-container` (`src/content/ui.css` and `INLINE_UI_CSS` in `src/content/ui.js`), synchronized and tested for WCAG AA contrast against `--cc-surface-solid`.
2. **Pre-mount theme resolution**: `src/content/content.js` resolves the user's theme setting before first mounting `InPageUI`, preventing dark-to-light flash on initial paint.
3. **Popup decluttering**: Removed boxy container cards, inner borders, and micro-type from `src/popup/popup.jsx`; enforced the `>= 12px` design scale across all text nodes, standardized control heights (`h-9` inputs/comboboxes, `h-11` primary toggle, `h-7` chips), and preserved all DOM IDs and behavioral contracts.

---

## Scope

1. **Dynamic Island Pill Theming (`src/content/ui.css` & `src/content/ui.js`)**:
   - Replaced raw hex literals with `--cc-*` tokens scoped to `.cc-island-container`.
   - Light (Paper default): `--cc-surface: rgba(247, 245, 240, 0.86)`, `--cc-surface-solid: #F7F5F0`, `--cc-raised: #EFECE5`, `--cc-hairline: #E2DED4`, `--cc-text: #191815`, `--cc-muted: #67635A`, `--cc-accent: #1E6B52`, `--cc-accent-fg: #FFFFFF`, `--cc-ring: rgba(30, 107, 82, 0.4)`.
   - Dark (Warm Night): `--cc-surface: rgba(24, 24, 22, 0.86)`, `--cc-surface-solid: #181816`, `--cc-raised: #10100E`, `--cc-hairline: #2A2926`, `--cc-text: #ECE9E2`, `--cc-muted: #9B968B`, `--cc-accent: #6FD3A6`, `--cc-accent-fg: #10100E`, `--cc-ring: rgba(111, 211, 166, 0.4)`.
   - Scoped selectors: `.cc-island-container` (light default), `@media (prefers-color-scheme: dark) { .cc-island-container:not([data-theme="light"]) { ... } }` (system dark), and `.cc-island-container[data-theme="dark"]` (explicit dark).
   - `color-scheme: light | dark` handles native `<select>` dropdown rendering.
   - Status dot uses `--cc-accent` (pine green) for active converted state and `--cc-muted` for inactive/original mode.
   - Accessibility fallbacks for `prefers-reduced-transparency: reduce`, `prefers-contrast: more`, and non-supporting blur runtimes fall back to solid `--cc-surface-solid`.
   - Enforced byte-for-byte CSS synchronization and zero hardcoded literals via `tests/pill_theme.test.js`.
2. **Content Script Settings Hydration (`src/content/content.js`)**:
   - `ensurePillTheme()` queries settings with a timeout fallback to `'system'`.
   - Invoked at `initContentScript()` start and `await`ed before `InPageUI` instantiation to guarantee the initial paint renders in the user's selected theme.
   - `storage.onChanged` updates `pillThemeSetting` and calls `currentUI.update({ theme })`.
3. **Popup Decluttering (`src/popup/popup.jsx`)**:
   - Flat, boxless status bar (`#live-status`, `role="status"`).
   - Plain muted text for `"Auto-detect"` (`#from-display`) replacing bordered chip.
   - Borderless pinned currency chips (`h-7`, `aria-pressed`, selected state uses `bg-secondary text-foreground font-medium`).
   - Flat warning-tinted row for `#unsupported-notice` (`bg-warning/10` with warning icon, no border box).
   - Enforced 12px minimum font size across all surfaces (verified via Playwright TreeWalker).
   - 100% contract preservation for existing tests: IDs, strings, and accessibility attributes intact.
4. **Documentation & Records**:
   - Authored `docs/adr/0015-theme-aware-in-page-pill.md`.
   - Updated `DESIGN.md` §1, §6, and §7.
   - Updated `CONTEXT.md` and `CHANGELOG.md`.

---

## Out of Scope

- Refactoring horizontal grid expansion (`grid-template-columns: 0fr -> 1fr`) to transform-only animation (reserved for dedicated motion performance step).
- Modifying user-owned audit screenshots in `docs/audits/2026-10-22-ui-foundation/`.
- Prohibited DOM-string manipulation APIs (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`).

---

## Verification Evidence

### 1. Automated Test Suite (`npm test`)
Executed on 2026-10-24:
```text
✔ B2 Regression: Parser currency labels and boundary tests (18.3681ms)
✔ B2 Regression: DOM PageScanner no stray labels or prefix leftovers (607.3137ms)
✔ build: manifest structure and permissions for Chrome (9.8933ms)
✔ build: manifest structure and permissions for Firefox (5.4807ms)
✔ build: zip packages exist and contain manifest.json at root (46.0399ms)
✔ Paper & Pine contrast ratios satisfy WCAG AA >= 4.5:1 (11.9254ms)
✔ Contrast calculation fails if contrast drops below 4.5:1 (0.2015ms)
✔ currencies: getCurrencyMeta returns correct metadata for fiat and crypto (3.3102ms)
✔ currencies: getAllCurrencies filters crypto and availableCodes properly (4.4867ms)
✔ currencies: TLD and language resolution (0.8037ms)
✔ currencies: resolveAmbiguousSymbol priority order (1.0784ms)
✔ Firefox MV3 Smoke: Add-on loads, popup opens, and converts prices on real page (12104.592ms)
✔ format: standard fiat currency with minor digits (58.6452ms)
✔ options unit: site rule mutations (add, change mode, set assumed currency, reset mode, remove) (0.4403ms)
✔ tests\parse.test.js (183.4794ms)
✔ scanner: multiple convert-revert-convert cycles succeed without dropping elements (887.8369ms)
✔ ui: InPageUI lifecycle, segmented switch, collapse, and updates (212.3696ms)
✔ popup: isRestrictedPage correctly identifies system vs web pages (14.6135ms)
✔ ui: Dynamic Island pill displays source -> target currency in compact view (68.2403ms)
✔ ui: Dynamic Island pill maintains single-capsule horizontal expansion architecture (62.8275ms)
✔ pill css: ui.css and INLINE_UI_CSS stay in sync (comments/whitespace ignored) (3.0966ms)
✔ pill css: defines light default, explicit dark, and system-dark token blocks (7.741ms)
✔ pill css: system-dark block is scoped so explicit light wins on a dark OS (0.4153ms)
✔ pill css: no hard-coded OLED/zinc/emerald literals outside token blocks (2.6032ms)
✔ pill css: uses theme tokens for surface, text, segmented control and select (0.7042ms)
✔ pill css: accessibility fallbacks for transparency and contrast preferences (0.5962ms)
✔ pill css: single-capsule horizontal expansion architecture is preserved (0.4341ms)
✔ pill theme: data-theme attribute follows theme at mount and on update (2.9559ms)
✔ pill theme: token pairs meet WCAG AA against the solid (worst-case) surface (26.3325ms)
✔ popup-errors: classifies errors correctly
✔ rates: cross-rate math and calculations
✔ settings: default settings schema, migrations, and SettingsManager
✔ theme: resolveEffectiveTheme, applyTheme, subscribeSystemTheme
ℹ tests 114
ℹ suites 0
ℹ pass 114
ℹ fail 0
ℹ duration_ms 14615.1274
```

### 2. Browser E2E Test Suite (`npm run test:e2e`)
Executed on 2026-10-24 in real Chromium:
```text
✔ B1 Regression: One instance, one pill, honest count, and iframe isolation (16139.3892ms)
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (34862.5172ms)
✔ C2 & C3 & C4: Gallery loads in real browser, fonts ready, 0 console errors, CDP glyph coverage, screenshots (4343.0732ms)
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget (25231.7128ms)
[F1] pill theme scenarios passed: 4
✔ F1: pill follows Theme setting (light/dark/system) and OS preference, loading saved theme before first paint (16782.7156ms)
[F2] popup contract + type scale verified
✔ F2: popup keeps its behavioral contract and renders no text under 12px (10928.1975ms)
✔ E2E Options: Complete rebuild verification covering all 10 requirements (23074.3832ms)
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders (10135.2428ms)
✔ T1 Regression: Show original stays original on late mutations, re-converts cleanly (24954.1694ms)
✔ T3 Regression: Context menu installation, listener lifecycle, and action dispatch (13566.1759ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ duration_ms 187463.4996
```

### 3. Firefox Lint (`npm run lint:firefox`)
Executed on 2026-10-24:
```text
Validation Summary:
errors          0
notices         0
warnings        4
```
*(4 warnings are standard React 19 inner bundle warnings; 0 errors).*

### 4. Prohibited HTML String Injection Grep Guard
```powershell
Get-ChildItem -Path src -Recurse -File | Select-String -Pattern "innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML"
```
Output:
```text
src\content\ui.js:765:    // Dismiss / Close Button (Clean 'x' icon, zero innerHTML)
```
**Zero prohibited API invocations** across all source files.

---

## Visual Verification Artifacts

All screenshots captured from real Chromium instances in `docs/steps/screenshots/`:

| Surface | State / Setting | Screenshot |
|---|---|---|
| In-Page Pill | Light Theme on Dark OS (Resting) | `docs/steps/screenshots/11-pill-theme-light-os-dark.png` |
| In-Page Pill | Light Theme on Dark OS (Expanded) | `docs/steps/screenshots/11-pill-theme-light-os-dark-expanded.png` |
| In-Page Pill | Dark Theme on Light OS (Resting) | `docs/steps/screenshots/11-pill-theme-dark-os-light.png` |
| In-Page Pill | Dark Theme on Light OS (Expanded) | `docs/steps/screenshots/11-pill-theme-dark-os-light-expanded.png` |
| In-Page Pill | System Theme on Light OS | `docs/steps/screenshots/11-pill-theme-system-os-light.png` |
| In-Page Pill | System Theme on Dark OS | `docs/steps/screenshots/11-pill-theme-system-os-dark.png` |
| Toolbar Popup | Light Theme (Decluttered, >=12px) | `docs/steps/screenshots/11-popup-light.png` |
| Toolbar Popup | Dark Theme (Decluttered, >=12px) | `docs/steps/screenshots/11-popup-dark.png` |
