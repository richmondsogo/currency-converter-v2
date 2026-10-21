import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractPrices } from '../src/shared/parser.js';
import { PageScanner } from '../src/content/scanner.js';

test('B2 Regression: Parser currency labels and boundary tests', () => {
  // 1. "US $133.00" -> USD 133.00, whole token consumed
  const r1 = extractPrices('US $133.00');
  assert.equal(r1.length, 1);
  assert.equal(r1[0].currency, 'USD');
  assert.equal(r1[0].amount, 133);
  assert.equal(r1[0].raw, 'US $133.00');
  assert.equal(r1[0].startIndex, 0);
  assert.equal(r1[0].endIndex, 10);

  // 2. "+US $15.50 shipping" -> USD 15.50, " shipping" untouched
  const r2 = extractPrices('+US $15.50 shipping');
  assert.equal(r2.length, 1);
  assert.equal(r2[0].currency, 'USD');
  assert.equal(r2[0].amount, 15.5);
  assert.equal(r2[0].raw, 'US $15.50');
  assert.equal(r2[0].startIndex, 1);
  assert.equal(r2[0].endIndex, 10);

  // 3. "US$25" and "USD 25" -> unchanged behavior
  const r3a = extractPrices('US$25');
  assert.equal(r3a.length, 1);
  assert.equal(r3a[0].currency, 'USD');
  assert.equal(r3a[0].amount, 25);
  assert.equal(r3a[0].raw, 'US$25');

  const r3b = extractPrices('USD 25');
  assert.equal(r3b.length, 1);
  assert.equal(r3b[0].currency, 'USD');
  assert.equal(r3b[0].amount, 25);
  assert.equal(r3b[0].raw, 'USD 25');

  // 4. "$399.00 USD" -> USD 399.00, trailing USD consumed
  const r4 = extractPrices('$399.00 USD');
  assert.equal(r4.length, 1);
  assert.equal(r4[0].currency, 'USD');
  assert.equal(r4[0].amount, 399);
  assert.equal(r4[0].raw, '$399.00 USD');
  assert.equal(r4[0].startIndex, 0);
  assert.equal(r4[0].endIndex, 11);

  // 5. "$25 CAD" -> CAD 25 (trailing code wins over ambiguous $)
  const r5 = extractPrices('$25 CAD');
  assert.equal(r5.length, 1);
  assert.equal(r5[0].currency, 'CAD');
  assert.equal(r5[0].amount, 25);
  assert.equal(r5[0].raw, '$25 CAD');
  assert.equal(r5[0].startIndex, 0);
  assert.equal(r5[0].endIndex, 7);

  // 6. "CA $25", "AU $25" -> CAD / AUD (country-prefix rule)
  const r6a = extractPrices('CA $25');
  assert.equal(r6a.length, 1);
  assert.equal(r6a[0].currency, 'CAD');
  assert.equal(r6a[0].amount, 25);
  assert.equal(r6a[0].raw, 'CA $25');

  const r6b = extractPrices('AU $25');
  assert.equal(r6b.length, 1);
  assert.equal(r6b[0].currency, 'AUD');
  assert.equal(r6b[0].amount, 25);
  assert.equal(r6b[0].raw, 'AU $25');

  // 7. "US $10 - US $20" -> a USD range, both tokens consumed
  const r7 = extractPrices('US $10 - US $20');
  assert.ok(r7.length >= 1);
  assert.equal(r7[0].currency, 'USD');
  assert.equal(r7[r7.length - 1].currency, 'USD');

  // 8. "$25 USDA" -> USD 25, " USDA" untouched (word boundary prevents matching USDA)
  const r8 = extractPrices('$25 USDA');
  assert.equal(r8.length, 1);
  assert.equal(r8[0].currency, 'USD');
  assert.equal(r8[0].amount, 25);
  assert.equal(r8[0].raw, '$25');
  assert.equal(r8[0].startIndex, 0);
  assert.equal(r8[0].endIndex, 3);

  // 9. "or as low as $24.73/mo" -> converts, "/mo" untouched
  const r9 = extractPrices('or as low as $24.73/mo');
  assert.equal(r9.length, 1);
  assert.equal(r9[0].currency, 'USD');
  assert.equal(r9[0].amount, 24.73);
  assert.equal(r9[0].raw, '$24.73');

  // 10. "From $ To" with no digits -> untouched
  const r10 = extractPrices('From $ To');
  assert.equal(r10.length, 0);
});

test('B2 Regression: DOM PageScanner no stray labels or prefix leftovers', () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="item1">US $133.00</div>
        <div id="shipping">+US $15.50 shipping</div>
        <div id="item2">$399.00 USD</div>
        <div id="struck"><s>$1,107.92 USD</s></div>
        <div id="cad">$25 CAD</div>
        <div id="ca">CA $25</div>
        <div id="usda">$25 USDA</div>
      </body>
    </html>
  `);

  const scanner = new PageScanner({
    doc: dom.window.document,
    targetCurrency: 'NGN',
    ratesTable: { USD: 1, NGN: 1500, CAD: 1.35, EUR: 0.92 }
  });

  scanner.convert();

  const item1Text = dom.window.document.getElementById('item1').textContent;
  const shippingText = dom.window.document.getElementById('shipping').textContent;
  const item2Text = dom.window.document.getElementById('item2').textContent;
  const struckHtml = dom.window.document.getElementById('struck').innerHTML;
  const cadText = dom.window.document.getElementById('cad').textContent;
  const caText = dom.window.document.getElementById('ca').textContent;
  const usdaText = dom.window.document.getElementById('usda').textContent;

  // No stray "US "
  assert.ok(!item1Text.includes('US '), `item1 must not contain stray 'US ': ${item1Text}`);
  assert.match(item1Text, /NGN\s*199,500/);

  assert.ok(!shippingText.includes('US '), `shipping must not contain stray 'US ': ${shippingText}`);
  assert.match(shippingText, /NGN[\s\u00A0]*23,250(?:\.00)?\s*shipping/);

  // No stray " USD"
  assert.ok(!item2Text.includes('USD'), `item2 must not contain stray 'USD': ${item2Text}`);
  assert.match(item2Text, /NGN\s*598,500/);

  // Strikethrough tag <s> preserved
  assert.ok(struckHtml.startsWith('<s>') && struckHtml.endsWith('</s>'), `<s> tag must be preserved: ${struckHtml}`);
  assert.ok(!struckHtml.includes('USD'), `struck price must not contain stray 'USD': ${struckHtml}`);

  // CAD trailing override
  assert.ok(!cadText.includes('CAD'), `cadText must not contain stray 'CAD': ${cadText}`);
  // CA $25 -> CAD
  assert.ok(!caText.includes('CA '), `caText must not contain stray 'CA ': ${caText}`);

  // $25 USDA -> " USDA" untouched
  assert.ok(usdaText.includes('USDA'), `usdaText must leave 'USDA' untouched: ${usdaText}`);
});
