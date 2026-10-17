import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { PageScanner } from '../src/content/scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

function loadFixture(name) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

// Fixed mock rates table with EUR base
const mockRates = {
  EUR: 1.0,
  USD: 1.10,     // 1 EUR = 1.10 USD
  NGN: 1650.0,   // 1 EUR = 1650 NGN -> 1 USD = 1500 NGN
  GBP: 0.85,
  CAD: 1.50
};

test('scanner: simple text prices and byte-for-byte revert fidelity', () => {
  const html = loadFixture('simple.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates,
    displayMode: 'replace'
  });

  const convertedCount = scanner.convert();
  assert.equal(convertedCount, 2); // $199.99 and $9.95

  // Confirm prices were converted
  assert.ok(doc.body.innerHTML.includes('₦') || doc.body.innerHTML.includes('NGN'));
  assert.ok(!doc.body.innerHTML.includes('$199.99'));

  // Revert
  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml, 'Revert must restore byte-for-byte identical DOM');
});

test('scanner: European comma-decimal numbers (149,50 € and 1.299,99 €)', () => {
  const html = loadFixture('european.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'USD',
    ratesTable: mockRates,
    displayMode: 'replace'
  });

  const count = scanner.convert();
  assert.equal(count, 2);
  assert.ok(doc.body.innerHTML.includes('$') || doc.body.innerHTML.includes('USD'));
  assert.ok(!doc.body.innerHTML.includes('149,50 €'));

  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml);
});

test('scanner: Amazon split-price structure and revert fidelity', () => {
  const html = loadFixture('amazon_split.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates,
    displayMode: 'replace'
  });

  const count = scanner.convert();
  assert.ok(count >= 1);
  assert.ok(doc.body.innerHTML.includes('₦') || doc.body.innerHTML.includes('NGN'));

  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml, 'Amazon split price must revert cleanly');
});

test('scanner: sup cents structure and revert fidelity', () => {
  const html = loadFixture('sup_cents.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'EUR',
    ratesTable: mockRates,
    displayMode: 'replace'
  });

  const count = scanner.convert();
  assert.ok(count >= 1);
  assert.ok(doc.body.innerHTML.includes('€') || doc.body.innerHTML.includes('EUR'));

  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml);
});

test('scanner: ranges and was/now pairs', () => {
  const htmlRanges = loadFixture('ranges.html');
  const domRanges = new JSDOM(htmlRanges);
  const scannerRanges = new PageScanner({
    doc: domRanges.window.document,
    targetCurrency: 'CAD',
    ratesTable: mockRates
  });
  const countRanges = scannerRanges.convert();
  assert.ok(countRanges >= 2);

  const htmlWasNow = loadFixture('was_now.html');
  const domWasNow = new JSDOM(htmlWasNow);
  const scannerWasNow = new PageScanner({
    doc: domWasNow.window.document,
    targetCurrency: 'GBP',
    ratesTable: mockRates
  });
  const countWasNow = scannerWasNow.convert();
  assert.equal(countWasNow, 3); // $120.00, $79.99, $40.01
});

test('scanner: skip lists (input, textarea, code, pre, contenteditable, data-cc-ignore)', () => {
  const html = loadFixture('skip_lists.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates
  });

  const count = scanner.convert();
  // Only the .valid-price should be converted!
  assert.equal(count, 1);
  assert.equal(doc.querySelector('input').value, '$50.00');
  assert.equal(doc.querySelector('textarea').textContent, '$100.00');
  assert.equal(doc.querySelector('code').textContent, "const price = '$15.00';");
  assert.equal(doc.querySelector('[contenteditable="true"]').textContent, '$300.00');
  assert.equal(doc.querySelector('[data-cc-ignore]').textContent, '$400.00');
  assert.ok(doc.querySelector('.valid-price').textContent.includes('₦') || doc.querySelector('.valid-price').textContent.includes('NGN'));
});

test('scanner: idempotency (running convert twice changes nothing the second time)', () => {
  const html = loadFixture('simple.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates
  });

  const count1 = scanner.convert();
  const htmlAfterFirst = doc.body.innerHTML;

  const count2 = scanner.convert();
  const htmlAfterSecond = doc.body.innerHTML;

  assert.equal(count1, 2);
  assert.equal(count2, 0); // No new conversions
  assert.equal(htmlAfterFirst, htmlAfterSecond);
});

test('scanner: target currency equals source currency skip', () => {
  const html = loadFixture('simple.html');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  // Source is USD and target is USD -> should not convert
  const scanner = new PageScanner({
    doc,
    targetCurrency: 'USD',
    ratesTable: mockRates
  });

  const count = scanner.convert();
  assert.equal(count, 0);
  assert.equal(doc.body.innerHTML, originalHtml);
});

test('scanner: dynamic mutations via MutationObserver', async () => {
  const dom = new JSDOM('<div id="container"><div class="item">$10.00</div></div>');
  const doc = dom.window.document;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates
  });

  scanner.convert();
  scanner.startObserving();

  // Dynamically insert a new item
  const newItem = doc.createElement('div');
  newItem.className = 'new-item';
  newItem.textContent = 'Special Deal: $25.00';
  doc.getElementById('container').appendChild(newItem);

  // Wait for debounced mutation handler
  await new Promise(r => setTimeout(r, 200));

  assert.ok(newItem.textContent.includes('₦') || newItem.textContent.includes('NGN'));
  scanner.stopObserving();
});

test('scanner: nested inline elements (e.g. nested spans for symbol, whole, cents)', () => {
  const dom = new JSDOM('<div class="price-container"><span><span class="curr">$</span><span class="val">49</span>.<span class="dec">99</span></span></div>');
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'CAD',
    ratesTable: mockRates,
    displayMode: 'replace'
  });

  const count = scanner.convert();
  assert.equal(count, 1);
  assert.ok(doc.body.innerHTML.includes('CA$') || doc.body.innerHTML.includes('CAD'));

  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml, 'Nested inline elements must revert byte-for-byte');
});

test('scanner: open shadow DOM scanning and conversion', () => {
  const dom = new JSDOM('<div id="host"></div>');
  const doc = dom.window.document;
  const host = doc.getElementById('host');
  const shadow = host.attachShadow({ mode: 'open' });
  const shadowChild = doc.createElement('div');
  shadowChild.className = 'shadow-price';
  shadowChild.textContent = 'Member price: $35.00';
  shadow.appendChild(shadowChild);

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates,
    displayMode: 'replace'
  });

  const count = scanner.convert();
  assert.equal(count, 1);
  assert.ok(shadow.innerHTML.includes('₦') || shadow.innerHTML.includes('NGN'));

  scanner.revert();
  assert.equal(shadowChild.textContent, 'Member price: $35.00');
});

test('scanner: no infinite observer loop when scanner mutates DOM', async () => {
  const dom = new JSDOM('<div id="box"><span class="price">$12.50</span></div>');
  const doc = dom.window.document;

  let extraConvertCalls = 0;
  const scanner = new PageScanner({
    doc,
    targetCurrency: 'NGN',
    ratesTable: mockRates
  });

  scanner.convert();
  scanner.startObserving();

  const originalConvert = scanner.convert.bind(scanner);
  scanner.convert = (...args) => {
    extraConvertCalls++;
    return originalConvert(...args);
  };

  // Trigger internal revert & convert
  scanner.revert();
  scanner.convert();

  // Wait a debounce cycle
  await new Promise(r => setTimeout(r, 250));

  // The scanner should not trigger endless conversions from its own changes
  assert.equal(extraConvertCalls, 1, 'Only the manual convert() call should run, not an infinite observer loop');
  scanner.stopObserving();
});

