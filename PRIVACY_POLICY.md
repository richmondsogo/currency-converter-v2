# Privacy Policy for Currency Convertr

**Effective Date:** October 17, 2026  
**Last Updated:** October 17, 2026

This Privacy Policy describes how the **Currency Convertr** browser extension ("Currency Convertr", "the extension", "we", "us", or "our") handles information when installed on Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi) and Mozilla Firefox.

---

## 1. Zero Data Collection Architecture

Currency Convertr is engineered under a strict **Zero-Telemetry, Privacy-by-Design** philosophy. We do not collect, store, transmit, or monetize any personal information, browsing history, or user identity.

Specifically, Currency Convertr:
- **Does not require user accounts or registration.**
- **Does not collect personal identifiers** (no names, email addresses, IP addresses, or device identifiers).
- **Does not track or record browsing history** or the URLs of web pages you visit.
- **Does not log keystrokes, form fields, passwords, or cookies.**
- **Does not inject analytics, telemetry beacons, or advertising SDKs.**
- **Does not transmit page contents or user data to external servers.**

---

## 2. Local-Only In-Memory Processing

When you invoke Currency Convertr—either via the toolbar popup, keyboard shortcut (`Alt+Shift+C`), right-click context menu, or on sites you have configured for automated conversion:

1. **Local DOM Analysis**: The extension inspects text nodes and pricing elements on the active webpage **entirely locally within your browser tab**.
2. **Volatile Memory**: Currency symbols, numbers, and ISO codes are processed purely in ephemeral JavaScript memory.
3. **No External Transmission**: Page text, product descriptions, pricing history, and DOM structures **never leave your device**.
4. **Reversible Operation**: If you select "Show original", original text is restored directly from client-side memory without contacting any remote service.

---

## 3. Local Preferences Storage

Currency Convertr uses the browser's local storage API (`chrome.storage.local`) exclusively on your device to persist:
- Your preferred target currency and display mode (Replace, Append, or Replace + Highlight).
- Pinned currencies for the toolbar and context menu.
- Custom per-site rules you have explicitly created (e.g., "Always convert on this site").
- Cached foreign exchange rate tables (to reduce unnecessary network calls).

This data is stored strictly in your local browser profile. It is **never** synchronized with any cloud server or transmitted off your machine.

---

## 4. Third-Party Foreign Exchange Rate Providers

To convert prices with live market data, the extension's background worker fetches anonymous foreign exchange rate tables from trusted upstream providers:

### 1. Frankfurter API (Primary Provider)
- **Endpoint:** `https://api.frankfurter.dev/`
- **Data Transmitted:** Standard HTTP GET request for exchange rate tables with base EUR (e.g., `/v1/latest?base=EUR`).
- **Nature of Service:** Free, open-source reference exchange rates published by the European Central Bank (ECB).
- **Telemetry:** No user identifiers, cookies, or tracking headers are transmitted.

### 2. Fawaz Ahmed Currency API via jsDelivr CDN (Secondary Provider)
- **Endpoint:** `https://cdn.jsdelivr.net/`
- **Data Transmitted:** Static file GET request for the broad rate table (e.g., `/v1/currencies/eur.json`).
- **Nature of Service:** Globally distributed CDN caching exchange rates for 170+ world currencies.
- **Telemetry:** Anonymous static file download served by jsDelivr.

### 3. Fawaz Ahmed Currency API via Cloudflare Pages (Tertiary Fallback)
- **Endpoint:** `https://latest.currency-api.pages.dev/`
- **Data Transmitted:** Static file GET request for `/v1/currencies/eur.json`.
- **Nature of Service:** High-availability fallback host if primary and CDN endpoints are unreachable.
- **Telemetry:** Anonymous static file download.

*Note: Content scripts never connect directly to the internet. All rate requests are centralized in the background worker, ensuring host web pages and their Content Security Policies are never affected.*

---

## 5. Browser Permissions and Justifications

Currency Convertr adheres to the Principle of Least Privilege:

| Permission | Category | Technical Justification |
|---|---|---|
| `contextMenus` | API | Enables the right-click "Convert currency" menu item on selected text. |
| `notifications` | API | Renders system desktop notifications for context-menu selection conversions. |
| `storage` | API | Saves your preferences and caches exchange rates locally on your computer. |
| `activeTab` | API | Grants temporary access to the active tab to execute in-page price conversion when you click "Convert this page" or use the keyboard shortcut. |
| `scripting` | API | Injects the in-page price scanner and registers automated conversion scripts for sites you have explicitly approved. |
| `optional_host_permissions` (`<all_urls>`) | Runtime Host | Requested **only** after an explicit user gesture if you choose to enable "Always convert on this site" or "Auto-convert on all sites". Never granted by default. |
| `https://api.frankfurter.dev/*` | Host | Queries European Central Bank reference exchange rates. |
| `https://cdn.jsdelivr.net/*` | Host | Queries exchange rate tables for 170+ global currencies via CDN. |
| `https://latest.currency-api.pages.dev/*` | Host | Serves as tertiary fallback provider for rate data. |

The extension **never** requests sensitive permissions such as `tabs`, `webRequest`, `cookies`, or `history`.

---

## 6. Children's Online Privacy

Currency Convertr does not collect, maintain, or solicit any personal information from children under the age of 13, adhering fully to the Children's Online Privacy Protection Act (COPPA).

---

## 7. Policy Modifications

Should this Privacy Policy be updated, the revised version will be published in this repository with an updated "Last Updated" timestamp.

---

## 8. Contact Information

For inquiries, support, or security questions regarding this Privacy Policy:
- **Developer:** Richmond Sogo
- **Email:** `richmondsogo@gmail.com`
- **Repository:** [https://github.com/richmondsogo/currency-converter-v2](https://github.com/richmondsogo/currency-converter-v2)
- **Issue Tracker:** [GitHub Issues](https://github.com/richmondsogo/currency-converter-v2/issues)
