# 0014. UI Stack for Extension Pages (Options and Popup)

Date: 2026-10-22
Status: Accepted (Supersedes portions of ADR 0001 and ADR 0002)

## Context
The Currency Convertr browser extension provides three primary user surfaces:
1. **In-Page Floating Pill & Detection**: Floats on arbitrary host web pages inside an open Shadow DOM.
2. **Toolbar Action Popup**: Quick conversion scratchpad, page action triggers, and per-site rules.
3. **Preferences & Options Dashboard**: Comprehensive settings, custom rates, site rule management, and display options.

Previous ADRs (ADR 0001, 0002) mandated an entirely vanilla, hand-crafted DOM approach across all surfaces to enforce a strict "zero runtime dependencies" constraint. However, live testing (Owner Feedback 2026-10-21) demonstrated that hand-crafting complex UI surfaces (accessible searchable comboboxes, three-state segmented controls, responsive keyboard navigation, and theme toggling) in vanilla DOM introduced friction, layout inconsistency, and styling drift.

At the same time, browser extension environments under Manifest V3 impose strict architectural constraints:
- **Strict Content Security Policy (CSP)**: `script-src 'self'`. Remotely hosted code, CDNs, inline scripts (`<script>...</script>`), and string evaluation (`eval()`, `new Function()`) are strictly forbidden.
- **Mozilla Add-on & Chrome Web Store Policies**: Heavy scrutiny on obfuscation, runtime imports, and DOM-based cross-site scripting (DOM-XSS).
- **In-Page Isolation**: Injected content scripts share memory with host pages and must remain ultra-lightweight, non-intrusive, and fast.

## Decision
1. **Stack for Extension Pages (`options` and `popup`) and Dev Gallery**:
   - Use **React 19** + **Tailwind CSS v3** + **shadcn/ui** (Radix UI headless primitives).
   - Bundle locally using **esbuild** into self-contained IIFE/script bundles.
   - All components and assets (including fonts) are bundled locally. Zero remote requests or CDN dependencies.
2. **Vanilla Boundary for In-Page and Background Scripts**:
   - The in-page Dynamic Island pill (`src/content/ui.js`), page scanner (`src/content/scanner.js`), content script (`src/content/content.js`), lightweight detector, and background service worker (`src/background.js`) **strictly remain vanilla JavaScript**.
   - No React runtime, virtual DOM, or external framework code is ever included in `content.js` or `background.js`.
   - The in-page pill continues to use the system font stack and hardware OLED dark styling inside its Shadow DOM.
3. **Absolute Prohibition of innerHTML**:
   - The ban on `innerHTML`, `outerHTML`, and `insertAdjacentHTML` (ADR 0008) is preserved in full force.
   - `dangerouslySetInnerHTML` is strictly prohibited in all React code.
4. **Local Font Bundling**:
   - Typography relies on local WOFF2 font files bundled via `@fontsource` packages:
     - UI Text: **Familjen Grotesk** (400, 500, 600, 700).
     - Numerical figures, rates, hostnames: **Fragment Mono** (400).
   - Zero remote font loads (e.g., Google Fonts CDN is prohibited).
5. **Theme Management**:
   - Theme (`system` | `light` | `dark`) is resolved from stored settings and applied via a data attribute or class on the root element before first render, eliminating theme flash without inline script tags.

## Alternatives Considered
1. **Pure Vanilla DOM (Status Quo)**:
   - *Rejected*: Creating robust, accessible components (like ARIA-compliant comboboxes with keyboard search and multi-state segmented toggles) requires thousands of lines of imperative DOM manipulation, increasing bug surface and review friction.
2. **Svelte or Vue**:
   - *Rejected*: While lightweight, the headless accessible primitives ecosystem (Radix UI / shadcn) is significantly more mature and standardized in the React ecosystem.
3. **Preact**:
   - *Evaluated*: Offers a smaller footprint, but modern esbuild tree-shaking and minification for dedicated extension pages (options and popup) keeps React bundles under acceptable thresholds:
     - **Options Page**: `options.js` 419.1 KB uncompressed (128.1 KB gzip), `options.css` 34.5 KB uncompressed [**MEASURED** Step 07 at `e1aaafa`].
     - **Action Popup**: `popup.js` 339.0 KB uncompressed (108.5 KB gzip), `popup.css` 35.5 KB uncompressed [**MEASURED** Step 08 at `b0957ad`].
     - **Baseline Vanilla (Step 06 `db16e2c`)**: `options.js` 74.3 KB, `popup.js` 72.3 KB, Chrome ZIP 89.6 KB [**MEASURED**].
     Radix UI primitives have first-class, verified support with standard React while in-page scripts remain pure zero-framework vanilla.

## Consequences
- **Positive**:
  - Delivers a cohesive, accessible, and high-fidelity design system (Paper & Pine palette) using tested UI primitives.
  - Accelerates options and popup redesign in Steps 07 and 08.
  - Zero pollution of in-page scripts: `content.js` remains pure vanilla, preserving zero-overhead performance on third-party host pages.
- **Negative / Costs**:
  - Introduces React, Radix UI primitives, and Tailwind CSS to the development and packaging pipeline.
  - Extension package size increases slightly due to bundled local font files (WOFF2) and React runtime in extension pages.
- **Compliance & Privacy**:
  - Fully compliant with Manifest V3 and Mozilla `web-ext lint`.
  - Zero network leakage: all scripts, styles, and fonts reside locally within the extension package.
