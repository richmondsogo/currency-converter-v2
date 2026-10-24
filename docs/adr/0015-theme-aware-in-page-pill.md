# 0015. Theme-Aware In-Page Dynamic Island Pill (Paper & Pine Tokens)

Date: 2026-10-24
Status: Accepted (Supersedes the fixed OLED dark capsule rule in ADR 0002, ADR 0013, and ADR 0014)

## Context
Earlier architecture decisions (ADR 0002, ADR 0013, ADR 0014) and `DESIGN.md` §7 specified that the in-page Dynamic Island pill (`src/content/ui.js` / `src/content/ui.css`) should render as a fixed hardware OLED black capsule (`#09090b` surface, `#fafafa` text, `#10b981` emerald status dot) regardless of the user's extension theme preference (`system` | `light` | `dark`).

In practice, two issues surfaced during owner review:
1. **Visual disconnect across extension surfaces**: After the Options page (Step 07) and Toolbar Popup (Step 08) adopted the warm **Paper & Pine** palette (`#F7F5F0` / `#191815` light, `#10100E` / `#ECE9E2` dark, `#1E6B52` / `#6FD3A6` pine accents), the cold zinc/OLED black capsule and `#10b981` emerald dot clashed with the rest of the product and ignored explicit Light / Dark theme selections.
2. **Dead theme plumbing in the content script**: Although `InPageUI._applyTheme()` set `data-theme="light|dark"` on `.cc-island-container`, `ui.css` and `INLINE_UI_CSS` contained zero `[data-theme]` or `@media (prefers-color-scheme: dark)` rules—every color was hard-coded. Furthermore, `src/content/content.js` initialized `currentSettings = null` and only updated it on `storage.onChanged`, so the first mount always passed `theme: 'system'` even when the user had explicitly saved `'light'` or `'dark'`.

## Decision
1. **Paper & Pine Theme Tokens Scoped to `.cc-island-container`**:
   - Define `--cc-surface`, `--cc-surface-solid`, `--cc-raised`, `--cc-hairline`, `--cc-text`, `--cc-muted`, `--cc-accent`, `--cc-accent-fg`, and `--cc-ring` on `.cc-island-container` with Paper (light) as the default.
   - Apply Warm Night (dark) tokens in two selectors:
     - `@media (prefers-color-scheme: dark) { .cc-island-container:not([data-theme="light"]) { ... } }` for `system` mode on a dark OS while guaranteeing an explicit `light` choice always wins.
     - `.cc-island-container[data-theme="dark"] { ... }` for explicit `dark` mode on any OS.
   - Set `color-scheme: light` / `color-scheme: dark` on `.cc-island-container` so the native `<select>` currency dropdown popup matches the active pill theme without `!important` color hacks.
2. **Pre-Mount Theme Resolution in Content Script**:
   - Load the saved `theme` setting via `MSG.GET_SETTINGS` (`ensurePillTheme()` in `src/content/content.js`) with a bounded timeout before mounting `InPageUI` for the first time, and keep it synchronized via `chrome.storage.onChanged`.
   - If the background query fails or times out, fall back gracefully to `'system'`.
3. **Accessibility & Material Fallbacks**:
   - Use translucent Paper & Pine surfaces (`rgba(247, 245, 240, 0.86)` light / `rgba(24, 24, 22, 0.86)` dark) with `backdrop-filter: blur(18px) saturate(160%)` for the floating capsule, and solid `--cc-surface-solid` (`#F7F5F0` / `#181816`) for the hover tooltip.
   - Honor `@media (prefers-reduced-transparency: reduce)`, `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))`, and `@media (prefers-contrast: more)` by switching the capsule to opaque `--cc-surface-solid` and higher-contrast borders.
   - Verify WCAG AA contrast ($\ge 4.5:1$ for text, $\ge 3:1$ for the status dot) against the solid surface in both themes via automated tests (`tests/pill_theme.test.js`).
4. **Enforced CSS Synchronization**:
   - Guard `src/content/ui.css` and `INLINE_UI_CSS` in `src/content/ui.js` with an automated unit test (`tests/pill_theme.test.js`) asserting normalized equality and forbidding raw OLED/zinc/emerald hex literals outside the token blocks.
5. **Preserved Vanilla & Privacy Boundaries**:
   - The in-page pill remains 100% vanilla JavaScript inside an open Shadow DOM (`#cc-dynamic-island-host`), uses zero `innerHTML`, and strictly uses the host system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif` and `ui-monospace`) so no extension font files are exposed via `web_accessible_resources`.

## Rationale
- Scoping CSS custom properties to `.cc-island-container` inside the Shadow DOM isolates all theme state from the host page while allowing instant, zero-reflow theme switching when the user toggles Light / Dark / System in Options.
- Using `:not([data-theme="light"])` inside `@media (prefers-color-scheme: dark)` mirrors the pattern proven in `src/ui/globals.css` (Step 10), preventing OS dark mode from overriding an explicit Light setting.
- Evaluating WCAG AA contrast against `--cc-surface-solid` guarantees legibility both when `backdrop-filter` is active and when reduced-transparency fallbacks apply.

## Consequences
- **Positive**:
  - Cohesive Paper & Pine visual identity across Options, Popup, and the in-page Dynamic Island pill.
  - First paint of the in-page pill respects explicit Light, Dark, and System preferences without a dark-to-light flash.
  - Automated unit and real-Chromium E2E tests (`tests/pill_theme.test.js`, `tests/e2e/f1-pill-theme.e2e.js`) prevent CSS drift and theme regressions.
- **Negative / Risks**:
  - Translucent surfaces over arbitrary host pages depend on `backdrop-filter` blur and hairline borders for separation; solid surface fallbacks cover reduced-transparency and high-contrast modes.
- **Compliance & Privacy**:
  - Zero `innerHTML` and zero `web_accessible_resources` font exposure are preserved in full.
