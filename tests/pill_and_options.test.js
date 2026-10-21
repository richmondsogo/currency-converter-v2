import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseNumberString } from '../src/shared/parser.js';
import { PageScanner } from '../src/content/scanner.js';
import { InPageUI } from '../src/content/ui.js';

test('parser: parseNumberString handles 0,500 as decimal 0.5 without stripping to 500', () => {
  assert.equal(parseNumberString('0,500'), 0.5);
  assert.equal(parseNumberString('0,250'), 0.25);
  assert.equal(parseNumberString('0,75'), 0.75);
  assert.equal(parseNumberString('0,999'), 0.999);
  assert.equal(parseNumberString('1,500'), 1500); // 3 digits after comma without leading 0 is thousands
  assert.equal(parseNumberString('149,50'), 149.5); // 2 digits after comma is decimal
  assert.equal(parseNumberString('1.299,99'), 1299.99);
});

test('scanner: multiple convert-revert-convert cycles succeed without dropping elements', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="test"><p>Item 1: $100.00</p><p>Item 2: $250.00</p></div></body></html>');
  const doc = dom.window.document;
  const originalHtml = doc.body.innerHTML;

  const ratesTable = {
    USD: 1.10,
    EUR: 1.0,
    GBP: 0.85
  };

  const scanner = new PageScanner({
    doc,
    targetCurrency: 'EUR',
    ratesTable,
    displayMode: 'replace'
  });

  // Cycle 1: Convert
  const c1 = scanner.convert();
  assert.equal(c1, 2, 'First conversion should convert 2 prices');
  assert.ok(!doc.body.innerHTML.includes('$100.00'));

  // Cycle 1: Revert
  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml, 'Revert must restore exact original HTML');

  // Cycle 2: Convert again! (Previously failed and returned 0)
  const c2 = scanner.convert();
  assert.equal(c2, 2, 'Second conversion after revert must convert 2 prices again');
  assert.ok(!doc.body.innerHTML.includes('$100.00'));

  // Cycle 2: Revert
  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml, 'Second revert must restore exact original HTML');

  // Cycle 3: Convert with highlight display mode
  scanner.displayMode = 'replace_highlight';
  const c3 = scanner.convert();
  assert.equal(c3, 2, 'Third conversion in highlight mode should convert 2 prices');
  assert.ok(doc.body.innerHTML.includes('cc-price-highlight'));

  // Cycle 3: Revert
  scanner.revert();
  assert.equal(doc.body.innerHTML, originalHtml, 'Reverting highlight mode restores original DOM');
});

test('ui: InPageUI lifecycle, segmented switch, collapse, and updates', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;

  let showOriginalCalled = false;
  let convertCalled = false;
  let changeCurrencyCalled = null;

  const ui = new InPageUI({
    doc,
    targetCurrency: 'EUR',
    isConverted: true,
    convertedCount: 14,
    theme: 'dark',
    onShowOriginal: () => { showOriginalCalled = true; },
    onConvert: (cur) => { convertCalled = true; },
    onChangeCurrency: (cur) => { changeCurrencyCalled = cur; }
  });

  ui.mount('/* css */');

  assert.ok(ui.rootContainer, 'Shadow DOM root container should be mounted');
  assert.ok(ui.barElement, 'Bar element created');
  assert.ok(ui.collapsedElement, 'Collapsed element created');
  assert.ok(ui.tooltipElement, 'Tooltip element created');

  // Verify segmented buttons
  const btnOriginal = ui.barElement.querySelector('.cc-segment-original');
  const btnConverted = ui.barElement.querySelector('.cc-segment-converted');
  const countBadge = ui.barElement.querySelector('.cc-count-badge');
  const codeSpan = ui.barElement.querySelector('.cc-currency-code');

  assert.ok(btnConverted.classList.contains('active'), 'Converted segment should be active initially');
  assert.equal(countBadge.textContent, '14');
  assert.equal(codeSpan.textContent, 'EUR');

  // Click Original segment
  btnOriginal.click();
  assert.ok(showOriginalCalled, 'Clicking original segment triggers onShowOriginal callback');
  assert.ok(btnOriginal.classList.contains('active'), 'Original segment is now active');
  assert.ok(!btnConverted.classList.contains('active'), 'Converted segment is no longer active');

  // Click Converted segment
  btnConverted.click();
  assert.ok(convertCalled, 'Clicking converted segment triggers onConvert callback');

  // Test dynamic update()
  ui.update({
    isConverted: true,
    targetCurrency: 'GBP',
    count: 22
  });
  assert.equal(codeSpan.textContent, 'GBP');
  assert.equal(countBadge.textContent, '22');

  // Test collapse toggle
  assert.equal(ui.isCollapsed, false);
  ui.toggleCollapse();
  assert.equal(ui.isCollapsed, true);
  assert.equal(ui.barElement.style.display, 'none');
  assert.equal(ui.collapsedElement.style.display, 'inline-flex');

  // Expand
  ui.toggleCollapse();
  assert.equal(ui.isCollapsed, false);
  assert.equal(ui.barElement.style.display, 'flex');

  // Test Tooltip display and hide
  const sampleTarget = doc.createElement('span');
  sampleTarget.getBoundingClientRect = () => ({
    left: 100,
    top: 150,
    right: 180,
    bottom: 170,
    width: 80,
    height: 20
  });

  ui.showTooltip({
    originalAmount: 199.99,
    originalCurrency: 'USD',
    convertedAmount: 165.50,
    rate: 0.8275,
    date: '2026-10-20',
    targetElement: sampleTarget,
    x: 140,
    y: 160
  });

  assert.ok(ui.tooltipElement.classList.contains('visible'), 'Tooltip should be visible');
  const title = ui.tooltipElement.querySelector('.cc-tooltip-title');
  assert.ok(title.textContent.includes('199.99'));

  ui.hideTooltip();
  assert.ok(!ui.tooltipElement.classList.contains('visible'), 'Tooltip should be hidden');

  ui.unmount();
  assert.equal(ui.rootContainer, null);
});

test('popup: isRestrictedPage correctly identifies system vs web pages', async () => {
  const { isRestrictedPage } = await import('../src/popup/popup.js');

  assert.equal(isRestrictedPage(undefined), false);
  assert.equal(isRestrictedPage(''), false);
  assert.equal(isRestrictedPage('https://www.jumia.com.ng/'), false);
  assert.equal(isRestrictedPage('http://localhost:3000'), false);
  assert.equal(isRestrictedPage('https://amazon.com'), false);
  assert.equal(isRestrictedPage('chrome://extensions'), true);
  assert.equal(isRestrictedPage('edge://settings'), true);
  assert.equal(isRestrictedPage('about:blank'), true);
  assert.equal(isRestrictedPage('moz-extension://some-uuid/popup.html'), true);
  assert.equal(isRestrictedPage('chrome-extension://some-id/options.html'), true);
  assert.equal(isRestrictedPage('https://chromewebstore.google.com/detail/123'), true);
  assert.equal(isRestrictedPage('https://addons.mozilla.org/en-US/firefox/addon/123'), true);
});

test('ui: Dynamic Island pill displays source -> target currency in compact view', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;

  const ui = new InPageUI({
    doc,
    sourceCurrency: 'NGN',
    targetCurrency: 'USD',
    isConverted: true,
    convertedCount: 4
  });
  ui.mount();

  const codeSpan = ui.barElement.querySelector('.cc-currency-code');
  assert.equal(codeSpan.textContent, 'NGN → USD');
  const countBadge = ui.barElement.querySelector('.cc-count-badge');
  assert.equal(countBadge.textContent, '4');
});
