# 0012. Static All-Sites Detector Content Script

Date: 2026-10-21
Status: Accepted
Supersedes: [0005](0005-permission-footprint-and-dynamic-scripting.md) (in part)
Amended by: [0013](0013-detector-and-dynamic-island-pill-handoff-architecture.md)

## Context
In order to make Currency Convertr work like Google Translate for prices, the extension needs to automatically offer conversion on pages displaying foreign prices without requiring the user to open the popup or right-click first.

An initial technical proposal considered asking the user for host permissions dynamically using an in-page Dynamic Island button that calls `chrome.permissions.request()`. However:
1. **API Inaccessibility in Content Scripts**: According to the official [Chrome Content Scripts Capabilities Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#capabilities), content scripts only have direct access to a small subset of extension APIs: `dom`, `i18n`, `storage`, and specific `runtime` methods/events (`connect`, `getManifest`, `getURL`, `id`, `onConnect`, `onMessage`, `sendMessage`). The page states:
   > *"Content scripts are unable to access other APIs directly. But they can access them indirectly by exchanging messages with other parts of your extension."*
   The `chrome.permissions` API namespace is not in this list and cannot be called directly from content scripts.
2. The extension manifest already declares `host_permissions: ["<all_urls>"]`.

## Decision
Declare a lightweight static detector content script (`detector.js`) in `manifest.json` under `content_scripts`:
- **Matches**: `["http://*/*", "https://*/*"]`
- **Frames**: Top frame only (`"all_frames": false`)
- **Execution Timing**: `"run_at": "document_idle"`

The detector performs the following:
1. Reads the site preference mode from storage (`chrome.storage.local` / settings cache).
2. If `mode === 'never'`, the script exits immediately.
3. If `mode === 'always'`, the script requests full conversion from the background engine via `MSG.CONVERT_PAGE`.
4. If `mode === 'ask'` (the default):
   - It runs a dry-run candidate price count (`countCandidates()`) that strictly inspects text without modifying the DOM.
   - If candidate prices count $\ge \text{MIN\_PRICES}$ (where $\text{MIN\_PRICES} = 3$), the detector sends `MSG.OFFER_REQUESTED` to `background.js`.
   - `background.js` verifies that the host is not in session suppression (`chrome.storage.session`).
   - If eligible, `background.js` injects `content.js` into the tab to mount the canonical Dynamic Island pill (`#cc-dynamic-island-host`) in the `OFFER` state: `"Convert to USD?"` with `[Convert]` and `[Not now]`.
   - **No DOM prices are mutated or converted, and no prices are modified until the user explicitly accepts the offer by clicking `[Convert]` (or if the site was already configured as `'always'`).**
5. "Always convert on this site" becomes a stored user configuration in `chrome.storage.local` (`perSite[hostname].mode = 'always'`), rather than a runtime browser host permission grant.

## Rationale
- **Feasibility**: Resolves the architectural impossibility of invoking `chrome.permissions.request` from content scripts.
- **Privacy & Lightweight Execution**: The detector script is minimal and read-only. It performs a fast, non-mutating count of candidate prices only after the page reaches idle state.
- **Single Canonical Host**: As formalized in ADR 0013, `content.js` is the sole owner of `#cc-dynamic-island-host`. `detector.js` creates zero DOM elements.
- **Top Frame Only**: Prevents duplicate detector runs, redundant pill mounts, or wasted CPU in embedded iframes and third-party widgets.

## Consequences
- **Install Warning**: Unchanged. The manifest already ships `<all_urls>` host permissions.
- **Privacy Policy & Documentation**: `README.md` and `PRIVACY_POLICY.md` describe that the detector reads page text locally in memory solely to count candidate price patterns, and never transmits page content, URLs, or browsing history over the network.
- **Session Suppression**: User clicks on "Not now" or scoped Escape are routed via message to `background.js` and stored in `chrome.storage.session` so offers are not repeatedly shown on subsequent page views within the same browser session.
- **Frame Isolation**: `all_frames: false` guarantees that nested ads, embeds, and iframes are ignored.
