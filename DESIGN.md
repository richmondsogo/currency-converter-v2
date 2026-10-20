---
name: currency-convertr
version: 2.1.0
description: Ultra-clean editorial minimalism design system for Currency Convertr browser extension.
colors:
  bg-canvas: "#ffffff"
  bg-canvas-dark: "#0a0a0a"
  bg-surface: "#ffffff"
  bg-surface-dark: "#09090b"
  text-primary: "#111111"
  text-primary-dark: "#fafafa"
  text-secondary: "#888888"
  text-secondary-dark: "#a1a1aa"
  text-muted: "#a1a1aa"
  border-hairline: "rgba(0, 0, 0, 0.06)"
  border-hairline-dark: "rgba(255, 255, 255, 0.08)"
  island-bg: "#09090b"
  island-border: "rgba(255, 255, 255, 0.12)"
  status-emerald: "#10b981"
  status-muted: "#71717a"
typography:
  sans:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
  mono:
    fontFamily: "'Geist Mono', 'SF Mono', 'JetBrains Mono', ui-monospace, monospace"
  title:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "13.5px"
    lineHeight: "18px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: "18px"
    fontWeight: 400
  mono-code:
    fontFamily: "'Geist Mono', 'SF Mono', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "12px"
    lineHeight: "16px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  island-text:
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif"
    fontSize: "12px"
    lineHeight: "16px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  island-rate:
    fontFamily: "'Geist Mono', 'SF Mono', 'JetBrains Mono', ui-monospace, monospace"
    fontSize: "11.5px"
    lineHeight: "15px"
    fontWeight: 450
    letterSpacing: "-0.02em"
rounded:
  base: "4px"
  pill: "9999px"
spacing:
  section-gap: "28px"
  row-gap: "14px"
  item-gap: "8px"
---

# Design Philosophy & Technical UI/UX Specifications

> **Project**: Currency Convertr  
> **Version**: 2.1.0  
> **Aesthetic**: Ultra-Clean Editorial Minimalism  
> **Architecture**: Cross-Browser Web Extension (Manifest V3)

---

## Overview

Currency Convertr provides an unobtrusive, high-fidelity currency translation experience for web pages. Built with zero visual slop, the interface is inspired by high-end engineering portfolios and precision instrumentation: pure white and hardware OLED canvases, hairline vertical division, inline dual-tone typography, and an Apple-style Dynamic Island pill isolated via Shadow DOM.

---

## Colors

The palette is strictly restrained, avoiding decorative gradients, heavy borders, or saturated brand colors:

- **Canvas & Surfaces**:
  - Light mode: Pure `#FFFFFF` background.
  - Dark mode: Crisp `#0A0A0A` canvas; `#09090B` hardware OLED pill.
- **Ink & Contrast**:
  - Primary text: High-contrast near-black `#111111` (Light) / `#FAFAFA` (Dark).
  - Secondary metadata & labels: Neutral `#888888` (Light) / `#A1A1AA` (Dark).
  - Tertiary accents: `#71717A` (Inactive toggle/subdued glyphs).
  - Status indicator: `#10B981` (Emerald active conversion dot) / `#71717A` (Original state).
- **Hairline Dividers**:
  - Pure vertical whitespace (`24px–32px`) is preferred over borders.
  - When division is structurally required, use whisper-quiet `1px solid rgba(0, 0, 0, 0.06)` (Light) or `1px solid rgba(255, 255, 255, 0.08)` (Dark). Boxy card wrappers are strictly banned.

---

## Typography

Typography acts as the primary layout structure. Two font stacks govern all surfaces:

1. **System & Proportional Sans**:
   `--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;`
2. **Tabular Monospace**:
   `--font-mono: 'Geist Mono', 'SF Mono', 'JetBrains Mono', ui-monospace, monospace;`

### Global Typography Rules
- **Anti-aliasing**: Enforce `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;` on all root elements.
- **Font Features**: Apply `font-feature-settings: "cv02", "cv03", "cv04", "cv11", "tnum";` globally.
- **Numerical Figures**: Enforce `font-variant-numeric: tabular-nums; letter-spacing: -0.02em;` on every number, input, rate, count badge, and monetary string across popup, options, and in-page pill.
- **Inline Dual-Tone Hierarchy**: Primary labels and currency codes appear in `#111111` (`font-weight: 500` or `600`) paired directly on the exact same baseline with muted `#888888` (`font-weight: 400`) secondary text.

---

## Layout

- **Popup Surface (`src/popup/`)**:
  - `310px` fixed width, `20px` padding, zero outer container cards, zero scrollbars.
  - Top bar: Title `13.5px` (`font-weight: 600`) on left; hardware toggle switch (`32px × 18px`) on right.
  - Typographic converter row: Instant numerical conversion input with tabular figures, `--font-mono` currency codes, and clean select trigger.
  - Page status & actions: Inline tab summary, 1-click "Revert page" / "Convert page" text link (`#111111` with subtle glyph), rates freshness timestamp in `#A1A1AA`, and link to Options.
- **Options Page (`src/options/`)**:
  - Single-column editorial layout (`max-width: 540px`, centered with generous top/bottom breathing room).
  - No boxy nested cards. Clean typographic rows with left-aligned setting name (`13.5px`, `#111111`) + description (`13px`, `#888888`), paired with right-aligned minimalist controls.
- **Dynamic Island (`src/content/ui.js`)**:
  - Fixed top-center (`top: 14px; left: 50%; transform: translate3d(-50%, 0, 0)`).
  - High z-index (`2147483647`), mounted strictly inside an open Shadow DOM root (`#cc-dynamic-island-host`).

---

## Elevation & Depth

- Surfaces rest flat on the canvas. No drop shadows on resting buttons, inputs, or content blocks.
- **Dynamic Island Specular Elevation**:
  - Hardware OLED black `#09090B` capsule with specular hairline border: `1px solid rgba(255, 255, 255, 0.12)`.
  - Floating depth shadow: `0 10px 28px -6px rgba(0, 0, 0, 0.45), 0 2px 6px -1px rgba(0, 0, 0, 0.25)`.
  - Zero heavy `backdrop-filter: blur()` to eliminate GPU repaint jank on heavy e-commerce websites.

---

## Shapes

- Inputs and controls: Clean `4px` subtle radius (`--radius-base: 4px`) or hairline underlines.
- Dynamic Island capsule and segmented toggle buttons: Fully rounded pill shape (`border-radius: 9999px`).
- Monochrome hardware toggle switches: `32px × 18px` track with circular `14px` knob.

---

## Components

### 1. Dynamic Island Capsule (`src/content/ui.js`)
- **State Machine**:
  - `HIDDEN`: `opacity: 0; transform: translate3d(-50%, -14px, 0) scale(0.92); pointer-events: none;`. Does not render or mount if converted count is 0.
  - `COMPACT`: `30px` height, `0 12px` padding. Displays `6px` status dot (`#10B981` converted / `#71717A` original), currency pair (`EUR → USD`), and tabular count (`· 14`). Auto-collapses/fades after `3.5s` idle time.
  - `EXPANDED` (on hover/focus): Morphs horizontally (`scale(1.015)`) via compositor properties to reveal live exchange rate (`1 EUR = 1.08 USD` in `--font-mono`), tactile pill toggle (`Original` / `Converted`), and quiet `×` dismiss button.
- **Motion Timing**: Single transition on `transform`, `opacity`, and CSS Grid fractional tracks (`cubic-bezier(0.22, 1, 0.36, 1)`, `360ms`). Fallback to immediate transition under `@media (prefers-reduced-motion: reduce)`.

### 2. Typographic Interactive Converter (`src/popup/`)
- Amount input styled as high-contrast borderless or hairline-underlined numeral field.
- Instant conversion without page reload or submit buttons.
- Currency selection dropdown with clean keyboard navigation.

### 3. Setting Rows (`src/options/`)
- Single horizontal baseline alignment.
- Minimal controls: monochrome switches, subtle selects, and quiet text links.

---

## Do's and Don'ts

### Do
- Use whitespace as primary divider between setting groups.
- Enforce `font-variant-numeric: tabular-nums; letter-spacing: -0.02em;` on all figures and prices.
- Use Shadow DOM isolation with `:host { all: initial; }` to protect in-page elements.
- Immediately bail out of conversions when source currency equals target currency.
- Keep popup and options completely usable via keyboard (Tab, Enter, Escape, Arrow keys).

### Don't
- Never use decorative cards-inside-cards or saturated gradient backgrounds.
- Never use heavy `backdrop-filter: blur()` on morphing elements.
- Never use `requestAnimationFrame` polling loops for in-page animations.
- Never use `innerHTML` anywhere in extension code.
- Never convert prices or display the Dynamic Island pill when converted count is 0.
