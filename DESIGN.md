# Design Philosophy and Technical UX Specifications

> **Project**: Currency Converter  
> **Architecture**: Browser Extension (Manifest V3)  
> **Audience**: Developers, Contributors, and UI Reviewers

---

## 1. Executive Design Principles

Currency Converter adheres to an intentional, restrained design philosophy centered around five core tenets:

### 1.1 Zero-DOM Overhead ("Invisible UI")
Most browser extensions introduce visual friction by injecting heavy DOM elements, floating buttons, or unstyled tooltips into target web pages. This degrades host website layout stability, triggers Content Security Policy (CSP) conflicts, and creates visual distraction.

Currency Converter operates on an **Invisible UI** model:
- **No Injected Nodes**: Zero modification of the host webpage's DOM.
- **Native Context Delivery**: Interaction takes place entirely within the browser's native context menu.
- **System Notification Presentation**: Results appear via native operating system desktop notifications, maintaining visual harmony with the host OS.

### 1.2 Calm and Non-Intrusive
Interfaces should serve the user without demanding ongoing attention. The extension produces visual output only when explicitly invoked by user action and dismisses automatically according to operating system notification timeouts.

### 1.3 Precision in Formatting
Monetary figures require exact formatting. Ambiguity between thousands grouping and decimal separators leads to financial miscalculation. The extension enforces unambiguous formatting via `Intl.NumberFormat` localized for standard financial clarity.

### 1.4 Predictability Over Novelty
Familiarity builds user trust. The context menu structure mirrors standard operating system submenu conventions, ordering target currencies logically and displaying unambiguous currency labels.

---

## 2. Visual Language and Iconography

### 2.1 Brand Glyph
The extension utilizes a high-contrast, dark-mode foundational glyph (`fx`, representing Foreign Exchange):
- **Base Surface**: Solid zinc dark fill (`#18181b`).
- **Foreground Glyph**: High-contrast off-white (`#fafafa`).
- **Corner Curvature**: Continuous 22% squircle radius relative to icon dimensions.
- **Typeface**: System-native grotesque sans-serif (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`).

### 2.2 Icon DPI Scaling Matrix
Icons are generated and rasterized across four standard web extension densities:

| Asset | Dimension | Target Context |
|---|---|---|
| `icon16.png` | 16 &times; 16 px | Browser context menu, extension toolbar sub-indicator |
| `icon48.png` | 48 &times; 48 px | Extension management page (`chrome://extensions`) |
| `icon96.png` | 96 &times; 96 px | High-DPI / Retina extension displays |
| `icon128.png` | 128 &times; 128 px | Chrome Web Store showcase and installation modal |

---

## 3. Context Menu Interaction Model

### 3.1 Trigger Context
The context menu registration is scoped strictly to:
```javascript
contexts: ["selection"]
```
This guarantees the extension never appears in the right-click menu unless the user has actively selected text, eliminating right-click menu bloat during general web browsing.

### 3.2 Menu Structure
```text
Convert currency (Parent Menu Item)
├── To NGN (Nigerian Naira)
├── To USD (US Dollar)
├── To EUR (Euro)
├── To GBP (British Pound)
├── To JPY (Japanese Yen)
├── To CAD (Canadian Dollar)
├── To AUD (Australian Dollar)
└── To INR (Indian Rupee)
```

Target selections are ordered based on regional liquidity and common international conversion demand.

---

## 4. Output Formatting Specifications

Desktop notification outputs follow a standardized, two-line financial summary pattern:

### 4.1 Structure
```text
[Formatted Input Amount] [Source ISO] = [Formatted Output Amount] [Target ISO]
Rate: 1 [Source ISO] = [Formatted Unit Rate] [Target ISO]
```

### 4.2 Formatting Implementation
```javascript
const fmt = (n, cur) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n) + " " + cur;
```

### 4.3 Examples
- Standard Dot-Decimal:  
  `1,299.99 USD = 1,159.59 EUR`  
  `Rate: 1 USD = 0.89 EUR`
- Emerging Market / Regional:  
  `100.00 USD = 132,987.05 NGN`  
  `Rate: 1 USD = 1,329.87 NGN`

---

## 5. Error State Feedback

Error messages must be actionable, concise, and informative:

| Failure Scenario | Notification Title | Notification Body |
|---|---|---|
| **Empty Selection** | `Currency Converter` | `No text selected. Highlight a price and try again.` |
| **No Parseable Digits** | `Currency Converter` | `No valid numeric price found in "[Truncated Selection]".` |
| **Network or Rate Failure** | `Currency Converter` | `Unable to convert [FROM] to [TO]. Verify network connection.` |

---

## 6. Verification and Design QA

Any modifications to visual assets, notifications, or parsing logic must be verified in active browser runtimes prior to release:
1. Verify context menu display on highlighted DOM text across both dark and light web themes.
2. Verify native notification presentation in Windows Action Center / macOS Notification Center / Linux desktop environments.
3. Validate icon crispness at 100%, 125%, 150%, and 200% OS display scaling.
