import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrency,
  formatPriceDisplay
} from '../src/shared/format.js';

test('format: standard fiat currency with minor digits', () => {
  const usd = formatCurrency(1234.56, 'USD');
  // Format should be $1,234.56 or 1,234.56 USD depending on locale/standard
  assert.ok(usd.includes('1,234.56') || usd.includes('1.234,56'));
  assert.ok(usd.includes('$') || usd.includes('USD'));

  // 0 decimals for JPY
  const jpy = formatCurrency(500.8, 'JPY');
  assert.ok(jpy.includes('501') || jpy.includes('500')); // rounded to whole number
  assert.ok(!jpy.includes('.8'));

  // 3 decimals for KWD
  const kwd = formatCurrency(12.3456, 'KWD');
  assert.ok(kwd.includes('12.346') || kwd.includes('12,346'));
});

test('format: round to whole numbers option', () => {
  const usdWhole = formatCurrency(1234.56, 'USD', { roundWhole: true });
  assert.ok(usdWhole.includes('1,235') || usdWhole.includes('1.235'));
  assert.ok(!usdWhole.includes('.56') && !usdWhole.includes(',56'));
});

test('format: crypto fallback when Intl does not recognize currency code', () => {
  const btc = formatCurrency(0.0456, 'BTC');
  assert.ok(btc.includes('0.0456'));
  assert.ok(btc.includes('BTC') || btc.includes('₿'));
});

test('format: display modes (replace, append, replace+highlight)', () => {
  const original = '$20.00';
  const converted = '₦30,512.00';

  // 1. Replace mode
  const resReplace = formatPriceDisplay({
    originalText: original,
    convertedText: converted,
    displayMode: 'replace'
  });
  assert.equal(resReplace.text, '₦30,512.00');
  assert.equal(resReplace.highlight, false);

  // 2. Append mode
  const resAppend = formatPriceDisplay({
    originalText: original,
    convertedText: converted,
    displayMode: 'append'
  });
  assert.equal(resAppend.text, '$20.00 (≈ ₦30,512.00)');
  assert.equal(resAppend.highlight, false);

  // 3. Replace + highlight mode
  const resHighlight = formatPriceDisplay({
    originalText: original,
    convertedText: converted,
    displayMode: 'replace_highlight'
  });
  assert.equal(resHighlight.text, '₦30,512.00');
  assert.equal(resHighlight.highlight, true);
});
