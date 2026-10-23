import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  normalizeHost,
  migrateSettings,
  validateSettings,
  getSiteMode,
  setSiteMode
} from '../src/shared/settings.js';

// Pure UI mapping helpers matching options page logic
export function getEffectiveSiteCaption(rule, autoConvertAll) {
  if (!rule || !rule.mode) {
    return `Uses default (${autoConvertAll ? 'Always' : 'Ask'})`;
  }
  return '';
}

export function validateDomainInput(rawDomain, existingPerSite = {}) {
  const trimmed = typeof rawDomain === 'string' ? rawDomain.trim() : '';
  if (!trimmed) {
    return { ok: false, error: 'Please enter a domain name (e.g. amazon.de)' };
  }
  const clean = normalizeHost(trimmed);
  if (!clean || !clean.includes('.')) {
    return { ok: false, error: 'Please enter a valid domain containing an extension (e.g. amazon.de)' };
  }
  if (existingPerSite && existingPerSite[clean]) {
    return { ok: false, error: `A rule for "${clean}" already exists` };
  }
  return { ok: true, clean };
}

export function canAddPinned(pinnedCurrencies) {
  if (!Array.isArray(pinnedCurrencies)) return true;
  return pinnedCurrencies.length < 8;
}

export function validateImportContent(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('File content must be a non-empty string');
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('File content must be a JSON object');
  }
  return migrateSettings(parsed);
}

test('options unit: hostname normalization on add', () => {
  assert.equal(normalizeHost('WWW.Shop.test'), 'shop.test');
  assert.equal(normalizeHost('https://WWW.AMAZON.DE/products?id=123'), 'amazon.de');
  assert.equal(normalizeHost('http://sub.domain.co.uk:8080/'), 'sub.domain.co.uk');
  assert.equal(normalizeHost('  WWW.JUMIA.COM.NG  '), 'jumia.com.ng');
  assert.equal(normalizeHost('www.www.example.com'), 'example.com');
  assert.equal(normalizeHost('localhost'), 'localhost');
  assert.equal(normalizeHost(''), '');
  assert.equal(normalizeHost(null), '');
});

test('options unit: validateDomainInput inline validation rules', () => {
  const existing = {
    'amazon.de': { mode: 'always', assumedCurrency: 'EUR' }
  };

  // Empty input
  const emptyRes = validateDomainInput('   ', existing);
  assert.equal(emptyRes.ok, false);
  assert.ok(emptyRes.error.includes('Please enter a domain'));

  // Invalid domain without extension
  const invalidRes = validateDomainInput('localhost', existing);
  assert.equal(invalidRes.ok, false);
  assert.ok(invalidRes.error.includes('valid domain containing an extension'));

  // Duplicate rejection
  const dupRes = validateDomainInput('WWW.Amazon.DE', existing);
  assert.equal(dupRes.ok, false);
  assert.equal(dupRes.error, 'A rule for "amazon.de" already exists');

  // Valid new domain
  const validRes = validateDomainInput('WWW.Shop.test', existing);
  assert.equal(validRes.ok, true);
  assert.equal(validRes.clean, 'shop.test');
});

test('options unit: effective mode caption logic', () => {
  // Inheriting when autoConvertAll is false -> Ask
  assert.equal(getEffectiveSiteCaption(null, false), 'Uses default (Ask)');
  assert.equal(getEffectiveSiteCaption({}, false), 'Uses default (Ask)');
  assert.equal(getEffectiveSiteCaption({ mode: undefined }, false), 'Uses default (Ask)');

  // Inheriting when autoConvertAll is true -> Always
  assert.equal(getEffectiveSiteCaption(null, true), 'Uses default (Always)');
  assert.equal(getEffectiveSiteCaption({ mode: undefined }, true), 'Uses default (Always)');

  // Explicit mode set -> caption is empty
  assert.equal(getEffectiveSiteCaption({ mode: 'always' }, false), '');
  assert.equal(getEffectiveSiteCaption({ mode: 'always' }, true), '');
  assert.equal(getEffectiveSiteCaption({ mode: 'never' }, true), '');
  assert.equal(getEffectiveSiteCaption({ mode: 'ask' }, true), '');
});

test('options unit: pinned currencies limit enforcement (max 8)', () => {
  const empty = [];
  assert.equal(canAddPinned(empty), true);

  const seven = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NGN'];
  assert.equal(canAddPinned(seven), true);

  const eight = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NGN', 'INR'];
  assert.equal(canAddPinned(eight), false);

  const nine = [...eight, 'ZAR'];
  assert.equal(canAddPinned(nine), false);
});

test('options unit: import validation and migration round-trip', () => {
  // Valid v3 export
  const v3Settings = {
    ...DEFAULT_SETTINGS,
    targetCurrency: 'EUR',
    perSite: { 'shop.test': { mode: 'always', assumedCurrency: 'USD' } }
  };
  const importedV3 = validateImportContent(JSON.stringify(v3Settings));
  assert.equal(importedV3.targetCurrency, 'EUR');
  assert.equal(importedV3.perSite['shop.test'].mode, 'always');

  // Legacy v2 format with autoConvert / neverConvert boolean flags
  const legacyV2 = {
    schemaVersion: 2,
    targetCurrency: 'GBP',
    perSite: {
      'jumia.com.ng': { autoConvert: true, neverConvert: false },
      'reddit.com': { autoConvert: false, neverConvert: true }
    }
  };
  const importedV2 = validateImportContent(JSON.stringify(legacyV2));
  assert.equal(importedV2.schemaVersion, 3);
  assert.equal(importedV2.targetCurrency, 'GBP');
  assert.equal(importedV2.perSite['jumia.com.ng'].mode, 'always');
  assert.equal(importedV2.perSite['reddit.com'].mode, 'never');

  // Corrupted / garbage input
  assert.throws(() => validateImportContent('NOT A JSON'), /Invalid JSON/);
  assert.throws(() => validateImportContent('""'), /JSON object/);
  assert.throws(() => validateImportContent('[]'), /JSON object/);
  assert.throws(() => validateImportContent('null'), /JSON object/);
});

test('options unit: site rule mutations (add, change mode, set assumed currency, reset mode, remove)', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    perSite: {}
  };

  // 1. Add site rule
  const host = 'shop.test';
  setSiteMode(settings, host, 'always');
  assert.equal(settings.perSite[host].mode, 'always');

  // 2. Set assumed currency
  settings.perSite[host].assumedCurrency = 'EUR';
  assert.equal(settings.perSite[host].assumedCurrency, 'EUR');

  // 3. Reset mode clears explicit mode
  setSiteMode(settings, host, null);
  assert.equal(settings.perSite[host].mode, undefined);
  assert.equal(settings.perSite[host].assumedCurrency, 'EUR'); // preserves assumed currency

  // 4. Remove rule deletes entry entirely
  delete settings.perSite[host];
  assert.equal(settings.perSite[host], undefined);
});
