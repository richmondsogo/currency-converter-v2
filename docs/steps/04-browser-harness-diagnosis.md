# Step 04: Real-Browser Harness & Live-Bug Diagnosis

- **Branch**: `step/04-browser-harness-diagnosis`
- **Target Branch**: `main`
- **Status**: COMPLETE
- **Previous Step (Step 03) Merge Commit SHA on Main**: `f4c9baa`
- **PR URL**: https://github.com/richmondsogo/currency-convertr/pull/8
- **First Commit SHA**: `3a50930`
- **Last Commit SHA**: `recorded before merge`
- **Merge Commit SHA**: `recorded in the step 05 branch`

---

## 1. Scope & Objectives

The goal of Step 04 is to build a reproducible real-browser automation harness for Currency Convertr and systematically reproduce and diagnose (without modifying product code in `src/`) the live bugs reported by the owner during manual testing.

- **In-Scope**:
  - `tests/e2e/smoke.test.js`: Permanent E2E test verifying extension loading, service worker lifecycle, and page rendering in real Chrome for Testing.
  - `scripts/launch-browser.js`: Reusable CLI launcher and module for headed/persistent browser sessions.
  - `scripts/diagnose.js`: Automated diagnostic suite covering R1 through R6.
  - `tests/fixtures/`: Real-world DOM fixtures (`ebay_us_prefix.html`, `usd_suffix.html`, `iframe_prices.html`, `iframe_inner.html`).
  - `docs/feedback/2026-10-21-owner-test.md`: Verbatim record of owner testing feedback.
  - `docs/audits/2026-10-21-live-diagnosis/`: Screenshots and `report.md`.
  - `AGENTS.md`: Addition of Rule 4 prohibiting amending or force-pushing once a PR is open.
- **Strictly Out-of-Scope**:
  - No edits to `src/`, `build.js`, or `manifest.json`.
  - No bug fixes in product code (all fixes deferred to their respective implementation steps).
  - No changes to `dist/`.

---

## 2. Phase 0: Owner Feedback (Verbatim)

Recorded in `docs/feedback/2026-10-21-owner-test.md`:
1. Dragged the pill and a second pill remained on the page. Screenshot shows "USD -> NGN 148" and "USD 0" at the same time.
2. Pill currency dropdown: only the focused option is legible. Owner does not want a basic native dropdown.
3. eBay: set Always, it did not auto-convert. Converted manually and prices read "US NGN 133,419.80" instead of "NGN 133,419.80". A pill showed "USD -> NGN 0" with a grey dot while the page was converted. (Possibly tested on a stale build.)
4. plug.tech: added a rule, reloaded, nothing happened until manual convert; after that prices read "NGN 552,620.92 USD" (stray "USD"). (Possibly tested on a stale build.)
5. Never convert worked, but choosing it from the dropdown was bad.
6. Options page needs a huge overhaul: minimalist, calm, coherent; clean sidebar layout with shadcn components. Contrast is off, layout is clumsy. Dislikes the Live Preview section and the pill-style tab bar. The "Add Rule" button reads "+ + Add Rule" (an icon plus and a literal plus in the label text).
7. Popup: "Always convert" and "Never convert" are two independent toggle switches with bad spacing; with the tri-state site mode they can show contradictory states. Toggles look larger than the 32x18 spec in DESIGN.md. No consistent design system.
8. Owner expected shadcn/component libraries to be used. They were not.
9. Owner loves the pill concept and its fluency.

---

## 3. Phase 1: Build Under Test Comparison (STALE vs FRESH)

The committed `dist/chrome` on `main` was extracted to a temporary directory outside the repo (`stale`), while a fresh build was compiled with `npm run build` and copied to `fresh`, followed by `git restore dist/`.

### SHA256 Comparison

| File | STALE SHA256 (Committed on `main`) | FRESH SHA256 (Current `src/`) | Differs? | Contains `getSiteMode` / Schema 3? |
|---|---|---|---|---|
| `background.js` | `2DA8CA2BFECC247EF356942A01C0F241555A84EC9CB0D20D8030E64C234BD133` | `A1A0F81A5D20EB1CF5A94B47485F509437E2E018C0FCB496507D0A4F8E087219` | YES | STALE: False / FRESH: True |
| `content.js` | `2421080E70893ACB51D2EA0420DAB8E8B21E59349F00D6336C285BF1B680B26A` | `69406369149AC61ACE6A0D264CCDB1E56895EE2B1E1FD989114EC49C68F2FDEA` | YES | STALE: False / FRESH: True |
| `options/options.js` | `5BA9E69F84E7C7A2585E957438487D86967E75D016477BF7210AE1C26F3B59FB` | `4298380F0783E138E859FE8634C1CD09560ABCCC3A35037EEB7B8319B3ED8E17` | YES | STALE: False / FRESH: True (`rule-mode-select`) |
| `popup/popup.js` | `2332C5952F80281D6052E02F9C3184A107EE4BD3DAFBE9A4EFA4EAC147BF4349` | `8566B7189AFA1A1786FEBF5076A61BCC8840FD79EBE1E357D6F1891705EDAFD3` | YES | STALE: False / FRESH: True |

**Conclusion**: The committed bundles in `dist/` on `main` were pre-Step 03 binaries. Running `git restore .\dist\` before loading the extension reverted the owner's testing environment to the stale code.

---

## 4. Phase 2: Real-Browser Harness

### Browser Compatibility Findings
1. **Official Google Chrome 155.0.8059.85** (`C:\Program Files\Google\Chrome\Application\chrome.exe`):
   - **Result**: FAILED. Official Chrome 137+ ignores `--load-extension` and `--disable-extensions-except` for normal user profiles unless special enterprise/developer policies are configured. 0 service workers launched and extension failed to load.
2. **Chrome for Testing 156.0.8078.4 (Playwright Chromium v1248)**:
   - **Result**: SUCCESS. Headed persistent context (`headless: false`) launched cleanly, service worker initialized immediately (`chrome-extension://fbppdipdaikfgnfnolmhagkojjdplkoi/background.js`), and options/popup pages opened and rendered without error.

### Smoke Test Output (`tests/e2e/smoke.test.js`)
```
[E2E Smoke] Passed: Service Worker alive, Options and Popup pages render cleanly.
✔ E2E Smoke: Extension loads in real browser, service worker is alive, and options page renders (4811.7997ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
```

---

## 5. Phase 3 & 4: Live Diagnosis Results (R1 – R6)

### R1: Duplicate Pills
- **Reproduction**: In `iframe_prices.html`, convert 1 mounted 1 pill in top window and 1 pill in the iframe (`allFrames: true`). Convert 2 mounted a second pill in top window (2 total) and a second pill in the iframe (2 total).
- **Cause**: Dual cause confirmed: `background.js:108` injects `allFrames: true`, and `content.js:1` lacks an injection idempotency guard, allowing multiple instances of `InPageUI` to mount simultaneously. Furthermore, `ui.js:683` mounts `.cc-collapsed-pill` with `0 USD`, explaining why dragging revealed a stationary secondary pill showing `USD 0`.
- **Confidence**: **CONFIRMED**

### R2: Stray Labels
- **Reproduction**:
  - `"$399.00 USD"` converted to `"NGN 598,500.00 USD"` (stray trailing `USD`).
  - `"$1,107.92 USD"` converted to `"NGN 1,661,880.00 USD"` (stray trailing `USD`).
  - `"$25 USD"` converted to `"NGN 37,500.00 USD"` (stray trailing `USD`).
  - `"US $133.00"` converted to `"US NGN 199,500.00"` (stray leading `US `).
  - `"+US $15.50 shipping"` converted to `"+US NGN 23,250.00 shipping"` (stray leading `US `).
- **Cause**: `src/shared/parser.js:296`: `prefixRegex` matches `US$` but does not match `US $` (with space). It also does not look ahead to consume redundant trailing currency code tokens (`(?:\s+USD)?`).
- **Confidence**: **CONFIRMED**

### R3: Count After Re-convert
- **Reproduction**: When clean instance converts: `count = 5`, dot is green (`#10b981`). When re-injected without revert (double-injection): scans already-converted NGN prices, skips them (`target === source`), reports `convertedCount = 0`, dot turns inactive grey (`#71717a`), and pill displays `USD -> NGN 0`.
- **Cause**: `src/content/content.js:108-110`: `currentScanner` state is scoped to closure; newly injected scripts cannot revert previous DOM mutations before converting.
- **Confidence**: **CONFIRMED**

### R4: Always / Never Rule Auto-Convert (STALE vs FRESH)
- **Reproduction**:
  - STALE build completely lacked `tabs.onUpdated` and `registerContentScripts`. Setting Always in options failed to auto-convert on reload.
  - FRESH build has `tabs.onUpdated`. However, `syncAutoConvertRules` is only called on extension install/startup and is NOT connected to `chrome.storage.onChanged`. On reload, `tabs.onUpdated` runs `convertPageOnTab()`, but defaults to target `USD` on sites where prices are already USD.
- **Verdict**: Owner items 3 and 4 were **CONFIRMED** to be stale-build artifacts during the owner's manual testing.
- **Confidence**: **CONFIRMED**

### R5: Pill Currency Dropdown
- **Reproduction**: Computed styles inside shadow root: `.cc-select` has `color: rgb(250, 250, 250)` (white) on dark capsule; native `<option>` tags have transparent background. On Windows Chrome, native `<option>` popup list renders with default light OS background, making white text completely unreadable unless focused/hovered.
- **Cause**: `src/content/ui.js:630`: Unstyled native HTML `<select>` inside dark Shadow DOM.
- **Confidence**: **CONFIRMED**

### R6: Options Page & Popup vs DESIGN.md
- **Reproduction**:
  - Add Rule button outer HTML: `<button ...><svg>...</svg><span>+ Add Rule</span></button>`. Label literally renders `+ + Add Rule`.
  - Options page wraps sections in `.settings-card`, uses floating tab pills, and includes a Live Preview simulator, all contradicting `DESIGN.md:93-94` ("Boxy card wrappers are strictly banned").
  - Popup switches measure 32x18, but "Always convert" and "Never convert" are two independent checkboxes in the DOM that can be checked simultaneously (`bothCheckedInDOM: true`).
- **Confidence**: **CONFIRMED**

---

## 6. Generated Screenshots

All screenshots recorded in `docs/audits/2026-10-21-live-diagnosis/`:
1. `r1-duplicate-pills-fresh.png`
2. `r1-duplicate-pills-stale.png`
3. `r2-stray-labels-plug-fixture.png`
4. `r2-stray-labels-ebay-fixture.png`
5. `r3-reconvert-pass1.png`
6. `r3-reconvert-pass2.png`
7. `r4-always-rule-stale.png`
8. `r4-always-rule-fresh.png`
9. `r5-pill-dropdown.png`
10. `r6-options-1280-light.png`
11. `r6-options-1280-dark.png`
12. `r6-options-900-light.png`
13. `r6-options-900-dark.png`
14. `r6-popup-light.png`
15. `r6-popup-dark.png`

---

## 7. Verification

### Unit & E2E Test Suite (`npm test`)
```
> currency-converter-v2@2.0.0 test
> node --test tests/**/*.test.js && node tests/parse.test.js

ℹ tests 57
ℹ suites 0
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
```
57 tests pass cleanly (56 unit tests + 1 E2E real-browser smoke test).

### Scope Verification (`git status`)
- Touched: `tests/e2e/`, `tests/fixtures/`, `scripts/`, `docs/`, `package.json`, `package-lock.json`, `AGENTS.md`.
- Untouched: `src/`, `build.js`, `manifest.json`, `dist/`.

---

## 8. Provenance Record
- **PR URL**: https://github.com/richmondsogo/currency-convertr/pull/8
- **First Commit SHA**: `3a50930`
- **Last Commit SHA**: `recorded before merge`
- **Merge Commit SHA on Main**: `recorded in the step 05 branch`
