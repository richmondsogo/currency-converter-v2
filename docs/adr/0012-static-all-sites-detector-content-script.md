# 0012. Static All-Sites Detector Content Script

Date: 2026-10-21
Status: Accepted
Supersedes: [0005](0005-permission-footprint-and-dynamic-scripting.md) (in part)

## Context
In order to make Currency Convertr work like Google Translate for prices, the extension needs to automatically offer conversion on pages displaying foreign prices without requiring the user to open the popup or right-click first.

An initial technical proposal considered asking the user for host permissions dynamically using an in-page Dynamic Island "Allow" button that calls `chrome.permissions.request()`. However, official Chrome extension architecture strictly restricts the `chrome.permissions` API:
1. **API Inaccessibility in Content Scripts**: Content scripts running in web pages do not have access to the `chrome.permissions` API namespace ([Chrome Content Scripts Capabilities Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#capabilities)).
2. **User Gesture Constraints**: `chrome.permissions.request()` must be triggered from an extension origin context (e.g. extension popup or options page) via a direct user gesture; web page content script interactions cannot directly spawn browser extension permission dialogs ([Chrome Permissions API Reference](https://developer.chrome.com/docs/extensions/reference/api/permissions)).

Furthermore, the extension manifest already declares `host_permissions: ["<all_urls>"]`.

## Decision
Declare a lightweight static detector content script (`detector.js`) in `manifest.json` under `content_scripts`:
- **Matches**: `["http://*/*", "https://*/*"]`
- **Frames**: Top frame only (`"all_frames": false`)
- **Execution Timing**: `"run_at": "document_idle"`

The detector performs the following:
1. Reads the site preference mode from storage (`chrome.storage.local` / settings cache).
2. If `mode === 'never'`, the script exits immediately.
3. If `mode === 'always'`, the script requests full conversion from the background engine.
4. If `mode === 'ask'` (the default):
   - It checks session suppression in `chrome.storage.session`. If suppressed, it exits.
   - It runs a dry-run candidate price count (`countCandidates()`) that strictly inspects text without modifying the DOM.
   - If candidate prices count $\ge \text{MIN\_PRICES}$ (where $\text{MIN\_PRICES} = 3$), the detector displays the Dynamic Island offer: `"Convert to USD?"` with `[Convert]` and `[Not now]`.
5. "Always convert on this site" becomes a stored user configuration in `chrome.storage`, rather than a runtime browser host permission grant.

## Rationale
- **Feasibility**: Resolves the architectural impossibility of invoking `chrome.permissions.request` from content scripts.
- **Privacy & Lightweight Execution**: The detector script is minimal and read-only. It performs a fast, non-mutating count of candidate prices only after the page reaches idle state.
- **On-Demand Engine Loading**: The full conversion engine (`content.js`, `scanner.js`, rates pipeline, full UI controls) is only loaded or executed after explicit user consent (clicking "Convert" on the offer) or on sites marked as `'always'`.
- **Top Frame Only**: Prevents duplicate detector runs, redundant pill mounts, or wasted CPU in embedded iframes and third-party widgets.

## Consequences
- **Install Warning**: Unchanged. The manifest already ships `<all_urls>` host permissions.
- **Privacy Policy & Documentation**: `README.md` and `PRIVACY_POLICY.md` must clearly state that the detector reads page text locally in memory solely to count candidate price patterns, and never transmits page content, URLs, or browsing history over the network.
- **Session Suppression**: User clicks on "Not now" must be recorded in `chrome.storage.session` so the offer is not repeatedly shown on subsequent page views within the same browser session.
- **Frame Isolation**: `all_frames: false` guarantees that nested ads, embeds, and iframes are ignored.
