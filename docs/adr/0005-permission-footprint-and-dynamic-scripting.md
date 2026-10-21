# 0005. Permission Footprint and Dynamic Scripting (v2.0.0)

Date: 2026-03-01
Status: Superseded in part by [0012](0012-static-all-sites-detector-content-script.md)

## Context
In early v2.0.0 planning, minimizing manifest permissions was desired to reduce user install warnings. The initial intent was to avoid declaring `<all_urls>` statically and instead request optional host permissions on a per-site basis when users toggled "Always convert on this site".

## Decision
In v2.0.0, the declared permissions were:
- Permissions: `["contextMenus", "notifications", "storage", "activeTab", "scripting", "tabs"]`
- Host Permissions: `<all_urls>` was included in build configuration for development and store testing.
- Manual conversions invoked `chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })`.
- Per-site auto-conversions attempted dynamic script registration via `chrome.scripting.registerContentScripts` or `chrome.tabs.onUpdated` injection.

## Rationale
- Allowed manual one-click page translation on active tabs.
- Deferred full engine execution until explicitly triggered.

## Consequences & Evolution
- Attempting dynamic permission grants from an in-page UI encountered browser security constraints because `chrome.permissions` is unavailable in content scripts.
- Superseded in part by ADR 0012 and ADR 0013, which introduce a lightweight static detector script while keeping DOM price mutation gated on user consent or 'always' mode (content.js is injected on demand to mount the canonical Dynamic Island offer pill).

