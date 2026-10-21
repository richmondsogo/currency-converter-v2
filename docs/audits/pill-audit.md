# UI Audit: In-Page Dynamic Island Pill

Audit conducted under the `improve-ui` skill evaluating `src/content/ui.js` and `src/content/ui.css` against `DESIGN.md`. Strictly read-only; no source files modified.

---

## Design language
- **Audited surface**: In-Page Dynamic Island Capsule (`src/content/ui.js`, `src/content/ui.css`) mounted inside open Shadow DOM root (`#cc-dynamic-island-host`).
- **Design sources**: `DESIGN.md` (v2.1.0-draft / Ultra-Clean Editorial Minimalism design system).
- **Documented decisions**:
  - Hardware OLED black `#09090b` capsule with specular hairline border (`rgba(255, 255, 255, 0.12)`).
  - Floating depth shadow with zero `backdrop-filter: blur()`.
  - Tabular monospace numbers (`Geist Mono` / `SF Mono`, `font-variant-numeric: tabular-nums`).
  - Compositor-only motion on `transform` and `opacity` with zero layout reflow.
  - Compact height of `30px`, `0 12px` padding, and `6px` status dot.
- **Governing owners and consumers**: `InPageUI` class (`src/content/ui.js`), `ui.css` injected via Shadow DOM `<style>`.
- **Explicit exceptions**: None documented.

---

## Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
|---|---|---|---|---|---|
| 1 | Expansion animation animates CSS Grid tracks, causing layout recalculations rather than compositor-only transitions | `DESIGN.md` mandates compositor-only motion (`transform`, `opacity`) to eliminate layout thrashing. `src/content/ui.css` lines 122–132 uses `grid-template-columns: 0fr -> 1fr` transitioned over `280ms cubic-bezier(0.22, 1, 0.36, 1)`. | Refactor `.cc-island-expandable` and `.cc-island-expandable-content` to use GPU-promoted `transform: scaleX(...)` and `opacity` or `clip-path` masking to keep animation on compositor thread. | `src/content/ui.css` | High |
| 2 | Compact capsule height and horizontal padding exceed documented design token specifications | `DESIGN.md` line 153 specifies `COMPACT` state dimensions of `30px` height and `0 12px` padding. `src/content/ui.css` lines 42–43 specifies `height: 34px; padding: 0 14px;`. | Update `.cc-dynamic-island` resting dimensions to `height: 30px; padding: 0 12px;` to match DESIGN.md token. | `src/content/ui.css` | High |
| 3 | Status indicator dot diameter is oversized by 1px relative to design token contract | `DESIGN.md` line 153 explicitly specifies a `6px` status dot. `src/content/ui.css` lines 78–79 implements `width: 7px; height: 7px;`. | Adjust `.cc-status-dot` to `width: 6px; height: 6px;` to match the precision micro-scale of the capsule. | `src/content/ui.css` | High |

---

## Improve first
**Finding 1 (Compositor-only expansion motion)** is the highest leverage finding. While the capsule renders smoothly on simple pages, animating CSS grid column geometry forces recurring layout and paint passes on complex e-commerce pages with large DOM trees (e.g., Amazon, eBay, Jumia). Refactoring to compositor-promoted properties guarantees a rock-solid 60fps frame rate and eliminates layout jank. Scheduled for implementation in planned Step 06.
