# 0001. Bundling and Modular Architecture

Date: 2026-03-01
Status: Accepted

## Context
A browser extension built with Manifest V3 requires self-contained scripts for background workers, content scripts, and extension pages. Many browsers restrict dynamic ESM module imports or remote script execution in extension contexts under strict Content Security Policies (CSP).

## Decision
Use `esbuild` as a development dependency to bundle pure ESM source modules from `src/shared/`, `src/content/`, `src/popup/`, and `src/options/` into self-contained IIFE/worker bundles in `dist/`.

Target bundles:
- `background.js`: Universal background script/worker.
- `content.js`: In-page content script injected dynamically or declared statically.
- `popup/popup.js`: Toolbar extension popup logic.
- `options/options.js`: Dedicated options/preferences page.

## Rationale
- Zero runtime dependencies: Keeps extension lightweight and self-reliant.
- Zero remote code: Complies with Manifest V3 security mandates prohibiting remotely hosted code.
- Strict CSP compatibility: Bundled IIFE scripts execute without requiring `unsafe-eval` or runtime dynamic module fetching.

## Consequences
- Requires a build step (`node build.js` / `npm run build`) before testing unpacked bundles.
- Eliminates runtime dependency vulnerabilities.
