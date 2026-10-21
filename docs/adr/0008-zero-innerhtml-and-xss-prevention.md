# 0008. Zero innerHTML and XSS Prevention

Date: 2026-03-01
Status: Accepted

## Context
Browser extensions operate with elevated privileges. Parsing untrusted page text, currency labels, or error messages via `innerHTML`, `outerHTML`, or `insertAdjacentHTML` introduces critical Cross-Site Scripting (DOM-XSS) vulnerabilities and triggers automatic rejections during Mozilla Add-on and Chrome Web Store reviews.

## Decision
Ban `innerHTML`, `outerHTML`, and `insertAdjacentHTML` entirely across the entire codebase. Build all UI elements across `src/content/ui.js`, `src/popup/popup.js`, and `src/options/options.js` strictly using native DOM APIs:
- `document.createElement()`
- `document.createTextNode()`
- `element.replaceChildren()`
- `element.textContent`
- SVG creation via `document.createElementNS('http://www.w3.org/2000/svg', ...)`

## Rationale
- Security: Eliminates any possibility of script execution from hostile or malformed web page text.
- Store Compliance: Passes `web-ext lint` with zero errors, notices, or warnings, complying with Mozilla Add-on Review Policies and Google extension security requirements.
- Performance: Direct DOM construction avoids HTML parser overhead.

## Consequences
- Requires writing verbose DOM construction helpers (e.g. `createSvg()` in `ui.js`) instead of HTML template strings.
