# 0011. Firefox MV3 & Cross-Browser Shim

Date: 2026-03-01
Status: Accepted

## Context
Chromium browsers (Chrome, Edge, Brave, Opera) and Mozilla Gecko (Firefox) share the Manifest V3 specification but differ in implementation details:
- Chromium uses `background.service_worker: "background.js"` and the `chrome.*` namespace.
- Firefox MV3 uses `background.scripts: ["background.js"]`, requires an explicit gecko add-on ID (`browser_specific_settings.gecko.id`), and supports the promise-based `browser.*` namespace alongside `chrome.*`.

## Decision
Use `src/shared/browser.js` as a unified promise-based abstraction layer. Provide seamless fallbacks between `chrome.*` and `browser.*`. Configure `build.js` to emit separate manifest files tailored to Chrome and Firefox targets while sharing the compiled core bundles.

## Rationale
- Write once, run everywhere: Core product logic does not contain repetitive `if (typeof browser !== 'undefined')` conditionals.
- Full store compliance: Generates native manifests passing both Chrome Web Store and Firefox AMO submission pipelines.

## Consequences
- Requires dual manifest maintenance in `build.js` and automated tests verifying both manifest variants (`tests/build.test.js`).
