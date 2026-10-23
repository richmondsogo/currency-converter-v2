# Step 09: Cross-Browser Reliability & Interaction Polish

- **Branch**: `step/09-cross-browser-reliability-and-polish`
- **Target branch**: `main`
- **Status**: IN PROGRESS
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

`npm run test:e2e` was started after the source changes, but the command did not complete within the available command session and therefore is **NOT RUN** as a completed verification. The existing `tests/e2e/d1-default-target.e2e.js` covers conversion through the Chrome popup, including its converted-page assertion; it must be run to completion before this step is merged.
