// src/content/ui.js
import { getAllCurrencies } from '../shared/currencies.js';
import { formatCurrency } from '../shared/format.js';

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

    // Idle auto-collapse timer
    this._idleTimer = null;
    this._idleDelay = 3500;

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
    if (!this.doc || !this.doc.body || this.rootContainer) return;

    this.rootContainer = this.doc.createElement('div');
    this.rootContainer.id = 'cc-dynamic-island-host';
    this.rootContainer.setAttribute('data-cc-ignore', 'true');

    this.shadowRoot = this.rootContainer.attachShadow({ mode: 'open' });

    // Inject styles
    if (cssContent) {
      const styleEl = this.doc.createElement('style');
      styleEl.textContent = cssContent;
      this.shadowRoot.appendChild(styleEl);
    }

    // Dynamic Island container
    this.barContainer = this.doc.createElement('div');
    this.barContainer.className = 'cc-island-container cc-container';
    this._applyTheme(this.theme);

    // Build OLED Dynamic Island Pill
    this.barElement = this._buildDynamicIsland();
    this.barContainer.appendChild(this.barElement);

    // Build Collapsed Pill (for toggleCollapse compatibility)
    this.collapsedElement = this._buildCollapsedPill();
    this.barContainer.appendChild(this.collapsedElement);

    // Build Hover Tooltip
    this.tooltipElement = this._buildTooltip();
    this.barContainer.appendChild(this.tooltipElement);

    this.shadowRoot.appendChild(this.barContainer);
    this.doc.body.appendChild(this.rootContainer);

    this._setupDragging();
    this._setupIdleAutoFade();

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

    // 1. Compact Row (Always visible)
    const compact = this.doc.createElement('div');
    compact.className = 'cc-island-compact';

    // Status Dot (6px, #10b981 when active)
    const statusDot = this.doc.createElement('div');
    statusDot.className = `cc-status-dot ${!this.isConverted ? 'cc-status-inactive' : ''}`;
    compact.appendChild(statusDot);

    // Currency Code
    const codeSpan = this.doc.createElement('span');
    codeSpan.className = 'cc-currency-code';
    codeSpan.textContent = this.targetCurrency;
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
    countBadge.textContent = String(this.convertedCount || 0);
    if (!this.convertedCount) countBadge.style.display = 'none';
    compact.appendChild(countBadge);

    island.appendChild(compact);

    // 2. Expandable Row (0fr -> 1fr CSS grid expansion on hover/focus)
    const expandable = this.doc.createElement('div');
    expandable.className = 'cc-island-expandable';

    const expandableContent = this.doc.createElement('div');
    expandableContent.className = 'cc-island-expandable-content';

    // Live rate / provider info
    const rateSpan = this.doc.createElement('span');
    rateSpan.className = 'cc-live-rate';
    rateSpan.textContent = this.rateDate ? `${this.rateDate}` : '';
    if (!this.rateDate) rateSpan.style.display = 'none';
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

    // Currency Switcher Dropdown
    const selectWrapper = this.doc.createElement('div');
    selectWrapper.className = 'cc-select-wrapper';
    selectWrapper.style.display = 'none'; // Clean default, can be toggled

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
    selectWrapper.appendChild(select);
    expandableContent.appendChild(selectWrapper);

    // Dismiss Button (Zero innerHTML)
    const btnDismiss = this.doc.createElement('button');
    btnDismiss.className = 'cc-dismiss-btn cc-btn-close';
    btnDismiss.setAttribute('type', 'button');
    btnDismiss.setAttribute('title', 'Dismiss toolbar for this session');
    btnDismiss.setAttribute('aria-label', 'Dismiss price toolbar');

    const closeSvg = createSvg(
      this.doc,
      10,
      10,
      '0 0 24 24',
      2.5,
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
    label.textContent = `${this.convertedCount || 0} ${this.targetCurrency}`;
    mini.appendChild(label);

    mini.addEventListener('click', () => {
      this.toggleCollapse();
    });

    return mini;
  }

  _setupIdleAutoFade() {
    if (!this.barElement) return;

    const resetTimer = () => {
      if (this._idleTimer) {
        clearTimeout(this._idleTimer);
        this._idleTimer = null;
      }
      this.barElement.classList.remove('cc-idle-fade');
      this._idleTimer = setTimeout(() => {
        if (!this.isCollapsed && this.barElement.style.display !== 'none') {
          this.barElement.classList.add('cc-idle-fade');
        }
      }, this._idleDelay);
    };

    this.barElement.addEventListener('pointerenter', () => {
      if (this._idleTimer) clearTimeout(this._idleTimer);
      this.barElement.classList.remove('cc-idle-fade');
    });

    this.barElement.addEventListener('focusin', () => {
      if (this._idleTimer) clearTimeout(this._idleTimer);
      this.barElement.classList.remove('cc-idle-fade');
    });

    this.barElement.addEventListener('pointerleave', resetTimer);
    this.barElement.addEventListener('focusout', resetTimer);

    // Initial arming
    resetTimer();
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
      const barWidth = this.barContainer.offsetWidth || 220;
      const barHeight = this.barContainer.offsetHeight || 36;

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
      this.barElement.classList.remove('cc-idle-fade');
      this._setupIdleAutoFade();
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
      this.barElement.classList.remove('cc-idle-fade');
    }
    if (this.collapsedElement) {
      this.collapsedElement.style.display = 'none';
    }
    this._setupIdleAutoFade();
  }

  update({ isConverted, targetCurrency, count, rateDate, provider, theme } = {}) {
    if (isConverted !== undefined) this.isConverted = Boolean(isConverted);
    if (targetCurrency !== undefined) this.targetCurrency = targetCurrency;
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
      codeSpan.textContent = this.targetCurrency;
    }
    if (countBadge) {
      countBadge.textContent = String(this.convertedCount || 0);
      countBadge.style.display = this.convertedCount > 0 ? 'inline-flex' : 'none';
    }
    if (rateSpan && this.rateDate) {
      rateSpan.textContent = this.rateDate;
      rateSpan.style.display = 'inline';
    }
    if (select && select.value !== this.targetCurrency) {
      select.value = this.targetCurrency;
    }
    if (miniLabel) {
      miniLabel.textContent = `${this.convertedCount || 0} ${this.targetCurrency}`;
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
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this.rootContainer && this.rootContainer.parentNode) {
      this.rootContainer.parentNode.removeChild(this.rootContainer);
      this.rootContainer = null;
      this.shadowRoot = null;
    }
  }
}
