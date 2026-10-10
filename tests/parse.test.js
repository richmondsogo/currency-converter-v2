const assert = require('assert');

// Currency symbol mappings matching src/background.js
const SYMBOL_MAP = {
  "CAD$": "CAD",
  "CA$":  "CAD",
  "NZ$":  "NZD",
  "HK$":  "HKD",
  "US$":  "USD",
  "A$":   "AUD",
  "AU$":  "AUD",
  "S$":   "SGD",
  "SG$":  "SGD",
  "R$":   "BRL",
  "CHF":  "CHF",
  "€":    "EUR",
  "£":    "GBP",
  "¥":    "JPY",
  "₦":    "NGN",
  "₹":    "INR",
  "₩":    "KRW",
  "zł":   "PLN",
  "Kč":   "CZK",
  "kr":   "SEK",
  "$":    "USD",
};

const ISO_CODES = [
  "USD","EUR","GBP","CAD","AUD","NZD","JPY","INR","KRW","CHF",
  "ZAR","HKD","SGD","MXN","BRL","SEK","NOK","DKK","PLN","CZK",
  "HUF","TRY","CNY","THB","MYR","PHP","IDR","AED","SAR","EGP",
  "NGN","KES","GHS","MAD","CLP","COP","PEN","ARS","PKR","ILS",
];

function detectCurrency(text) {
  for (const [sym, code] of Object.entries(SYMBOL_MAP)) {
    if (text.includes(sym)) return code;
  }
  const upper = text.toUpperCase();
  for (const code of ISO_CODES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  return "USD";
}

function extractAmount(text) {
  let s = text
    .replace(/[£€₦₹₩¥₣$]/g, " ")
    .replace(/\b[A-Z]{3}\b/g, " ")
    .trim();

  const match = s.match(/\d[\d,. ]*/);
  if (!match) return null;

  let raw = match[0].trim();

  if (raw.includes(",") && raw.includes(".")) {
    if (raw.indexOf(",") < raw.indexOf(".")) {
      raw = raw.replace(/,/g, "");
    } else {
      raw = raw.replace(/\./g, "").replace(",", ".");
    }
  } else if (raw.includes(",")) {
    if (/,\d{1,2}$/.test(raw)) {
      raw = raw.replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  }

  raw = raw.replace(/\s+/g, "");

  const n = parseFloat(raw);
  return isNaN(n) || n <= 0 ? null : n;
}

// Suite execution
console.log('[Test Suite] Running Currency Converter unit tests...');

// Currency detection tests
assert.strictEqual(detectCurrency('$100'), 'USD');
assert.strictEqual(detectCurrency('CA$50'), 'CAD');
assert.strictEqual(detectCurrency('CAD$ 99'), 'CAD');
assert.strictEqual(detectCurrency('150 €'), 'EUR');
assert.strictEqual(detectCurrency('₦50,000'), 'NGN');
assert.strictEqual(detectCurrency('100 GBP'), 'GBP');
assert.strictEqual(detectCurrency('500 JPY'), 'JPY');
assert.strictEqual(detectCurrency('Just 500'), 'USD', 'Should default to USD');

// Amount parsing tests
assert.strictEqual(extractAmount('$1,299.99'), 1299.99);
assert.strictEqual(extractAmount('149,50 €'), 149.50);
assert.strictEqual(extractAmount('1.299,99 €'), 1299.99);
assert.strictEqual(extractAmount('₦50,000'), 50000);
assert.strictEqual(extractAmount('1,500'), 1500);
assert.strictEqual(extractAmount('CAD$ 75.50'), 75.50);
assert.strictEqual(extractAmount('Price: 99.00 USD'), 99.00);
assert.strictEqual(extractAmount('0'), null, 'Zero amount should return null');
assert.strictEqual(extractAmount('0.00'), null, 'Zero float should return null');
assert.strictEqual(extractAmount('invalid price'), null, 'Non-numeric string should return null');

console.log('[Test Suite] All unit tests passed successfully.');
