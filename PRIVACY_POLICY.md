# Privacy Policy for Currency Converter

**Effective Date:** October 10, 2026  
**Last Updated:** October 10, 2026

This Privacy Policy describes how the **Currency Converter** browser extension ("Currency Converter", "the extension", "we", "us", or "our") processes information when installed on Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi) and Mozilla Firefox.

---

## 1. Zero Data Collection Architecture

Currency Converter operates under a strict Zero-Telemetry, Privacy-by-Design standard. We do not collect, harvest, store, transmit, or monetize any personal information or web browsing data.

Specifically, Currency Converter:
- **Does not require user registration or accounts.**
- **Does not collect personal identifiers** (including name, email address, IP addresses, or device IDs).
- **Does not track web browsing history** or access the URLs of pages visited.
- **Does not track keystrokes, form submissions, or clicks.**
- **Does not inject analytics libraries, telemetry trackers, or advertising SDKs.**
- **Does not store cookies, LocalStorage, or persistent client-side data.**

---

## 2. Ephemeral Processing of Selected Content

When you highlight text on a web page and select a currency conversion option from the browser context menu:

1. The browser passes the highlighted text string to the extension's background worker.
2. The numeric value and currency symbol or ISO 4217 code are extracted **purely in volatile memory**.
3. Once the calculation is complete and the desktop notification is rendered, the string is released from memory.
4. The extension **never reads or accesses any surrounding page content, page HTML, DOM elements, or web page URLs**.

---

## 3. Third-Party Network Requests and Exchange Rate APIs

To compute exchange rates, the extension sends outbound HTTPS requests to two public rate providers:

### Primary Provider: Frankfurter API
- **Endpoint:** `https://api.frankfurter.dev/`
- **Data Transmitted:** Source currency code, target currency code, and numeric amount (for example: `?amount=100&from=USD&to=EUR`).
- **Nature of Service:** Free, open-source European Central Bank reference exchange rates.
- **Telemetry:** No user identifiers, cookies, or tracking headers are transmitted in API requests.

### Fallback Provider: Fawaz Ahmed Currency API (jsDelivr CDN)
- **Endpoint:** `https://cdn.jsdelivr.net/`
- **Data Transmitted:** Static file request for the source currency exchange rate table (for example: `/v1/currencies/usd.json`).
- **Nature of Service:** CDN-cached daily exchange rate tables for 170+ world currencies.
- **Telemetry:** Requests are standard anonymous GET requests served by the jsDelivr global CDN network.

---

## 4. Browser Permissions and Justifications

The extension requests the minimum browser permissions necessary to execute its single declared purpose:

| Permission | Category | Purpose |
|---|---|---|
| `contextMenus` | API | Adds the "Convert currency" menu item and target currency submenus to the browser right-click menu when text is selected. |
| `notifications` | API | Displays the converted currency amount and implied exchange rate to the user via native system notifications. |
| `https://api.frankfurter.dev/*` | Host | Permits network calls to fetch live European Central Bank foreign exchange rates. |
| `https://cdn.jsdelivr.net/*` | Host | Permits network calls to fetch fallback exchange rate tables for regional and emerging-market currencies. |

The extension **does not request** high-risk permissions such as `<all_urls>`, `webRequest`, `storage`, or `tabs`.

---

## 5. Security and Data Retention

Because Currency Converter does not collect or transmit personal information to any server owned or controlled by the developer, there is no user data stored, maintained, or subject to data retention periods. All conversions occur locally and ephemerally.

---

## 6. Children's Online Privacy Protection

Currency Converter does not knowingly collect or solicit any personal information from children under the age of 13, in full compliance with the Children's Online Privacy Protection Act (COPPA).

---

## 7. Compliance and Regulatory Standards

This policy complies with:
- Google Chrome Web Store Developer Program Policies (User Data Policy).
- Mozilla Conditions for Add-on Developers.
- General Data Protection Regulation (GDPR) standards regarding data minimization.
- California Consumer Privacy Act (CCPA) standards.

---

## 8. Policy Modifications

We may update this Privacy Policy to reflect enhancements or changes in regulatory requirements. When modifications are made, the revised version will be published in this repository with an updated "Last Updated" date.

---

## 9. Contact and Developer Information

If you have questions, inquiries, or feedback regarding this Privacy Policy:

- **Developer:** Richmond Sogo
- **Email:** `richmondsogo@gmail.com`
- **Issue Tracker:** [GitHub Repository Issues](https://github.com/richmondsogo/currency-converter-v2/issues)
- **Repository:** [https://github.com/richmondsogo/currency-converter-v2](https://github.com/richmondsogo/currency-converter-v2)
