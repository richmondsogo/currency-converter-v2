# Chrome Web Store & Firefox AMO Submission Specification

> **Target Version**: 2.0.0  
> **Package Files**:  
> - Chrome: `dist/packages/currency-converter-chrome-v2.0.0.zip`  
> - Firefox: `dist/packages/currency-converter-firefox-v2.0.0.zip`  
> **Last Verified**: 2026-10-17  

---

## Part 1: Chrome Web Store Submission Metadata

### 1. Product Details

#### Extension Name
```text
Currency Convertr
```

#### Summary / Short Description
*(132 characters max — Current: 122 characters)*
```text
Convert every price on any webpage in place into your preferred currency with live exchange rates. Google Translate for prices.
```

#### Detailed Description
```text
"Google Translate for prices" — Convert every price on any webpage into your chosen currency, in place, with live exchange rates and one-click restoration of original prices.

Currency Convertr transforms international online shopping, travel bookings, and global price comparisons. With a single click or keyboard shortcut, every price on the page is seamlessly replaced with your target currency. A clean, non-intrusive Translate-style bar floats at the top, allowing you to switch currencies or restore original prices anytime.

KEY CAPABILITIES

• In-Page Price Conversion: Converts prices directly within the webpage layout without breaking design or causing visual jumping.
• Reversible at Any Time: Click "Show original" to restore the webpage to its exact original state.
• Modern Translate-Style Bar: A non-intrusive floating bar lets you change target currencies or dismiss the widget for that browsing session.
• Price Hover Tooltips: Hover over any converted price to inspect the original amount, source currency, and the exact exchange rate used.
• Three Display Modes: Choose between "Replace" (clean in-place conversion), "Append" ($20.00 ≈ ₦30,512), or "Replace + Highlight".
• Split-Price Recognition: Accurately identifies complex e-commerce layouts (such as Amazon-style split whole and fraction spans, superscript cents, and multi-element prices).
• 170+ Supported Currencies: Converts major world currencies (USD, EUR, GBP, JPY, CAD, AUD, INR) alongside regional emerging currencies (NGN, GHS, KES, ZAR, BRL, and more) and popular cryptocurrencies.
• Context Menu & Selection: Highlight any specific price, right-click, and convert it instantly via a desktop alert.
• Dynamic Content & SPAs: Seamlessly converts new items loaded via infinite scrolling or client-side navigation.
• Automated Site Rules: Configure specific websites to auto-convert prices upon page load.

PRIVACY & SECURITY GUARANTEES

Currency Convertr operates under a strict Zero-Telemetry policy:
• All DOM reading and price conversion happens strictly locally on your device.
• No browsing history, URLs, or page contents are ever transmitted to any external server.
• Anonymous public exchange rate tables are fetched from the European Central Bank and distributed CDN mirrors with zero tracking.
• Settings are stored locally in your browser profile.

SUPPORT & ISSUES

Report bugs or submit currency requests on GitHub:
https://github.com/richmondsogo/currency-converter-v2/issues
```

#### Category
```text
Shopping
```

#### Language
```text
English
```

---

### 2. Graphic Assets Matrix

| Asset Type | Dimensions | File Location | Validation Status |
|---|---|---|---|
| **Store Icon** | 128 &times; 128 px | `dist/chrome/icons/icon128.png` | Valid |
| **Screenshot 1** | 1280 &times; 800 px | `screenshots/screenshot-inpage-bar.png` | In-page converted price + Translate floating bar + hover tooltip |
| **Screenshot 2** | 1280 &times; 800 px | `screenshots/screenshot-popup.png` | Toolbar action popup with searchable combobox & site rules |
| **Screenshot 3** | 1280 &times; 800 px | `screenshots/screenshot-options.png` | Options dashboard with pinned currencies & site rules |
| **Screenshot 4** | 1280 &times; 800 px | `screenshots/real-work-test-context-menu.png` | Context-menu selection conversion |
| **Promo Banner** | 440 &times; 280 px | `screenshots/promo-small-440x280.png` | Chrome Web Store promotional tile |

---

### 3. Permissions Justifications (for Chrome Web Store Reviewers)

| Permission | Scope | Justification |
|---|---|---|
| `activeTab` | API | Enables the user to initiate in-page price conversion on the active tab via the toolbar button or keyboard shortcut without requiring permanent broad host permissions. |
| `scripting` | API | Injects the price-scanning content script into the active tab upon user activation, and dynamically registers content scripts for sites the user configured for auto-conversion. |
| `storage` | API | Persists user preferences (target currency, display mode, pinned currencies, per-site rules) and caches exchange rates locally (`chrome.storage.local`). |
| `contextMenus` | API | Registers the "Convert currency" context-menu items when text is selected on a page. |
| `notifications` | API | Displays desktop notifications when converting selected text via the right-click menu. |
| `optional_host_permissions` (`["<all_urls>"]`) | Host | Requested only after an explicit user interaction when the user chooses to enable "Always convert on this site" or "Auto-convert on all sites". Never granted by default. |
| `https://api.frankfurter.dev/*` | Host | Queries European Central Bank reference exchange rates for major fiat currencies. |
| `https://cdn.jsdelivr.net/*` | Host | Queries open exchange rate tables for 170+ regional currencies via CDN. |
| `https://latest.currency-api.pages.dev/*` | Host | Serves as tertiary fallback provider if primary and CDN rate hosts are unreachable. |

---

### 4. Single-Purpose Declaration

```text
Convert prices on webpages into the user's selected target currency using live foreign exchange rates.
```

### 5. Data Usage & Privacy Declarations

- **Personally identifiable information**: Not collected.
- **Health information**: Not collected.
- **Financial information**: Not collected (no banking, card, or wallet details accessed).
- **Authentication information**: Not collected.
- **Personal communications**: Not collected.
- **Location**: Not collected.
- **Web browsing history**: Not collected (URLs and history are never recorded or stored).
- **Website content**: Processed locally in volatile memory strictly to extract numbers and currency symbols; never transmitted off-device.

---

### 6. Technical Reviewer Guidance (Chrome Web Store)

```text
Reviewer Guidance:
1. Pure Manifest V3 Architecture: The background service worker (background.js) orchestrates rate caching and messaging.
2. User-Initiated Execution: In-page price conversion runs on-demand via activeTab and scripting.executeScript. Optional host permissions (<all_urls>) are only requested upon explicit user toggle ("Always convert on this site").
3. Local Processing: No page text, URLs, or browsing data are transmitted anywhere. The only network calls are anonymous GET requests for public currency rate tables (base EUR).
4. No Remote Code: All JavaScript modules are bundled locally using esbuild with zero eval, zero inline scripts, and zero remote code dependencies.
```

---

## Part 2: Firefox Add-ons (AMO) Submission Metadata

### 1. Add-on Details

#### Add-on Name
```text
Currency Convertr
```

#### Add-on ID
```text
currency-converter-fx@richmond.addons
```

#### Summary
```text
Translate prices on any website into your preferred currency in place with live rates, floating bar, and one-click restore.
```

#### Full Description
```text
"Google Translate for prices" — Convert every price on any webpage into your preferred currency, in place, with live exchange rates and one-click restoration of original prices.

Currency Convertr transforms international online shopping, travel bookings, and global price comparisons. With a single click or keyboard shortcut, every price on the page is seamlessly replaced with your target currency. A clean, non-intrusive Translate-style bar floats at the top, allowing you to switch currencies or restore original prices anytime.

KEY FEATURES:
• In-Page Price Conversion: Converts prices directly within the webpage layout without breaking design or causing visual jumping.
• Reversible at Any Time: Click "Show original" to restore the webpage to its exact original state.
• Floating Translate Bar: A non-intrusive floating bar lets you change target currencies or dismiss the widget for that browsing session.
• Price Hover Tooltips: Hover over any converted price to inspect the original amount, source currency, and the exact exchange rate used.
• Three Display Modes: Choose between "Replace" (clean in-place conversion), "Append" ($20.00 ≈ ₦30,512), or "Replace + Highlight".
• Split-Price Recognition: Accurately identifies complex e-commerce layouts (such as Amazon-style split whole and fraction spans, superscript cents, and multi-element prices).
• 170+ Supported Currencies: Converts major world currencies (USD, EUR, GBP, JPY, CAD, AUD, INR) alongside regional emerging currencies (NGN, GHS, KES, ZAR, BRL, and more) and popular cryptocurrencies.
• Context Menu & Selection: Highlight any specific price, right-click, and convert it instantly via a desktop alert.
• Dynamic Content & SPAs: Seamlessly converts new items loaded via infinite scrolling or client-side navigation.
• Automated Site Rules: Configure specific websites to auto-convert prices upon page load.

PRIVACY & SECURITY:
• All DOM reading and price conversion happens strictly locally on your device.
• No browsing history, URLs, or page contents are ever transmitted to any external server.
• Anonymous public exchange rate tables are fetched from the European Central Bank and distributed CDN mirrors with zero tracking.
• Settings are stored locally in your browser profile.
```

#### Notes to Reviewer (Firefox AMO)
```text
Dear AMO Review Team,

Currency Convertr v2.0.0 is a Manifest V3 add-on providing in-page currency conversion:
1. Local DOM Processing: All text scanning and currency replacement occur entirely client-side in the active tab. No webpage content, URLs, or browsing data are ever sent off the device.
2. Optional Host Permissions: The add-on specifies optional_host_permissions: ["<all_urls>"]. This permission is NOT active upon installation. It is only requested via browser.permissions.request() if the user explicitly turns on "Always convert on this site" or "Auto-convert on all sites" in the popup or options page.
3. Clean Manifest V3 Build: Bundled via esbuild with zero remote scripts and zero innerHTML usages (verified with web-ext lint: 0 errors, 0 notices, 0 warnings).
4. Dual Rate Architecture: Exchange rates are fetched anonymously by the background script (base EUR) from the European Central Bank (Frankfurter) and Fawaz Ahmed currency API via jsDelivr CDN / Cloudflare Pages.
```
