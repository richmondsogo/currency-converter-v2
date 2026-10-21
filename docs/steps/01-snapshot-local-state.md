# Step 01: Snapshot Local State

- **Branch**: `step/01-snapshot-local-state`
- **Target Branch**: `main`
- **PR URL**: https://github.com/richmondsogo/currency-convertr/pull/4
- **First Commit SHA**: `023f80f`
- **Status**: Merged

## Context & Objectives
Prior agent work left uncommitted changes in the local working tree. The remote `main` branch did not reflect this actual project state. Step 01 snapshots all legitimate local work into clean, logical commits, verifies existing unit tests, opens a PR, and merges it back into `main` using `--no-ff` per `BUILD_PROTOCOL.md`.

## Inventory of Local State
### Untracked Files
- `BUILD_PROTOCOL.md`: Repository governance and build protocol documentation.
- `screenshots/verify-dynamic-island-expanded.png`: Visual verification artifact for the expanded Dynamic Island pill.
- `screenshots/verify-dynamic-island-pill.png`: Visual verification artifact for the compact Dynamic Island pill.
- `screenshots/verify-options-fullpage-shadcn.png`: Visual verification artifact for the options page full view.
- `screenshots/verify-options-shadcn.png`: Visual verification artifact for options settings tokens.
- `screenshots/verify-popup-shadcn.png`: Visual verification artifact for popup styling.
- `scripts/verify_expanded_pill.js`: Verification test script for expanded pill state.
- `scripts/verify_options_lower.js`: Verification test script for options scroll / lower controls.
- `scripts/verify_ui_render.js`: Verification test script for UI rendering in browser context.

### Modified Files
- `INSTALLED_SKILLS.md`: Updated skill configuration references.
- `build.js`: Manifest configuration adding `tabs` permission and explicit host permissions (`<all_urls>`, `http://*/*`, `https://*/*`).
- `tests/build.test.js`: Manifest tests reflecting permission updates.
- `src/shared/browser.js`: Added `injectContentScript` helper for dynamic execution.
- `src/shared/parser.js`: Improved prefix/suffix regex for minus sign and paren negative values; added Jumia Nigeria price extraction support.
- `tests/parser.test.js`: Added tests for Jumia price detection and TLD currency inference.
- `src/content/scanner.js`: Added tracking for `detectedCurrencies` and `primarySourceCurrency`.
- `tests/scanner.test.js`: Added test for Jumia Nigeria conversion and byte-for-byte revert.
- `src/content/content.js`: Updated Dynamic Island trigger condition and pass-through of detected currencies and manual flag.
- `src/content/ui.js` & `src/content/ui.css`: Overhauled InPageUI Dynamic Island pill styling, source->target labeling, and collapse/expand lifecycle.
- `tests/pill_and_options.test.js`: Added tests for restricted page detection and Dynamic Island currency code display.
- `src/popup/*`: Overhauled popup styling, dark mode tokens, and restricted page handling.
- `src/options/*`: Overhauled options page UI with modern tokens and per-site controls.
- `dist/*`: Pre-existing tracked build artifacts and release packages (`currency-converter-chrome-v2.0.0.zip`, `currency-converter-firefox-v2.0.0.zip`).

### Security & Artifact Audit
- **Secrets**: None found. No API keys, credentials, or sensitive tokens exist in the working directory.
- **Build Artifacts**: `dist/` is tracked on `main`. Retained tracked behavior as instructed.
- **Scratch Files**: Verification scripts and screenshot artifacts from previous visual verification runs placed in `scripts/` and `screenshots/`.

## Test Results
Ran `npm test`:
```
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6623.7985
[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
```

## Commit Log
1. `023f80f`: `docs: add build protocol and update installed skills`
2. `12ffcb5`: `fix(build): add tabs and explicit wildcard host permissions to manifest`
3. `c01c3ec`: `feat(parser): improve price regex for negative amounts and add Jumia Nigeria support`
4. `ba92506`: `feat(scanner): track detected and primary source currencies during scan`
5. `a0fcfc8`: `feat(ui): update Dynamic Island pill with source-to-target label and manual trigger handling`
6. `fd5021d`: `feat(popup,options): enhance popup and options with restricted page guard and design tokens`
7. `6e13637`: `test(visual): add verification scripts and UI render screenshots`
8. `c6c7401`: `build: update compiled distribution bundles and packages for Chrome and Firefox`
9. `9dd5a57`: `docs: record step 01 local state snapshot log`

## Provenance
- First commit SHA: `023f80f`
- Last commit SHA: `9dd5a57`
- Merge commit SHA: `3d2864b`
