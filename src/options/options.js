// src/options/options.js
import { getAllCurrencies, getCurrencyMeta } from '../shared/currencies.js';
import { MSG } from '../shared/messaging.js';
import { sendMessage, getBrowser } from '../shared/browser.js';
import { getSiteMode, setSiteMode, normalizeHost } from '../shared/settings.js';
import { formatCurrency, formatPriceDisplay } from '../shared/format.js';
import { calculateRate, convertAmount } from '../shared/rates.js';

const api = getBrowser();

let currentSettings = null;
let toastTimeout = null;
let liveRates = null;

// Fallback rates table for offline / standalone preview
const FALLBACK_PREVIEW_RATES = {
  EUR: 1.0,
  USD: 1.09,
  GBP: 0.86,
  JPY: 165.2,
  CAD: 1.48,
  AUD: 1.64,
  NGN: 1750.0,
  INR: 91.5,
  CHF: 0.96,
  CNY: 7.92,
  BRL: 5.95,
  MXN: 21.8,
  SGD: 1.45,
  HKD: 8.52,
  KRW: 1510.0,
  ZAR: 19.8,
  SEK: 11.4,
  NOK: 11.8,
  DKK: 7.46,
  NZD: 1.82,
  TRY: 37.2,
  RUB: 105.0,
  PLN: 4.32,
  CZK: 25.1,
  HUF: 395.0,
  ILS: 4.12,
  AED: 4.00,
  SAR: 4.09,
  THB: 39.8,
  VND: 27500.0,
  PHP: 62.5,
  MYR: 5.12,
  IDR: 17200.0,
  BTC: 0.000012,
  ETH: 0.00038,
  SOL: 0.0065,
  DOGE: 8.5
};

const SUGGESTED_PINNED = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NGN', 'INR'];

// DOM Elements
const selectDefaultTarget = document.getElementById('default-target-currency');
const selectDisplayMode = document.getElementById('display-mode');
const selectAmbiguousDollar = document.getElementById('ambiguous-dollar');
const selectTheme = document.getElementById('theme-select');
const checkRoundWhole = document.getElementById('check-round-whole');
const checkShowInPageBar = document.getElementById('check-show-inpage-bar');
const checkShowCrypto = document.getElementById('check-show-crypto');
const checkAutoConvertAll = document.getElementById('check-autoconvert-all');
const pinnedChipsContainer = document.getElementById('pinned-chips-container');
const quickSuggestButtons = document.getElementById('quick-suggest-buttons');
const selectAddPinned = document.getElementById('select-add-pinned');
const rulesTableBody = document.getElementById('rules-table-body');
const formAddRule = document.getElementById('form-add-rule');
const inputRuleDomain = document.getElementById('input-rule-domain');
const selectRuleBehavior = document.getElementById('select-rule-behavior');
const selectRuleCurrency = document.getElementById('select-rule-currency');
const inputSearchRules = document.getElementById('input-search-rules');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export-settings');
const inputImport = document.getElementById('input-import-settings');
const saveToast = document.getElementById('save-toast');

// Live preview elements
const previewRenderedPrice = document.getElementById('preview-rendered-price');
const previewSimulatedTooltip = document.getElementById('preview-simulated-tooltip');
const previewTooltipRateText = document.getElementById('preview-tooltip-rate-text');

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // Update theme toggle buttons in header
  const buttons = document.querySelectorAll('.theme-btn');
  buttons.forEach(btn => {
    const val = btn.getAttribute('data-theme-val');
    btn.classList.toggle('active', val === (theme || 'system'));
  });

  if (selectTheme && selectTheme.value !== theme) {
    selectTheme.value = theme || 'system';
  }
}

function showSaveToast(message = 'Preferences saved') {
  if (toastTimeout) clearTimeout(toastTimeout);
  const textEl = saveToast.querySelector('.toast-text');
  if (textEl) {
    textEl.textContent = message;
  } else {
    saveToast.textContent = message;
  }
  saveToast.classList.add('visible');
  toastTimeout = setTimeout(() => {
    saveToast.classList.remove('visible');
  }, 2200);
}

async function loadSettings() {
  try {
    currentSettings = await sendMessage({ type: MSG.GET_SETTINGS });
    if (!currentSettings) throw new Error('No settings returned');
  } catch (err) {
    console.warn('[Options] Using default settings fallback:', err);
    try {
      const stored = localStorage.getItem('cc_settings_dev_fallback');
      if (stored) {
        currentSettings = JSON.parse(stored);
      }
    } catch {}

    if (!currentSettings) {
      currentSettings = {
        targetCurrency: 'USD',
        pinnedCurrencies: ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'],
        displayMode: 'replace',
        roundWhole: false,
        ambiguousDollar: 'USD',
        showCrypto: false,
        showInPageBar: true,
        autoConvertAll: false,
        theme: 'system',
        perSite: {}
      };
    }
  }

  // Fetch live rates for preview calculation
  try {
    const ratesRes = await sendMessage({ type: MSG.GET_RATES });
    if (ratesRes && ratesRes.rates) {
      liveRates = ratesRes.rates;
    }
  } catch {
    liveRates = FALLBACK_PREVIEW_RATES;
  }
  if (!liveRates) liveRates = FALLBACK_PREVIEW_RATES;

  applyTheme(currentSettings.theme);
  renderUI();
  updateLivePreview();
}

function renderUI() {
  if (!currentSettings) return;

  const showCrypto = Boolean(currentSettings.showCrypto);
  const allCurrencies = getAllCurrencies({ includeCrypto: showCrypto });

  // 1. Populate Target Currency Dropdown if not already populated
  if (selectDefaultTarget.options.length !== allCurrencies.length) {
    selectDefaultTarget.replaceChildren();
    for (const c of allCurrencies) {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} (${c.symbol}) — ${c.name}`;
      selectDefaultTarget.appendChild(opt);
    }
  }
  selectDefaultTarget.value = currentSettings.targetCurrency;

  // Populate Add Rule Currency Dropdown if not already populated
  if (selectRuleCurrency.options.length !== allCurrencies.length + 1) {
    selectRuleCurrency.replaceChildren();
    const autoDetectOpt = document.createElement('option');
    autoDetectOpt.value = '';
    autoDetectOpt.textContent = 'Auto-detect currency';
    selectRuleCurrency.appendChild(autoDetectOpt);

    for (const c of allCurrencies) {
      const opt = document.createElement('option');
      opt.value = c.code;
      opt.textContent = `${c.code} (${c.symbol}) — ${c.name}`;
      selectRuleCurrency.appendChild(opt);
    }
  }

  // 2. Form values
  selectDisplayMode.value = currentSettings.displayMode || 'replace';
  selectAmbiguousDollar.value = currentSettings.ambiguousDollar || 'USD';
  selectTheme.value = currentSettings.theme || 'system';
  checkRoundWhole.checked = Boolean(currentSettings.roundWhole);
  checkShowInPageBar.checked = currentSettings.showInPageBar !== false;
  checkShowCrypto.checked = showCrypto;
  checkAutoConvertAll.checked = Boolean(currentSettings.autoConvertAll);

  // 3. Render Pinned Chips & Quick Suggestions
  renderPinnedChips(allCurrencies);

  // 4. Render Per-Site Rules Table
  renderRulesTable();
}

function renderPinnedChips(allCurrencies) {
  pinnedChipsContainer.replaceChildren();
  const pinned = currentSettings.pinnedCurrencies || [];

  const countBadge = document.getElementById('pinned-count-badge');
  if (countBadge) {
    countBadge.textContent = `${pinned.length} / 8`;
    countBadge.classList.toggle('badge-full', pinned.length >= 8);
  }

  if (pinned.length === 0) {
    const tmplEmpty = document.getElementById('template-empty-pinned');
    if (tmplEmpty) {
      pinnedChipsContainer.appendChild(tmplEmpty.content.cloneNode(true));
    }
  } else {
    for (const code of pinned) {
      const meta = getCurrencyMeta(code);
      const chip = document.createElement('div');
      chip.className = 'currency-chip';

      const codeSpan = document.createElement('span');
      codeSpan.className = 'chip-code';
      codeSpan.textContent = code;
      chip.appendChild(codeSpan);

      if (meta && meta.symbol) {
        const symSpan = document.createElement('span');
        symSpan.className = 'chip-symbol';
        symSpan.textContent = meta.symbol;
        chip.appendChild(symSpan);
      }

      const btnRemove = document.createElement('button');
      btnRemove.className = 'chip-remove-btn';
      btnRemove.setAttribute('type', 'button');
      btnRemove.setAttribute('aria-label', `Remove ${code} from pinned`);
      const tmplChipIcon = document.getElementById('template-chip-remove-icon');
      if (tmplChipIcon) {
        btnRemove.appendChild(tmplChipIcon.content.cloneNode(true));
      }
      btnRemove.addEventListener('click', async () => {
        chip.classList.add('chip-exiting');
        setTimeout(async () => {
          const updated = pinned.filter(c => c !== code);
          await savePartialSettings({ pinnedCurrencies: updated });
        }, 120);
      });
      chip.appendChild(btnRemove);

      pinnedChipsContainer.appendChild(chip);
    }
  }

  // Populate Quick Add Buttons
  quickSuggestButtons.replaceChildren();
  for (const sCode of SUGGESTED_PINNED) {
    if (!pinned.includes(sCode)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-suggest-btn';
      btn.textContent = `+ ${sCode}`;
      btn.disabled = pinned.length >= 8;
      btn.addEventListener('click', async () => {
        if (pinned.length < 8 && !pinned.includes(sCode)) {
          await savePartialSettings({ pinnedCurrencies: [...pinned, sCode] });
        }
      });
      quickSuggestButtons.appendChild(btn);
    }
  }

  // Populate Add Pinned select
  selectAddPinned.replaceChildren();
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = pinned.length >= 8 ? 'Pinned limit reached (8 max)' : '+ Add currency to pinned...';
  selectAddPinned.appendChild(placeholderOpt);

  if (pinned.length >= 8) {
    selectAddPinned.disabled = true;
  } else {
    selectAddPinned.disabled = false;
    for (const c of allCurrencies) {
      if (!pinned.includes(c.code)) {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = `${c.code} (${c.symbol}) — ${c.name}`;
        selectAddPinned.appendChild(opt);
      }
    }
  }
}

function renderRulesTable() {
  rulesTableBody.replaceChildren();
  const perSite = currentSettings.perSite || {};
  const filterQuery = (inputSearchRules?.value || '').trim().toLowerCase();

  let entries = Object.entries(perSite);
  if (filterQuery) {
    entries = entries.filter(([host]) => host.toLowerCase().includes(filterQuery));
  }

  const rulesCountBadge = document.getElementById('rules-count-badge');
  if (rulesCountBadge) {
    const totalCount = Object.keys(perSite).length;
    rulesCountBadge.textContent = `${totalCount} ${totalCount === 1 ? 'rule' : 'rules'}`;
  }

  if (entries.length === 0) {
    const tmplEmpty = document.getElementById('template-empty-rules');
    if (tmplEmpty) {
      rulesTableBody.appendChild(tmplEmpty.content.cloneNode(true));
    }
    return;
  }

  for (const [hostname, rule] of entries) {
    const tr = document.createElement('tr');
    tr.className = 'rule-row';

    // Domain
    const tdDomain = document.createElement('td');
    tdDomain.className = 'rule-domain-cell';
    const hostSpan = document.createElement('span');
    hostSpan.className = 'domain-host';
    hostSpan.textContent = hostname;
    tdDomain.appendChild(hostSpan);
    tr.appendChild(tdDomain);

    // Behavior Select (Default / Ask / Always / Never)
    const tdBehavior = document.createElement('td');
    tdBehavior.className = 'rule-behavior-cell';

    const selectMode = document.createElement('select');
    selectMode.className = 'form-select rule-mode-select';
    selectMode.setAttribute('aria-label', `Behavior for ${hostname}`);

    const optDefault = document.createElement('option');
    optDefault.value = 'default';
    optDefault.textContent = 'Default';

    const optAsk = document.createElement('option');
    optAsk.value = 'ask';
    optAsk.textContent = 'Ask';

    const optAlways = document.createElement('option');
    optAlways.value = 'always';
    optAlways.textContent = 'Always';

    const optNever = document.createElement('option');
    optNever.value = 'never';
    optNever.textContent = 'Never';

    selectMode.appendChild(optDefault);
    selectMode.appendChild(optAsk);
    selectMode.appendChild(optAlways);
    selectMode.appendChild(optNever);

    const currentMode = rule.mode || (rule.autoConvert ? 'always' : (rule.neverConvert ? 'never' : 'default'));
    selectMode.value = currentMode;

    selectMode.addEventListener('change', async (e) => {
      const val = e.target.value;
      const newMode = val === 'default' ? null : val;
      setSiteMode(currentSettings, hostname, newMode);
      await savePartialSettings({ perSite: currentSettings.perSite });
      showSaveToast(`Updated ${hostname} to ${val}`);
    });

    tdBehavior.appendChild(selectMode);
    tr.appendChild(tdBehavior);

    // Assumed Currency
    const tdCurrency = document.createElement('td');
    tdCurrency.className = 'rule-currency-cell';
    tdCurrency.textContent = rule.assumedCurrency || 'Auto-detect';
    tr.appendChild(tdCurrency);

    // Action (Delete)
    const tdAction = document.createElement('td');
    tdAction.className = 'rule-action-cell';
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-danger-small';
    btnDelete.setAttribute('type', 'button');
    btnDelete.setAttribute('aria-label', `Remove rule for ${hostname}`);
    const tmplDelIcon = document.getElementById('template-delete-icon');
    if (tmplDelIcon) {
      btnDelete.appendChild(tmplDelIcon.content.cloneNode(true));
    }
    const delLabel = document.createElement('span');
    delLabel.textContent = 'Remove';
    btnDelete.appendChild(delLabel);

    btnDelete.addEventListener('click', async () => {
      tr.style.opacity = '0';
      tr.style.transform = 'translateX(10px)';
      tr.style.transition = 'all 140ms ease';
      setTimeout(async () => {
        const updatedPerSite = { ...currentSettings.perSite };
        delete updatedPerSite[hostname];
        await savePartialSettings({ perSite: updatedPerSite });
        showSaveToast(`Rule for ${hostname} removed`);
      }, 140);
    });
    tdAction.appendChild(btnDelete);
    tr.appendChild(tdAction);

    rulesTableBody.appendChild(tr);
  }
}

function updateLivePreview() {
  if (!previewRenderedPrice || !currentSettings) return;

  const inputAmount = document.getElementById('preview-amount');
  const selectSourceCur = document.getElementById('preview-source-currency');
  const sampleAmount = inputAmount ? (parseFloat(inputAmount.value) || 0) : 1299.99;
  const sampleOriginalCurrency = selectSourceCur ? (selectSourceCur.value || 'USD') : 'USD';
  const targetCurrency = currentSettings.targetCurrency || 'USD';
  const displayMode = currentSettings.displayMode || 'replace';
  const roundWhole = Boolean(currentSettings.roundWhole);

  const ratesTable = liveRates || FALLBACK_PREVIEW_RATES;
  let convertedAmount = sampleAmount;
  let rate = 1.0;

  try {
    rate = calculateRate(sampleOriginalCurrency, targetCurrency, ratesTable);
    convertedAmount = convertAmount(sampleAmount, sampleOriginalCurrency, targetCurrency, ratesTable);
  } catch {
    rate = 1.0;
    convertedAmount = sampleAmount;
  }

  const origFormatted = formatCurrency(sampleAmount, sampleOriginalCurrency, { roundWhole: false });
  const formattedConverted = formatCurrency(convertedAmount, targetCurrency, { roundWhole });
  const display = formatPriceDisplay({
    originalText: origFormatted,
    convertedText: formattedConverted,
    displayMode
  });

  previewRenderedPrice.replaceChildren();
  if (display.highlight) {
    const mark = document.createElement('mark');
    mark.className = 'cc-price-highlight';
    mark.textContent = display.text;
    previewRenderedPrice.appendChild(mark);
  } else {
    previewRenderedPrice.textContent = display.text;
  }

  // Update simulated tooltip text
  if (previewTooltipRateText) {
    const formattedUnit = rate.toFixed(4);
    previewTooltipRateText.textContent = `1 ${sampleOriginalCurrency} = ${formattedUnit} ${targetCurrency} · Live Rates`;
  }
  const tooltipTitle = previewSimulatedTooltip ? previewSimulatedTooltip.querySelector('.preview-tooltip-title') : null;
  if (tooltipTitle) {
    tooltipTitle.textContent = `Original: ${origFormatted}`;
  }
}

async function savePartialSettings(partial) {
  try {
    const res = await sendMessage({
      type: MSG.UPDATE_SETTINGS,
      payload: partial
    });
    if (res && res.settings) {
      currentSettings = res.settings;
      renderUI();
      updateLivePreview();
      showSaveToast();
      return;
    }
  } catch (err) {
    console.warn('[Options] Storage update fallback:', err);
  }

  // Fallback for standalone/demo execution
  currentSettings = {
    ...currentSettings,
    ...partial
  };
  try {
    localStorage.setItem('cc_settings_dev_fallback', JSON.stringify(currentSettings));
  } catch {}
  renderUI();
  updateLivePreview();
  showSaveToast();
}

function setupNavigation() {
  const navPills = document.querySelectorAll('.nav-pill');
  const sections = ['section-preview', 'section-general', 'section-pinned', 'section-automation', 'section-backup']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  navPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = pill.getAttribute('href')?.replace('#', '');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        navPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
      }
    });
  });

  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navPills.forEach(pill => {
            if (pill.getAttribute('href') === `#${id}`) {
              navPills.forEach(p => p.classList.remove('active'));
              pill.classList.add('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-15% 0px -65% 0px',
      threshold: 0
    });

    sections.forEach(sec => observer.observe(sec));
  }
}

function setupEventListeners() {
  // Theme quick-switch buttons in header
  const themeButtons = document.querySelectorAll('.theme-btn');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const chosenTheme = btn.getAttribute('data-theme-val');
      applyTheme(chosenTheme);
      savePartialSettings({ theme: chosenTheme });
    });
  });

  // Interactive Live Preview Controls
  const inputPreviewAmount = document.getElementById('preview-amount');
  if (inputPreviewAmount) {
    inputPreviewAmount.addEventListener('input', () => {
      updateLivePreview();
    });
  }

  const selectPreviewSource = document.getElementById('preview-source-currency');
  if (selectPreviewSource) {
    selectPreviewSource.addEventListener('change', () => {
      updateLivePreview();
    });
  }

  selectDefaultTarget.addEventListener('change', (e) => {
    if (currentSettings) {
      currentSettings.targetCurrency = e.target.value;
      currentSettings.lastUsedTarget = e.target.value;
    }
    updateLivePreview();
    savePartialSettings({ targetCurrency: e.target.value, lastUsedTarget: e.target.value });
  });

  selectDisplayMode.addEventListener('change', (e) => {
    if (currentSettings) currentSettings.displayMode = e.target.value;
    updateLivePreview();
    savePartialSettings({ displayMode: e.target.value });
  });

  selectAmbiguousDollar.addEventListener('change', (e) => {
    if (currentSettings) currentSettings.ambiguousDollar = e.target.value;
    savePartialSettings({ ambiguousDollar: e.target.value });
  });

  selectTheme.addEventListener('change', (e) => {
    applyTheme(e.target.value);
    savePartialSettings({ theme: e.target.value });
  });

  checkRoundWhole.addEventListener('change', (e) => {
    if (currentSettings) currentSettings.roundWhole = e.target.checked;
    updateLivePreview();
    savePartialSettings({ roundWhole: e.target.checked });
  });

  checkShowInPageBar.addEventListener('change', (e) => {
    savePartialSettings({ showInPageBar: e.target.checked });
  });

  checkShowCrypto.addEventListener('change', (e) => {
    savePartialSettings({ showCrypto: e.target.checked });
  });

  // Auto-convert all sites (optional permission request)
  checkAutoConvertAll.addEventListener('change', async (e) => {
    const checked = e.target.checked;
    if (checked) {
      if (api && api.permissions && api.permissions.request) {
        try {
          const granted = await new Promise(resolve => {
            api.permissions.request({ origins: ['<all_urls>'] }, resolve);
          });
          if (!granted) {
            checkAutoConvertAll.checked = false;
            showSaveToast('Permission was not granted');
            return;
          }
        } catch {
          checkAutoConvertAll.checked = false;
          return;
        }
      }
    }
    savePartialSettings({ autoConvertAll: checked });
  });

  // Add Pinned
  selectAddPinned.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const pinned = currentSettings.pinnedCurrencies || [];
    if (pinned.length < 8 && !pinned.includes(val)) {
      savePartialSettings({ pinnedCurrencies: [...pinned, val] });
    }
    e.target.value = '';
  });

  // Add Site Rule Form submission
  if (formAddRule) {
    formAddRule.addEventListener('submit', async (e) => {
      e.preventDefault();
      let domain = (inputRuleDomain.value || '').trim();
      domain = normalizeHost(domain);

      if (!domain || !domain.includes('.')) {
        alert('Please enter a valid domain name (e.g. amazon.de or asos.com)');
        return;
      }

      const behavior = selectRuleBehavior.value;
      const assumedCurrency = selectRuleCurrency.value || null;
      const mode = behavior === 'default' ? null : behavior;

      setSiteMode(currentSettings, domain, mode);
      if (assumedCurrency) {
        currentSettings.perSite[domain] = {
          ...(currentSettings.perSite[domain] || {}),
          assumedCurrency
        };
      }

      await savePartialSettings({ perSite: currentSettings.perSite });
      inputRuleDomain.value = '';
      selectRuleBehavior.value = 'default';
      selectRuleCurrency.value = '';
      showSaveToast(`Rule for ${domain} saved`);
    });
  }

  // Rules table filter input
  if (inputSearchRules) {
    inputSearchRules.addEventListener('input', () => {
      renderRulesTable();
    });
  }

  // Live preview simulated tooltip hover interaction
  if (previewRenderedPrice && previewSimulatedTooltip) {
    previewRenderedPrice.addEventListener('mouseenter', () => {
      previewSimulatedTooltip.classList.add('visible');
    });
    previewRenderedPrice.addEventListener('mouseleave', () => {
      previewSimulatedTooltip.classList.remove('visible');
    });
  }

  // Reset Defaults
  btnReset.addEventListener('click', async () => {
    if (confirm('Reset all Currency Convertr preferences to default settings?')) {
      const defaults = {
        targetCurrency: 'USD',
        pinnedCurrencies: ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'],
        displayMode: 'replace',
        roundWhole: false,
        ambiguousDollar: 'USD',
        showCrypto: false,
        showInPageBar: true,
        autoConvertAll: false,
        theme: 'system',
        perSite: {}
      };
      await savePartialSettings(defaults);
      applyTheme('system');
      showSaveToast('Settings reset to defaults');
    }
  });

  // Export JSON
  btnExport.addEventListener('click', () => {
    const jsonStr = JSON.stringify(currentSettings, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `currency-convertr-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSaveToast('Settings exported');
  });

  // Import JSON
  inputImport.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('JSON content must be an object');
        }
        await savePartialSettings(parsed);
        showSaveToast('Settings imported successfully');
      } catch (err) {
        alert('Invalid JSON file format: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupEventListeners();
  setupNavigation();
});
