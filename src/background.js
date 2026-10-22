// src/background.js
import { RatesEngine, calculateRate, convertAmount } from './shared/rates.js';
import { SettingsManager, DEFAULT_SETTINGS, getSiteMode, shouldAutoConvertPage, normalizeHost } from './shared/settings.js';
import { formatCurrency } from './shared/format.js';
import { detectCurrency, extractAmount } from './shared/parser.js';
import { MSG } from './shared/messaging.js';
import { getBrowser, sendTabMessage, ensureInjected } from './shared/browser.js';

const api = getBrowser();
const ratesEngine = new RatesEngine();
const settingsManager = new SettingsManager();

// Cache of active tab status: tabId -> { isConverted, count, targetCurrency }
const tabStatusMap = new Map();

// -----------------------------------------------------------------------------
// 1. NOTIFICATIONS
// -----------------------------------------------------------------------------
function notify(title, message) {
  if (!api || !api.notifications) return;
  const notifId = `cc-notif-${Date.now()}`;
  try {
    api.notifications.create(notifId, {
      type: 'basic',
      iconUrl: api.runtime.getURL('icons/icon48.png'),
      title,
      message
    }, () => {
      if (api.runtime.lastError) {
        // Ignored
      }
    });
  } catch (err) {
    console.warn('[CurrencyConverter] Notification failed:', err);
  }
}

// -----------------------------------------------------------------------------
// 2. CONTEXT MENUS (Selection conversion + Page-level actions)
// -----------------------------------------------------------------------------
async function buildMenus() {
  if (!api || !api.contextMenus) return;

  api.contextMenus.removeAll(async () => {
    try {
      const settings = await settingsManager.getSettings();
      const pinned = settings.pinnedCurrencies || DEFAULT_SETTINGS.pinnedCurrencies;
      const defaultTarget = settings.targetCurrency || 'USD';

      // 1. Selection Parent Menu (v1 compatibility)
      api.contextMenus.create({
        id: 'cc-parent',
        title: 'Convert currency',
        contexts: ['selection']
      }, () => {
        if (api.runtime.lastError) {}
      });

      // Selection submenus for pinned currencies
      for (const cur of pinned) {
        api.contextMenus.create({
          id: `cc-sel-${cur}`,
          parentId: 'cc-parent',
          title: `To ${cur}`,
          contexts: ['selection']
        }, () => {
          if (api.runtime.lastError) {}
        });
      }

      // 2. Page-level Actions
      api.contextMenus.create({
        id: 'cc-page-convert',
        title: `Convert prices on this page to ${defaultTarget}`,
        contexts: ['page']
      }, () => {
        if (api.runtime.lastError) {}
      });

      api.contextMenus.create({
        id: 'cc-page-revert',
        title: 'Show original prices',
        contexts: ['page']
      }, () => {
        if (api.runtime.lastError) {}
      });
    } catch (err) {
      console.warn('[CurrencyConverter] Failed to build context menus:', err);
    }
  });
}

// -----------------------------------------------------------------------------
// 3. PAGE INJECTION & CONVERSION ORCHESTRATION
// -----------------------------------------------------------------------------
async function convertPageOnTab(tabId, targetCurrency = null) {
  const injected = await ensureInjected(tabId);
  if (!injected) return;

  const settings = await settingsManager.getSettings();
  const target = targetCurrency || settings.targetCurrency || 'USD';
  let ratesData;
  try {
    ratesData = await ratesEngine.getRates();
  } catch (err) {
    console.warn('[CurrencyConverter] getRates failed, using fallback:', err.message);
    ratesData = {
      rates: { USD: 1, EUR: 0.92, GBP: 0.79, NGN: 1500, CAD: 1.35, AUD: 1.5, JPY: 150 },
      date: new Date().toISOString().split('T')[0],
      provider: 'Offline Fallback'
    };
  }

  const response = await sendTabMessage(tabId, {
    type: MSG.CONVERT_PAGE,
    payload: {
      targetCurrency: target,
      ratesTable: ratesData ? ratesData.rates : null,
      rateDate: ratesData ? ratesData.date : null,
      provider: ratesData ? ratesData.provider : null,
      displayMode: settings.displayMode,
      roundWhole: settings.roundWhole,
      showInPageBar: settings.showInPageBar
    }
  });

  if (response && response.success) {
    tabStatusMap.set(tabId, {
      isConverted: true,
      count: response.count,
      targetCurrency: target
    });
  }
}

async function revertPageOnTab(tabId) {
  const response = await sendTabMessage(tabId, { type: MSG.REVERT_PAGE });
  if (response && response.success) {
    tabStatusMap.set(tabId, {
      isConverted: false,
      count: 0,
      targetCurrency: null
    });
  }
}

async function togglePageConversionOnTab(tabId) {
  const currentStatus = tabStatusMap.get(tabId);
  if (currentStatus && currentStatus.isConverted) {
    await revertPageOnTab(tabId);
  } else {
    await convertPageOnTab(tabId);
  }
}

// -----------------------------------------------------------------------------
// 4. SELECTION CONVERSION (v1 feature)
// -----------------------------------------------------------------------------
async function handleSelectionConversion(text, targetCurrency) {
  const raw = (text || '').trim();
  if (!raw) {
    notify('Currency Converter', 'No text selected. Highlight a price and try again.');
    return;
  }

  const amount = extractAmount(raw);
  if (amount === null) {
    notify('Currency Converter', `No valid numeric price found in "${raw.slice(0, 50)}".`);
    return;
  }

  const fromCurrency = detectCurrency(raw);

  try {
    const ratesData = await ratesEngine.getRates();
    const rate = calculateRate(fromCurrency, targetCurrency, ratesData.rates);
    const converted = amount * rate;

    const formattedFrom = formatCurrency(amount, fromCurrency);
    const formattedTo = formatCurrency(converted, targetCurrency);
    const formattedUnit = formatCurrency(rate, targetCurrency);

    notify(
      'Currency Converter',
      `${formattedFrom} = ${formattedTo}\nRate: 1 ${fromCurrency} = ${formattedUnit}`
    );
  } catch (err) {
    console.error('[CurrencyConverter] Selection conversion failed:', err);
    notify(
      'Currency Converter',
      `Unable to convert ${fromCurrency} to ${targetCurrency}. Verify network connection.`
    );
  }
}

// -----------------------------------------------------------------------------
// 5. EVENT LISTENERS
// -----------------------------------------------------------------------------

// Context Menu Clicks
if (api && api.contextMenus && api.contextMenus.onClicked) {
  api.contextMenus.onClicked.addListener(async (info, tab) => {
    const menuId = info.menuItemId;

    // Selection conversion
    if (menuId.startsWith('cc-sel-')) {
      const targetCurrency = menuId.replace('cc-sel-', '');
      await handleSelectionConversion(info.selectionText, targetCurrency);
      return;
    }

    // Page level convert
    if (menuId === 'cc-page-convert' && tab && tab.id) {
      await convertPageOnTab(tab.id);
      return;
    }

    // Page level revert
    if (menuId === 'cc-page-revert' && tab && tab.id) {
      await revertPageOnTab(tab.id);
      return;
    }
  });
}

// Keyboard Shortcut Command
if (api && api.commands && api.commands.onCommand) {
  api.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-page-conversion') {
      if (api.tabs && api.tabs.query) {
        api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            await togglePageConversionOnTab(tabs[0].id);
          }
        });
      }
    }
  });
}

// Runtime Messaging Dispatcher
if (api && api.runtime && api.runtime.onMessage) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    // Rates query
    if (message.type === MSG.GET_RATES) {
      ratesEngine.getRates()
        .then(ratesData => sendResponse(ratesData))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }

    // Settings query
    if (message.type === MSG.GET_SETTINGS) {
      settingsManager.getSettings()
        .then(settings => sendResponse(settings))
        .catch(err => sendResponse({ error: err.message }));
      return true;
    }

    // Settings update
    if (message.type === MSG.UPDATE_SETTINGS) {
      settingsManager.updateSettings(message.payload || {})
        .then(updated => {
          buildMenus();
          sendResponse({ success: true, settings: updated });
        })
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    // Page status reported by content script
    if (message.type === MSG.PAGE_STATUS) {
      if (sender && sender.tab && sender.tab.id) {
        tabStatusMap.set(sender.tab.id, message.payload);
      }
      sendResponse({ received: true });
      return false;
    }
  });
}

// tabs.onUpdated auto-convert trigger for approved origins
if (api && api.tabs && api.tabs.onUpdated) {
  api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      const rawUrl = tab?.url || changeInfo?.url;
      if (rawUrl && rawUrl.startsWith('http')) {
        try {
          const url = new URL(rawUrl);
          const settings = await settingsManager.getSettings();
          const shouldAutoConvert = shouldAutoConvertPage(settings, url.hostname);

          if (shouldAutoConvert) {
            const target = settings.targetCurrency || 'USD';
            await convertPageOnTab(tabId, target);
          }
        } catch (err) {
          console.error('[CC Background] Auto-convert failed on tab:', tabId, err);
        }
      }
    }
  });
}

// Tab removal cleanup
if (api && api.tabs && api.tabs.onRemoved) {
  api.tabs.onRemoved.addListener((tabId) => {
    tabStatusMap.delete(tabId);
  });
}

// Startup & install hooks
if (api && api.runtime && api.runtime.onInstalled) {
  api.runtime.onInstalled.addListener(() => {
    buildMenus();
    if (api.scripting && api.scripting.unregisterContentScripts) {
      api.scripting.unregisterContentScripts({ ids: ['cc-autoconvert-sites'] }).catch(() => {});
    }
  });
}

if (api && api.runtime && api.runtime.onStartup) {
  api.runtime.onStartup.addListener(() => {
    buildMenus();
    if (api.scripting && api.scripting.unregisterContentScripts) {
      api.scripting.unregisterContentScripts({ ids: ['cc-autoconvert-sites'] }).catch(() => {});
    }
  });
}
