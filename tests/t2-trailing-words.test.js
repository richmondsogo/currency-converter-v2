import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPrices } from '../src/shared/parser.js';

test('T2: Trailing-word safety and currency code consumption', () => {
  // 1. "$30 OFF" must leave " OFF" untouched
  const r1 = extractPrices('$30 OFF');
  assert.equal(r1.length, 1);
  assert.equal(r1[0].raw, '$30');
  assert.equal(r1[0].amount, 30);
  assert.equal(r1[0].currency, 'USD');
  assert.equal(r1[0].endIndex, 3);

  // 2. "$20 FREE" must leave " FREE" untouched
  const r2 = extractPrices('$20 FREE');
  assert.equal(r2.length, 1);
  assert.equal(r2[0].raw, '$20');
  assert.equal(r2[0].amount, 20);
  assert.equal(r2[0].currency, 'USD');
  assert.equal(r2[0].endIndex, 3);

  // 3. "$5 PER month" must leave " PER month" untouched
  const r3 = extractPrices('$5 PER month');
  assert.equal(r3.length, 1);
  assert.equal(r3[0].raw, '$5');
  assert.equal(r3[0].amount, 5);
  assert.equal(r3[0].currency, 'USD');
  assert.equal(r3[0].endIndex, 2);

  // 4. "$10 MIN" must leave " MIN" untouched
  const r4 = extractPrices('$10 MIN');
  assert.equal(r4.length, 1);
  assert.equal(r4[0].raw, '$10');
  assert.equal(r4[0].amount, 10);
  assert.equal(r4[0].currency, 'USD');
  assert.equal(r4[0].endIndex, 3);

  // 5. "$25 XYZ" must leave " XYZ" untouched
  const r5 = extractPrices('$25 XYZ');
  assert.equal(r5.length, 1);
  assert.equal(r5[0].raw, '$25');
  assert.equal(r5[0].amount, 25);
  assert.equal(r5[0].currency, 'USD');
  assert.equal(r5[0].endIndex, 3);

  // 6. "$25 USD", "$25 CAD", "$25 NGN" consume the real code
  const r6a = extractPrices('$25 USD');
  assert.equal(r6a.length, 1);
  assert.equal(r6a[0].raw, '$25 USD');
  assert.equal(r6a[0].amount, 25);
  assert.equal(r6a[0].currency, 'USD');
  assert.equal(r6a[0].endIndex, 7);

  const r6b = extractPrices('$25 CAD');
  assert.equal(r6b.length, 1);
  assert.equal(r6b[0].raw, '$25 CAD');
  assert.equal(r6b[0].amount, 25);
  assert.equal(r6b[0].currency, 'CAD');
  assert.equal(r6b[0].endIndex, 7);

  const r6c = extractPrices('$25 NGN');
  assert.equal(r6c.length, 1);
  assert.equal(r6c[0].raw, '$25 NGN');
  assert.equal(r6c[0].amount, 25);
  assert.equal(r6c[0].currency, 'NGN');
  assert.equal(r6c[0].endIndex, 7);

  // 7. "US $10 - US $20" is one USD range with both tokens consumed
  const r7 = extractPrices('US $10 - US $20');
  assert.equal(r7.length, 2);
  assert.equal(r7[0].raw, 'US $10');
  assert.equal(r7[0].amount, 10);
  assert.equal(r7[0].currency, 'USD');
  assert.equal(r7[1].raw, 'US $20');
  assert.equal(r7[1].amount, 20);
  assert.equal(r7[1].currency, 'USD');
});
