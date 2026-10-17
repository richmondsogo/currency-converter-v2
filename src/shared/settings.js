// src/shared/settings.js
export const SETTINGS_STORAGE_KEY = 'currency_converter_settings_v2';
export const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  targetCurrency: 'USD',
  lastUsedTarget: 'USD',
  pinnedCurrencies: ['NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'],
  displayMode: 'replace', // 'replace' | 'append' | 'replace_highlight'
  roundWhole: false,
  ambiguousDollar: 'USD',
  showCrypto: false,
  showInPageBar: true,
  autoConvertAll: false,
  theme: 'system', // 'system' | 'light' | 'dark'
  perSite: {} // { [hostname]: { autoConvert?: boolean, neverConvert?: boolean, assumedCurrency?: string } }
};

/**
 * Validates and migrates settings from previous versions or empty state.
 */
export function migrateSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  // Version 2 current
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      perSite: { ...raw.perSite }
    };
  }

  // Version 1 or unversioned migration
  const migrated = {
    ...DEFAULT_SETTINGS,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    targetCurrency: raw.targetCurrency || DEFAULT_SETTINGS.targetCurrency,
    lastUsedTarget: raw.lastUsedTarget || raw.targetCurrency || DEFAULT_SETTINGS.lastUsedTarget,
    pinnedCurrencies: Array.isArray(raw.pinnedCurrencies) && raw.pinnedCurrencies.length > 0
      ? raw.pinnedCurrencies.slice(0, 8)
      : [...DEFAULT_SETTINGS.pinnedCurrencies],
    displayMode: ['replace', 'append', 'replace_highlight'].includes(raw.displayMode)
      ? raw.displayMode
      : DEFAULT_SETTINGS.displayMode,
    roundWhole: Boolean(raw.roundWhole),
    ambiguousDollar: raw.ambiguousDollar || DEFAULT_SETTINGS.ambiguousDollar,
    showCrypto: Boolean(raw.showCrypto),
    showInPageBar: raw.showInPageBar !== undefined ? Boolean(raw.showInPageBar) : DEFAULT_SETTINGS.showInPageBar,
    autoConvertAll: Boolean(raw.autoConvertAll),
    theme: ['system', 'light', 'dark'].includes(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    perSite: raw.perSite && typeof raw.perSite === 'object' ? { ...raw.perSite } : {}
  };

  return migrated;
}

export function validateSettings(settings) {
  const s = migrateSettings(settings);
  // Ensure pinned currencies has at most 8 items
  if (s.pinnedCurrencies.length > 8) {
    s.pinnedCurrencies = s.pinnedCurrencies.slice(0, 8);
  }
  return s;
}

export class SettingsManager {
  constructor({ storage = null } = {}) {
    this.storage = storage || this._resolveBrowserStorage();
  }

  _resolveBrowserStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    const mem = {};
    return {
      get: async (k) => (typeof k === 'string' ? { [k]: mem[k] } : mem),
      set: async (obj) => Object.assign(mem, obj)
    };
  }

  async getSettings() {
    try {
      const data = await this.storage.get(SETTINGS_STORAGE_KEY);
      return migrateSettings(data ? data[SETTINGS_STORAGE_KEY] : null);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async updateSettings(partial) {
    const current = await this.getSettings();
    const updated = validateSettings({
      ...current,
      ...partial
    });
    await this.storage.set({ [SETTINGS_STORAGE_KEY]: updated });
    return updated;
  }

  async setSiteRule(hostname, rule) {
    if (!hostname) return;
    const current = await this.getSettings();
    const perSite = { ...current.perSite };
    perSite[hostname] = {
      ...(perSite[hostname] || {}),
      ...rule
    };
    return this.updateSettings({ perSite });
  }

  async getSiteRule(hostname) {
    if (!hostname) return null;
    const settings = await this.getSettings();
    return settings.perSite[hostname] || null;
  }

  async removeSiteRule(hostname) {
    if (!hostname) return;
    const current = await this.getSettings();
    const perSite = { ...current.perSite };
    delete perSite[hostname];
    return this.updateSettings({ perSite });
  }

  async resetDefaults() {
    await this.storage.set({ [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS } });
    return { ...DEFAULT_SETTINGS };
  }

  async exportJson() {
    const settings = await this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  async importJson(jsonString) {
    const parsed = JSON.parse(jsonString);
    const validated = validateSettings(parsed);
    await this.storage.set({ [SETTINGS_STORAGE_KEY]: validated });
    return validated;
  }
}
