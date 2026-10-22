# Currency Convertr

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20%7C%20Firefox-lightgrey.svg)](#cross-browser-compatibility)
[![Tests](https://img.shields.io/badge/Tests-51%20Passing-brightgreen.svg)](#test-suite)

> **"Google Translate for prices"** (v2.0.0) — An intelligent, cross-browser extension that instantly converts every price on any webpage into your preferred currency in place, with a non-intrusive Dynamic Island floating bar and one-click restoration of original prices.

---

## Visual Tour

### 1. In-Page Price Conversion & Translate Bar
Prices convert directly on the page. The floating bar lets you switch target currencies, view status, or revert to original prices instantly. Hovering over any converted price displays a detailed breakdown with the original amount, exchange rate used, and rate date.

![In-Page Price Conversion](screenshots/screenshot-inpage-bar.png)

### 2. Toolbar Action Popup
Quickly toggle conversion on the active page, switch target currencies with the searchable combobox, and configure per-site auto-conversion rules.

![Action Popup](screenshots/screenshot-popup.png)

### 3. Full Preferences & Options Dashboard
Customize your default target currency, reorder pinned currencies for quick access, select your preferred display mode, enable cryptocurrency support, and manage automated site rules.

![Options Page](screenshots/screenshot-options.png)

### 4. Selection Conversion (Preserved from v1)
Highlight any specific price string, right-click, and convert it instantly via a native desktop notification.

![Context Menu Selection](screenshots/real-work-test-context-menu.png)

---

## Core Features

- **In-Place Page Conversion**: Converts every detected price on any page into your chosen currency without disrupting page layout.
- **Three Display Modes**:
  - `Replace` (Default): Cleanly replaces the price on page; hover tooltip displays original amount.
  - `Append`: Displays original and converted prices side-by-side (e.g. `$20.00 (≈ ₦30,512)`).
  - `Replace + Highlight`: Adds a subtle, elegant highlight to converted prices.
- **100% Byte-for-Byte Reversible**: Preserves exact original text nodes and DOM structures in memory (`WeakMap<Element, DocumentFragment>`). Clicking "Show original" restores the page to its pristine state.
- **Split-Price Assembly**: Intelligently handles modern e-commerce layouts (such as Amazon's split symbol, whole, and fraction tags, `<sup>` cents, and nested spans) as cohesive pricing units.
- **Dynamic Content & SPAs**: Batched `MutationObserver` automatically converts new items loaded via infinite scroll or client-side navigation without main-thread blocking or infinite loops.
- **Open Shadow DOM Support**: Traverses open shadow roots in modern web components to convert encapsulated pricing elements.
- **Smart Currency Detection**:
  1. Unambiguous tokens (`US$`, `CA$`, `AU$`, `NZ$`, `₦`, `€`, `zł`, `Kč`, `฿`, `₺`, etc.).
  2. Structured page metadata (JSON-LD `priceCurrency`, `og:price:currency`, `product:price:currency`, and microdata `[itemprop="priceCurrency"]`).
  3. Site context: Country-code TLD mapping (.ca &rarr; CAD, .co.uk &rarr; GBP, .ng &rarr; NGN, .jp &rarr; JPY, etc.) and `<html lang>` region codes.
  4. Per-site user overrides.
  5. Configurable default for ambiguous symbols (`$`, `¥`, `kr`).
- **170+ Global Currencies**: Full support for 162 ISO 4217 currencies plus major cryptocurrencies with localized minor-unit precision and rounding options.
- **3-Tier Rates Engine**:
  - Primary: European Central Bank (ECB) via Frankfurter API.
  - Secondary: Fawaz Ahmed Currency API via jsDelivr CDN.
  - Tertiary: Fawaz Ahmed Currency API via Cloudflare Pages.
  - Transparent cross-rates calculated through EUR with a 6-hour cache, stale-while-revalidate, in-flight deduplication, and offline fallback.
- **Zero Runtime Dependencies in Core Engine**: In-page scanner, detector, background service worker, and Shadow DOM pill are built entirely in vanilla JavaScript with zero framework overhead. Extension pages (options, popup) use locally bundled React and shadcn/ui components with 100% local bundling (zero remote code, zero CDN calls).

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph UI ["User Interfaces"]
        Popup["Toolbar Popup<br/>(popup.js)"]
        Options["Options Dashboard<br/>(options.js)"]
        InPageBar["Shadow DOM Translate Bar<br/>(content/ui.js)"]
        ContextMenu["Context Menu<br/>(selection)"]
    end

    subgraph Background ["Background Service Worker (MV3)"]
        Router["Message Router<br/>(background.js)"]
        RatesEngine["Rates Engine<br/>(shared/rates.js)"]
        Storage["chrome.storage.local<br/>(Cache & Settings)"]
        Scripting["chrome.scripting<br/>(Dynamic Injection)"]
    end

    subgraph ContentScript ["Content Script (Tab)"]
        Scanner["Page Scanner<br/>(content/scanner.js)"]
        DOM["Host Page DOM<br/>(Light + Shadow DOM)"]
    end

    subgraph RemoteAPIs ["Foreign Exchange Rates Providers"]
        ECB["1. Frankfurter API<br/>(European Central Bank)"]
        FawazCDN["2. Fawaz Currency API<br/>(jsDelivr CDN)"]
        FawazPages["3. Fawaz Fallback Host<br/>(Cloudflare Pages)"]
    end

    Popup -->|MSG.CONVERT_PAGE / MSG.UPDATE_SETTINGS| Router
    Options -->|MSG.UPDATE_SETTINGS| Router
    ContextMenu -->|chrome.contextMenus.onClicked| Router
    Router --> Scripting
    Scripting -->|injects / registers| Scanner
    Scanner <-->|walks & converts| DOM
    Scanner --> InPageBar
    Router <--> RatesEngine
    RatesEngine <--> Storage
    RatesEngine -->|1. Try ECB| ECB
    RatesEngine -->|2. Try CDN| FawazCDN
    RatesEngine -->|3. Try Pages| FawazPages
```

---

## Permission Model & Least Privilege

Currency Convertr requests the following permissions in `manifest.json`:

| Permission | Scope | Technical Justification |
|---|---|---|
| `contextMenus` | API | Enables the right-click "Convert prices on this page" context menu item. |
| `notifications` | API | Displays quick conversion notifications for right-click text selections. |
| `storage` | API | Persists user preferences and cached exchange rate tables locally (`chrome.storage.local` and `chrome.storage.session`). |
| `activeTab` | API | Grants temporary access to the active tab to execute in-page conversion on user demand. |
| `scripting` | API | Executes content script injection into active tabs upon conversion request. |
| `tabs` | API | Queries active tab properties (URL, restricted scheme verification) to route conversion commands and status. |
| `<all_urls>` | Host Permission | Allows the in-page price conversion engine and lightweight detector script to detect and convert prices across international shopping websites. |
| `http://*/*`, `https://*/*` | Host Permission | *(Redundant with `<all_urls>`; currently declared in manifest and scheduled for cleanup in a future step).* |

> **Planned Permission Cleanup**: The explicit wildcard entries `http://*/*` and `https://*/*` are redundant alongside `<all_urls>` and will be removed in an upcoming maintenance step.

---

## Installation & Local Development

### Prerequisites
- Node.js v18.0.0 or higher
- Google Chrome, Microsoft Edge, Brave, or Mozilla Firefox
- Playwright Chromium (for E2E browser tests): `npx playwright install chromium`

### 1. Build the Extension
> **Important**: `dist/` is not tracked in git. You must run `npm run build`, then load `dist/chrome`.

```bash
# Clone the repository
git clone https://github.com/richmondsogo/currency-convertr.git
cd currency-convertr

# Install dependencies
npm install

# Install Playwright browser for E2E tests
npx playwright install chromium

# Compile Chrome and Firefox distribution bundles (run npm run build, then load dist/chrome; dist/ is not tracked)
npm run build
```

### 2. Load into Chromium (Chrome, Edge, Brave)
1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Toggle **Developer mode** on in the top-right corner.
3. Click **Load unpacked**.
4. Select the `dist/chrome` folder (run `npm run build` first; `dist/` is not tracked).

### 3. Load into Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `dist/firefox/manifest.json` (run `npm run build` first; `dist/` is not tracked).

---

## Testing & Verification

The repository includes both unit tests and a real-browser Playwright E2E harness:

```bash
# Run unit and DOM integration tests
npm test

# Run real-browser E2E tests (Chrome for Testing)
npm run test:e2e

# Lint Firefox extension for Mozilla AMO compliance
npm run lint:firefox
```

---

## Privacy Policy Summary

- **Local-Only Processing**: All webpage text inspection, candidate price detection, and DOM scanning occur strictly on your device inside volatile memory. Nothing about your browsing history, page contents, or URLs is ever recorded, transmitted, or shared.
- **Detector Script Privacy Guarantee**: The lightweight static detector reads text nodes locally in the active tab solely to count potential price patterns. It transmits zero data over the network and never logs page content.
- **Zero Telemetry**: No analytics beacons, no crash tracking SDKs, no advertising libraries, and no user profiling.
- **Anonymous Rate Requests**: Foreign exchange rate queries request public rate tables (base EUR) and never transmit user-specific data.

For our full privacy disclosures, see [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

---

## Contributing

Contributions, feedback, and currency metadata updates are welcome!
1. Fork the repository and create your feature branch: `git checkout -b feat/my-improvement`.
2. Commit your changes following Conventional Commits: `git commit -m "feat: add currency XYZ"`.
3. Ensure all tests and linter checks pass: `npm test && npm run lint:firefox`.
4. Open a Pull Request.

---

## License

This project is licensed under the [MIT License](LICENSE).
