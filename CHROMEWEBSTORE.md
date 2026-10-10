# Chrome Web Store Developer Submission Specification

> **Target Version**: 1.1.0  
> **Last Verified**: 2026-10-10  
> **Package File**: `dist/packages/currency-converter-chrome-v1.1.0.zip`

---

## 1. Product Details

### Extension Name
```text
Currency Converter
```

### Summary / Short Description
*(132 characters max — Current: 111 characters)*
```text
Highlight any price on a webpage, right-click, and convert it instantly into your target currency with live rates.
```

### Detailed Description
```text
Convert prices instantly without ever leaving your web browser tab.

Currency Converter streamlines international online shopping, travel reservations, and financial comparisons. Simply highlight any price, right-click to open the context menu, and view the live converted value right away. You no longer need to copy numbers into separate search engine tabs or open calculator applications.

CORE CAPABILITIES

• Context Menu Conversion: Instant conversion directly from the browser right-click menu.
• 170+ Supported Currencies: Full support for major global currencies (USD, EUR, GBP, JPY, CAD, AUD, INR) alongside emerging market currencies (NGN, GHS, KES, and more).
• Intelligent Price Recognition: Automatically identifies currency symbols ($, €, £, ₦, ¥, ₹, ₩, CAD$, AU$) and three-letter ISO 4217 currency codes.
• Global Number Formatting: Accurately parses both standard dot-decimal values ($1,299.99) and European comma-decimal values (1.299,99 or 149,50 €).
• Native System Notifications: Delivers clean, non-intrusive desktop alerts with formatted totals and implied unit exchange rates.
• Dual-Tier Rate Reliability: Queries European Central Bank reference exchange rates with seamless CDN fallback for broad global coverage.

USAGE INSTRUCTIONS

1. Highlight any price or numeric amount on any web page.
2. Right-click the selected text.
3. Hover over "Convert currency" and select your target currency (e.g., To NGN, To USD, To EUR, To GBP).
4. A native desktop notification appears displaying the converted amount and exchange rate.

PRIVACY AND SECURITY GUARANTEE

Currency Converter operates under a strict Zero-Telemetry policy:
• No user data, browsing history, or website content is ever recorded or transmitted off-device.
• Highlighted text selections are processed in volatile browser memory only at the time of conversion.
• No content scripts are injected into web pages.

SUPPORT AND ISSUES

Report bugs or submit currency requests on GitHub:
https://github.com/richmondsogo/currency-converter-v2/issues
```

### Category
```text
Shopping
```

### Language
```text
English
```

---

## 2. Graphic Assets Matrix

| Asset Type | Required Dimensions | File Location | Validation Status |
|---|---|---|---|
| **Extension Icon** | 128 &times; 128 px (PNG) | `dist/chrome/icons/icon128.png` | Valid (PNG 128&times;128) |
| **Screenshot 1** | 1280 &times; 800 px (PNG) | `screenshots/real-work-test-context-menu.png` | Valid (PNG 1280&times;800) |
| **Screenshot 2** | 1280 &times; 800 px (PNG) | `screenshots/real-work-test-conversion-alert.png` | Valid (PNG 1280&times;800) |
| **Screenshot 3** | 1280 &times; 800 px (PNG) | `screenshots/real-work-test-european-decimal.png` | Valid (PNG 1280&times;800) |
| **Small Promo Tile** | 440 &times; 280 px (PNG) | `screenshots/promo-small-440x280.png` | Valid (PNG 440&times;280) |

### Asset Descriptions for Dashboard Upload

- **Screenshot 1**: In-page right-click context menu demonstrating conversion of a selected e-commerce item price.
- **Screenshot 2**: System notification output displaying the calculated target total and implied exchange rate.
- **Screenshot 3**: Parsing verification of European comma-decimal formatting (`149,50 €` converted to USD).
- **Small Promo Banner**: Official branding tile adhering to Chrome Web Store visual guidelines.

---

## 3. Permissions Justifications

The extension requests only the minimum set of permissions necessary to deliver its core functionality:

| Permission | Type | Technical Justification for Reviewer |
|---|---|---|
| `contextMenus` | API Permission | Required to register the "Convert currency" menu item and currency target submenu items when users highlight text on web pages. |
| `notifications` | API Permission | Required to display the conversion result to the user via native system notifications without injecting scripts or elements into the host webpage. |
| `https://api.frankfurter.dev/*` | Host Permission | Required to fetch real-time European Central Bank foreign exchange rates for major currencies. |
| `https://cdn.jsdelivr.net/*` | Host Permission | Required to access the open exchange rate fallback database for 170+ regional currencies (e.g., NGN, GHS, KES) not tracked by central banks. |

---

## 4. Privacy Practices & Data Declarations

### Single Purpose Declaration
```text
Convert highlighted monetary values on web pages into selected target currencies via the browser context menu.
```

### Data Collection Answers

| Data Type | Collected? | Off-Device Transmission? | Explanation |
|---|---|---|---|
| Personally identifiable information | **No** | No | None |
| Financial and payment information | **No** | No | No credit card or account data accessed |
| Health information | **No** | No | None |
| Authentication information | **No** | No | No accounts or credentials required |
| Personal communications | **No** | No | None |
| Location data | **No** | No | None |
| Web browsing history | **No** | No | No URLs, history, or browsing activity tracked |
| User activity | **No** | No | No clicks or user activity tracked |
| Website content | **No** | No | Highlighted text is processed in volatile memory only during conversion |

### Chrome Web Store Certifications

- [x] **No sale of user data**: Data is not sold, rented, or transferred to data brokers.
- [x] **No unrelated usage**: The extension does not use data for purposes outside its declared single purpose.
- [x] **No lending or credit determination**: The extension does not assess creditworthiness.

---

## 5. Privacy Policy Link & Contact

- **Public Privacy Policy URL**:  
  `https://github.com/richmondsogo/currency-converter-v2/blob/main/PRIVACY_POLICY.md`
- **Developer Name**: Richmond Sogo
- **Contact Email**: `richmondsogo@gmail.com`
- **Support / Issue Tracker**:  
  `https://github.com/richmondsogo/currency-converter-v2/issues`

---

## 6. Technical Reviewer Notes (for CWS Review Team)

```text
Reviewer Guidance:
1. Pure Manifest V3 Implementation: The extension utilizes a lightweight background service worker (background.js) with no content scripts, DOM injection, or external script execution.
2. User-Initiated Execution: Network requests are triggered strictly when the user selects a currency item from the context menu. No background polling or periodic syncing occurs.
3. Clean Zip Archive: The submitted archive (dist/packages/currency-converter-chrome-v1.1.0.zip) includes manifest.json directly at the root directory level.
4. Ephemeral Processing: Text selections are parsed strictly in memory; no user data or URLs are logged or stored.
```
