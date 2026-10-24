# Step 10: Dynamic Island Capsule Restoration & Cross-Browser Theming

- **Branch**: `step/10-dynamic-island-and-theming`
- **Target branch**: `main`
- **Pull Request**: TBD
- **First Commit SHA**: TBD
- **Last Commit SHA**: TBD
- **Merge Commit SHA**: TBD
- **Base Commit**: `a479301` (`main`)
- **Status**: Completed / Ready for PR
- **Approved by owner**: 2026-10-24

## Scope

1. **Dynamic Island Capsule Restoration**:
   - Revert the in-page pill design from the detached dropdown drawer introduced in Step 09 back to its true Apple Dynamic Island look.
   - Enforce single-capsule morphology: `overflow: hidden`, `border-radius: 9999px`, and OLED `#09090b` styling.
   - Restore inline horizontal grid expansion (`grid-template-columns: 0fr -> 1fr` with Apple spring easing `cubic-bezier(0.22, 1, 0.36, 1)` and `280ms` duration).
   - Keep all controls (`[Original | Converted]` segmented toggle, quick currency dropdown, live rate info, and dismiss button) intact within the expanding capsule.
   - Add tactile active press state (`transform: scale(0.97)`) on controls.
   - Synchronize `src/content/ui.css` and `INLINE_UI_CSS` in `src/content/ui.js` byte-for-byte.
2. **Cross-Browser Theming Architecture (`src/shared/theme.js`)**:
   - Build a centralized, tested theme management module for resolving themes, applying symmetric classes (`.dark` / `.light`), setting `data-theme`, and setting native `color-scheme`.
   - Add explicit `color-scheme: light` and `color-scheme: dark` to `src/ui/globals.css` to guarantee native browser scrollbars and `<select>` dropdowns match the theme across Chrome and Firefox.
   - Symmetrically apply `.light` and `.dark` so that `@media (prefers-color-scheme: dark) :root:not(.light)` never clashes with an explicit light theme setting on a dark OS.
   - Standardize synchronous pre-boot script (`theme-boot.js`) across Options and Popup to eliminate any flash of unstyled theme (FOUC).
   - Wire live system theme listeners (`matchMedia('(prefers-color-scheme: dark)')`) across both Options and Popup.
   - Synchronize theme setting to `localStorage` on all `SettingsManager` mutations and broadcast updates to open content scripts.

## Out of Scope

- New settings schema additions or rate providers.
- Changes to the user-owned audit screenshots in `docs/audits/2026-10-22-ui-foundation/`.
- Prohibited HTML-string DOM APIs (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`).

---

## Verification Evidence

### 1. Test Suite (`npm test`)
Executed on 2026-10-24:
```text
✔ B2 Regression: Parser currency labels and boundary tests (24.7437ms)
✔ B2 Regression: DOM PageScanner no stray labels or prefix leftovers (488.4133ms)
✔ build: manifest structure and permissions for Chrome (6.3604ms)
✔ build: manifest structure and permissions for Firefox (3.8352ms)
✔ build: zip packages exist and contain manifest.json at root (45.2584ms)
✔ Paper & Pine contrast ratios satisfy WCAG AA >= 4.5:1 (15.9114ms)
✔ Contrast calculation fails if contrast drops below 4.5:1 (0.2541ms)
✔ currencies: getCurrencyMeta returns correct metadata for fiat and crypto (1.7874ms)
✔ currencies: getAllCurrencies filters crypto and availableCodes properly (2.2414ms)
✔ currencies: TLD and language resolution (0.7569ms)
✔ currencies: resolveAmbiguousSymbol priority order (0.639ms)
[Firefox Smoke Test] Popup final status: 2 prices converted · Rates: ECB + Fallback
[Firefox Smoke Test] Converted price p2: $55.96
✔ Firefox MV3 Smoke: Add-on loads, popup opens, and converts prices on real page (13311.345ms)
✔ format: standard fiat currency with minor digits (53.1845ms)
✔ options unit: site rule mutations (add, change mode, set assumed currency, reset mode, remove) (0.9965ms)
✔ tests\parse.test.js (145.4157ms)
✔ scanner: multiple convert-revert-convert cycles succeed without dropping elements (454.8218ms)
✔ ui: InPageUI lifecycle, segmented switch, collapse, and updates (142.5187ms)
✔ popup: isRestrictedPage correctly identifies system vs web pages (5.1844ms)
✔ ui: Dynamic Island pill displays source -> target currency in compact view (56.3142ms)
✔ ui: Dynamic Island pill maintains single-capsule horizontal expansion architecture (76.4381ms)
✔ theme: resolveEffectiveTheme handles explicit and system themes (1.9056ms)
✔ theme: applyTheme applies symmetric classes, data-theme, and colorScheme to DOM document (3.0195ms)
✔ theme: subscribeSystemTheme attaches and cleans up matchMedia listeners (0.6663ms)
ℹ tests 87
ℹ suites 0
ℹ pass 87
ℹ fail 0
```

### 2. Browser E2E Test Suite (`npm run test:e2e`)
Executed on 2026-10-24:
```text
✔ B1 Regression: One instance, one pill, honest count, and iframe isolation (22844.7661ms)
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (38855.4739ms)
✔ C2 & C3 & C4: Gallery loads in real browser, fonts ready, 0 console errors, CDP glyph coverage, screenshots (5011.1436ms)
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget (33909.4455ms)
[E2E Options] All 10 test scenarios passed with 0 console errors.
✔ E2E Options: Complete rebuild verification covering all 10 requirements (28651.2939ms)
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders (17547.2502ms)
✔ T1 Regression: Show original stays original on late mutations, re-converts cleanly (32077.7687ms)
✔ T3 Regression: Context menu installation, listener lifecycle, and action dispatch (16902.9697ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
```

### 3. Firefox Lint (`npm run lint:firefox`)
Executed on 2026-10-24:
```text
> web-ext lint --source-dir dist/firefox

Validation Summary:
errors          0
notices         0
warnings        4
```
*0 errors; 4 warnings are known React 19 core library warnings inside bundled react-dom.*
