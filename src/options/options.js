// src/options/options.js
import { getAllCurrencies, getCurrencyMeta } from '../shared/currencies.js';
import { MSG } from '../shared/messaging.js';
import { sendMessage, getBrowser } from '../shared/browser.js';

const api = getBrowser();

let currentSettings = null;
let toastTimeout = null;

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
const selectAddPinned = document.getElementById('select-add-pinned');
const rulesTableBody = document.getElementById('rules-table-body');
const btnReset = document.getElementById('btn-reset');
const btnExport = document.getElementById('btn-export-settings');
const inputImport = document.getElementById('input-import-settings');
const saveToast = document.getElementById('save-toast');

function showSaveToast(message = 'Preferences saved') {
  if (toastTimeout) clearTimeout(toastTimeout);
  saveToast.textContent = message;
  saveToast.classList.add('visible');
  toastTimeout = setTimeout(() => {
    saveToast.classList.remove('visible');
  }, 2000);
}

async function loadSettings() {
  try {
    currentSettings = await sendMessage({ type: MSG.GET_SETTINGS });
    renderUI();
  } catch (err) {
    console.error('[Options] Failed to load settings:', err);
  }
}

function renderUI() {
  if (!currentSettings) return;

  const showCrypto = Boolean(currentSettings.showCrypto);
  const allCurrencies = getAllCurrencies({ includeCrypto: showCrypto });

  // 1. Populate Target Currency Dropdown
  selectDefaultTarget.replaceChildren();
  for (const c of allCurrencies) {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.code} (${c.symbol}) — ${c.name}`;
    if (c.code === currentSettings.targetCurrency) {
      opt.selected = true;
    }
    selectDefaultTarget.appendChild(opt);
  }

  // 2. Form values
  selectDisplayMode.value = currentSettings.displayMode || 'replace';
  selectAmbiguousDollar.value = currentSettings.ambiguousDollar || 'USD';
  selectTheme.value = currentSettings.theme || 'system';
  checkRoundWhole.checked = Boolean(currentSettings.roundWhole);
  checkShowInPageBar.checked = currentSettings.showInPageBar !== false;
  checkShowCrypto.checked = showCrypto;
  checkAutoConvertAll.checked = Boolean(currentSettings.autoConvertAll);

  // 3. Render Pinned Chips
  renderPinnedChips(allCurrencies);

  // 4. Render Per-Site Rules Table
  renderRulesTable();
}

function renderPinnedChips(allCurrencies) {
  pinnedChipsContainer.replaceChildren();
  const pinned = currentSettings.pinnedCurrencies || [];

  for (const code of pinned) {
    const meta = getCurrencyMeta(code);
    const chip = document.createElement('div');
    chip.className = 'currency-chip';

    const text = document.createElement('span');
    text.textContent = `${code} (${meta ? meta.symbol : ''})`;
    chip.appendChild(text);

    const btnRemove = document.createElement('button');
    btnRemove.className = 'chip-remove-btn';
    btnRemove.textContent = '✕';
    btnRemove.setAttribute('type', 'button');
    btnRemove.setAttribute('aria-label', `Remove ${code} from pinned`);
    btnRemove.addEventListener('click', async () => {
      const updated = pinned.filter(c => c !== code);
      await savePartialSettings({ pinnedCurrencies: updated });
    });
    chip.appendChild(btnRemove);

    pinnedChipsContainer.appendChild(chip);
  }

  // Populate Add Pinned select
  selectAddPinned.replaceChildren();
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = '+ Add currency to pinned...';
  selectAddPinned.appendChild(placeholderOpt);

  if (pinned.length >= 8) {
    selectAddPinned.disabled = true;
  } else {
    selectAddPinned.disabled = false;
    for (const c of allCurrencies) {
      if (!pinned.includes(c.code)) {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = `${c.code} — ${c.name}`;
        selectAddPinned.appendChild(opt);
      }
    }
  }
}

function renderRulesTable() {
  rulesTableBody.replaceChildren();
  const perSite = currentSettings.perSite || {};
  const entries = Object.entries(perSite);

  if (entries.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.style.color = '#71717a';
    td.style.textAlign = 'center';
    td.style.padding = '16px';
    td.textContent = 'No custom site rules configured yet.';
    tr.appendChild(td);
    rulesTableBody.appendChild(tr);
    return;
  }

  for (const [hostname, rule] of entries) {
    const tr = document.createElement('tr');

    // Domain
    const tdDomain = document.createElement('td');
    tdDomain.textContent = hostname;
    tdDomain.style.fontWeight = '500';
    tr.appendChild(tdDomain);

    // Behavior
    const tdBehavior = document.createElement('td');
    if (rule.autoConvert) {
      const badge = document.createElement('span');
      badge.className = 'badge-tag badge-always';
      badge.textContent = 'Always Convert';
      tdBehavior.appendChild(badge);
    } else if (rule.neverConvert) {
      const badge = document.createElement('span');
      badge.className = 'badge-tag badge-never';
      badge.textContent = 'Never Convert';
      tdBehavior.appendChild(badge);
    } else {
      tdBehavior.textContent = 'Default';
    }
    tr.appendChild(tdBehavior);

    // Assumed Currency
    const tdCurrency = document.createElement('td');
    tdCurrency.textContent = rule.assumedCurrency || 'Auto';
    tr.appendChild(tdCurrency);

    // Action (Delete)
    const tdAction = document.createElement('td');
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-danger-small';
    btnDelete.textContent = 'Remove';
    btnDelete.setAttribute('type', 'button');
    btnDelete.addEventListener('click', async () => {
      const updatedPerSite = { ...perSite };
      delete updatedPerSite[hostname];
      await savePartialSettings({ perSite: updatedPerSite });
    });
    tdAction.appendChild(btnDelete);
    tr.appendChild(tdAction);

    rulesTableBody.appendChild(tr);
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
      showSaveToast();
    }
  } catch (err) {
    console.error('[Options] Failed to update settings:', err);
  }
}

function setupEventListeners() {
  selectDefaultTarget.addEventListener('change', (e) => {
    savePartialSettings({ targetCurrency: e.target.value });
  });

  selectDisplayMode.addEventListener('change', (e) => {
    savePartialSettings({ displayMode: e.target.value });
  });

  selectAmbiguousDollar.addEventListener('change', (e) => {
    savePartialSettings({ ambiguousDollar: e.target.value });
  });

  selectTheme.addEventListener('change', (e) => {
    savePartialSettings({ theme: e.target.value });
  });

  checkRoundWhole.addEventListener('change', (e) => {
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
  });

  // Reset Defaults
  btnReset.addEventListener('click', async () => {
    if (confirm('Reset all Currency Convertr preferences to default settings?')) {
      const res = await sendMessage({
        type: MSG.UPDATE_SETTINGS,
        payload: {
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
        }
      });
      if (res && res.settings) {
        currentSettings = res.settings;
        renderUI();
        showSaveToast('Settings reset to defaults');
      }
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
  });

  // Import JSON
  inputImport.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const res = await sendMessage({
          type: MSG.UPDATE_SETTINGS,
          payload: parsed
        });
        if (res && res.settings) {
          currentSettings = res.settings;
          renderUI();
          showSaveToast('Settings imported successfully');
        }
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
});
