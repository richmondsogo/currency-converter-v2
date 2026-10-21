import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchExtensionBrowser } from '../../scripts/launch-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

const usdSuffixHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'usd_suffix.html'), 'utf8');
const latePricesHtml = fs.readFileSync(path.join(FIXTURES_DIR, 'late_prices.html'), 'utf8');

test('B3 Regression: Auto-convert trigger, hostname routing, and late-rendered prices', async () => {
  const browser = await launchExtensionBrowser({ build: 'fresh' });

  try {
    const context = browser.context;
    browser.sw.on('console', msg => console.log('[SW CONSOLE]', msg.text()));

    // Intercept fake domains using Playwright routing
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol.startsWith('chrome-extension')) {
        return route.continue();
      }

      if (url.hostname.includes('late')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: latePricesHtml
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: usdSuffixHtml
      });
    });

    const page = await context.newPage();

    // 1. Configure Options Page: Target currency = NGN, add 'always' rule for shop.test
    await page.goto(`chrome-extension://${browser.extensionId}/options/options.html`);
    await page.waitForLoadState('domcontentloaded');

    // Select target currency NGN
    await page.locator('#default-target-currency').selectOption('NGN');

    // Add per-site rule for shop.test -> Always
    await page.locator('#input-rule-domain').fill('shop.test');
    await page.locator('#select-rule-behavior').selectOption('always');
    await page.locator('#btn-add-rule-submit').click();
    await page.waitForTimeout(1000);

    // 2. Test www.shop.test -> expected: auto-converts to NGN, exactly 1 pill
    await page.goto('http://www.shop.test/products');
    await page.waitForTimeout(3000);

    const wwwResult = await page.evaluate(() => {
      const hosts = document.querySelectorAll('#cc-dynamic-island-host');
      const text = document.body.textContent;
      return {
        hostCount: hosts.length,
        hasNgn: text.includes('NGN'),
        hasUsd: text.includes('USD')
      };
    });

    assert.equal(wwwResult.hostCount, 1, 'www.shop.test must have exactly 1 pill host');
    assert.equal(wwwResult.hasNgn, true, 'www.shop.test must auto-convert to user target NGN');

    // 3. Test sub.shop.test -> expected: auto-converts to NGN, exactly 1 pill
    await page.goto('http://sub.shop.test/items');
    await page.waitForTimeout(3000);

    const subResult = await page.evaluate(() => {
      const hosts = document.querySelectorAll('#cc-dynamic-island-host');
      const text = document.body.textContent;
      return {
        hostCount: hosts.length,
        hasNgn: text.includes('NGN')
      };
    });

    assert.equal(subResult.hostCount, 1, 'sub.shop.test must have exactly 1 pill host');
    assert.equal(subResult.hasNgn, true, 'sub.shop.test must auto-convert to NGN');

    // 4. Test other.test -> expected: does NOT auto-convert
    await page.goto('http://other.test/items');
    await page.waitForTimeout(2000);

    const otherResult = await page.evaluate(() => {
      const hosts = document.querySelectorAll('#cc-dynamic-island-host');
      const text = document.body.textContent;
      return {
        hostCount: hosts.length,
        hasNgn: text.includes('NGN')
      };
    });

    assert.equal(otherResult.hostCount, 0, 'other.test must not mount pill host');
    assert.equal(otherResult.hasNgn, false, 'other.test must not convert');

    // 5. Test Never rule beats autoConvertAll: true
    await page.goto(`chrome-extension://${browser.extensionId}/options/options.html`);
    await page.waitForLoadState('domcontentloaded');

    // Check autoConvertAll
    await page.locator('#check-autoconvert-all').check();
    await page.waitForTimeout(500);

    // Add rule never.test -> never
    await page.locator('#input-rule-domain').fill('never.test');
    await page.locator('#select-rule-behavior').selectOption('never');
    await page.locator('#btn-add-rule-submit').click();
    await page.waitForTimeout(1000);

    // Visit never.test -> must NOT convert even with autoConvertAll true
    await page.goto('http://never.test/items');
    await page.waitForTimeout(2000);

    const neverResult = await page.evaluate(() => {
      const hosts = document.querySelectorAll('#cc-dynamic-island-host');
      const text = document.body.textContent;
      return {
        hostCount: hosts.length,
        hasNgn: text.includes('NGN')
      };
    });

    assert.equal(neverResult.hostCount, 0, 'never.test must not convert with never mode');
    assert.equal(neverResult.hasNgn, false, 'never.test must not contain converted NGN');

    // 6. Test Late-Rendered Prices: late.shop.test
    // Prices are injected 1500ms after load. Observer must be running and convert it!
    await page.goto('http://late.shop.test/showcase');
    // Wait past the 1500ms injection point
    await page.waitForTimeout(3000);

    const lateResult = await page.evaluate(() => {
      const lateEl = document.getElementById('late-price');
      return {
        text: lateEl ? lateEl.textContent : '',
        hasConverted: lateEl ? lateEl.textContent.includes('NGN') : false
      };
    });

    assert.equal(lateResult.hasConverted, true, `Late-rendered price must convert to NGN, got: '${lateResult.text}'`);
  } finally {
    await browser.close();
  }
});
