# Step 03: Site-Mode Model & Migration

- **Branch**: `step/03-site-mode-migration`
- **Target Branch**: `main`
- **Status**: COMPLETE
- **PR URL**: https://github.com/richmondsogo/currency-convertr/pull/7
- **First Commit SHA**: `fb9ed84`
- **Last Commit SHA**: `f107f61`
- **Merge Commit SHA on Main**: `f4c9baa`

---

## 1. Scope & Objectives

The goal of Step 03 is to replace legacy per-site boolean flags (`autoConvert`, `neverConvert`) with a unified tri-state `mode` enum (`'ask' | 'always' | 'never' | undefined`), with ZERO user-visible behavior change.
- In-scope: `src/shared/settings.js`, all readers and writers of `perSite`, options UI behavior select, unit test matrix.
- Out-of-scope: No detector script, no Dynamic Island pill changes, no scanner changes, no manifest or `build.js` changes, and no changes to `dist/`.

---

## 2. Approved Architectural Decisions (D1 – D6)

- **D1 (Shape)**: `PerSiteRule = { mode?: 'ask'|'always'|'never', assumedCurrency: string|null }`. An ABSENT mode (`mode === undefined`) explicitly means "inherit the global default mode" (`settings.autoConvertAll ? 'always' : 'ask'`).
- **D2 (Migration)**: Migrates `schemaVersion` 2 (or unversioned) to 3:
  - Contradictory flags (`autoConvert: true` and `neverConvert: true`): resolved conservatively to `mode: 'never'`.
  - `autoConvert: true` -> `mode: 'always'`.
  - `neverConvert: true` -> `mode: 'never'`.
  - Neither flag true: mode is left **ABSENT** (`undefined`), preserving `autoConvertAll` inheritance. Legacy keys `autoConvert` and `neverConvert` are deleted.
  - Rules with neither mode nor `assumedCurrency` are dropped.
  - Global keys untouched. Storage key remains `'currency_converter_settings_v2'`. Idempotent: `migrate(migrate(x))` deep-equals `migrate(x)`.
- **D3 (Single Source of Truth Lookup)**: `getSiteMode(settings, hostname)` returns `{ mode, source: 'site'|'default', matchedKey: string|null }`. If a rule has a valid mode, it returns `source: 'site'`; otherwise it inherits from `autoConvertAll` (`source: 'default'`).
- **D4 (Hostname Normalization & Subdomain Walk-up)**:
  - On write: `normalizeHost()` lowercases, trims, strips ports, paths, protocols, trailing dots, and leading `www.`.
  - On lookup: `getLookupHosts()` tests the normalized host, then walks up parent domains while at least 2 non-TLD labels remain (`shop.ebay.com` -> `ebay.com`). Public multi-part suffixes (e.g. `co.uk`, `com.au`) are never matched as parent domains.
  - On migration: normalizes keys and merges collisions (`'never'` > `'always'` > absent).
- **D5 (Writes & Toggle State)**: `setSiteMode(settings, hostname, mode|null)`. Passing `null` removes the mode while preserving `assumedCurrency`. The popup "Always convert" toggle displays state derived from `getSiteMode()`. Toggling OFF sets `mode: 'ask'` if `autoConvertAll` is true; otherwise removes the mode (`null`).
- **D6 (Sanitization)**: Unknown mode values are sanitized to absent (`undefined`).

### Amendment to Behavior Spec (`docs/steps/02-behavior-spec.md`)
Section 1 of the Step 02 behavior spec initially stated that during migration, unconfigured rules (`neither flag true`) should default to `mode: 'ask'`. This was **amended by Decision D2**: unconfigured rules leave `mode` absent (`undefined`) rather than writing `'ask'`. This ensures that existing rules created solely to record an `assumedCurrency` override continue to inherit global `autoConvertAll` behavior without regression.

---

## 3. Phase 1 Evidence (Read-Only Audit)

### 1a. Reader and Writer Inventory (`git grep -nE "perSite|autoConvert|neverConvert|assumedCurrency|autoConvertAll" src tests`)
- `src/background.js:306`: Reader (`settings.perSite`) in `syncAutoConvertRules()`.
- `src/background.js:307`: Reader (`rule.autoConvert`) in `syncAutoConvertRules()`.
- `src/background.js:346`: Reader (`settings.perSite[hostname]`) in `tabs.onUpdated`.
- `src/background.js:349-350`: Reader (`rule.autoConvert || (autoConvertAll && !rule.neverConvert)`).
- `src/content/content.js:284`: Reader (`settings.perSite[hostname]`) in `initializeContentScript()`.
- `src/content/content.js:290-291`: Reader (`siteRule.autoConvert || (autoConvertAll && !siteRule.neverConvert)`).
- `src/options/options.js:142, 144`: Writer (defaults for `autoConvertAll` and `perSite`).
- `src/options/options.js:206`: Reader (`checkAutoConvertAll.checked`).
- `src/options/options.js:311, 314, 321`: Reader (`currentSettings.perSite` for rules table).
- `src/options/options.js:353, 358`: Reader (`rule.autoConvert`, `rule.neverConvert` for badge).
- `src/options/options.js:375`: Reader (`rule.assumedCurrency` display).
- `src/options/options.js:398-400`: Writer (rule removal).
- `src/options/options.js:616`: Writer (`savePartialSettings({ autoConvertAll })`).
- `src/options/options.js:643-656`: Writer (domain rule creation from add form).
- `src/options/options.js:690, 692`: Writer (reset defaults).
- `src/popup/popup.js:194-198`: Reader (`siteRule.autoConvert`, `siteRule.neverConvert`, `assumedCurrency`).
- `src/popup/popup.js:451-452`: Writer (`autoConvert: checked, neverConvert: false`).
- `src/popup/popup.js:463-464`: Writer (`neverConvert: checked, autoConvert: false`).
- `src/popup/popup.js:472`: Writer (`assumedCurrency`).
- `src/popup/popup.js:485-488`: Writer (`perSite[currentHostname] = updatedRule`).
- `src/popup/popup.js:515, 526`: Reader (`siteOverride: siteRule?.assumedCurrency`).
- `src/shared/settings.js:15, 17`: Defaults definition.
- `src/shared/settings.js:33, 53, 55`: Migration and validation.
- `src/shared/settings.js:111-130`: `setSiteRule`, `getSiteRule`, `removeSiteRule`.

### 1b. Hostname String Mismatch Analysis
- **POPUP wrote**: `currentHostname = parsed.hostname.replace(/^www\./, '');` (`src/popup/popup.js:144`). Stripped `www.` before writing.
- **BACKGROUND looked up**: `url.hostname` (`src/background.js:344`). Kept `www.` intact.
- **CONTENT looked up**: `window.location.hostname` (`src/content/content.js:283`). Kept `www.` intact.
- **OPTIONS wrote**: `domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')` (`src/options/options.js:635`). Stripped `www.`.
- **Finding**: A rule set in popup for `www.ebay.com` was stored under `ebay.com`, but missed on lookup by `background.js` and `content.js`. Decision D4 and `normalizeHost` + subdomain walk-up (`getLookupHosts`) resolves this mismatch across the entire extension.

---

## 4. Implementation Summary

1. `src/shared/settings.js`:
   - Updated `CURRENT_SCHEMA_VERSION = 3`.
   - Exported `normalizeHost(hostname)` and `getLookupHosts(hostname)`.
   - Exported `getSiteMode(settings, hostname)` with single-source-of-truth fallback.
   - Exported `setSiteMode(settings, hostname, mode)`.
   - Exported `shouldAutoConvertPage(settings, hostname)`.
   - Updated `migrateSettings(raw)` to handle collision merging, contradictory flag resolution, and legacy cleanup.
   - Preserved `SettingsManager` API compatibility and added `setSiteMode` / `getSiteMode`.
2. `src/background.js`:
   - Adapted `syncAutoConvertRules()` to filter on `rule.mode === 'always' || rule.autoConvert` and normalize hostnames.
   - Adapted `tabs.onUpdated` to use pure `shouldAutoConvertPage(settings, url.hostname)`.
3. `src/content/content.js`:
   - Adapted `initializeContentScript()` to use `shouldAutoConvertPage(settings, window.location.hostname)`.
4. `src/popup/popup.js`:
   - Derived toggle states from `getSiteMode()`.
   - Adapted toggle handlers to call `setSiteMode()` and handle `autoConvertAll` fallback cleanly.
5. `src/options/options.html`, `options.js`, `options.css`:
   - Updated Add Domain Rule form behavior select with `Default`, `Ask`, `Always`, `Never`.
   - Replaced static table badges with interactive inline `<select class="form-select rule-mode-select">`.
   - Preserved row-level "Remove" action.

---

## 5. Verification Results

### Unit Test Execution (`npm test`)
```
> currency-converter-v2@2.0.0 test
> node --test tests/**/*.test.js && node tests/parse.test.js

ℹ tests 56
ℹ suites 0
ℹ pass 56
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5416.049
[Test Suite] Running Currency Converter unit tests...
[Test Suite] All unit tests passed successfully.
```
All 56 unit tests pass cleanly, including the complete migration matrix, idempotency, JSON import, getSiteMode resolution, hostname normalization edge cases, and background decision parity.

### Clean Working Tree & Scope Verification
- `git diff --stat main`:
  - Touched: `src/shared/settings.js`, `src/background.js`, `src/content/content.js`, `src/popup/popup.js`, `src/options/options.html`, `src/options/options.js`, `src/options/options.css`, `tests/settings.test.js`.
  - Untouched: `build.js`, `manifest.json`, `scanner.js`, `ui.js`, `ui.css`, `dist/`.

### Interactive Browser Verification
- **Unpacked Chrome extension load & toggle interactive test**: `NOT RUN` (Requires interactive browser session or automated browser harness scheduled for Step 08).
- **Reload persistence on live host**: `NOT RUN` (Grounded in unit test simulation `settings: SettingsManager load, save, setSiteMode, and perSite overrides` which passed).

---

## 6. Discoveries Outside Scope
- `dist/`: Build distribution files are tracked in git on `main`. Tracked build output is a smell that causes noisy diffs during development builds. As required by protocol, `dist/` was left 100% untouched in this step.

---

## 7. Provenance Record
- **First Commit SHA**: `fb9ed84` (`feat(settings): implement schemaVersion 3 site-mode tri-state model and migration`)
- **Intermediate Commit SHAs**:
  - `d22938b`: `feat(readers): adapt background, content, and popup readers and writers to getSiteMode`
  - `9209184`: `feat(options): update options page site rules to tri-state behavior select`
  - `58219a8`: `test(settings): add comprehensive test suite for schema v3, migration, and lookup`
  - `e9010fa`: `docs: record step 03 site-mode migration behavior and verification`
- **Last Commit SHA**: `f107f61` (`docs: finalize recorded commit SHA in step 03 documentation`)
- **Merge Commit SHA on Main**: `f4c9baa`
- **Branch History Note**: The step 03 branch history was rewritten by a `git push --force` before merge, replacing commit `61ae8ef` with `f107f61`.
