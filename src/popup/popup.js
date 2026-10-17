// src/popup/popup.js
import { getAllCurrencies, getCurrencyMeta } from '../shared/currencies.js';
import { MSG } from '../shared/messaging.js';
import {
  sendMessage,
  sendTabMessage,
  getActiveTab,
  requestOriginPermission,
  hasOriginPermission,
  getBrowser
} from '../shared/browser.js';

const api = getBrowser();

let currentTab = null;
let currentHostname = null;
let currentOrigin = null;
let currentSettings = null;
let selectedTargetCurrency = 'USD';
let isPageConverted = false;
let allCurrenciesList = [];

// DOM Elements
const btnConvertToggle = document.getElementById('btn-convert-toggle');
const liveStatusEl = document.getElementById('live-status');
const unsupportedNoticeEl = document.getElementById('unsupported-notice');
const mainControlsEl = document.getElementById('main-controls');
const pickerBtn = document.getElementById('picker-to-btn');
const selectedTargetText = document.getElementById('selected-target-text');
const currencyDropdown = document.getElementById('currency-dropdown');
const currencySearchInput = document.getElementById('currency-search-input');
const currencyOptionsList = document.getElementById('currency-options-list');
const toggleAlwaysSite = document.getElementById('toggle-always-site');
const toggleNeverSite = document.getElementById('toggle-never-site');
const siteCurrencyOverride = document.getElementById('site-currency-override');
const currentDomainLabel = document.getElementById('current-domain-label');
const ratesFreshnessText = document.getElementById('rates-freshness-text');
const btnRetryRates = document.getElementById('btn-retry-rates');
const btnOpenOptions = document.getElementById('btn-open-options');
const linkOptions = document.getElementById('link-options');

function openOptionsPage(e) {
  if (e) e.preventDefault();
  if (api && api.runtime && api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
  } else if (api && api.tabs && api.tabs.create) {
    api.tabs.create({ url: api.runtime.getURL('options/options.html') });
  }
}

btnOpenOptions.addEventListener('click', openOptionsPage);
linkOptions.addEventListener('click', openOptionsPage);

async function initPopup() {
  currentTab = await getActiveTab();
  allCurrenciesList = getAllCurrencies({ includeCrypto: false });

  // 1. Populate site currency override options
  populateOverrideDropdown();

  // 2. Validate current URL
  if (!currentTab || !currentTab.url) {
    showUnsupportedState();
    return;
  }

  const url = currentTab.url;
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://') ||
    url.includes('addons.mozilla.org') ||
    url.includes('chromewebstore.google.com')
  ) {
    showUnsupportedState();
    return;
  }

  try {
    const parsed = new URL(url);
    currentHostname = parsed.hostname;
    currentOrigin = parsed.origin;
    currentDomainLabel.textContent = currentHostname;
  } catch {
    showUnsupportedState();
    return;
  }

  // 3. Load settings
  try {
    const settings = await sendMessage({ type: MSG.GET_SETTINGS });
    if (settings) {
      currentSettings = settings;
      selectedTargetCurrency = settings.lastUsedTarget || settings.targetCurrency || 'USD';
      updateSelectedTargetUI(selectedTargetCurrency);
      initSiteRulesUI();
    }
  } catch (err) {
    console.warn('[Popup] Could not load settings:', err);
  }

  // 4. Fetch Rates status
  await loadRatesStatus();

  // 5. Query active page conversion status
  await checkPageStatus();

  // 6. Setup combobox
  setupCurrencyPicker();

  // 7. Setup event handlers
  setupActionListeners();
}

function showUnsupportedState() {
  unsupportedNoticeEl.style.display = 'flex';
  btnConvertToggle.disabled = true;
  btnConvertToggle.textContent = 'Unavailable on this page';
  liveStatusEl.textContent = 'Extension permissions do not apply here';
}

function populateOverrideDropdown() {
  siteCurrencyOverride.replaceChildren();
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Auto-detect';
  siteCurrencyOverride.appendChild(defaultOpt);

  for (const c of allCurrenciesList) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.code} (${c.symbol}) — ${c.name}`;
    siteCurrencyOverride.appendChild(opt);
  }
}

function updateSelectedTargetUI(code) {
  selectedTargetCurrency = code;
  const meta = getCurrencyMeta(code);
  const sym = meta ? meta.symbol : code;
  selectedTargetText.textContent = `${code} (${sym})`;
}

function initSiteRulesUI() {
  if (!currentSettings || !currentHostname) return;
  const siteRule = (currentSettings.perSite && currentSettings.perSite[currentHostname]) || {};

  toggleAlwaysSite.checked = Boolean(siteRule.autoConvert);
  toggleNeverSite.checked = Boolean(siteRule.neverConvert);
  siteCurrencyOverride.value = siteRule.assumedCurrency || '';
}

async function loadRatesStatus() {
  btnRetryRates.style.display = 'none';
  ratesFreshnessText.textContent = 'Rates: Updating...';

  try {
    const ratesData = await sendMessage({ type: MSG.GET_RATES });
    if (ratesData && ratesData.rates) {
      const provider = ratesData.provider || 'ECB';
      const date = ratesData.date || 'Today';
      const staleNotice = ratesData.isStale ? ' (cached)' : '';
      ratesFreshnessText.textContent = `Rates: ${provider}, ${date}${staleNotice}`;
    } else {
      ratesFreshnessText.textContent = 'Rates: Unavailable';
      btnRetryRates.style.display = 'inline-block';
    }
  } catch (err) {
    ratesFreshnessText.textContent = 'Rates: Network error';
    btnRetryRates.style.display = 'inline-block';
  }
}

btnRetryRates.addEventListener('click', async () => {
  await loadRatesStatus();
});

async function checkPageStatus() {
  if (!currentTab || !currentTab.id) return;

  try {
    const status = await sendTabMessage(currentTab.id, { type: MSG.GET_PAGE_STATUS });
    if (status && status.isConverted) {
      isPageConverted = true;
      btnConvertToggle.textContent = 'Show original';
      btnConvertToggle.classList.add('active-revert');
      liveStatusEl.textContent = `${status.count} prices converted to ${status.targetCurrency}`;
      if (status.targetCurrency) {
        updateSelectedTargetUI(status.targetCurrency);
      }
    } else {
      isPageConverted = false;
      btnConvertToggle.textContent = 'Convert this page';
      btnConvertToggle.classList.remove('active-revert');
      liveStatusEl.textContent = 'Ready to convert';
    }
  } catch {
    // Content script not yet injected
    isPageConverted = false;
    btnConvertToggle.textContent = 'Convert this page';
    btnConvertToggle.classList.remove('active-revert');
    liveStatusEl.textContent = 'Ready to convert';
  }
}

function setupCurrencyPicker() {
  pickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = currencyDropdown.style.display !== 'none';
    if (isOpen) {
      currencyDropdown.style.display = 'none';
      pickerBtn.setAttribute('aria-expanded', 'false');
    } else {
      currencyDropdown.style.display = 'flex';
      pickerBtn.setAttribute('aria-expanded', 'true');
      currencySearchInput.value = '';
      renderCurrencyOptions('');
      currencySearchInput.focus();
    }
  });

  currencySearchInput.addEventListener('input', (e) => {
    renderCurrencyOptions(e.target.value.trim().toLowerCase());
  });

  document.addEventListener('click', (e) => {
    if (!currencyDropdown.contains(e.target) && e.target !== pickerBtn) {
      currencyDropdown.style.display = 'none';
      pickerBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

function renderCurrencyOptions(query) {
  currencyOptionsList.replaceChildren();
  const pinnedCodes = currentSettings?.pinnedCurrencies || ['USD', 'EUR', 'GBP', 'NGN'];

  const filtered = allCurrenciesList.filter(c => {
    if (!query) return true;
    return (
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.symbol.toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'option-item';
    empty.style.color = '#a1a1aa';
    empty.textContent = 'No matching currencies';
    currencyOptionsList.appendChild(empty);
    return;
  }

  // Pinned group (only when no active search query)
  if (!query) {
    const pinnedGroupLabel = document.createElement('div');
    pinnedGroupLabel.className = 'option-group-label';
    pinnedGroupLabel.textContent = 'Pinned';
    currencyOptionsList.appendChild(pinnedGroupLabel);

    for (const code of pinnedCodes) {
      const meta = getCurrencyMeta(code);
      if (meta) {
        currencyOptionsList.appendChild(createOptionItem(meta));
      }
    }

    const allGroupLabel = document.createElement('div');
    allGroupLabel.className = 'option-group-label';
    allGroupLabel.textContent = 'All Currencies';
    currencyOptionsList.appendChild(allGroupLabel);
  }

  for (const c of filtered) {
    currencyOptionsList.appendChild(createOptionItem(c));
  }
}

function createOptionItem(c) {
  const item = document.createElement('div');
  item.className = 'option-item';
  item.setAttribute('role', 'option');
  if (c.code === selectedTargetCurrency) {
    item.setAttribute('aria-selected', 'true');
  }

  const left = document.createElement('span');
  left.textContent = `${c.code} (${c.symbol})`;

  const right = document.createElement('span');
  right.style.color = '#71717a';
  right.style.fontSize = '11px';
  right.textContent = c.name;

  item.appendChild(left);
  item.appendChild(right);

  item.addEventListener('click', async () => {
    updateSelectedTargetUI(c.code);
    currencyDropdown.style.display = 'none';
    pickerBtn.setAttribute('aria-expanded', 'false');

    // Update settings with last used
    await sendMessage({
      type: MSG.UPDATE_SETTINGS,
      payload: { lastUsedTarget: c.code }
    });

    // If page is currently converted, immediately re-convert to new target
    if (isPageConverted && currentTab && currentTab.id) {
      await triggerConvert(c.code);
    }
  });

  return item;
}

function setupActionListeners() {
  btnConvertToggle.addEventListener('click', async () => {
    if (isPageConverted) {
      await triggerRevert();
    } else {
      await triggerConvert(selectedTargetCurrency);
    }
  });

  // Always convert toggle with user gesture permission request
  toggleAlwaysSite.addEventListener('change', async (e) => {
    const checked = e.target.checked;
    if (checked) {
      // Uncheck never convert if active
      toggleNeverSite.checked = false;

      // Request optional host permission from user gesture
      const granted = await requestOriginPermission(currentOrigin);
      if (!granted) {
        toggleAlwaysSite.checked = false;
        liveStatusEl.textContent = 'Permission denied for this site';
        return;
      }
    }

    await saveSiteRule({
      autoConvert: checked,
      neverConvert: false
    });
  });

  // Never convert toggle
  toggleNeverSite.addEventListener('change', async (e) => {
    const checked = e.target.checked;
    if (checked) {
      toggleAlwaysSite.checked = false;
    }
    await saveSiteRule({
      neverConvert: checked,
      autoConvert: false
    });
  });

  // Site currency override
  siteCurrencyOverride.addEventListener('change', async (e) => {
    const val = e.target.value;
    await saveSiteRule({
      assumedCurrency: val || null
    });
  });
}

async function saveSiteRule(rulePatch) {
  if (!currentHostname) return;
  const currentRules = (currentSettings?.perSite && currentSettings.perSite[currentHostname]) || {};
  const updatedRule = {
    ...currentRules,
    ...rulePatch
  };

  const perSite = {
    ...(currentSettings?.perSite || {}),
    [currentHostname]: updatedRule
  };

  await sendMessage({
    type: MSG.UPDATE_SETTINGS,
    payload: { perSite }
  });

  currentSettings.perSite = perSite;
}

async function triggerConvert(targetCur) {
  if (!currentTab || !currentTab.id) return;
  btnConvertToggle.disabled = true;
  liveStatusEl.textContent = 'Scanning and converting...';

  try {
    // Inject script if needed
    if (api.scripting && api.scripting.executeScript) {
      await api.scripting.executeScript({
        target: { tabId: currentTab.id, allFrames: true },
        files: ['content.js']
      }).catch(() => {});
    }

    const ratesData = await sendMessage({ type: MSG.GET_RATES });
    const siteRule = currentSettings?.perSite && currentSettings.perSite[currentHostname];

    const response = await sendTabMessage(currentTab.id, {
      type: MSG.CONVERT_PAGE,
      payload: {
        targetCurrency: targetCur,
        ratesTable: ratesData.rates,
        rateDate: ratesData.date,
        provider: ratesData.provider,
        displayMode: currentSettings?.displayMode || 'replace',
        roundWhole: currentSettings?.roundWhole || false,
        showInPageBar: currentSettings?.showInPageBar !== false,
        siteOverride: siteRule?.assumedCurrency || null
      }
    });

    if (response && response.success) {
      isPageConverted = true;
      btnConvertToggle.textContent = 'Show original';
      btnConvertToggle.classList.add('active-revert');
      liveStatusEl.textContent = `${response.count} prices converted · Rates: ${ratesData.provider || 'ECB'}`;
      if (response.count === 0) {
        liveStatusEl.textContent = 'No convertible prices found on this page';
      }
    } else {
      liveStatusEl.textContent = 'Conversion failed';
    }
  } catch (err) {
    liveStatusEl.textContent = 'Error: ' + err.message;
  } finally {
    btnConvertToggle.disabled = false;
  }
}

async function triggerRevert() {
  if (!currentTab || !currentTab.id) return;
  btnConvertToggle.disabled = true;

  try {
    const response = await sendTabMessage(currentTab.id, { type: MSG.REVERT_PAGE });
    if (response && response.success) {
      isPageConverted = false;
      btnConvertToggle.textContent = 'Convert this page';
      btnConvertToggle.classList.remove('active-revert');
      liveStatusEl.textContent = 'Original prices restored';
    }
  } catch (err) {
    liveStatusEl.textContent = 'Error restoring prices';
  } finally {
    btnConvertToggle.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', initPopup);
