---
name: currency-convertr
version: 2.1.0-draft
description: Paper & Pine design system for Currency Convertr browser extension.
palette:
  light:
    background: "#F7F5F0"
    raised: "#EFECE5"
    hairline: "#E2DED4"
    text: "#191815"
    muted: "#67635A"
    accent: "#1E6B52"
    warning: "#A15C07"
    danger: "#B3261E"
  dark:
    background: "#10100E"
    raised: "#181816"
    hairline: "#2A2926"
    text: "#ECE9E2"
    muted: "#9B968B"
    accent: "#6FD3A6"
    warning: "#E5A038"
    danger: "#E87068"
typography:
  ui-text:
    fontFamily: "'Familjen Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    weights: [400, 500, 600, 700]
  mono:
    fontFamily: "'Fragment Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    weights: [400]
  pill-text:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    weights: [400, 500, 600]
scales:
  type: [12, 13, 14, 16, 22]
  spacing: [4, 8, 12, 16, 24, 32, 48]
  radius: "8px"
  hairline: "1px"
motion:
  duration: "150ms"
  easing: "ease-out"
---

# Design Philosophy & Technical UI/UX Specifications

> **Project**: Currency Convertr  
> **Version**: 2.1.0-draft  
> **Aesthetic**: Paper & Pine — Warm Editorial Minimalism  
> **Architecture**: Cross-Browser Web Extension (Manifest V3)  

---

## 1. Overview

Currency Convertr provides an unobtrusive, high-fidelity currency translation experience for web pages. Inspired by tactile archival stationery and precision instrumentation, the visual language departs entirely from sterile, cold zinc greys in favor of the **"Paper & Pine"** design system:
- **Warm, tactile surfaces**: Natural paper canvases (`#F7F5F0` light, `#10100E` dark).
- **Hairline structural division**: Whisper-quiet 1px borders (`#E2DED4` light, `#2A2926` dark).
- **Ink-based hierarchy**: High-contrast near-black typography and ink primary actions.
- **Deep evergreen accents**: Pine green (`#1E6B52`) in light and mint pine (`#6FD3A6`) in dark for on-states, links, and converted statuses.
- **Dedicated extension pages (Options and Popup)**: Built on React + Tailwind + shadcn/ui.
- **In-page Dynamic Island pill**: Isolated inside an open Shadow DOM, styled in hardware OLED black using the host system font stack.

---

## 2. Palette: Paper & Pine

The color system avoids cold blue/zinc tones. Every text/background pair is verified to achieve WCAG 2.1 AA (contrast ratio $\ge 4.5:1$) or AAA:

### Light Theme (Paper Canvas)
- **Background (`#F7F5F0`)**: Warm, unbleached paper tone.
- **Raised / Hover (`#EFECE5`)**: Subtle elevated surface for hover states, select menus, and active indicators.
- **Hairline Divider (`#E2DED4`)**: 1px structural separation.
- **Text / Foreground (`#191815`)**: Deep natural ink (**16.3:1** contrast on background, **15.0:1** on raised).
- **Muted Metadata (`#67635A`)**: Secondary descriptions and helper labels (**5.5:1** contrast on background, **5.1:1** on raised).
- **Accent Pine (`#1E6B52`)**: Reserved for active on-states, switches, sidebar indicator, links, focus ring at ~40% alpha, and converted currency green (**5.9:1** contrast on background).
- **Warning Amber (`#A15C07`)**: Warnings, stale rate indicators, rate warnings (**4.8:1** contrast).
- **Danger Crimson (`#B3261E`)**: Destructive actions, rate fetch errors (**6.0:1** contrast).

### Dark Theme (Warm Night Canvas)
- **Background (`#10100E`)**: Warm obsidian tone (not cold blue/grey).
- **Raised / Hover (`#181816`)**: Subtle warm elevation for menus, popovers, and hover states.
- **Hairline Divider (`#2A2926`)**: 1px structural boundary.
- **Text / Foreground (`#ECE9E2`)**: Soft warm off-white ink (**15.7:1** contrast on background, **14.5:1** on raised).
- **Muted Metadata (`#9B968B`)**: Secondary metadata (**6.5:1** contrast on background, **6.0:1** on raised).
- **Accent Mint Pine (`#6FD3A6`)**: Luminous mint pine for active on-states, switches, sidebar indicators, and converted green (**10.5:1** contrast).
- **Warning Amber (`#E5A038`)**: Warm golden amber (**8.5:1** contrast on background, **8.0:1** on raised).
- **Danger Coral (`#E87068`)**: Warm muted crimson (**6.3:1** contrast on background, **5.9:1** on raised).

### Semantic Button Rules
- **Primary Buttons**: Use **ink** — text color as background (`#191815` with `#F7F5F0` text in light; `#ECE9E2` with `#10100E` text in dark).
- **Secondary / Ghost Buttons**: Use raised surface on hover (`#EFECE5` in light, `#181816` in dark).
- **Destructive Buttons**: Use danger color (`#B3261E` in light, `#E87068` in dark).
- **Accent**: Strictly reserved for on-states (switch checked, active sidebar indicator, links, focus ring at ~40% alpha) and the "converted" green. Never used as a generic card fill or secondary button background.

---

## 3. Typography

All typography is bundled locally within the extension package (WOFF2 format via `@fontsource`). Remote font requests and CDNs are strictly prohibited under Manifest V3 CSP.

1. **UI Sans-Serif**:
   `--font-sans: "Familjen Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;`
   - Weights: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold).
   - Used across all extension pages (Options, Popup, Gallery) for titles, headings, setting labels, button labels, and descriptions.
2. **Tabular Monospace**:
   `--font-mono: "Fragment Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;`
   - Weight: 400 (Regular).
   - Used for exchange rates, hostnames, currency codes, price numerals, and timestamps.
3. **In-Page Floating Pill**:
   `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;`
   - Kept strictly to the **system font stack**.
   - *Rationale*: Injected content scripts cannot load extension custom web fonts into host pages without exposing extension resources via `web_accessible_resources`, which leaks extension fingerprinting to third-party web trackers.

### Type Scale & Leading
- **12px / 18px (`text-xs`)**: Timestamps, small currency codes, rate providers, badge counts.
- **13px / 20px (`text-sm`)**: Secondary descriptions, helper text, table captions.
- **14px / 22px (`text-base`)**: Setting labels, body text, form inputs, button labels.
- **16px / 24px (`text-md`)**: Section headings, popup titles, modal headings.
- **22px / 30px (`text-xl`)**: Page headers, large amount displays.

### Typographic Rules
- **Tabular Numerals**: Apply `font-variant-numeric: tabular-nums; letter-spacing: -0.02em;` on every number, rate, input, badge count, and price string across all surfaces.
- **Anti-aliasing**: Apply `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;` globally.
- **Font Features**: Apply `font-feature-settings: "cv02", "cv03", "cv04", "cv11", "tnum";` on proportional UI text.

---

## 4. Spacing, Shapes & Hairlines

- **Spacing Scale (4px Base)**:
  - `4px` (`space-1`), `8px` (`space-2`), `12px` (`space-3`), `16px` (`space-4`), `24px` (`space-6`), `32px` (`space-8`), `48px` (`space-12`).
- **Radii**:
  - Controls, inputs, buttons, combobox popovers: **8px** (`--radius: 8px`).
  - Segmented toggle controls and capsules: **9999px pill** (`rounded-pill`).
- **Hairlines**:
  - Pure 1px hairlines (`#E2DED4` light, `#2A2926` dark).
- **The NO-CARD Rule**:
  - Boxy cards, nested cards, and drop-shadow containers are **strictly banned** on extension pages.
  - Sections are separated purely by generous vertical whitespace (`24px–32px`), typographic hierarchy, and subtle 1px hairlines.

---

## 5. Motion & Performance

- **Timing**: 150ms duration with `ease-out` timing function (`transition: all 150ms ease-out`).
- **Properties**: Transitions are strictly restricted to compositor properties (`opacity`, `transform`).
- **Layout Thrashing**: Never animate width, height, margin, padding, or `grid-template-columns`.
- **Accessibility**: Honor `prefers-reduced-motion: reduce` by zeroing transition durations (`transition-duration: 0.01ms !important`).

---

## 6. Page Layout Targets (Step 07 & 08 Specifications)

### Options Page Layout Target (`src/options/`)
- **Structure**: Two-column layout with a fixed **~220px sidebar navigation** on the left and a **~640px settings column** on the right.
- **Sidebar**:
  - Navigation items with 8px radius, icon + label.
  - Active indicator uses Paper & Pine accent (`#1E6B52` / `#6FD3A6`).
  - Theme switcher and version build stamp in sidebar footer.
- **Settings Rows**:
  - Left: Setting label (`14px font-medium`) + one-line description (`13px text-muted`).
  - Right: Minimalist control (switch, combobox, input, or toggle-group).
- **Per-Site Rules List**:
  - Each rule row displays hostname (`font-mono 13px`), assumed currency badge, and a **three-way segmented control** (`Ask` / `Always` / `Never`).
  - "Add site" row with inline domain input and behavior selector.

### Toolbar Popup Layout Target (`src/popup/`)
- **Width**: `320px` fixed width, `16px` padding, zero outer container cards, zero scrollbars.
- **Header**: Extension title (`14px font-medium`) with direct link to Options.
- **Site Rule Row**: Three-way segmented control (`Ask` / `Always` / `Never`) for the active domain.
- **Typographic Converter Row**: Numeric amount input, tabular numbers, searchable currency combobox.
- **Actions**: Instant conversion status, 1-click "Convert page" / "Show original", live rates timestamp.

---

## 7. Dynamic Island Capsule (`src/content/ui.js`)

The in-page floating pill operates inside an open Shadow DOM root (`#cc-dynamic-island-host`) and remains pure vanilla JavaScript with zero framework dependencies.

- **Placement**: Fixed top-center (`top: 14px; left: 50%; transform: translate3d(-50%, 0, 0)`), `z-index: 2147483647`.
- **Styling**: Hardware OLED black capsule (`#09090B`) with specular hairline border (`1px solid rgba(255, 255, 255, 0.12)`) and floating elevation shadow (`0 10px 28px -6px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.25)`).
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`). Does not load extension fonts to eliminate host-page tracking exposure.
- **State Machine**:
  - `HIDDEN / UNMOUNTED`: Not rendered on pages without detected prices.
  - `OFFER`: Initial prompt on unconfigured sites with foreign prices (`"Convert to USD?"` with `[Convert]` and `[Not now]`). Never auto-hides on a timer. Scoped Escape key dismisses within shadow root.
  - `WORKING`: Pulsating neutral dot + `"Converting..."`.
  - `CONVERTED`: Active resting state. Status dot `#10B981` (emerald green strictly reserved for active conversions), currency pair (`EUR → USD`), and price count. Expands on hover/focus to reveal rates, `Original`/`Converted` pill toggle, and currency picker.
  - `ORIGINAL`: Neutral dot + `"Showing original prices"`. Allows 1-click toggle back to `[Converted]`.
  - `NOTHING_FOUND`: Manual triggers with 0 prices. Dismisses after 4.0s.
  - `ERROR`: Amber dot + failure reason.

---

## 8. Do's and Don'ts

### Do
- Use the Paper & Pine palette for all extension UI surfaces.
- Use ink for primary buttons and reserve Pine accent for on-states, switches, and converted indicators.
- Enforce `font-variant-numeric: tabular-nums; letter-spacing: -0.02em;` on all numbers, rates, and prices.
- Construct all DOM elements using native APIs or safe React JSX (zero `innerHTML` / `dangerouslySetInnerHTML`).
- Honor `prefers-reduced-motion: reduce`.
- Maintain contrast ratio $\ge 4.5:1$ on every text/background pair.

### Don't
- Never use cold zinc/slate greys.
- Never use decorative cards-inside-cards or drop-shadow boxes on settings pages.
- Never use remote fonts, Google Fonts CDN, or external style links.
- Never use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `dangerouslySetInnerHTML`.
- Never inject React or extension fonts into third-party host web pages. The in-page pill must remain vanilla JS with system fonts.
