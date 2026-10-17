// src/shared/currencies.js
import {
  CURRENCIES_DATA,
  CCTLD_TO_CURRENCY,
  AMBIGUOUS_SYMBOLS,
  POPULAR_CRYPTO_CODES
} from './currencies-data.js';

// Region code to currency mapping for <html lang="xx-YY">
const REGION_TO_CURRENCY = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  UK: 'GBP',
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  NG: 'NGN',
  BR: 'BRL',
  ZA: 'ZAR',
  MX: 'MXN',
  SG: 'SGD',
  HK: 'HKD',
  KR: 'KRW',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  IS: 'ISK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  TR: 'TRY',
  RU: 'RUB',
  UA: 'UAH',
  IL: 'ILS',
  AE: 'AED',
  SA: 'SAR',
  EG: 'EGP',
  KE: 'KES',
  GH: 'GHS',
  TH: 'THB',
  VN: 'VND',
  PH: 'PHP',
  MY: 'MYR',
  ID: 'IDR',
  PK: 'PKR',
  BD: 'BDT',
  // Eurozone countries
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  GR: 'EUR'
};

export function getCurrencyMeta(code) {
  if (!code) return null;
  const upper = code.toUpperCase();
  return CURRENCIES_DATA[upper] || null;
}

export function getAllCurrencies({ includeCrypto = false, availableCodes = null } = {}) {
  const list = Object.values(CURRENCIES_DATA);
  return list.filter(item => {
    if (!includeCrypto && item.crypto) return false;
    if (availableCodes && !availableCodes.has(item.code)) return false;
    return true;
  });
}

export function isAmbiguousSymbol(symbol) {
  return Boolean(AMBIGUOUS_SYMBOLS[symbol]);
}

export function getCurrencyByTld(hostnameOrTld) {
  if (!hostnameOrTld) return null;
  const lower = hostnameOrTld.toLowerCase();
  
  // Try direct lookup
  if (CCTLD_TO_CURRENCY[lower]) {
    return CCTLD_TO_CURRENCY[lower];
  }

  // Extract from full domain: e.g. store.amazon.co.uk -> check 'co.uk', then 'uk'
  const parts = lower.split('.');
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (CCTLD_TO_CURRENCY[lastTwo]) {
      return CCTLD_TO_CURRENCY[lastTwo];
    }
    const lastOne = parts[parts.length - 1];
    if (CCTLD_TO_CURRENCY[lastOne]) {
      return CCTLD_TO_CURRENCY[lastOne];
    }
  }

  return null;
}

export function getCurrencyByLang(langString) {
  if (!langString) return null;
  // Format could be "en-US", "en_GB", "ja", "fr-FR"
  const normalized = langString.trim().replace('_', '-');
  const match = normalized.match(/^[a-zA-Z]{2,3}(?:-([a-zA-Z]{2}))?/);
  if (!match) return null;

  const region = match[1] ? match[1].toUpperCase() : null;
  if (region && REGION_TO_CURRENCY[region]) {
    return REGION_TO_CURRENCY[region];
  }

  // Language without region fallback for specific monolingual currencies
  const primaryLang = normalized.split('-')[0].toLowerCase();
  const langFallback = {
    ja: 'JPY',
    ko: 'KRW',
    th: 'THB',
    vi: 'VND',
    pl: 'PLN',
    cs: 'CZK',
    hu: 'HUF',
    tr: 'TRY',
    uk: 'UAH',
    he: 'ILS',
    el: 'EUR',
    da: 'DKK',
    sv: 'SEK',
    nb: 'NOK',
    nn: 'NOK'
  };

  return langFallback[primaryLang] || null;
}

/**
 * Pure function to resolve ambiguous symbols like $, ¥, kr, £, Rs, etc.
 * Detection priority:
 * 1. User per-site override
 * 2. Structured page hint (JSON-LD, og:price:currency, itemprop)
 * 3. Site TLD hint
 * 4. <html lang> hint
 * 5. User global ambiguous $ setting (for $)
 * 6. Default candidate fallback
 */
export function resolveAmbiguousSymbol(symbol, context = {}) {
  const config = AMBIGUOUS_SYMBOLS[symbol];
  if (!config) {
    return 'USD';
  }

  const {
    siteOverride,
    structuredHint,
    tld,
    htmlLang,
    ambiguousDollarSetting
  } = context;

  // 1. User per-site override
  if (siteOverride && config.candidates.includes(siteOverride.toUpperCase())) {
    return siteOverride.toUpperCase();
  }

  // 2. Structured page hints
  if (structuredHint && config.candidates.includes(structuredHint.toUpperCase())) {
    return structuredHint.toUpperCase();
  }

  // 3. TLD hints
  if (tld) {
    const tldCurrency = getCurrencyByTld(tld);
    if (tldCurrency && config.candidates.includes(tldCurrency)) {
      return tldCurrency;
    }
  }

  // 4. HTML lang region hints
  if (htmlLang) {
    const langCurrency = getCurrencyByLang(htmlLang);
    if (langCurrency && config.candidates.includes(langCurrency)) {
      return langCurrency;
    }
  }

  // 5. Global ambiguous setting (e.g. for '$')
  if (symbol === '$' && ambiguousDollarSetting && config.candidates.includes(ambiguousDollarSetting.toUpperCase())) {
    return ambiguousDollarSetting.toUpperCase();
  }

  // 6. Default fallback
  return config.default;
}

export {
  CURRENCIES_DATA,
  CCTLD_TO_CURRENCY,
  AMBIGUOUS_SYMBOLS,
  POPULAR_CRYPTO_CODES
};
