// src/shared/format.js
import { getCurrencyMeta } from './currencies.js';

/**
 * Formats a numeric currency amount safely using Intl.NumberFormat with fallback.
 * @param {number} amount
 * @param {string} currencyCode
 * @param {Object} options
 * @param {boolean} [options.roundWhole=false]
 * @param {string} [options.locale='en-US']
 * @returns {string}
 */
export function formatCurrency(amount, currencyCode, options = {}) {
  const code = (currencyCode || 'USD').toUpperCase();
  const meta = getCurrencyMeta(code);
  const roundWhole = Boolean(options.roundWhole);
  const locale = options.locale || 'en-US';

  const digits = roundWhole ? 0 : (meta ? meta.digits : 2);

  // Try standard Intl with currency style
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
    return formatter.format(amount);
  } catch {
    // Intl threw, possibly because code is a crypto ticker or non-standard ISO
  }

  // Fallback: format number part with decimal places + append or prepend symbol/code
  let numFormatted;
  try {
    numFormatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(amount);
  } catch {
    numFormatted = digits === 0 ? Math.round(amount).toString() : amount.toFixed(digits);
  }

  const symbol = meta ? (meta.narrowSymbol || meta.symbol || code) : code;

  // For symbols like $, €, £, ₦, ¥, ₿, prepend; for words/codes, append
  if (/^[^a-zA-Z0-9]$/.test(symbol)) {
    return `${symbol}${numFormatted}`;
  }
  return `${numFormatted} ${code}`;
}

/**
 * Formats the in-page price display according to the display mode setting.
 * @param {Object} params
 * @param {string} params.originalText - e.g. "$20.00"
 * @param {string} params.convertedText - e.g. "₦30,512.00"
 * @param {'replace'|'append'|'replace_highlight'} [params.displayMode='replace']
 * @returns {{ text: string, highlight: boolean }}
 */
export function formatPriceDisplay({ originalText, convertedText, displayMode = 'replace' }) {
  if (displayMode === 'append') {
    return {
      text: `${originalText} (≈ ${convertedText})`,
      highlight: false
    };
  }

  if (displayMode === 'replace_highlight') {
    return {
      text: convertedText,
      highlight: true
    };
  }

  // Default: replace
  return {
    text: convertedText,
    highlight: false
  };
}
