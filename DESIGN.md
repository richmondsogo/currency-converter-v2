# Design Philosophy & Technical UI/UX Specifications

> **Project**: Currency Convertr  
> **Version**: 2.0.0 ("Google Translate for Prices")  
> **Architecture**: Cross-Browser Web Extension (Manifest V3)  
> **Design Tokens**: Zinc Neutral Scale, Shadcn / Modern Editorial Typography, Shadow DOM UI Isolation

---

## 1. Executive Design Principles

Currency Convertr v2.0.0 evolves from a contextual text converter to a full in-page translation experience inspired by Google Translate, adhering to four foundational tenets:

### 1.1 In-Place Harmony & Zero Page Distruption
Price conversion should feel native to the website you are browsing:
- **Preserved Geometry**: Converted numbers fit smoothly into host page typography and layout without causing layout shifts (CLS = 0).
- **Shadow DOM Isolation**: The in-page floating Translate bar and custom price tooltips live inside an isolated open Shadow DOM root (`#currency-convertr-root`). Host page stylesheets cannot bleed into extension UI, and extension styles cannot interfere with host page aesthetics.
- **Byte-for-Byte Reversibility**: Any converted page can be restored to its exact original state at the touch of a button.

### 1.2 Non-Intrusive, Calm Interfaces
- The in-page floating Translate pill attaches at the top center of the viewport with a subtle slide-down animation, respects dark mode, provides quick target currency adjustments, and is dismissible for the current browsing session.
- Tooltips only appear on intentional hover, displaying original amounts, source currencies, and the exact exchange rate used.

### 1.3 High-Precision Typography & Localized Formatting
- Monetary calculations adhere to standard ISO 4217 minor-unit conventions (e.g. 0 decimals for JPY/KRW/VND, 2 decimals for USD/EUR/GBP/NGN, 3 decimals for BHD/KWD/OMR).
- Tabular figures (`font-variant-numeric: tabular-nums`) are enforced on all monetary displays for numerical clarity.

### 1.4 Predictability & Accessibility
- Full WCAG AA contrast compliance across both Light and Dark themes.
- Comprehensive keyboard accessibility for all interactive controls (searchable combobox with Arrow navigation, Esc to close, Enter to select, explicit ARIA roles).

---

## 2. Design System & Token Foundation

The design system utilizes a curated Zinc palette, matching clean modern desktop software.

### 2.1 Palette Tokens

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--cc-bg-surface` | `#ffffff` | `#18181b` | Cards, popups, and dropdown containers |
| `--cc-bg-subtle` | `#f4f4f5` | `#27272a` | Pill displays, inputs, chip backgrounds |
| `--cc-border-subtle` | `#e4e4e7` | `#3f3f46` | Separators and input borders |
| `--cc-text-primary` | `#09090b` | `#fafafa` | Primary headings, titles, and price values |
| `--cc-text-secondary` | `#71717a` | `#a1a1aa` | Labels, metadata, and exchange rates |
| `--cc-accent-brand` | `#18181b` | `#fafafa` | Primary buttons and brand badges |
| `--cc-highlight-bg` | `rgba(37, 99, 235, 0.08)` | `rgba(96, 165, 250, 0.15)` | Converted price highlight background |
| `--cc-highlight-border` | `#3b82f6` | `#60a5fa` | Converted price underline accent |

---

## 3. Surface Specifications

### 3.1 Toolbar Action Popup (`src/popup/`)
- **Width**: Compact ~340px width.
- **Components**:
  - Brand header with `fx` badge and gear shortcut to Options.
  - From &rarr; To currency row featuring a searchable, keyboard-navigable dropdown combobox grouped by "Pinned", "Recent", and "All currencies".
  - Large primary action button: "Convert this page" &harr; "Show original".
  - Live status indicator (e.g. `✓ 14 prices converted · Rates: ECB Reference, updated today`).
  - Per-site toggles: "Always convert on this site" and "Never convert on this site".
  - Domain currency override selector (assumes site-specific currency if auto-detection is ambiguous).
  - Footer with live rate status, retry button on error, and deep link to Options.

### 3.2 In-Page Translate Floating Bar (`src/content/ui.js` & `ui.css`)
- **Container**: `position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2147483647;`.
- **Form Factor**: Curved pill bar (`border-radius: 9999px`) with soft drop-shadow (`box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1)`).
- **Controls**:
  - Extension brand mark (`fx`).
  - Active target currency badge.
  - "Show original" button.
  - Quick target currency switcher `<select>`.
  - Dismiss button (`✕`), which closes the bar for that tab session without reverting prices.

### 3.3 Hover Tooltip
- Appears when hovering over any converted price.
- Displays:
  - Original price and currency: `Original: $3,499.00 USD`.
  - Calculated rate: `Rate: 1 USD = 1,650.00 NGN · ECB Reference`.
- Styled as a dark floating card with an indicator caret, automatically positioned above the target element.

### 3.4 Right-Click Context Menu (Selection)
- Preserves the right-click selection conversion flow from v1.
- Provides submenus for the user's top pinned currencies (default: NGN, USD, EUR, GBP, JPY, CAD, AUD, INR; customizable in Options).
- Outputs results via native operating system desktop notifications.

### 3.5 Options Dashboard (`src/options/`)
- Clean full-page options dashboard allowing customization of:
  - Default target currency.
  - Pinned currency chips (add/remove up to 8).
  - In-place display mode (`Replace`, `Append`, `Replace + Highlight`).
  - Decimal rounding preference (currency minor units vs. round to whole numbers).
  - Ambiguous `$` resolution preference (default: USD).
  - Cryptocurrency visibility toggle.
  - Per-site conversion rules management table.
  - JSON configuration export and import.

---

## 4. Verification & QA Protocol

Prior to production release:
1. Confirm popup and in-page bar render correctly in both light mode and dark mode (`prefers-color-scheme: dark`).
2. Verify that high-contrast focus rings (`outline: 2px solid #2563eb`) are visible during keyboard tab navigation.
3. Verify that the in-page bar and tooltips never shift host page elements or introduce horizontal scrollbars.
4. Verify that `web-ext lint` completes with zero errors, notices, or warnings.
