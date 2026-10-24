# Step 09: Cross-Browser Reliability & Interaction Polish

- **Branch**: `step/09-cross-browser-reliability-and-polish`
- **Target branch**: `main`
- **Status**: Completed
- **Base Commit**: `935058f` (`main`)
- **Approved by owner**: 2026-10-23

## Scope

1. Make the Firefox MV3 conversion path reliable when the popup targets a page in another window.
2. Make the Firefox smoke test independent of mutable repository build output, and retain a regression signal for the reported conversion failure.
3. Improve conversion feedback and micro-interactions across the popup and in-page pill using the existing Paper & Pine and OLED systems only.
4. Verify the same conversion path in Chrome and Firefox; run unit tests, browser E2E tests, a fresh build, and Firefox lint.

## Out of Scope

- New settings, rate providers, or manifest permission expansion.
- Changes to the user-owned audit screenshots already modified in the working tree.
- Replacing the existing React/shadcn extension-page stack or the vanilla in-page pill boundary.

## Design Direction

The extension remains an editorial utility rather than a dashboard: the primary conversion action and its resulting status are the one memorable moment. Popup feedback should be immediate, compact, and unambiguous. The in-page pill should use transform/opacity-only motion and system typography, retaining its OLED treatment without introducing new visual tokens or decorative surfaces.

## Verification Targets

- Firefox smoke test passes repeatedly from a fresh, isolated Firefox extension directory.
- Popup action waits for a real page target and reports success only after a successful response.
- Chrome E2E conversion regression suite remains green.
- No prohibited HTML-string DOM APIs or React `dangerouslySetInnerHTML` are introduced.

## Verification Evidence

### Firefox conversion regression

Before this step, `npm test` failed in the Firefox smoke test while the same test passed alone. The isolated failure showed the popup status remained `Ready to convert` after the action was clicked. The underlying test suite also rebuilt shared `dist/` output concurrently with the Firefox add-on installation.

After the change, `npm test` was run on 2026-10-23 and completed with **83 passed, 0 failed**. Its Firefox smoke output was:

```text
[Firefox Smoke Test] Popup final status: 2 prices converted · Rates: ECB + Fallback
[Firefox Smoke Test] Converted price p2: $55.96
✔ Firefox MV3 Smoke: Add-on loads, popup opens, and converts prices on real page
ℹ tests 83
ℹ pass 83
ℹ fail 0
```

### Build and lint

`npm run build` completed successfully for both Chrome and Firefox output directories. `npm run lint:firefox` reported **0 errors, 0 notices, 4 warnings**. The warnings are existing `web-ext` static-analysis false positives against minified React bundle internals; the source scan found no prohibited DOM-string API added by this step.

```text
> npm run lint:firefox
Validation Summary:
errors  0
notices 0
warnings 4
```

### Chrome browser E2E

`npm run test:e2e` was executed to completion on 2026-10-24 and completed with **12 passed, 0 failed** in 168.56s. All real-browser conversion flows, including popup conversions, default target persistence, auto-conversions, dynamic island pill interactions, and context menus are verified.

```text
> currency-converter-v2@2.0.0 test:e2e
> node --test --test-concurrency=1 tests/e2e/*.e2e.js

✔ B1 Regression: One instance, one pill, honest count, and iframe isolation (15350.5019ms)
✔ B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices (34190.9948ms)
✔ C2 & C3 & C4: Gallery loads in real browser, fonts ready, 0 console errors, CDP glyph coverage, screenshots (5013.6743ms)
✔ D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget (28241.2567ms)
✔ E2E Options: Complete rebuild verification covering all 10 requirements (28273.1019ms)
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders (11899.912ms)
✔ T1 Regression: Show original stays original on late mutations, re-converts cleanly (21701.7182ms)
✔ T3 Regression: Context menu installation, listener lifecycle, and action dispatch (16275.9871ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 168564.8518
```
**Status**: **PASS (12/12 real browser E2E tests pass)**
