# Product Context: Currency Convertr

## Overview
**Currency Convertr** is a privacy-first, zero-bloat browser extension designed to function as "Google Translate for prices". It detects foreign currency prices on e-commerce websites and international pages, instantly converting them into the user's preferred native currency while preserving the original page layout and styling.

The visual hallmark of the extension is a hardware-inspired, OLED dark **Dynamic Island pill** that floats unobtrusively at the top of the browser viewport.

---

## The Three Entry Points
All conversion requests feed into a single, unified conversion pipeline in the background and content scripts:

1. **Context Menu** (Right-Click):
   - Right-click anywhere on a webpage -> Select "Convert prices on this page".
   - Executes an explicit, manual conversion of the active tab.
   - Provides immediate visual feedback through the Dynamic Island pill.

2. **Toolbar Popup**:
   - Click the extension icon in the browser toolbar.
   - Features an instant numeric scratchpad calculator, a "Convert this page" action, and an "Always convert on this site" toggle.
   - Allows users to configure target currency, display mode, and inspect rates metadata.

3. **Automatic Offer (New in v2.1.0)**:
   - On the first visit to a site where `mode === 'ask'` (the default for all unconfigured sites), a lightweight detector runs locally after the page settles.
   - If the dry-run scan detects prices (`count >= MIN_PRICES`), the Dynamic Island pill appears with an offer: `"Convert to USD?"` with `[Convert]` and `[Not now]`.
   - If the user accepts, the page converts immediately and the pill presents a one-time follow-up: `"Always convert on <host>?"` with `[Always]` and `[Just this time]`.

---

## One-Page Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Web Browser Tab                               │
│                                                                        │
│  ┌─────────────────────────┐          ┌─────────────────────────────┐  │
│  │   detector.js (Static)  │          │   content.js (Full Engine)  │  │
│  │  - Runs at idle         │          │  - Injected on demand       │  │
│  │  - Reads site mode      │          │  - PageScanner (DOM mutator)│  │
│  │  - countCandidates()    │          │  - InPageUI (Shadow DOM)    │  │
│  │  - Dry-run only         │          │  - Dynamic Island Pill      │  │
│  └───────────┬─────────────┘          └──────────────┬──────────────┘  │
└──────────────┼───────────────────────────────────────┼─────────────────┘
               │                                       │                  
               │ Typed Messages via messaging.js       │                  
               ▼                                       ▼                  
┌────────────────────────────────────────────────────────────────────────┐
│                     Background Service Worker                          │
│                         (background.js)                                │
│                                                                        │
│  - Central rate caching & deduplication (chrome.storage.local)         │
│  - 3-Tier exchange rate fallback:                                      │
│      1. European Central Bank (Frankfurter API)                        │
│      2. Fawaz Ahmed Currency API (jsDelivr CDN)                        │
│      3. Cloudflare Pages Fallback Host                                 │
│  - Stale-while-revalidate caching (6-hour TTL)                         │
│  - Site preferences management (mode: 'ask' | 'always' | 'never')      │
│  - Session suppression (chrome.storage.session)                        │
│  - Context menu lifecycle & command dispatch                           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │      popup.js         │                 │      options.js       │
   │  Toolbar UI & quick   │                 │  Full settings, site  │
   │  converter calculator │                 │  rules, custom rates  │
   └───────────────────────┘                 └───────────────────────┘
```

---

## Current Status
- **Current Version**: v2.0.0 in production; transitioning to v2.1.0 specification.
- **Engine**: Cross-browser Manifest V3 (Chrome, Edge, Brave, Opera, Firefox).
- **DOM Engine**: Two-phase DOM walker with regex boundary parsing, split-price inner-first assembly, and open Shadow DOM traversal with byte-for-byte revert fidelity.
- **UI System**: Custom OLED Dynamic Island pill with zero runtime frameworks, zero external CSS dependencies, isolated inside an open Shadow DOM root.

---

## Known Issues & Implementation Gaps
1. **Popup Result Misleading Label**: When zero prices are found on a page, the popup currently reports "Page is already in USD" instead of "No prices found on this page". The result contract must distinguish `no_prices` from `already_target`.
2. **Auto-Collapse Implementation Gap**: `DESIGN.md` documented a 3.5s auto-collapse for the Dynamic Island pill, but this was never wired in code. It must be explicitly defined for `CONVERTED` and forbidden for `OFFER`.
3. **Motion Layout Reflow**: The pill expansion currently transitions `grid-template-columns: 0fr -> 1fr`, causing layout calculations rather than purely compositor-driven transforms.
4. **Redundant Manifest Permissions**: `manifest.json` ships `host_permissions: ["<all_urls>", "http://*/*", "https://*/*"]` and `permissions: [..., "tabs"]`. The wildcard duplicates require cleanup.
5. **Site Settings Schema**: Site preferences currently use dual booleans (`autoConvert`, `neverConvert`) which allow invalid states; must be migrated to a clean enum `mode: 'ask' | 'always' | 'never'`.
