// src/content/ui.js
import { getAllCurrencies } from '../shared/currencies.js';
import { formatCurrency } from '../shared/format.js';

export const INLINE_UI_CSS = `
/* src/content/ui.css - Theme-aware Dynamic Island capsule (Paper & Pine) */
/* NOTE: keep in sync with INLINE_UI_CSS in src/content/ui.js (guarded by tests/pill_theme.test.js). */

:host {
  all: initial;
  display: block;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
  z-index: 2147483647;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Theme tokens: Paper & Pine light is the default. */
.cc-island-container {
  color-scheme: light;
  --cc-surface: rgba(247, 245, 240, 0.86);
  --cc-surface-solid: #F7F5F0;
  --cc-raised: #EFECE5;
  --cc-hairline: #E2DED4;
  --cc-text: #191815;
  --cc-muted: #67635A;
  --cc-accent: #1E6B52;
  --cc-accent-fg: #FFFFFF;
  --cc-ring: rgba(30, 107, 82, 0.4);
  --cc-highlight: rgba(255, 255, 255, 0.7);
  --cc-glow: none;
  --cc-shadow: 0 10px 28px -8px rgba(25, 24, 21, 0.22), 0 2px 6px -1px rgba(25, 24, 21, 0.1);
  --cc-shadow-lift: 0 14px 34px -8px rgba(25, 24, 21, 0.28), 0 4px 10px -1px rgba(25, 24, 21, 0.12);
}

/* System theme on a dark OS (an explicit light setting always wins). */
@media (prefers-color-scheme: dark) {
  .cc-island-container:not([data-theme="light"]) {
    color-scheme: dark;
    --cc-surface: rgba(24, 24, 22, 0.86);
    --cc-surface-solid: #181816;
    --cc-raised: #10100E;
    --cc-hairline: #2A2926;
    --cc-text: #ECE9E2;
    --cc-muted: #9B968B;
    --cc-accent: #6FD3A6;
    --cc-accent-fg: #10100E;
    --cc-ring: rgba(111, 211, 166, 0.4);
    --cc-highlight: rgba(255, 255, 255, 0.06);
    --cc-glow: 0 0 8px rgba(111, 211, 166, 0.5);
    --cc-shadow: 0 10px 28px -8px rgba(0, 0, 0, 0.6), 0 2px 6px -1px rgba(0, 0, 0, 0.35);
    --cc-shadow-lift: 0 14px 34px -8px rgba(0, 0, 0, 0.7), 0 4px 10px -1px rgba(0, 0, 0, 0.4);
  }
}

/* Explicit dark setting. */
.cc-island-container[data-theme="dark"] {
  color-scheme: dark;
  --cc-surface: rgba(24, 24, 22, 0.86);
  --cc-surface-solid: #181816;
  --cc-raised: #10100E;
  --cc-hairline: #2A2926;
  --cc-text: #ECE9E2;
  --cc-muted: #9B968B;
  --cc-accent: #6FD3A6;
  --cc-accent-fg: #10100E;
  --cc-ring: rgba(111, 211, 166, 0.4);
  --cc-highlight: rgba(255, 255, 255, 0.06);
  --cc-glow: 0 0 8px rgba(111, 211, 166, 0.5);
  --cc-shadow: 0 10px 28px -8px rgba(0, 0, 0, 0.6), 0 2px 6px -1px rgba(0, 0, 0, 0.35);
  --cc-shadow-lift: 0 14px 34px -8px rgba(0, 0, 0, 0.7), 0 4px 10px -1px rgba(0, 0, 0, 0.4);
}

.cc-island-container {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  pointer-events: auto;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 2147483647;
  color: var(--cc-text);
}

/* 1. Dynamic Island capsule: a translucent Paper & Pine material */
.cc-dynamic-island {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 14px;
  background-color: var(--cc-surface);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  color: var(--cc-text);
  border-radius: 9999px;
  border: 1px solid var(--cc-hairline);
  box-shadow: inset 0 1px 0 var(--cc-highlight), var(--cc-shadow);
  cursor: default;
  overflow: hidden;
  will-change: transform, opacity;
  transform-origin: center top;
  transition:
    transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 150ms ease,
    opacity 200ms ease;
}

.cc-dynamic-island:hover,
.cc-dynamic-island:focus-within,
.cc-dynamic-island.cc-expanded {
  transform: scale(1.02);
  box-shadow: inset 0 1px 0 var(--cc-highlight), var(--cc-shadow-lift);
  border-color: var(--cc-muted);
}

/* Compact Inner Section */
.cc-island-compact {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

/* Status dot: pine accent while converted, muted when showing originals */
.cc-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--cc-accent);
  box-shadow: var(--cc-glow);
  flex-shrink: 0;
  transition: background-color 200ms ease, box-shadow 200ms ease;
}

.cc-status-dot.cc-status-inactive {
  background-color: var(--cc-muted);
  opacity: 0.6;
  box-shadow: none;
}

/* Currency Code & Conversion Pair */
.cc-currency-code {
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-text);
  letter-spacing: -0.01em;
}

.cc-count-sep {
  font-size: 12px;
  color: var(--cc-muted);
  user-select: none;
}

/* Count Badge */
.cc-count-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 500;
  color: var(--cc-text);
  background-color: var(--cc-raised);
  padding: 1px 6px;
  border-radius: 9999px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* Expandable Grid Track (0fr -> 1fr horizontal morph) */
.cc-island-expandable {
  display: grid;
  grid-template-columns: 0fr;
  transition: grid-template-columns 280ms cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
}

.cc-dynamic-island:hover .cc-island-expandable,
.cc-dynamic-island:focus-within .cc-island-expandable,
.cc-dynamic-island.cc-expanded .cc-island-expandable {
  grid-template-columns: 1fr;
}

.cc-island-expandable-content {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 10px;
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  white-space: nowrap;
}

.cc-dynamic-island:hover .cc-island-expandable-content,
.cc-dynamic-island:focus-within .cc-island-expandable-content,
.cc-dynamic-island.cc-expanded .cc-island-expandable-content {
  opacity: 1;
  transform: translateX(0);
}

/* Live Exchange Rate */
.cc-live-rate {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 400;
  color: var(--cc-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* Segmented control: [ Original | Converted ] (accent = on-state) */
.cc-segmented {
  display: inline-flex;
  align-items: center;
  background: var(--cc-raised);
  border-radius: 9999px;
  padding: 2px;
  gap: 2px;
}

.cc-segment-btn {
  background: transparent;
  border: none;
  border-radius: 9999px;
  padding: 2px 9px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--cc-muted);
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease;
  outline: none;
}

.cc-segment-btn:hover {
  color: var(--cc-text);
}

.cc-segment-btn.active {
  background: var(--cc-accent);
  color: var(--cc-accent-fg);
}

.cc-segment-btn:active {
  transform: scale(0.97);
}

.cc-segment-btn:focus-visible {
  outline: 2px solid var(--cc-accent);
  outline-offset: 2px;
}

/* Quick currency select inside the island */
.cc-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.cc-select {
  appearance: none;
  -webkit-appearance: none;
  background: var(--cc-raised);
  border: 1px solid var(--cc-hairline);
  color: var(--cc-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  height: 24px;
  padding: 0 18px 0 7px;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  transition: border-color 140ms ease;
}

.cc-select:hover {
  border-color: var(--cc-muted);
}

.cc-select:focus-visible {
  border-color: var(--cc-accent);
  box-shadow: 0 0 0 3px var(--cc-ring);
}

/* Native option list follows the theme (color-scheme handles the popup chrome) */
.cc-select option {
  background-color: var(--cc-surface-solid);
  color: var(--cc-text);
}

.cc-select-arrow {
  position: absolute;
  right: 6px;
  pointer-events: none;
  color: var(--cc-muted);
  display: flex;
  align-items: center;
}

/* Dismiss / Close Button */
.cc-dismiss-btn {
  background: transparent;
  border: none;
  color: var(--cc-muted);
  padding: 4px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, transform 140ms ease;
  outline: none;
}

.cc-dismiss-btn:hover {
  color: var(--cc-text);
  background-color: var(--cc-raised);
  transform: scale(1.1);
}

.cc-dismiss-btn:active {
  transform: scale(0.92);
}

.cc-dismiss-btn:focus-visible {
  outline: 2px solid var(--cc-accent);
  outline-offset: 1px;
}

/* Collapsed Mini Pill */
.cc-collapsed-pill {
  display: none;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background-color: var(--cc-surface);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  backdrop-filter: blur(18px) saturate(160%);
  color: var(--cc-text);
  border-radius: 9999px;
  border: 1px solid var(--cc-hairline);
  box-shadow: inset 0 1px 0 var(--cc-highlight), var(--cc-shadow);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  transition: transform 180ms ease, opacity 180ms ease;
}

.cc-collapsed-pill:hover {
  transform: scale(1.05);
  border-color: var(--cc-muted);
}

.cc-collapsed-pill:focus-visible {
  outline: 2px solid var(--cc-accent);
  outline-offset: 2px;
}

/* 2. Hover tooltip (solid surface: it overlays arbitrary page text) */
.cc-tooltip {
  position: fixed;
  display: none;
  flex-direction: column;
  background: var(--cc-surface-solid);
  border: 1px solid var(--cc-hairline);
  border-radius: 6px;
  padding: 6px 10px;
  color: var(--cc-text);
  font-size: 11.5px;
  box-shadow: var(--cc-shadow);
  pointer-events: none;
  z-index: 2147483647;
  max-width: 280px;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.cc-tooltip.visible {
  display: flex;
  opacity: 1;
  transform: translateY(0);
}

.cc-tooltip-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--cc-text);
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}

.cc-tooltip-sub {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10.5px;
  color: var(--cc-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.cc-tooltip-caret {
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--cc-surface-solid);
  border-right: 1px solid var(--cc-hairline);
  border-bottom: 1px solid var(--cc-hairline);
  transform: rotate(45deg);
  bottom: -4px;
  left: 50%;
  margin-left: -3px;
}

/* 3. Accessibility: transparency, contrast and motion preferences */
@media (prefers-reduced-transparency: reduce) {
  .cc-dynamic-island,
  .cc-collapsed-pill {
    background-color: var(--cc-surface-solid);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .cc-dynamic-island,
  .cc-collapsed-pill {
    background-color: var(--cc-surface-solid);
  }
}

@media (prefers-contrast: more) {
  .cc-dynamic-island,
  .cc-collapsed-pill,
  .cc-tooltip {
    background-color: var(--cc-surface-solid);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    border-color: var(--cc-muted);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cc-dynamic-island,
  .cc-island-expandable,
  .cc-island-expandable-content,
  .cc-collapsed-pill,
  .cc-tooltip {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
`;

function createSvg(doc, width, height, viewBox, strokeWidth, paths = [], circles = []) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  for (const c of circles) {
    const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    for (const [k, v] of Object.entries(c)) {
      circle.setAttribute(k, String(v));
    }
    svg.appendChild(circle);
  }

  for (const p of paths) {
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    for (const [k, v] of Object.entries(p)) {
      path.setAttribute(k, String(v));
    }
    svg.appendChild(path);
  }

  return svg;
}

export class InPageUI {
  constructor({
    doc = (typeof document !== 'undefined' ? document : null),
    targetCurrency = 'USD',
    sourceCurrency = null,
    isConverted = true,
    convertedCount = 0,
    rateDate = null,
    provider = null,
    theme = 'system',
    onShowOriginal = null,
    onConvert = null,
    onChangeCurrency = null,
    onDismiss = null
  } = {}) {
    this.doc = doc;
    this.targetCurrency = targetCurrency;
    this.sourceCurrency = sourceCurrency;
    this.isConverted = isConverted;
    this.convertedCount = convertedCount;
    this.rateDate = rateDate;
    this.provider = provider;
    this.theme = theme;
    this.onShowOriginal = onShowOriginal;
    this.onConvert = onConvert;
    this.onChangeCurrency = onChangeCurrency;
    this.onDismiss = onDismiss;

    this.rootContainer = null;
    this.shadowRoot = null;
    this.barContainer = null;
    this.barElement = null;
    this.collapsedElement = null;
    this.tooltipElement = null;
    this.isDismissedForSession = false;
    this.isCollapsed = false;

    // Dragging state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.barStartLeft = 0;
    this.barStartTop = 0;
    this.hasMovedDrag = false;

    this._checkSessionDismissal();
  }

  _checkSessionDismissal() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        this.isDismissedForSession = sessionStorage.getItem('cc_bar_dismissed') === 'true';
      }
    } catch {}
  }

  mount(cssContent = '') {
    const parent = this.doc ? (this.doc.body || this.doc.documentElement) : null;
    if (!parent) return;

    // Never create a second #cc-dynamic-island-host in a document. Reuse or replace the existing one.
    const existing = this.doc.getElementById('cc-dynamic-island-host');
    if (existing) {
      existing.remove();
    }
    this.rootContainer = null;

    this.rootContainer = this.doc.createElement('div');
    this.rootContainer.id = 'cc-dynamic-island-host';
    this.rootContainer.setAttribute('data-cc-ignore', 'true');

    this.shadowRoot = this.rootContainer.attachShadow({ mode: 'open' });

    // Inject styles (inlined fallback ensures self-contained MV3 injection)
    const effectiveCss = cssContent || INLINE_UI_CSS;
    if (effectiveCss) {
      const styleEl = this.doc.createElement('style');
      styleEl.textContent = effectiveCss;
      this.shadowRoot.appendChild(styleEl);
    }

    // Dynamic Island container
    this.barContainer = this.doc.createElement('div');
    this.barContainer.className = 'cc-island-container cc-container';
    this._applyTheme(this.theme);

    // Build Dynamic Island Pill (themed via --cc-* tokens + data-theme)
    this.barElement = this._buildDynamicIsland();
    this.barContainer.appendChild(this.barElement);

    // Build Collapsed Pill (for toggleCollapse compatibility)
    this.collapsedElement = this._buildCollapsedPill();
    this.barContainer.appendChild(this.collapsedElement);

    // Build Hover Tooltip
    this.tooltipElement = this._buildTooltip();
    this.barContainer.appendChild(this.tooltipElement);

    this.shadowRoot.appendChild(this.barContainer);
    parent.appendChild(this.rootContainer);

    this._setupDragging();

    if (this.isDismissedForSession) {
      this.barElement.style.display = 'none';
      this.collapsedElement.style.display = 'none';
    }
  }

  _applyTheme(theme) {
    if (!this.barContainer) return;
    if (theme === 'dark') {
      this.barContainer.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      this.barContainer.setAttribute('data-theme', 'light');
    } else {
      this.barContainer.removeAttribute('data-theme');
    }
  }

  _buildDynamicIsland() {
    const island = this.doc.createElement('div');
    island.className = 'cc-dynamic-island cc-bar';
    island.setAttribute('role', 'toolbar');
    island.setAttribute('aria-label', 'Currency Convertr Dynamic Island');

    // 1. Compact Row (Always visible in capsule)
    const compact = this.doc.createElement('div');
    compact.className = 'cc-island-compact';

    // Status Dot (pine accent while converted, muted when showing originals)
    const statusDot = this.doc.createElement('div');
    statusDot.className = `cc-status-dot ${!this.isConverted ? 'cc-status-inactive' : ''}`;
    compact.appendChild(statusDot);

    // Currency Code: e.g. "NGN → USD" if sourceCurrency is known, else "USD"
    const codeSpan = this.doc.createElement('span');
    codeSpan.className = 'cc-currency-code';
    codeSpan.textContent = this.sourceCurrency && this.sourceCurrency !== this.targetCurrency
      ? `${this.sourceCurrency} → ${this.targetCurrency}`
      : this.targetCurrency;
    compact.appendChild(codeSpan);

    // Bullet Separator
    const sep = this.doc.createElement('span');
    sep.className = 'cc-count-sep cc-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = '·';
    compact.appendChild(sep);

    // Count Badge (Geist Mono tabular-nums)
    const countBadge = this.doc.createElement('span');
    countBadge.className = 'cc-count-badge';
    countBadge.textContent = String(this.convertedCount !== undefined ? this.convertedCount : 0);
    compact.appendChild(countBadge);

    island.appendChild(compact);

    // 2. Expandable Row (0fr -> 1fr CSS grid hardware morph on hover/focus)
    const expandable = this.doc.createElement('div');
    expandable.className = 'cc-island-expandable';

    const expandableContent = this.doc.createElement('div');
    expandableContent.className = 'cc-island-expandable-content';

    // Live rate / provider info
    const rateSpan = this.doc.createElement('span');
    rateSpan.className = 'cc-live-rate';
    rateSpan.textContent = this.rateDate ? `${this.rateDate}` : (this.provider ? `${this.provider}` : '');
    if (!this.rateDate && !this.provider) rateSpan.style.display = 'none';
    expandableContent.appendChild(rateSpan);

    // Tactile Segmented Control: [ Original | Converted ]
    const segmented = this.doc.createElement('div');
    segmented.className = 'cc-segmented';
    segmented.setAttribute('role', 'tablist');
    segmented.setAttribute('aria-label', 'View original or converted prices');

    const btnOriginal = this.doc.createElement('button');
    btnOriginal.className = `cc-segment-btn cc-segment-original ${!this.isConverted ? 'active' : ''}`;
    btnOriginal.setAttribute('type', 'button');
    btnOriginal.setAttribute('role', 'tab');
    btnOriginal.setAttribute('aria-selected', !this.isConverted ? 'true' : 'false');
    btnOriginal.setAttribute('data-state', 'original');
    btnOriginal.textContent = 'Original';

    btnOriginal.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.isConverted) {
        this.update({ isConverted: false });
        if (this.onShowOriginal) this.onShowOriginal();
      }
    });
    segmented.appendChild(btnOriginal);

    const btnConverted = this.doc.createElement('button');
    btnConverted.className = `cc-segment-btn cc-segment-converted ${this.isConverted ? 'active' : ''}`;
    btnConverted.setAttribute('type', 'button');
    btnConverted.setAttribute('role', 'tab');
    btnConverted.setAttribute('data-state', 'converted');
    btnConverted.setAttribute('aria-selected', this.isConverted ? 'true' : 'false');
    btnConverted.setAttribute('aria-label', `Show prices converted to ${this.targetCurrency}`);
    btnConverted.textContent = 'Converted';

    btnConverted.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.isConverted) {
        this.update({ isConverted: true });
        if (this.onConvert) this.onConvert(this.targetCurrency);
      }
    });
    segmented.appendChild(btnConverted);
    expandableContent.appendChild(segmented);

    // Quick Currency Switcher Dropdown inside Island
    const selectWrapper = this.doc.createElement('div');
    selectWrapper.className = 'cc-select-wrapper';

    const select = this.doc.createElement('select');
    select.className = 'cc-select';
    select.setAttribute('aria-label', 'Change target currency');

    const currencies = getAllCurrencies({ includeCrypto: false });
    for (const c of currencies) {
      const opt = this.doc.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} (${c.symbol})`;
      if (c.code === this.targetCurrency) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      const newCur = e.target.value;
      if (newCur && newCur !== this.targetCurrency) {
        this.targetCurrency = newCur;
        codeSpan.textContent = newCur;
        this.update({ isConverted: true, targetCurrency: newCur });
        if (this.onChangeCurrency) this.onChangeCurrency(newCur);
      }
    });

    const selectArrow = createSvg(
      this.doc,
      8,
      8,
      '0 0 24 24',
      2.5,
      [{ d: 'm6 9 6 6 6-6' }]
    );
    selectArrow.setAttribute('class', 'cc-select-arrow');

    selectWrapper.appendChild(select);
    selectWrapper.appendChild(selectArrow);
    expandableContent.appendChild(selectWrapper);

    // Dismiss / Close Button (Clean '×' icon, zero innerHTML)
    const btnDismiss = this.doc.createElement('button');
    btnDismiss.className = 'cc-dismiss-btn cc-btn-close';
    btnDismiss.setAttribute('type', 'button');
    btnDismiss.setAttribute('title', 'Dismiss toolbar for this session');
    btnDismiss.setAttribute('aria-label', 'Dismiss price toolbar');

    const closeSvg = createSvg(
      this.doc,
      11,
      11,
      '0 0 24 24',
      2.2,
      [
        { d: 'M18 6 6 18' },
        { d: 'm6 6 12 12' }
      ]
    );
    btnDismiss.appendChild(closeSvg);

    btnDismiss.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dismiss();
    });
    expandableContent.appendChild(btnDismiss);

    expandable.appendChild(expandableContent);
    island.appendChild(expandable);

    return island;
  }

  _buildCollapsedPill() {
    const mini = this.doc.createElement('button');
    mini.className = 'cc-collapsed-pill cc-bar-collapsed';
    mini.setAttribute('type', 'button');
    mini.setAttribute('title', 'Click to expand Currency Convertr Dynamic Island');
    mini.setAttribute('aria-label', 'Expand Currency Convertr Dynamic Island');
    mini.style.display = 'none';

    const dot = this.doc.createElement('span');
    dot.className = 'cc-status-dot';
    mini.appendChild(dot);

    const label = this.doc.createElement('span');
    label.className = 'cc-mini-label';
    label.textContent = `${this.convertedCount !== undefined ? this.convertedCount : 0} ${this.targetCurrency}`;
    mini.appendChild(label);

    mini.addEventListener('click', () => {
      this.toggleCollapse();
    });

    return mini;
  }

  _setupDragging() {
    if (!this.barContainer || !this.barElement) return;

    const onPointerDown = (e) => {
      const target = e.target;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'OPTION' ||
        target.closest('button') ||
        target.closest('select')
      ) {
        return;
      }

      this.isDragging = true;
      this.hasMovedDrag = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.barContainer.getBoundingClientRect();
      this.barStartLeft = rect.left;
      this.barStartTop = rect.top;

      this.barContainer.classList.add('cc-dragging');
      this.doc.addEventListener('pointermove', onPointerMove, { passive: false });
      this.doc.addEventListener('pointerup', onPointerUp, { passive: false });
      this.doc.addEventListener('pointercancel', onPointerUp, { passive: false });
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.hasMovedDrag = true;
      }

      const winWidth = this.doc.defaultView?.innerWidth || 1200;
      const winHeight = this.doc.defaultView?.innerHeight || 800;
      const barWidth = this.barContainer.offsetWidth || 240;
      const barHeight = this.barContainer.offsetHeight || 38;

      const newLeft = Math.min(Math.max(this.barStartLeft + dx, 8), winWidth - barWidth - 8);
      const newTop = Math.min(Math.max(this.barStartTop + dy, 8), winHeight - barHeight - 8);

      this.barContainer.style.left = `${newLeft}px`;
      this.barContainer.style.top = `${newTop}px`;
      this.barContainer.style.transform = 'none';
      e.preventDefault();
    };

    const onPointerUp = () => {
      this.isDragging = false;
      this.barContainer.classList.remove('cc-dragging');
      this.doc.removeEventListener('pointermove', onPointerMove);
      this.doc.removeEventListener('pointerup', onPointerUp);
      this.doc.removeEventListener('pointercancel', onPointerUp);
    };

    this.barElement.addEventListener('pointerdown', onPointerDown);
    this.collapsedElement.addEventListener('pointerdown', onPointerDown);
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      this.barElement.style.display = 'none';
      this.collapsedElement.style.display = 'inline-flex';
    } else {
      this.collapsedElement.style.display = 'none';
      this.barElement.style.display = 'flex';
    }
  }

  dismiss() {
    if (!this.barElement) return;
    this.isDismissedForSession = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cc_bar_dismissed', 'true');
      }
    } catch {}

    this.barElement.style.display = 'none';
    if (this.collapsedElement) {
      this.collapsedElement.style.display = 'none';
    }
    if (this.onDismiss) this.onDismiss();
  }

  hide() {
    if (this.barElement) {
      this.barElement.style.display = 'none';
    }
    if (this.collapsedElement) {
      this.collapsedElement.style.display = 'none';
    }
    this.hideTooltip();
  }

  show() {
    this.isDismissedForSession = false;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('cc_bar_dismissed');
      }
    } catch {}

    if (this.barElement) {
      this.barElement.style.display = 'flex';
    }
    if (this.collapsedElement) {
      this.collapsedElement.style.display = 'none';
    }
  }

  update({ isConverted, targetCurrency, sourceCurrency, count, rateDate, provider, theme } = {}) {
    if (isConverted !== undefined) this.isConverted = Boolean(isConverted);
    if (targetCurrency !== undefined) this.targetCurrency = targetCurrency;
    if (sourceCurrency !== undefined) this.sourceCurrency = sourceCurrency;
    if (count !== undefined) this.convertedCount = count;
    if (rateDate !== undefined) this.rateDate = rateDate;
    if (provider !== undefined) this.provider = provider;
    if (theme !== undefined) {
      this.theme = theme;
      this._applyTheme(theme);
    }

    if (!this.barElement) return;

    const dot = this.barElement.querySelector('.cc-status-dot');
    const btnOriginal = this.barElement.querySelector('.cc-segment-original');
    const btnConverted = this.barElement.querySelector('.cc-segment-converted');
    const codeSpan = this.barElement.querySelector('.cc-currency-code');
    const countBadge = this.barElement.querySelector('.cc-count-badge');
    const rateSpan = this.barElement.querySelector('.cc-live-rate');
    const select = this.barElement.querySelector('.cc-select');
    const miniLabel = this.collapsedElement?.querySelector('.cc-mini-label');

    if (dot) {
      dot.classList.toggle('cc-status-inactive', !this.isConverted);
    }
    if (btnOriginal) {
      btnOriginal.classList.toggle('active', !this.isConverted);
      btnOriginal.setAttribute('aria-selected', !this.isConverted ? 'true' : 'false');
    }
    if (btnConverted) {
      btnConverted.classList.toggle('active', this.isConverted);
      btnConverted.setAttribute('aria-selected', this.isConverted ? 'true' : 'false');
    }
    if (codeSpan) {
      codeSpan.textContent = this.sourceCurrency && this.sourceCurrency !== this.targetCurrency
        ? `${this.sourceCurrency} → ${this.targetCurrency}`
        : this.targetCurrency;
    }
    if (countBadge) {
      countBadge.textContent = String(this.convertedCount !== undefined ? this.convertedCount : 0);
      countBadge.style.display = 'inline-flex';
    }
    if (rateSpan && (this.rateDate || this.provider)) {
      rateSpan.textContent = this.rateDate || this.provider;
      rateSpan.style.display = 'inline';
    }
    if (select && select.value !== this.targetCurrency) {
      select.value = this.targetCurrency;
    }
    if (miniLabel) {
      miniLabel.textContent = `${this.convertedCount !== undefined ? this.convertedCount : 0} ${this.targetCurrency}`;
    }

    if (!this.isDismissedForSession && this.barElement.style.display === 'none' && !this.isCollapsed) {
      this.barElement.style.display = 'flex';
    }
  }

  _buildTooltip() {
    const tooltip = this.doc.createElement('div');
    tooltip.className = 'cc-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');

    const content = this.doc.createElement('div');
    content.className = 'cc-tooltip-content';

    const title = this.doc.createElement('div');
    title.className = 'cc-tooltip-title';
    content.appendChild(title);

    const sub = this.doc.createElement('div');
    sub.className = 'cc-tooltip-sub';
    content.appendChild(sub);

    const caret = this.doc.createElement('div');
    caret.className = 'cc-tooltip-caret';
    caret.setAttribute('aria-hidden', 'true');

    tooltip.appendChild(content);
    tooltip.appendChild(caret);

    return tooltip;
  }

  showTooltip({ originalAmount, originalCurrency, convertedAmount, rate, date, targetElement, x, y }) {
    if (!this.tooltipElement) return;

    const titleEl = this.tooltipElement.querySelector('.cc-tooltip-title');
    const subEl = this.tooltipElement.querySelector('.cc-tooltip-sub');

    const formattedOriginal = formatCurrency(originalAmount, originalCurrency);
    titleEl.textContent = `Original: ${formattedOriginal}`;

    const formattedUnitRate = rate ? `1 ${originalCurrency} = ${rate.toFixed(4)} ${this.targetCurrency}` : '';
    const dateStr = date ? ` · Rates: ${date}` : '';
    subEl.textContent = `${formattedUnitRate}${dateStr}`;

    const winWidth = this.doc.defaultView?.innerWidth || 1000;
    const tooltipWidth = 260;
    let left = (x || 0) + 10;
    let top = (y || 0) - 48;
    let isFlipped = false;

    if (targetElement && targetElement.getBoundingClientRect) {
      const rect = targetElement.getBoundingClientRect();
      left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      if (rect.top > 54) {
        top = rect.top - 46;
        isFlipped = false;
      } else {
        top = rect.bottom + 8;
        isFlipped = true;
      }
    }

    left = Math.min(Math.max(left, 10), winWidth - tooltipWidth - 10);
    top = Math.max(top, 8);

    this.tooltipElement.style.left = `${Math.round(left)}px`;
    this.tooltipElement.style.top = `${Math.round(top)}px`;
    this.tooltipElement.classList.toggle('flipped', isFlipped);
    this.tooltipElement.classList.add('visible');
    this.tooltipElement.setAttribute('aria-hidden', 'false');
  }

  hideTooltip() {
    if (!this.tooltipElement) return;
    this.tooltipElement.classList.remove('visible');
    this.tooltipElement.setAttribute('aria-hidden', 'true');
  }

  unmount() {
    if (this.rootContainer && this.rootContainer.parentNode) {
      this.rootContainer.parentNode.removeChild(this.rootContainer);
      this.rootContainer = null;
      this.shadowRoot = null;
    }
  }
}
