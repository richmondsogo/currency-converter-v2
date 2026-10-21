# 0002. In-Page UI and CSS Isolation

Date: 2026-03-01
Status: Accepted

## Context
When injecting an in-page toolbar or floating UI (such as the Dynamic Island pill and price tooltips) into arbitrary third-party websites, the UI is vulnerable to host-page CSS resets, aggressive styling rules, `!important` declarations, and font overrides. Conversely, extension styles can inadvertently leak into the host page.

## Decision
Isolate the Dynamic Island floating bar and custom price tooltips inside an open Shadow DOM attached to a custom container element (`<div id="cc-dynamic-island-host" data-cc-ignore="true">`).
In-page styles (`ui.css`) are injected directly into the Shadow Root via a `<style>` element.

## Rationale
- Style Encapsulation: Host page CSS cannot alter the internal components of the Dynamic Island capsule.
- Anti-pollution: Extension classes (e.g. `.cc-dynamic-island`, `.cc-status-dot`) cannot collide with host page CSS selectors.
- Open Mode: Open Shadow DOM allows debugging and unit testing in simulated DOM environments (`JSDOM`) without compromising style isolation.

## Consequences
- Requires CSS to be bundled or inlined into the shadow root during mount.
- Global inherited CSS properties are neutralized using `:host { all: initial; }`.
