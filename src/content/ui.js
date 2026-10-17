// src/content/ui.js
import { getAllCurrencies } from '../shared/currencies.js';
import { formatCurrency } from '../shared/format.js';

export class InPageUI {
  constructor({
    doc = (typeof document !== 'undefined' ? document : null),
    targetCurrency = 'USD',
    rateDate = null,
    provider = null,
    onShowOriginal = null,
    onChangeCurrency = null,
    onDismiss = null
  } = {}) {
    this.doc = doc;
    this.targetCurrency = targetCurrency;
    this.rateDate = rateDate;
    this.provider = provider;
    this.onShowOriginal = onShowOriginal;
    this.onChangeCurrency = onChangeCurrency;
    this.onDismiss = onDismiss;

    this.rootContainer = null;
    this.shadowRoot = null;
    this.barElement = null;
    this.tooltipElement = null;
    this.isDismissedForSession = false;

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
    this.rootContainer.id = 'currency-convertr-root';
    this.rootContainer.setAttribute('data-cc-ignore', 'true');

    this.shadowRoot = this.rootContainer.attachShadow({ mode: 'open' });

    // Inject styles
    if (cssContent) {
      const styleEl = this.doc.createElement('style');
      styleEl.textContent = cssContent;
      this.shadowRoot.appendChild(styleEl);
    }

    // Build container
    const container = this.doc.createElement('div');
    container.className = 'cc-container';

    // Build Bar
    this.barElement = this._buildBar();
    container.appendChild(this.barElement);

    // Build Tooltip
    this.tooltipElement = this._buildTooltip();
    container.appendChild(this.tooltipElement);

    this.shadowRoot.appendChild(container);
    this.doc.body.appendChild(this.rootContainer);

    if (this.isDismissedForSession) {
      this.barElement.style.display = 'none';
    }
  }

  _buildBar() {
    const bar = this.doc.createElement('div');
    bar.className = 'cc-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-label', `Prices converted to ${this.targetCurrency}`);

    // Badge
    const badge = this.doc.createElement('span');
    badge.className = 'cc-brand-badge';
    badge.textContent = 'fx';
    bar.appendChild(badge);

    // Info
    const info = this.doc.createElement('span');
    info.className = 'cc-info';
    info.appendChild(this.doc.createTextNode('Prices in '));
    const codeSpan = this.doc.createElement('span');
    codeSpan.className = 'cc-currency-code';
    codeSpan.textContent = this.targetCurrency;
    info.appendChild(codeSpan);
    bar.appendChild(info);

    // Sep
    const sep1 = this.doc.createElement('span');
    sep1.className = 'cc-sep';
    sep1.textContent = '·';
    bar.appendChild(sep1);

    // Show original button
    const btnOriginal = this.doc.createElement('button');
    btnOriginal.className = 'cc-btn';
    btnOriginal.textContent = 'Show original';
    btnOriginal.setAttribute('type', 'button');
    btnOriginal.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.onShowOriginal) this.onShowOriginal();
    });
    bar.appendChild(btnOriginal);

    // Sep
    const sep2 = this.doc.createElement('span');
    sep2.className = 'cc-sep';
    sep2.textContent = '·';
    bar.appendChild(sep2);

    // Change currency select
    const selectWrapper = this.doc.createElement('div');
    selectWrapper.className = 'cc-select-wrapper';

    const select = this.doc.createElement('select');
    select.className = 'cc-select';
    select.setAttribute('aria-label', 'Change target currency');

    // Populate currencies
    const currencies = getAllCurrencies({ includeCrypto: false });
    for (const c of currencies) {
      const opt = this.doc.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} (${c.symbol})`;
      if (c.code === this.targetCurrency) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }

    select.addEventListener('change', (e) => {
      const newCur = e.target.value;
      if (newCur && newCur !== this.targetCurrency) {
        this.targetCurrency = newCur;
        const curCodeEl = bar.querySelector('.cc-currency-code');
        if (curCodeEl) curCodeEl.textContent = newCur;
        if (this.onChangeCurrency) this.onChangeCurrency(newCur);
      }
    });

    const arrow = this.doc.createElement('span');
    arrow.className = 'cc-select-arrow';
    arrow.textContent = '▾';

    selectWrapper.appendChild(select);
    selectWrapper.appendChild(arrow);
    bar.appendChild(selectWrapper);

    // Close button
    const btnClose = this.doc.createElement('button');
    btnClose.className = 'cc-btn-close';
    btnClose.setAttribute('type', 'button');
    btnClose.setAttribute('aria-label', 'Dismiss price bar');
    btnClose.textContent = '✕';
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      bar.style.display = 'none';
      this.isDismissedForSession = true;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('cc_bar_dismissed', 'true');
        }
      } catch {}
      if (this.onDismiss) this.onDismiss();
    });
    bar.appendChild(btnClose);

    return bar;
  }

  _buildTooltip() {
    const tooltip = this.doc.createElement('div');
    tooltip.className = 'cc-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');

    const title = this.doc.createElement('div');
    title.className = 'cc-tooltip-title';
    tooltip.appendChild(title);

    const sub = this.doc.createElement('div');
    sub.className = 'cc-tooltip-sub';
    tooltip.appendChild(sub);

    return tooltip;
  }

  showTooltip({ originalAmount, originalCurrency, convertedAmount, rate, date, x, y }) {
    if (!this.tooltipElement) return;

    const titleEl = this.tooltipElement.querySelector('.cc-tooltip-title');
    const subEl = this.tooltipElement.querySelector('.cc-tooltip-sub');

    const formattedOriginal = formatCurrency(originalAmount, originalCurrency);
    titleEl.textContent = `Original: ${formattedOriginal}`;

    const formattedUnitRate = rate ? `1 ${originalCurrency} = ${rate.toFixed(4)} ${this.targetCurrency}` : '';
    const dateStr = date ? ` · Rates: ${date}` : '';
    subEl.textContent = `${formattedUnitRate}${dateStr}`;

    // Position tooltip
    const left = Math.min(Math.max(x + 12, 10), (this.doc.defaultView?.innerWidth || 1000) - 290);
    const top = Math.max(y - 45, 10);

    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.top = `${top}px`;
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
