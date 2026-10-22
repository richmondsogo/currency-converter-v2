# Step 06: UI Foundation (Design System, shadcn Stack, Gallery)

- **Branch**: `step/06-ui-foundation`
- **Target Branch**: `main`
- **Status**: COMPLETE
- **Previous Step (Step 05b) Merge Commit SHA on Main**: `83e7632` (`Merge pull request #11 from richmondsogo/step/05b-verification`)
- **PR URL**: https://github.com/richmondsogo/currency-convertr/pull/12
- **First Commit SHA (Part A)**: `b01a517`
- **Last Content Commit SHA (Part D)**: `8893ea8`
- **Pre-Merge Branch Commit SHA**: `bef8677`

---

## 1. Scope & Objectives

Step 06 establishes the UI design foundation for the upcoming redesign of the Options page (Step 07) and Popup (Step 08). It introduces the "Paper & Pine" design tokens, local font assets, a standalone React + Tailwind + shadcn build pipeline, a dev review gallery, and an invariant fix ensuring automatic and menu conversions always respect the user's default target currency.

### Part A: ADR & Pipeline
- **A1: ADR 0014**: Authored `docs/adr/0014-ui-stack-for-extension-pages.md` specifying React 18 + Tailwind CSS v3 + shadcn/ui bundled locally by esbuild for Options and Popup only. In-page pill, content script, detector, and background service worker remain 100% vanilla JavaScript. Clarified MV3 security constraints (no remote scripts, no eval, zero `innerHTML`/`dangerouslySetInnerHTML`) and updated `README.md` to state: "Options and popup pages are built with React and shadcn/ui; content script, pill, and background service worker have zero runtime dependencies and zero framework overhead."
- **A2: Build Pipeline**: Maintained `npm run build` producing `dist/chrome` and `dist/firefox` bundles for existing vanilla pages. Added `npm run build:gallery` (via `node build.js --gallery`) outputting a self-contained standalone dev gallery to `dist/gallery/` with classic IIFE bundling (`format: 'iife'`, no ES modules) and relative WOFF2 asset paths so it can be opened directly via double-clicking `index.html` (`file://`).
- **A3: Vanilla Bundle Isolation**: Proved that `dist/chrome/background.js` and `dist/chrome/content.js` contain zero React or Tailwind code (`has React: false`).
- **A4: shadcn/ui Setup**: Added `components.json` with `@/` alias mapped to `src/ui`. Installed shadcn components (`button`, `input`, `label`, `switch`, `toggle-group`, `command` + `popover`, `separator`, `scroll-area`, `tooltip`, `sonner`, `badge`, `dialog`). Mapped all CSS variables in `src/ui/globals.css` to Paper & Pine semantic tokens.
- **A5: Build Stamp**: Injected `__VERSION__`, `__GIT_SHA__`, and `__BUILD_TIME__` via esbuild define. Added `"version_name": "2.0.0 (<sha>)"` to `dist/chrome/manifest.json`. Verified Firefox manifest omits `version_name` and `npm run lint:firefox` passes with 0 errors and 0 warnings.

### Part B: Design System Docs
- **B1: DESIGN.md Rewrite**: Completely rewrote `DESIGN.md` by hand to document the Paper & Pine palette, Familjen Grotesk (400/500/600/700) and Fragment Mono (400) local typography, 4px spacing scale, 8px control radii, 1px hairlines, 150ms transform/opacity motion with `prefers-reduced-motion` support, the strict no-card layout rule, and explicit preservation of the in-page pill in Shadow DOM using system fonts and OLED black styling.

### Part C: Dev Review Gallery
- **C1: src/ui/gallery**: Created comprehensive review surface (`src/ui/gallery/gallery.jsx`) featuring:
  - Complete typography specimen across all font sizes (12px, 13px, 14px, 16px, 22px) and weights (400, 500, 600, 700).
  - Currency symbol showcase line testing 10 target symbols: NGN (₦), EUR (€), GBP (£), JPY (¥), INR (₹), TRY (₺), RUB (₽), KRW (₩), GHS (₵), PHP (₱).
  - Color swatch sheet displaying all semantic tokens with computed WCAG contrast ratios.
  - Interactive shadcn components in realistic layouts: sidebar navigation sample, three settings rows (switch, 170-currency searchable combobox, text input), site rules list with 3-way segmented Ask / Always / Never controls, "Add site" row, buttons (primary ink, secondary, ghost, destructive), Sonner toast trigger, tooltips, and theme toggle (light/dark/system).
  - Footer build stamp displaying version, git SHA, and build timestamp.
- **C2: Real-Browser Glyph Verification**: Implemented Playwright test using Chrome DevTools Protocol (`CSS.getPlatformFontsForNode`) proving all 10 currency symbols render in the custom bundled `Familjen Grotesk` font and amounts render in `Fragment Mono`.
- **C3: Automated Tests**:
  - Unit test `tests/contrast.test.js` validating all 10 Paper & Pine light and dark text/background pairs exceed WCAG AA 4.5:1 (ranging from 5.16:1 to 16.32:1), failing if contrast drops below 4.5:1.
  - Real-browser E2E test `tests/e2e/c2-gallery.e2e.js` asserting `document.fonts` readiness and 0 console errors.
- **C4: Gallery Screenshots & Accessibility Audit**: Captured 4 responsive screenshots (1280px and 900px, light and dark) under `docs/audits/2026-10-22-ui-foundation/`. Ran accessibility audit ensuring 100% compliant ARIA attributes, semantic roles, and keyboard navigation.

### Part D: Default Target Invariant Fix
- **D1: Test-First Invariant Specification**: Authored `tests/e2e/d1-default-target.e2e.js` proving the owner-approved invariant: automatic and menu conversions always use `settings.targetCurrency`. Changing currency via popup or pill applies strictly to that active page and does not pollute subsequent page loads or Always-rule conversions.
- **D2: Minimal Fix**:
  - Removed `lastUsedTarget` update from `convertPageOnTab` in `src/background.js`.
  - Updated context menu creation in `src/background.js` to reference `settings.targetCurrency`.
  - Updated popup initialization in `src/popup/popup.js` to read `settings.targetCurrency`.
  - Marked `lastUsedTarget` `@deprecated` in `src/shared/settings.js`.

---

## 2. Bundle Size Verification (Part A3)

| Bundle File | Main (`83e7632`) | Step 06 (`step/06-ui-foundation`) | Net Change | Contains React? |
| :--- | :--- | :--- | :--- | :--- |
| `dist/chrome/background.js` | 85,961 bytes | 85,938 bytes | -23 bytes | **NO** (`false`) |
| `dist/chrome/content.js` | 132,319 bytes | 132,319 bytes | 0 bytes | **NO** (`false`) |
| `dist/chrome/options/options.js` | 76,032 bytes | 76,032 bytes | 0 bytes | **NO** (`false`) |
| `dist/chrome/popup/popup.js` | 73,597 bytes | 74,009 bytes | +412 bytes | **NO** (`false`) |

*Note: Production `background.js` and `content.js` bundles are 100% untouched by React/Tailwind. The +412 byte change in `popup.js` reflects the tab query fallback in `src/shared/browser.js:getActiveTab()` for test environments and default currency resolution cleanup.*

---

## 3. Real Browser Glyph Coverage Evidence (Part C2)

Automated verification via Chrome DevTools Protocol (`CSS.getPlatformFontsForNode`) on unpacked extension in Chromium:

```text
=== REAL BROWSER GLYPH COVERAGE EVIDENCE (CDP CSS.getPlatformFontsForNode) ===
[NGN] Symbol '₦' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (10 glyphs, isCustom: true)]
[EUR] Symbol '€' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (6 glyphs, isCustom: true)]
[GBP] Symbol '£' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (6 glyphs, isCustom: true)]
[JPY] Symbol '¥' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (6 glyphs, isCustom: true)]
[INR] Symbol '₹' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (9 glyphs, isCustom: true)]
[TRY] Symbol '₺' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (7 glyphs, isCustom: true)]
[RUB] Symbol '₽' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (9 glyphs, isCustom: true)]
[KRW] Symbol '₩' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (7 glyphs, isCustom: true)]
[GHS] Symbol '₵' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (7 glyphs, isCustom: true)]
[PHP] Symbol '₱' UI Font: [Familjen Grotesk (1 glyphs, isCustom: true)] | Amount Mono: [Fragment Mono (9 glyphs, isCustom: true)]
```

All 10 currency symbols render in the bundled `Familjen Grotesk` font (`isCustom: true`), and all amount strings render in `Fragment Mono` (`isCustom: true`). No system fallback fonts were used.

---

## 4. Test-First Evidence: Default Target Currency (Part D1)

### Failing Run (on unpatched code)
```text
[Step 1 - Initial Always Site Result]: { hasNgn: true, hasEur: false }
[Popup Action]: Selected EUR in popup on second tab
[Step 2 - Other Page Result]: Converted to EUR
[Step 3 - Reloaded Always Site Result]: { hasNgn: false, hasEur: true }
✖ AssertionError: Always site must reload with default target currency (NGN), not EUR
  Expected: true
  Actual: false
```

### Passing Run (with Part D fix)
```text
[Step 1 - Initial Always Site Result]: { hasNgn: true, hasEur: false }
[Popup Status]: {
  btnText: 'Show original',
  statusText: '9 prices converted · Rates: ECB + Fallback',
  selectedTarget: 'EUR (€)'
}
[Step 2 - Other Page Result after popup EUR]: { hasEur: true, hasNgn: false }
[Step 3 - Reloaded Always Site Result]: { hasNgn: true, hasEur: false }
[Step 4 - New Page on Always Site Result]: { hasNgn: true, hasEur: false }
[D1 Test Complete] Default target currency invariant preserved.
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget (17505.1166ms)
```

---

## 5. Gallery Screenshots & Accessibility Audit (Part C4)

### Responsive Screenshots
- `docs/audits/2026-10-22-ui-foundation/gallery-1280-light.png`
- `docs/audits/2026-10-22-ui-foundation/gallery-1280-dark.png`
- `docs/audits/2026-10-22-ui-foundation/gallery-900-light.png`
- `docs/audits/2026-10-22-ui-foundation/gallery-900-dark.png`

### Accessibility Audit Findings
- **Focus Rings**: Custom Tailwind ring utilities configure focus rings with 40% alpha pine accent (`rgb(30 107 82 / 0.4)` light, `rgb(111 211 166 / 0.4)` dark).
- **Semantics**: Segmented toggle groups have `role="radiogroup"` or `role="group"` with explicit `aria-label`s. Form inputs have paired `<Label>` elements with matching `htmlFor`/`id` associations.
- **Zero innerHTML**: Confirmed 0 violations across all components and the gallery entry.

---

## 6. Full Test Suite & Linter Verification

### Unit Tests (`npm test`)
```text
✔ B2 Regression: Parser currency labels and boundary tests (16.411ms)
✔ B2 Regression: DOM PageScanner no stray labels or prefix leftovers (352.6407ms)
✔ build: manifest structure and permissions for Chrome (6.9914ms)
✔ build: manifest structure and permissions for Firefox (2.5016ms)
✔ build: zip packages exist and contain manifest.json at root (17.6782ms)
▶ Paper & Pine contrast ratios satisfy WCAG AA >= 4.5:1
  ✔ Light Text (#191815) on #F7F5F0 (1.8593ms)
  ✔ Light Muted (#67635A) on #F7F5F0 (0.2832ms)
  ✔ Light Accent (#1E6B52) on #F7F5F0 (0.284ms)
  ✔ Light Warning (#A15C07) on #F7F5F0 (0.31ms)
  ✔ Light Danger (#B3261E) on #F7F5F0 (0.2928ms)
  ✔ Dark Text (#ECE9E2) on #10100E (0.3326ms)
  ✔ Dark Muted (#9B968B) on #10100E (0.2934ms)
  ✔ Dark Accent (#6FD3A6) on #10100E (0.2479ms)
  ✔ Dark Warning (#E5A038) on #10100E (0.3823ms)
  ✔ Dark Danger (#E87068) on #10100E (0.368ms)
✔ Paper & Pine contrast ratios satisfy WCAG AA >= 4.5:1 (10.3548ms)
✔ Contrast calculation fails if contrast drops below 4.5:1 (0.2598ms)
...
ℹ tests 71
ℹ suites 0
ℹ pass 71
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7275.5576
```

### Real Browser E2E Tests (`npm run test:e2e`)
```text
✔ B1 Regression: One instance, one pill, honest count, and iframe isolation (9836.1994ms)
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (21362.252ms)
✔ C2 & C3 & C4: Gallery loads in real browser, fonts ready, 0 console errors, CDP glyph coverage, screenshots (4695.142ms)
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget (17505.1166ms)
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders (3186.1163ms)
✔ T1 Regression: Show original stays original on late mutations, re-converts cleanly (16046.1412ms)
✔ T3 Regression: Context menu installation, listener lifecycle, and action dispatch (4895.158ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 82775.1041
```

### Firefox Manifest & WebExtension Linter (`npm run lint:firefox`)
```text
Validation Summary:

errors          0              
notices         0              
warnings        0              
```

---

## 7. Two-Axis Code Review (Standards & Spec)

### Standards
- **Zero innerHTML Rule**: PASS. All shadcn components, gallery code, and production scripts use native DOM APIs or React JSX elements. Zero usage of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `dangerouslySetInnerHTML`.
- **Skills Policy**: PASS. No prohibited skills used.
- **Evidence Over Summary**: PASS. Exact command outputs and CDP telemetry logged.
- **Smell Baseline**: None detected. Code is modularized under `src/ui/components/ui/`, `src/ui/lib/utils.js`, and `src/ui/gallery/`.

### Spec
- **ADR 0014 and Pipeline**: PASS. Standalone gallery outputs to `dist/gallery/`, classic IIFE bundle opens via `file://`.
- **Bundle Isolation**: PASS. React/Tailwind code is isolated strictly to `src/ui/` and `dist/gallery/`.
- **Paper & Pine Palette & Local Fonts**: PASS. Familjen Grotesk and Fragment Mono loaded via `@fontsource` packages locally. Contrast tests confirm >= 4.5:1.
- **CDP Glyph Coverage**: PASS. Proved all 10 symbols render via custom bundled fonts.
- **Default Target Currency Invariant**: PASS. Auto-converts and context menus strictly use `settings.targetCurrency`. `lastUsedTarget` deprecated.

---

## 8. Discoveries & Known Gaps

1. **Test Runner Concurrency in E2E Suite**: Node's built-in test runner (`node --test tests/e2e/*.e2e.js`) runs test files concurrently by default. Because each E2E test invokes `launchExtensionBrowser` which executes `node build.js`, simultaneous builds clobbered `dist/chrome`. Adding `--test-concurrency=1` to `"test:e2e"` serialized browser launches and achieved 100% deterministic test execution.
2. **Options & Popup Redesign Scope**: Step 06 establishes the foundation and gallery review surface. The actual production Options page and Popup UI remain on vanilla JavaScript and will be migrated to the React + shadcn stack in Step 07 and Step 08.
