import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCurrency,
  extractAmount,
  extractPrices,
  parseNumberString
} from '../src/shared/parser.js';

test('parser: v1 backwards-compatible detectCurrency', () => {
  assert.equal(detectCurrency('$100'), 'USD');
  assert.equal(detectCurrency('CA$50'), 'CAD');
  assert.equal(detectCurrency('CAD$ 99'), 'CAD');
  assert.equal(detectCurrency('150 €'), 'EUR');
  assert.equal(detectCurrency('₦50,000'), 'NGN');
  assert.equal(detectCurrency('100 GBP'), 'GBP');
  assert.equal(detectCurrency('500 JPY'), 'JPY');
  assert.equal(detectCurrency('Just 500'), 'USD'); // default fallback
});

test('parser: v1 backwards-compatible extractAmount', () => {
  assert.equal(extractAmount('$1,299.99'), 1299.99);
  assert.equal(extractAmount('149,50 €'), 149.50);
  assert.equal(extractAmount('1.299,99 €'), 1299.99);
  assert.equal(extractAmount('₦50,000'), 50000);
  assert.equal(extractAmount('1,500'), 1500);
  assert.equal(extractAmount('CAD$ 75.50'), 75.50);
  assert.equal(extractAmount('Price: 99.00 USD'), 99.00);
  assert.equal(extractAmount('0'), null);
  assert.equal(extractAmount('0.00'), null);
  assert.equal(extractAmount('invalid price'), null);
});

test('parser: parseNumberString handles international formats and grouping', () => {
  // Dot decimal, comma thousands
  assert.equal(parseNumberString('1,234.56'), 1234.56);
  // Comma decimal, dot thousands
  assert.equal(parseNumberString('1.234,56'), 1234.56);
  // French / Russian space thousands
  assert.equal(parseNumberString('1 234,56'), 1234.56);
  assert.equal(parseNumberString('1\u00A0234,56'), 1234.56);
  assert.equal(parseNumberString('1\u202F234.56'), 1234.56);
  // Swiss apostrophe
  assert.equal(parseNumberString("1'234.56"), 1234.56);
  // Indian numbering
  assert.equal(parseNumberString('12,34,567.89'), 1234567.89);
  // Suffix multipliers (k, M, bn)
  assert.equal(parseNumberString('1.5', 1000), 1500);
  assert.equal(parseNumberString('2.5', 1000000), 2500000);
  assert.equal(parseNumberString('3', 1000000000), 3000000000);
});

test('parser: detectCurrency with contextual hints for ambiguous symbols', () => {
  // Ambiguous $ resolved via TLD
  assert.equal(detectCurrency('$50', { tld: 'ca' }), 'CAD');
  assert.equal(detectCurrency('$50', { tld: 'com.au' }), 'AUD');
  assert.equal(detectCurrency('$50', { tld: 'nz' }), 'NZD');
  assert.equal(detectCurrency('$50', { tld: 'com.sg' }), 'SGD');
  assert.equal(detectCurrency('$50', { tld: 'com.mx' }), 'MXN');

  // Ambiguous $ resolved via structured hint
  assert.equal(detectCurrency('$50', { structuredHint: 'HKD' }), 'HKD');

  // Ambiguous $ resolved via user override
  assert.equal(detectCurrency('$50', { siteOverride: 'CAD' }), 'CAD');

  // Explicit token always overrides context
  assert.equal(detectCurrency('CA$50', { tld: 'com.au' }), 'CAD');
  assert.equal(detectCurrency('€50', { tld: 'us' }), 'EUR');
  assert.equal(detectCurrency('50 EUR', { tld: 'us' }), 'EUR');
  assert.equal(detectCurrency('₦2,500', { tld: 'uk' }), 'NGN');

  // Ambiguous ¥
  assert.equal(detectCurrency('¥1000', { tld: 'co.jp' }), 'JPY');
  assert.equal(detectCurrency('¥1000', { tld: 'cn' }), 'CNY');

  // Ambiguous kr
  assert.equal(detectCurrency('100 kr', { tld: 'dk' }), 'DKK');
  assert.equal(detectCurrency('100 kr', { tld: 'no' }), 'NOK');
  assert.equal(detectCurrency('100 kr', { tld: 'se' }), 'SEK');
});

test('parser: extractPrices finds single and multiple prices in text', () => {
  const text1 = 'Only $25.99 today!';
  const prices1 = extractPrices(text1);
  assert.equal(prices1.length, 1);
  assert.equal(prices1[0].amount, 25.99);
  assert.equal(prices1[0].currency, 'USD');
  assert.equal(prices1[0].raw, '$25.99');

  const text2 = 'Was $99.00, now $49.50 (Save 50%)';
  const prices2 = extractPrices(text2);
  assert.equal(prices2.length, 2);
  assert.equal(prices2[0].amount, 99.00);
  assert.equal(prices2[1].amount, 49.50);

  const text3 = 'Tickets from €15.00 to €45.00';
  const prices3 = extractPrices(text3);
  assert.equal(prices3.length, 2);
  assert.equal(prices3[0].amount, 15.00);
  assert.equal(prices3[0].currency, 'EUR');
  assert.equal(prices3[1].amount, 45.00);
  assert.equal(prices3[1].currency, 'EUR');

  // Suffix format: 149,50 €
  const text4 = 'Prix: 149,50 € TTC';
  const prices4 = extractPrices(text4);
  assert.equal(prices4.length, 1);
  assert.equal(prices4[0].amount, 149.50);
  assert.equal(prices4[0].currency, 'EUR');

  // Suffixes: 1.5M attached to currency
  const text5 = 'Valued at $1.5M';
  const prices5 = extractPrices(text5);
  assert.equal(prices5.length, 1);
  assert.equal(prices5[0].amount, 1500000);

  // Negative prices: -$5 or ($5.00)
  const text6 = 'Discount: -$5.00 applied';
  const prices6 = extractPrices(text6);
  assert.equal(prices6.length, 1);
  assert.equal(prices6[0].amount, 5.00);
  assert.equal(prices6[0].isNegative, true);

  const text7 = 'Credit: ($12.50)';
  const prices7 = extractPrices(text7);
  assert.equal(prices7.length, 1);
  assert.equal(prices7[0].amount, 12.50);
  assert.equal(prices7[0].isNegative, true);
});

test('parser: reject non-prices', () => {
  // Years
  assert.equal(extractPrices('In 1999 things were different').length, 0);
  assert.equal(extractPrices('Published in 2024').length, 0);

  // Phone numbers
  assert.equal(extractPrices('Call +1 800 555 1234').length, 0);

  // Versions and quantities without currency
  assert.equal(extractPrices('Version 2.0.0 released with 500 fixes').length, 0);
  assert.equal(extractPrices('There are 42 apples and 100 oranges').length, 0);
  assert.equal(extractPrices('Percentage is 99.5%').length, 0);
});

test('parser: price range detection', () => {
  const range1 = extractPrices('$10 – $20');
  // Two prices or range
  assert.ok(range1.length >= 1);
  if (range1.length === 1 && range1[0].isRange) {
    assert.equal(range1[0].amount, 10);
    assert.equal(range1[0].rangeEndAmount, 20);
  } else {
    assert.equal(range1[0].amount, 10);
    assert.equal(range1[1].amount, 20);
  }
});
