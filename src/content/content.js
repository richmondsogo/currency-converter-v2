// src/content/content.js
import { PageScanner } from './scanner.js';
import { InPageUI } from './ui.js';
import { MSG } from '../shared/messaging.js';
import { sendMessage, getBrowser } from '../shared/browser.js';
import { shouldAutoConvertPage } from '../shared/settings.js';

// Inlined ui.css for complete self-contained Shadow DOM isolation
import uiCssText from './ui.css';

let currentScanner = null;
let currentUI = null;
let isConverted = false;
let globalRates = null;
let rateDate = null;
let rateProvider = null;
let currentSettings = null;

const api = getBrowser();

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
      background-color: rgba(37, 99, 235, 0.08) !important;
      border-bottom: 1.5px dashed #3b82f6 !important;
      border-radius: 2px !important;
      padding: 0 2px !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      cursor: help !important;
      transition: background-color 140ms ease !important;
    }
    @media (hover: hover) and (pointer: fine) {
      .cc-price-highlight:hover {
        background-color: rgba(37, 99, 235, 0.16) !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      .cc-price-highlight {
        background-color: rgba(96, 165, 250, 0.15) !important;
        border-bottom-color: #60a5fa !important;
      }
      @media (hover: hover) and (pointer: fine) {
        .cc-price-highlight:hover {
          background-color: rgba(96, 165, 250, 0.25) !important;
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

  // If already converted, revert first to maintain clean DOM
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
        currentUI.update({ count });
      }
      notifyBackgroundOfStatus();
    }
  });

  const convertedCount = currentScanner.convert();
  isConverted = currentScanner.isConverted && convertedCount > 0;

  if (isConverted) {
    currentScanner.startObserving();
  }

  // Mount or update Dynamic Island pill
  const isManual = Boolean(options.manual);
  const shouldShowPill = showInPageBar && (convertedCount > 0 || isManual);

  const primarySourceCurrency = currentScanner?.primarySourceCurrency ||
    (currentScanner?.detectedCurrencies && Array.from(currentScanner.detectedCurrencies)[0]) ||
    null;

  if (shouldShowPill) {
    if (!currentUI) {
      currentUI = new InPageUI({
        doc: document,
        targetCurrency,
        sourceCurrency: primarySourceCurrency,
        isConverted: convertedCount > 0,
        convertedCount,
        rateDate,
        provider: rateProvider,
        theme: currentSettings?.theme || 'system',
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
        isConverted: convertedCount > 0,
        targetCurrency,
        sourceCurrency: primarySourceCurrency,
        count: convertedCount,
        rateDate,
        provider: rateProvider,
        theme: currentSettings?.theme || 'system'
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
    detectedCurrencies: currentScanner ? Array.from(currentScanner.detectedCurrencies || []) : []
  };
}

function performRevert() {
  if (currentScanner) {
    currentScanner.revert();
    currentScanner.stopObserving();
  }
  isConverted = false;
  if (currentUI) {
    currentUI.update({ isConverted: false });
  }
  notifyBackgroundOfStatus();
  return { success: true, count: 0 };
}

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

// Initialize on page load (check for auto-convert)
async function initializeContentScript() {
  try {
    const settings = await sendMessage({ type: MSG.GET_SETTINGS });
    if (settings) {
      currentSettings = settings;
      const shouldAutoConvert = shouldAutoConvertPage(settings, window.location.hostname);

      if (shouldAutoConvert) {
        performConversion();
      }
    }
  } catch (err) {
    // Content script injected standalone or offline
  }
}

// Wait for document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
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
