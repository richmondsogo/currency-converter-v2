import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  migrateSettings,
  validateSettings,
  SettingsManager
} from '../src/shared/settings.js';

// Mock storage for settings
class MockStorage {
  constructor(initialData = {}) {
    this.data = { ...initialData };
  }
  async get(keys) {
    if (typeof keys === 'string') return { [keys]: this.data[keys] };
    const res = {};
    for (const k of keys) {
      if (this.data[k] !== undefined) res[k] = this.data[k];
    }
    return res;
  }
  async set(obj) {
    Object.assign(this.data, obj);
  }
}

test('settings: default settings schema', () => {
  assert.equal(DEFAULT_SETTINGS.schemaVersion, 2);
  assert.equal(DEFAULT_SETTINGS.targetCurrency, 'USD');
  assert.deepEqual(DEFAULT_SETTINGS.pinnedCurrencies, [
    'NGN', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'
  ]);
  assert.equal(DEFAULT_SETTINGS.displayMode, 'replace');
  assert.equal(DEFAULT_SETTINGS.roundWhole, false);
  assert.equal(DEFAULT_SETTINGS.showCrypto, false);
  assert.equal(DEFAULT_SETTINGS.ambiguousDollar, 'USD');
  assert.equal(DEFAULT_SETTINGS.showInPageBar, true);
  assert.equal(DEFAULT_SETTINGS.theme, 'system');
  assert.deepEqual(DEFAULT_SETTINGS.perSite, {});
});

test('settings: migration from v1 or empty state', () => {
  // Empty state
  const migratedEmpty = migrateSettings(null);
  assert.equal(migratedEmpty.schemaVersion, 2);
  assert.equal(migratedEmpty.targetCurrency, 'USD');

  // v1 settings migration
  const v1Data = {
    targetCurrency: 'EUR',
    unknownOldKey: 'foo'
  };
  const migratedV1 = migrateSettings(v1Data);
  assert.equal(migratedV1.schemaVersion, 2);
  assert.equal(migratedV1.targetCurrency, 'EUR');
  assert.deepEqual(migratedV1.pinnedCurrencies, DEFAULT_SETTINGS.pinnedCurrencies);
  assert.equal(migratedV1.displayMode, 'replace');
});

test('settings: SettingsManager load, save, and perSite overrides', async () => {
  const storage = new MockStorage();
  const manager = new SettingsManager({ storage });

  const initial = await manager.getSettings();
  assert.equal(initial.targetCurrency, 'USD');

  // Update target currency
  await manager.updateSettings({ targetCurrency: 'NGN', roundWhole: true });
  const updated = await manager.getSettings();
  assert.equal(updated.targetCurrency, 'NGN');
  assert.equal(updated.roundWhole, true);

  // Per-site rules
  await manager.setSiteRule('amazon.ca', { autoConvert: true, assumedCurrency: 'CAD' });
  const siteRule = await manager.getSiteRule('amazon.ca');
  assert.equal(siteRule.autoConvert, true);
  assert.equal(siteRule.assumedCurrency, 'CAD');

  // Remove site rule
  await manager.removeSiteRule('amazon.ca');
  const removedRule = await manager.getSiteRule('amazon.ca');
  assert.equal(removedRule, null);
});

test('settings: export and import JSON', async () => {
  const storage = new MockStorage();
  const manager = new SettingsManager({ storage });

  await manager.updateSettings({
    targetCurrency: 'GBP',
    pinnedCurrencies: ['GBP', 'USD', 'EUR'],
    displayMode: 'append'
  });

  const jsonString = await manager.exportJson();
  assert.ok(typeof jsonString === 'string');

  const storage2 = new MockStorage();
  const manager2 = new SettingsManager({ storage: storage2 });
  await manager2.importJson(jsonString);

  const imported = await manager2.getSettings();
  assert.equal(imported.targetCurrency, 'GBP');
  assert.deepEqual(imported.pinnedCurrencies, ['GBP', 'USD', 'EUR']);
  assert.equal(imported.displayMode, 'append');
});
