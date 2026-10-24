// src/content/content.js
import { PageScanner } from './scanner.js';
import { InPageUI } from './ui.js';
import { MSG } from '../shared/messaging.js';
import { sendMessage, getBrowser } from '../shared/browser.js';
import { shouldAutoConvertPage, SETTINGS_STORAGE_KEY } from '../shared/settings.js';

// Inlined ui.css for complete self-contained Shadow DOM isolation
import uiCssText from './ui.css';

let currentScanner = null;
let currentUI = null;
let isConverted = false;
let globalRates = null;
let rateDate = null;
let rateProvider = null;
let currentSettings = null;
// Theme setting ('system' | 'light' | 'dark') for the in-page pill. Loaded on demand so the
// first paint already matches the user's choice (currentSettings is only populated by live
// storage changes and must not silently alter conversion fallbacks).
let pillThemeSetting = null;

const api = getBrowser();

const THEME_LOAD_TIMEOUT_MS = 800;

function resolvePillTheme() {
  return currentSettings?.theme || pillThemeSetting || 'system';
}

/**
 * Fetches the saved theme once. Never throws and never blocks conversion for long:
 * on failure or timeout the pill falls back to following the OS ('system').
 */
async function ensurePillTheme() {
  if (currentSettings?.theme || pillThemeSetting) return;
  try {
    const settings = await Promise.race([
      sendMessage({ type: MSG.GET_SETTINGS }),
      new Promise((resolve) => setTimeout(() => resolve(null), THEME_LOAD_TIMEOUT_MS))
    ]);
    if (settings && typeof settings.theme === 'string') {
      pillThemeSetting = settings.theme;
    }
  } catch {
    // Non-fatal: keep following the system theme.
  }
}

function notifyBackgroundOfStatus() {
  try {
    sendMessage({
      type: MSG.PAGE_STATUS,
      payload: {
        isConverted,
        count: currentScanner ? currentScanner.convertedCount : 0,
        targetCurrency: currentScanner ? currentScanner.targetCurrency : null
      }
    }).catch(() => {});
  } catch {}
}

function ensureHighlightStyles(doc = document) {
  if (!doc || doc.getElementById('cc-highlight-styles')) return;
  const style = doc.createElement('style');
  style.id = 'cc-highlight-styles';
  style.textContent = `
    .cc-price-highlight {
      background-color: rgba(30, 107, 82, 0.10) !important;
      border-bottom: 1.5px dashed #1E6B52 !important;
      border-radius: 2px !important;
      padding: 0 2px !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      cursor: help !important;
      transition: background-color 140ms ease !important;
    }
    @media (hover: hover) and (pointer: fine) {
      .cc-price-highlight:hover {
        background-color: rgba(30, 107, 82, 0.18) !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      .cc-price-highlight {
        background-color: rgba(111, 211, 166, 0.15) !important;
        border-bottom-color: #6FD3A6 !important;
      }
      @media (hover: hover) and (pointer: fine) {
        .cc-price-highlight:hover {
          background-color: rgba(111, 211, 166, 0.25) !important;
        }
      }
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
}

async function performConversion(options = {}) {
  const targetCurrency = options.targetCurrency || currentSettings?.targetCurrency || 'USD';
  const displayMode = options.displayMode || currentSettings?.displayMode || 'replace';
  if (displayMode === 'replace_highlight') {
    ensureHighlightStyles(document);
  }
  const roundWhole = options.roundWhole !== undefined ? options.roundWhole : (currentSettings?.roundWhole || false);
  const showInPageBar = options.showInPageBar !== undefined ? options.showInPageBar : (currentSettings?.showInPageBar !== false);

  // Fetch rates if not cached in memory
  if (options.ratesTable) {
    globalRates = options.ratesTable;
    rateDate = options.rateDate || rateDate;
    rateProvider = options.provider || rateProvider;
  } else if (!globalRates || options.forceRefreshRates) {
    try {
      const response = await sendMessage({ type: MSG.GET_RATES });
      if (response && response.rates) {
        globalRates = response.rates;
        rateDate = response.date;
        rateProvider = response.provider;
      }
    } catch (err) {
      if (typeof window !== 'undefined' && window.mockRates) {
        globalRates = window.mockRates;
        rateDate = new Date().toISOString().split('T')[0];
        rateProvider = 'ECB (Mock)';
      } else {
        console.warn('[CurrencyConverter] Could not fetch rates from background:', err.message);
        return { success: false, error: err.message };
      }
    }
  }

  if (!globalRates) {
    return { success: false, error: 'Rates unavailable' };
  }

  // If already converted to a different target currency, revert first
  if (!currentScanner || currentScanner.targetCurrency !== targetCurrency.toUpperCase()) {
    if (currentScanner && isConverted) {
      currentScanner.revert();
    }

    currentScanner = new PageScanner({
      doc: document,
      targetCurrency,
      ratesTable: globalRates,
      displayMode,
      roundWhole,
      rateDate,
      provider: rateProvider,
      onConvertedCountChange: (count) => {
        if (currentUI) {
          currentUI.update({ count, isConverted: true });
        }
        notifyBackgroundOfStatus();
      }
    });

    currentScanner.convert();
  } else {
    // Same target currency: scan incrementally for newly added elements
    currentScanner.convert();
  }

  isConverted = true;
  currentScanner.startObserving();

  const convertedCount = currentScanner.convertedCount;

  // Mount or update Dynamic Island pill
  const isManual = Boolean(options.manual);
  const shouldShowPill = showInPageBar && (convertedCount > 0 || isManual);

  const primarySourceCurrency = currentScanner?.primarySourceCurrency ||
    (currentScanner?.detectedCurrencies && Array.from(currentScanner.detectedCurrencies)[0]) ||
    null;

  if (shouldShowPill) {
    // Resolve the saved theme before the first paint (no-op once known). The create check below
    // runs synchronously after this await, so concurrent conversions cannot mount two pills.
    if (!currentUI) await ensurePillTheme();
    if (!currentUI) {
      currentUI = new InPageUI({
        doc: document,
        targetCurrency,
        sourceCurrency: primarySourceCurrency,
        isConverted: true,
        convertedCount,
        rateDate,
        provider: rateProvider,
        theme: resolvePillTheme(),
        onShowOriginal: () => {
          performRevert();
        },
        onConvert: (cur) => {
          performConversion({ targetCurrency: cur, manual: true });
        },
        onChangeCurrency: (newCur) => {
          performConversion({ targetCurrency: newCur, manual: true });
        }
      });
      currentUI.mount(uiCssText);
    } else {
      currentUI.update({
        isConverted: true,
        targetCurrency,
        sourceCurrency: primarySourceCurrency,
        count: convertedCount,
        rateDate,
        provider: rateProvider,
        theme: resolvePillTheme()
      });
    }

    if (isManual) {
      currentUI.show();
    } else if (convertedCount > 0 && !currentUI.isDismissedForSession) {
      currentUI.show();
    }
  } else {
    // If a scan finishes with 0 foreign conversions and not manual, hide the pill.
    if (currentUI && convertedCount === 0 && !isManual) {
      currentUI.hide();
    }
  }

  notifyBackgroundOfStatus();
  return {
    success: true,
    count: convertedCount,
    convertedCount,
    targetCurrency,
    alreadyTarget: convertedCount === 0,
    ratesDate: rateDate,
    ratesProvider: rateProvider
  };
}

function performRevert() {
  if (currentScanner) {
    currentScanner.revert();
    currentScanner.stopObserving();
  }
  isConverted = false;
  if (currentUI) {
    currentUI.update({ isConverted: false, count: 0 });
  }
  notifyBackgroundOfStatus();
  return { success: true, count: 0 };
}

function initContentScript() {
  void ensurePillTheme();
  // Tooltip event delegation
  document.addEventListener('mouseover', (e) => {
    if (!isConverted || !currentScanner || !currentUI) return;
    const target = e.target;
    if (!target || target.nodeType !== 1) return;

    const convertedEl = target.closest('[data-cc-converted]');
    if (!convertedEl) return;

    const meta = currentScanner.conversionMetadata.get(convertedEl);
    if (meta) {
      currentUI.showTooltip({
        originalAmount: meta.originalAmount,
        originalCurrency: meta.originalCurrency,
        convertedAmount: meta.convertedAmount,
        rate: meta.rate,
        date: meta.date,
        targetElement: convertedEl,
        x: e.clientX,
        y: e.clientY
      });
    }
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    if (!isConverted || !currentUI) return;
    const target = e.target;
    if (!target || target.nodeType !== 1) return;

    if (target.closest('[data-cc-converted]')) {
      currentUI.hideTooltip();
    }
  }, { passive: true });

  // Message receiver from popup and background
  if (api && api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;

      if (message.type === MSG.CONVERT_PAGE) {
        performConversion(message.payload || {})
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open for async response
      }

      if (message.type === MSG.REVERT_PAGE) {
        const res = performRevert();
        sendResponse(res);
        return false;
      }

      if (message.type === MSG.GET_PAGE_STATUS) {
        sendResponse({
          isConverted,
          count: currentScanner ? currentScanner.convertedCount : 0,
          targetCurrency: currentScanner ? currentScanner.targetCurrency : null,
          rateDate,
          rateProvider
        });
        return false;
      }
    });
  }

  // Live storage synchronization from options and popup
  if (api && api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener((changes, area) => {
      if ((area === 'local' || area === 'sync') && changes[SETTINGS_STORAGE_KEY]) {
        currentSettings = changes[SETTINGS_STORAGE_KEY].newValue || currentSettings;
        if (currentUI && currentSettings && currentSettings.theme) {
          pillThemeSetting = currentSettings.theme;
          currentUI.update({ theme: currentSettings.theme });
        }
      }
    });
  }

  // Standalone window message receiver for test rigs and headless verification
  if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'CC_MANUAL_CONVERT') {
        performConversion(event.data);
      } else if (event.data.type === 'CC_MANUAL_REVERT') {
        performRevert();
      }
    });
  }
}

// Top-level idempotency guard: re-injection is a clean no-op leaving existing instance intact
// Top frame only: iframes are not converted for now
if (typeof window !== 'undefined') {
  if (window !== window.top) {
    // Child frame / iframe: do not mount or run
  } else if (window.__CC_CONTENT_SCRIPT_INJECTED__) {
    // Already initialized in this frame; do nothing
  } else {
    window.__CC_CONTENT_SCRIPT_INJECTED__ = true;
    initContentScript();
  }
}
