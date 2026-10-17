import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrencyMeta,
  getAllCurrencies,
  resolveAmbiguousSymbol,
  isAmbiguousSymbol,
  getCurrencyByTld,
  getCurrencyByLang
} from '../src/shared/currencies.js';

test('currencies: getCurrencyMeta returns correct metadata for fiat and crypto', () => {
  const usd = getCurrencyMeta('USD');
  assert.equal(usd.code, 'USD');
  assert.equal(usd.digits, 2);
  assert.equal(usd.crypto, false);

  const jpy = getCurrencyMeta('JPY');
  assert.equal(jpy.code, 'JPY');
  assert.equal(jpy.digits, 0);

  const kwd = getCurrencyMeta('KWD');
  assert.equal(kwd.code, 'KWD');
  assert.equal(kwd.digits, 3);

  const btc = getCurrencyMeta('BTC');
  assert.equal(btc.code, 'BTC');
  assert.equal(btc.crypto, true);

  assert.equal(getCurrencyMeta('NONEXISTENT'), null);
});

test('currencies: getAllCurrencies filters crypto and availableCodes properly', () => {
  const allNoCrypto = getAllCurrencies({ includeCrypto: false });
  assert.ok(allNoCrypto.length >= 160);
  assert.ok(allNoCrypto.every(c => !c.crypto));

  const allWithCrypto = getAllCurrencies({ includeCrypto: true });
  assert.ok(allWithCrypto.length > allNoCrypto.length);
  assert.ok(allWithCrypto.some(c => c.crypto && c.code === 'BTC'));

  const filtered = getAllCurrencies({
    includeCrypto: true,
    availableCodes: new Set(['USD', 'EUR', 'BTC'])
  });
  assert.equal(filtered.length, 3);
  assert.deepEqual(filtered.map(c => c.code).sort(), ['BTC', 'EUR', 'USD']);
});

test('currencies: TLD and language resolution', () => {
  assert.equal(getCurrencyByTld('ca'), 'CAD');
  assert.equal(getCurrencyByTld('store.amazon.co.uk'), 'GBP');
  assert.equal(getCurrencyByTld('shop.com.au'), 'AUD');
  assert.equal(getCurrencyByTld('jumia.com.ng'), 'NGN');
  assert.equal(getCurrencyByTld('unknown.xyz'), null);

  assert.equal(getCurrencyByLang('en-GB'), 'GBP');
  assert.equal(getCurrencyByLang('en-CA'), 'CAD');
  assert.equal(getCurrencyByLang('ja-JP'), 'JPY');
  assert.equal(getCurrencyByLang('pt-BR'), 'BRL');
  assert.equal(getCurrencyByLang('en-US'), 'USD');
});

test('currencies: resolveAmbiguousSymbol priority order', () => {
  // 1. User per-site override wins
  const res1 = resolveAmbiguousSymbol('$', {
    siteOverride: 'CAD',
    structuredHint: 'AUD',
    tld: 'co.uk',
    htmlLang: 'en-NZ',
    ambiguousDollarSetting: 'USD'
  });
  assert.equal(res1, 'CAD');

  // 2. Structured page hint
  const res2 = resolveAmbiguousSymbol('$', {
    structuredHint: 'AUD',
    tld: 'ca',
    htmlLang: 'en-NZ',
    ambiguousDollarSetting: 'USD'
  });
  assert.equal(res2, 'AUD');

  // 3. TLD hint
  const res3 = resolveAmbiguousSymbol('$', {
    tld: 'ca',
    htmlLang: 'en-NZ',
    ambiguousDollarSetting: 'USD'
  });
  assert.equal(res3, 'CAD');

  // 4. Lang hint
  const res4 = resolveAmbiguousSymbol('$', {
    htmlLang: 'en-NZ',
    ambiguousDollarSetting: 'USD'
  });
  assert.equal(res4, 'NZD');

  // 5. User global ambiguous $ setting
  const res5 = resolveAmbiguousSymbol('$', {
    ambiguousDollarSetting: 'CAD'
  });
  assert.equal(res5, 'CAD');

  // Default fallback for $
  const res6 = resolveAmbiguousSymbol('$');
  assert.equal(res6, 'USD');

  // Non-dollar ambiguous symbol: ¥ with Japanese TLD vs Chinese TLD
  assert.equal(resolveAmbiguousSymbol('¥', { tld: 'co.jp' }), 'JPY');
  assert.equal(resolveAmbiguousSymbol('¥', { tld: 'cn' }), 'CNY');
  assert.equal(resolveAmbiguousSymbol('¥'), 'JPY'); // default

  // kr: SEK vs NOK vs DKK
  assert.equal(resolveAmbiguousSymbol('kr', { tld: 'dk' }), 'DKK');
  assert.equal(resolveAmbiguousSymbol('kr', { tld: 'no' }), 'NOK');
  assert.equal(resolveAmbiguousSymbol('kr', { tld: 'se' }), 'SEK');
  assert.equal(resolveAmbiguousSymbol('kr'), 'SEK'); // default
});
