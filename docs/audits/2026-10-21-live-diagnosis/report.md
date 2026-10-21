# Real-Browser Harness Diagnosis Report (2026-10-21)

- **Branch**: `step/04-browser-harness-diagnosis`
- **Audit Target**: Currency Convertr v2.0.0 (Manifest V3)
- **Harness Platform**: Playwright with Chromium (Chrome for Testing 156.0.8078.4, Win64), Headed Persistent Context
- **Artifacts Directory**: `docs/audits/2026-10-21-live-diagnosis/`

---

## Executive Summary

Following manual testing by the project owner, this audit ran in a real, browser-automated harness comparing the committed `dist/chrome` bundle on `main` (**STALE**, built prior to Step 03) against the freshly built extension bundle (**FRESH**, containing schemaVersion 3 and `getSiteMode`).

All 6 reported issues (R1 through R6) were successfully reproduced, isolated, and grounded in runtime DOM dumps, computed style measurements, network traces, and screenshots.

---

## Build Under Test Comparison (STALE vs FRESH)

| File | STALE SHA256 (Committed on `main`) | FRESH SHA256 (Compiled from `src/`) | Status | Contains `getSiteMode` / Schema 3? |
|---|---|---|---|---|
| `background.js` | `2DA8CA2BFECC247EF356942A01C0F241555A84EC9CB0D20D8030E64C234BD133` | `A1A0F81A5D20EB1CF5A94B47485F509437E2E018C0FCB496507D0A4F8E087219` | DIFFER | STALE: No / FRESH: Yes |
| `content.js` | `2421080E70893ACB51D2EA0420DAB8E8B21E59349F00D6336C285BF1B680B26A` | `69406369149AC61ACE6A0D264CCDB1E56895EE2B1E1FD989114EC49C68F2FDEA` | DIFFER | STALE: No / FRESH: Yes |
| `options/options.js` | `5BA9E69F84E7C7A2585E957438487D86967E75D016477BF7210AE1C26F3B59FB` | `4298380F0783E138E859FE8634C1CD09560ABCCC3A35037EEB7B8319B3ED8E17` | DIFFER | STALE: No / FRESH: Yes |
| `popup/popup.js` | `2332C5952F80281D6052E02F9C3184A107EE4BD3DAFBE9A4EFA4EAC147BF4349` | `8566B7189AFA1A1786FEBF5076A61BCC8840FD79EBE1E357D6F1891705EDAFD3` | DIFFER | STALE: No / FRESH: Yes |

**Finding**: The committed `dist/` on `main` was compiled in Step 01 and did not contain any Step 03 code. When the owner ran `npm run build` followed by `git restore .\dist\`, the fresh build was reverted to the pre-Step 03 bundles.

---

## Root-Cause Findings (R1 – R6)

### R1: Duplicate Pills ("USD -> NGN 148" and "USD 0" simultaneous pills)

- **Screenshot Evidence**: `r1-duplicate-pills-fresh.png`, `r1-duplicate-pills-stale.png`
- **Runtime Measurement**:
  - `http://127.0.0.1:3456/iframe_prices.html` embeds `iframe_inner.html` (2 frames total).
  - Convert 1: Top frame has 1 host; Iframe has 1 host (`allFrames: true` injection).
  - Convert 2: Top frame has 2 hosts; Iframe has 2 hosts (Double injection without idempotency).
  - Total `#cc-dynamic-island-host` elements in top page: 2.
- **Root Cause (File:Line)**:
  1. `src/background.js:108` and `src/background.js:329`: Content script injection specifies `allFrames: true`. When a webpage contains `<iframe>` elements (ads, embedded widgets, tracking iframes), `content.js` executes inside every iframe and mounts a full Dynamic Island `#cc-dynamic-island-host` inside each frame.
  2. `src/content/content.js:1`: Lacks a top-level execution guard (`window.__CC_INJECTED__`). Whenever the user clicks "Convert this page" in the popup or via context menu, `injectContentScript(tabId)` re-runs `content.js`. A new instance of `InPageUI` is instantiated.
  3. `src/content/ui.js:458`: `if (!parent || this.rootContainer) return;` only checks the instance variable `this.rootContainer`. It fails to query `this.doc.getElementById('cc-dynamic-island-host')` to remove or reuse an existing host.
  4. `src/content/ui.js:683-705`: `_buildCollapsedPill()` constructs `.cc-collapsed-pill` displaying `${this.convertedCount} ${this.targetCurrency}` (e.g. `0 USD`). If an iframe has 0 converted prices or if an unmounted ghost instance remains, dragging the primary pill reveals the stationary second pill showing `USD 0`.
- **Confidence**: **CONFIRMED**
- **Smallest Proposed Fix**:
  - Add an idempotency guard at the very top of `src/content/content.js`: `if (window.__CC_CONTENT_SCRIPT_INJECTED__) return; window.__CC_CONTENT_SCRIPT_INJECTED__ = true;`.
  - In `src/background.js:108`, restrict manual `executeScript` to `allFrames: false` (top frame only for UI host).
  - In `src/content/ui.js:458`, check `const existing = this.doc.getElementById('cc-dynamic-island-host'); if (existing) existing.remove();` before mounting.

---

### R2: Stray Currency Labels ("US NGN 199,500.00" and "NGN 598,500.00 USD")

- **Screenshot Evidence**: `r2-stray-labels-plug-fixture.png`, `r2-stray-labels-ebay-fixture.png`
- **Runtime Measurement**:
  - Plug.tech USD Suffix Fixture:
    - Before: `$399.00 USD` -> After: `NGN 598,500.00 USD` (stray trailing `USD`)
    - Before: `$1,107.92 USD` -> After: `NGN 1,661,880.00 USD` (stray trailing `USD`)
    - Before: `$25 USD` -> After: `NGN 37,500.00 USD` (stray trailing `USD`)
    - Before: `US$25` -> After: `NGN 37,500.00` (clean, prefix matched)
    - Before: `USD 25` -> After: `NGN 37,500.00` (clean, prefix matched)
  - eBay US Prefix Fixture:
    - Before: `US $133.00` -> After: `US NGN 199,500.00` (stray leading `US `)
    - Before: `+US $15.50 shipping` -> After: `+US NGN 23,250.00 shipping` (stray leading `US `)
    - Before: `US $650.00` -> After: `US NGN 975,000.00` (stray leading `US `)
- **Root Cause (File:Line)**:
  - `src/shared/parser.js:296`:
    `prefixRegex` matches `(CAD\$|CA\$|...|US\$|U\.S\.\$|\$|kr|\b[A-Z]{3}\b)\s*(\d...)`.
    Notice `US$` is matched, but `US $` (with a space between `US` and `$`) is NOT matched as a single symbol token. The regex starts matching at `$`, consuming `$133.00` and leaving `US ` untouched in the DOM.
  - `src/shared/parser.js:296, 300`:
    When a price has both a leading symbol and a trailing ISO code (e.g. `$399.00 USD` or `$25 USD`), `prefixRegex` matches `$399.00` as prefix currency `$`. It does NOT look ahead to consume the redundant trailing `\s*(USD|EUR|[A-Z]{3})`. As a result, the replacement text replaces `$399.00` with `NGN 598,500.00`, leaving the trailing ` USD` text intact.
- **Confidence**: **CONFIRMED**
- **Smallest Proposed Fix**:
  - In `src/shared/parser.js`, expand prefix regex to match `(?:US|U\.S\.)\s*\$` as a recognized compound prefix.
  - In `prefixRegex`, add an optional trailing lookahead/consumer for redundant currency codes `(?:\s+(?:USD|[A-Z]{3}))?` matching the same currency, so the entire token `$399.00 USD` is consumed and replaced.

---

### R3: Count After Re-convert (Pill shows "USD -> NGN 0" with Grey Dot)

- **Screenshot Evidence**: `r3-reconvert-pass1.png`, `r3-reconvert-pass2.png`
- **Runtime Measurement**:
  - When re-converting on a clean singleton instance, `countBadge = 5`, `dotColor = rgb(16, 185, 129)` (green).
  - However, when a secondary `content.js` script is injected (e.g. via toolbar popup re-click or double injection without state transfer):
    `isConverted` starts as `false`, and `currentScanner` starts as `null`.
    The new scanner scans the DOM, which has ALREADY been converted to `NGN`.
    Because all prices are now in NGN, and the target currency is NGN, the scanner detects `targetCurrency === sourceCurrency` (`NGN === NGN`) for all prices and skips them.
    Result: `convertedCount = 0`.
    In `src/content/ui.js:525` and `849`:
    `dot.classList.toggle('cc-status-inactive', !this.isConverted && this.convertedCount === 0)`
    The dot turns grey (`#71717a`), and the pill displays `USD -> NGN 0`.
- **Root Cause (File:Line)**:
  - `src/content/content.js:108-110`:
    `if (currentScanner && isConverted) { currentScanner.revert(); }`
    Because `currentScanner` is an unexported module-scoped variable, a newly injected `content.js` cannot see the previous scanner instance to revert the DOM before re-converting. It therefore scans the already-converted prices, bails out, and reports `0` converted prices.
- **Confidence**: **CONFIRMED**
- **Smallest Proposed Fix**:
  - Attach `currentScanner` and `isConverted` to a tab-global property (e.g. `window.__CC_SCANNER__`) or guard `content.js` so multiple injections do not create orphan instances.

---

### R4: Always / Never Rule Auto-Convert (STALE vs FRESH)

- **Screenshot Evidence**: `r4-always-rule-stale.png`, `r4-always-rule-fresh.png`
- **Runtime Measurement**:
  - In STALE:
    - Options UI wrote rules to storage, but `stale/background.js` had zero `tabs.onUpdated` listener and zero `registerContentScripts`.
    - Auto-convert on reload was completely absent (`autoConvertState: { hasConvertedText: false }`).
  - In FRESH:
    - Adding a rule in the Options page updates `chrome.storage.local`.
    - However, `chrome.scripting.getRegisteredContentScripts()` evaluates to `[]` (empty)!
    - Why? `syncAutoConvertRules()` in `src/background.js` is ONLY called on `runtime.onInstalled` and `runtime.onStartup`. It is NOT called when storage changes or when an options rule is added.
    - Fortunately, `src/background.js:340` contains a `tabs.onUpdated` fallback:
      `const shouldAutoConvert = shouldAutoConvertPage(settings, url.hostname); if (shouldAutoConvert) await convertPageOnTab(tabId);`
      On reload, `tabs.onUpdated` triggers `convertPageOnTab()`.
    - BUT in `convertPageOnTab()`, `targetCurrency` defaults to `settings.targetCurrency` (`'USD'`). If the user tests on eBay US or plug.tech where prices are already USD, `convertPageOnTab()` converts USD to USD, hitting the hard bailout gate (`count = 0`).
  - **Verdict on Stale Build Artifact**:
    Item 3 ("eBay: set Always, it did not auto-convert") and Item 4 ("plug.tech: added a rule, reloaded, nothing happened until manual convert") are **CONFIRMED** to be stale-build artifacts. The stale build tested by the owner lacked `tabs.onUpdated` entirely.
- **Confidence**: **CONFIRMED**
- **Smallest Proposed Fix**:
  - In `src/background.js`, add `chrome.storage.onChanged` listener to invoke `syncAutoConvertRules()` whenever `settings.perSite` changes.
  - In `src/background.js:346`, ensure `convertPageOnTab` respects the user's intended target currency or site-specific preference.

---

### R5: Pill Currency Dropdown (Unreadable Options on Dark Background)

- **Screenshot Evidence**: `r5-pill-dropdown.png`
- **Runtime Measurement**:
  - Computed styles inside Shadow DOM:
    - Select: `backgroundColor: rgba(255, 255, 255, 0.08)`, `color: rgb(250, 250, 250)` (white text).
    - Option: `backgroundColor: rgba(0, 0, 0, 0)`, `color: rgb(250, 250, 250)`.
  - On Windows Chromium, the native OS `<select>` dropdown menu renders with a default system light background. Because `<option>` has `color: rgb(250, 250, 250)`, the options render white-on-white, becoming invisible until hovered or focused.
  - Furthermore, native `<select>` controls cannot be styled with search, icons, or keyboard command-palette behavior.
- **Root Cause (File:Line)**:
  - `src/content/ui.js:630`: Uses native `<select class="cc-select">` with native `<option>` tags inside a dark hardware OLED pill.
- **Confidence**: **CONFIRMED**
- **Smallest Proposed Fix**:
  - Replace the native `<select>` in `InPageUI` with a custom floating combobox/listbox styled after the toolbar popup's currency picker, or set `option { background-color: #18181b; color: #fafafa; }` as an immediate CSS patch.

---

### R6: Options Page & Popup Design Review vs DESIGN.md

- **Screenshot Evidence**:
  - `r6-options-1280-light.png`, `r6-options-1280-dark.png`
  - `r6-options-900-light.png`, `r6-options-900-dark.png`
  - `r6-popup-light.png`, `r6-popup-dark.png`
- **Runtime Measurement & DOM Dumps**:
  1. **Add Rule Button Text**:
     ```html
     <button type="submit" id="btn-add-rule-submit" class="btn-primary">
       <svg width="13" height="13" ...><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
       <span>+ Add Rule</span>
     </button>
     ```
     `textContent`: `"+ Add Rule"`. The button contains both an SVG plus icon AND a literal plus in the label text, rendering as `+ + Add Rule`.
  2. **Contradictions to `DESIGN.md`**:
     - `DESIGN.md:93-94`: *"Boxy card wrappers are strictly banned."*
       Options page wraps every section in `.settings-card` with borders and shadows (`#section-general`, `#section-rules`, `#section-backup`).
     - `DESIGN.md:75-80`: Recommends ultra-clean editorial minimalism with whisper-quiet hairline dividers. Current options page uses a rounded floating tab bar (`.nav-pill`) and a heavy "Live Preview" simulator card that the owner specifically dislikes.
     - Layout lacks modern sidebar/navigation hierarchy (shadcn/radix style layout).
  3. **Popup Toggle Measurements**:
     - Measured Switch Track: `width: 32px, height: 18px, border-radius: 9999px`.
     - Knob: `width: 15px, height: 15px`.
     - Measured Row: `padding: 6px 0px, display: flex, justify-content: space-between`.
     - While the CSS track matches 32x18, the two independent toggles ("Always convert" and "Never convert") can be simultaneously checked in the DOM (`bothCheckedInDOM: true`), contradicting the tri-state site mode model.
- **Root Cause (File:Line)**:
  - `src/options/options.html:305-308`: Duplicate plus icon and text in `#btn-add-rule-submit`.
  - `src/options/options.html:49-100`: Deprecated pill-tab bar and preview card.
  - `src/popup/popup.html:89-101`: Dual independent toggle switches for a single tri-state setting.
- **Confidence**: **CONFIRMED**
- **Smallest Proposed Fix**:
  - Remove literal `+ ` from `<span>+ Add Rule</span>` -> `<span>Add Rule</span>`.
  - In the Options overhaul step, adopt a clean sidebar + content layout without cards, removing the Live Preview card.
  - In the Popup, replace the dual checkboxes with a single unified tri-state control or segmented switch.

---

## Conclusion & Diagnostic Summary

| Item | Description | Status | Build Artifact? | Root Cause Summary |
|---|---|---|---|---|
| **R1** | Duplicate pills on drag | **CONFIRMED** | No | `allFrames: true` embeds in iframes; lack of `content.js` idempotency allows double-injection. |
| **R2** | Stray labels (`US NGN`, `USD`) | **CONFIRMED** | No | `prefixRegex` misses `US $` compound space and trailing ` USD` suffix token. |
| **R3** | Re-convert pill shows 0 & grey dot | **CONFIRMED** | No | Re-injection scans already-converted NGN prices; target equals source skips all prices. |
| **R4** | Always rule did not auto-convert | **CONFIRMED** | **YES** | Stale build lacked `tabs.onUpdated` and `registerContentScripts`. |
| **R5** | Pill dropdown illegible | **CONFIRMED** | No | Native `<select>` renders white `<option>` text on light OS popup list. |
| **R6** | Options overhaul & `+ + Add Rule` | **CONFIRMED** | No | Literal `+ ` in HTML label next to SVG; card wrappers contradict `DESIGN.md`. |
