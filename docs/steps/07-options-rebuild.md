# Step 07: Options Page Rebuild (React + shadcn, Paper & Pine)

- **Branch**: `step/07-options-rebuild`
- **Target Branch**: `main`
- **Status**: IN PROGRESS (Phase 0 complete)
- **Previous Step (Step 06) Merge Commit SHA on Main**: `db16e2c` (`Merge pull request #12 from richmondsogo/step/06-ui-foundation`)
- **PR URL**: TBD
- **First Commit SHA (Part A)**: TBD
- **Last Content Commit SHA (Part E)**: TBD

---

## 1. Scope & Objectives

Step 07 replaces the legacy vanilla Options page with the redesigned surface approved by the owner in the design gallery (`dist/gallery`, section 4 "Realistic Options Page Layout"), featuring the Paper & Pine design system (Familjen Grotesk + Fragment Mono typography, warm surfaces, 1px hairlines, zero cards, 220px sidebar + ~640px column layout).

### Key Architectural Constraints
- **Zero Schema Changes**: Preserves the exact settings schema (`schemaVersion: 3`). No background or content-script alterations. The popup and in-page pill remain untouched.
- **Zero `innerHTML` Rule**: Absolute prohibition of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, and `dangerouslySetInnerHTML`.
- **Approved Sidebar Modification**: Active item has raised background (`#EFECE5` light / `#181816` dark), text weight 600 (`font-semibold`), icon in text ink color. No left border, no accent bar, no accent-colored text. Hover uses raised background at lower strength. (Applied to gallery as source of truth as well).
- **Site Rules List**: Plain list separated by 1px hairlines, no bordered boxes. Hostnames in Fragment Mono. 3-way segmented control (Ask / Always / Never), assumed currency combobox, and ghost "Remove". Add-site row with exact accessible button name "Add site" and single icon (no literal "+" in label).
- **Deleted Sections**: Live Preview section and pill-style tab bar are deleted. No preview of any kind.
- **Theme Boot Script**: External boot script `theme-boot.js` reads cached theme from `localStorage` before first paint, preventing theme flash without inline `<script>` tags (MV3 CSP compliance).

---

## 2. Phase 0: Parity Inventory

| Old Control / Feature | Old HTML ID / Selector | Settings Key | Validation / Constraints | Side Effects & Messages | New Location & Component (Step 07) |
|---|---|---|---|---|---|
| Default Target Currency | `#default-target-currency` | `targetCurrency`, `lastUsedTarget` | Must be a valid currency code from `getAllCurrencies()` / `CURRENCIES_DATA` | Triggers `MSG.UPDATE_SETTINGS` with `{ targetCurrency, lastUsedTarget }`. Updates conversion target for automatic & menu conversions. | **General** section (`#general`): Searchable combobox over full currency list (symbol + code + name, searchable by name e.g. "naira" or code "NGN"). |
| Ambiguous "$" Symbol Default | `#ambiguous-dollar` | `ambiguousDollar` | Must be one of dollar currency codes ('USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN') | Triggers `MSG.UPDATE_SETTINGS` with `{ ambiguousDollar }`. | **General** section (`#general`): Combobox / Select with one-line description. |
| Auto-Convert on All Sites / Default Rule | `#check-autoconvert-all` | `autoConvertAll` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ autoConvertAll }`. Optional host permission request on extension API if toggling on. | **General** section (`#general`): "Default for sites without a rule" segmented control (Ask / Always, bound to `autoConvertAll`: true = Always, false = Ask). |
| Show in-Page Floating Toolbar | `#check-show-inpage-bar` | `showInPageBar` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ showInPageBar }`. Enables/disables floating OLED Dynamic Island pill in content scripts. | **General** section (`#general`): "Show in-page pill" switch. |
| Round to Whole Numbers | `#check-round-whole` | `roundWhole` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ roundWhole }`. Omits decimal places on formatted converted prices. | **General** section (`#general`): Switch with one-line description. |
| Show Cryptocurrencies in Picker | `#check-show-crypto` | `showCrypto` | Boolean | Triggers `MSG.UPDATE_SETTINGS` with `{ showCrypto }`. Updates currency lists across popup and options to include BTC, ETH, SOL, DOGE. | **General** section (`#general`): Switch with one-line description. |
| Pinned Currencies List & Count | `#pinned-chips-container`, `#pinned-count-badge` | `pinnedCurrencies` | Array of strings, max 8 items | Triggers `MSG.UPDATE_SETTINGS` with `{ pinnedCurrencies }`. Displays "n of 8". | **Currencies** section (`#currencies`): Removable chips showing symbol and code, count badge "n of 8". |
| Add Pinned Currency | `#select-add-pinned`, `#quick-suggest-buttons` | `pinnedCurrencies` | Limit enforced: max 8. If 8 reached, disables adding with clear error message. | Triggers `MSG.UPDATE_SETTINGS` with `{ pinnedCurrencies: [...pinned, code] }`. | **Currencies** section (`#currencies`): Searchable combobox over remaining currencies, plus quick-suggest buttons, limit message when full. |
| Site Rules Table / List | `#rules-table-body`, `.rule-row`, `.domain-host` | `perSite[hostname]` | Hostname must be valid normalized domain (`normalizeHost`). | Reads `perSite`. Renders each configured domain. | **Sites** section (`#sites`): Plain list separated by 1px hairlines, no bordered boxes, hostname in `Fragment Mono`. |
| Site Rule Conversion Mode | `.rule-mode-select` | `perSite[hostname].mode` | 'ask', 'always', 'never', or absent (inheriting default) | Triggers `MSG.UPDATE_SETTINGS` with updated `perSite`. Never writes 'ask' unless user picked Ask. Absent mode shows muted caption "Uses default (Ask\|Always)". | **Sites** section (`#sites`): Three-way segmented control (Ask / Always / Never) + Reset action to clear explicit mode. |
| Site Rule Assumed Currency | `.rule-currency-cell` | `perSite[hostname].assumedCurrency` | Valid currency code or null | Triggers `MSG.UPDATE_SETTINGS` with updated `perSite`. | **Sites** section (`#sites`): Searchable combobox for assumed currency. |
| Remove Site Rule | `.rule-action-cell`, `.btn-danger-small` | `perSite[hostname]` | None | Triggers `MSG.UPDATE_SETTINGS` with `perSite` key deleted. | **Sites** section (`#sites`): Ghost "Remove" button per row. |
| Add Domain Rule Form | `#form-add-rule`, `#input-rule-domain`, `#select-rule-behavior`, `#select-rule-currency`, `#btn-add-rule-submit` | `perSite[hostname]` | Validates domain: reject empty, invalid, and duplicates inline with clear message (no `alert()`). Normalizes with `normalizeHost`. | Triggers `MSG.UPDATE_SETTINGS` with new rule. | **Sites** section (`#sites`): One inline Add-site row; button text is exactly "Add site" with single icon and NO literal "+" character. |
| Search / Filter Rules | `#input-search-rules` | None (UI filter) | Case-insensitive substring match | Filters the displayed rules by domain query. | **Sites** section (`#sites`): Inline domain search filter input. |
| Appearance Theme Mode | `#theme-select`, `.theme-btn` | `theme` | 'system', 'light', 'dark' | Applies theme class/attribute immediately to `document.documentElement` without flash; updates `localStorage` cache for boot script; triggers `MSG.UPDATE_SETTINGS`. | **Appearance** section (`#appearance`): Three-way segmented control (System / Light / Dark). |
| Display Mode | `#display-mode` | `displayMode` | 'replace', 'append', 'replace_highlight' | Triggers `MSG.UPDATE_SETTINGS` with `{ displayMode }`. | **Appearance** section (`#appearance`): Segmented control or select with one-line descriptions. |
| Export Settings | `#btn-export-settings` | None (reads all) | Generates valid JSON | Downloads `currency-convertr-settings-<date>.json`. | **Data** section (`#data`): Primary/secondary button downloading formatted JSON. |
| Import Settings | `#input-import-settings` | None (writes all) | Must parse valid JSON and pass `migrateSettings`. Invalid files trigger error toast, never crash or alter state. | Triggers `MSG.UPDATE_SETTINGS` with migrated settings object. | **Data** section (`#data`): File picker button with error/success toast notifications. |
| Reset to Defaults | `#btn-reset` | All settings keys | Requires user confirmation | Triggers `SettingsManager.resetDefaults()`, resets to `DEFAULT_SETTINGS`, applies theme 'system', shows toast. | **Data** section (`#data`): Destructive action behind an accessible alert-dialog stating what will be deleted. |
| Product Title & Version / Build Stamp | `.header-title`, `.version-pill` | None (read-only) | Reads injected build defines (`__BUILD_VERSION__`, `__BUILD_GIT_SHA__`, `__BUILD_STAMP__`) | Displays version and git SHA. | **Shell Header** (A2) + **About** section (`#about`, B6). |
| Rates Source & Last Updated Metadata | Preview rate text (previously in preview) | None (read-only) | Fetched via `MSG.GET_RATES` | Displays source (e.g. ECB / Fawaz / Fallback) and timestamp honestly. | **About** section (`#about`, B6): Read-only status card showing rates provider and last-updated timestamp. |
| Keyboard Shortcut Info | None previously | None (read-only) | Read from `chrome.commands.getAll()` if available | Informs user of shortcut (e.g. Alt+Shift+C). | **About** section (`#about`, B6). |
| Links & Policies | None previously | None (links) | External URLs | Links to Privacy Policy and GitHub repository. | **About** section (`#about`, B6). |
| Live Price Preview Stage & Pills | `#section-preview`, `#preview-stage`, `.options-nav` | N/A | Removed | Owner decision: "The Live Preview section and the pill-style tab bar are deleted. No preview of any kind." | **DELETED** per owner instruction. |

*Inventory confirmed: 0 orphaned controls, 0 missing settings keys. Demo items from gallery ("Custom Rates API Endpoint", "Rates & API" nav item) dropped.*
