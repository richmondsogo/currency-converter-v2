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

test('D1: Automatic and menu conversions ALWAYS use settings.targetCurrency (default NGN), ignoring lastUsedTarget', async () => {
  const browser = await launchExtensionBrowser({ build: 'fresh' });

  try {
    const context = browser.context;

    // Intercept test domains with price HTML and mock rates API
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol.startsWith('chrome-extension')) {
        return route.continue();
      }
      if (url.hostname.includes('frankfurter') || url.pathname.includes('latest')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            amount: 1,
            base: 'USD',
            date: '2026-10-22',
            rates: { EUR: 0.92, GBP: 0.79, NGN: 1500, USD: 1 }
          })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: usdSuffixHtml
      });
    });

    const page = await context.newPage();

    // 1. Configure Options Page: Default Target Currency = NGN, Site Rule for shop.test = Always
    await page.goto(`chrome-extension://${browser.extensionId}/options/options.html#general`);
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#select-target-currency').click();
    await page.locator('[cmdk-input]').fill('NGN');
    await page.locator('[data-currency-code="NGN"]').first().click();
    await page.waitForTimeout(600);

    // Switch to Sites section via sidebar
    await page.locator('a[href="#sites"]').click();
    await page.waitForSelector('#input-new-site');
    await page.locator('#input-new-site').fill('shop.test');
    await page.locator('button[aria-label="Add site"]').click();
    await page.waitForSelector('span.font-mono:has-text("shop.test")', { timeout: 5000 });
    await page.waitForTimeout(800);

    // 2. Open an Always site: verify it automatically converts to NGN
    const alwaysPage = await context.newPage();
    await alwaysPage.goto('http://shop.test/catalog');
    await alwaysPage.waitForTimeout(3000);

    const initialResult = await alwaysPage.evaluate(() => {
      const text = document.body.textContent;
      return {
        hasNgn: text.includes('NGN') || text.includes('₦'),
        hasEur: text.includes('EUR') || text.includes('€')
      };
    });
    console.log('[Step 1 - Initial Always Site Result]:', initialResult);
    assert.equal(initialResult.hasNgn, true, 'Initial always site must convert to default NGN');

    // 3. Open a normal page (other.test) and convert to EUR via popup path
    const otherPage = await context.newPage();
    await otherPage.goto('http://other.test/products');
    await otherPage.waitForTimeout(1000);

    // Open popup
    const popupPage = await context.newPage();
    popupPage.on('console', msg => console.log('[POPUP CONSOLE]', msg.text()));
    await popupPage.goto(`chrome-extension://${browser.extensionId}/popup/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(500);

    // Select EUR in popup picker
    await popupPage.locator('#picker-to-btn').click();
    await popupPage.waitForTimeout(300);
    await popupPage.locator('#currency-search-input').fill('EUR');
    await popupPage.waitForTimeout(300);
    await popupPage.locator('.option-item:has-text("EUR")').first().click();
    await popupPage.waitForTimeout(300);

    // Click Convert Page
    await popupPage.locator('#btn-convert-toggle').click();
    await popupPage.waitForFunction(() => {
      const btn = document.getElementById('btn-convert-toggle');
      return btn && btn.textContent.includes('Show original');
    }, { timeout: 10000 });

    const popupStatus = await popupPage.evaluate(() => ({
      btnText: document.getElementById('btn-convert-toggle')?.textContent,
      statusText: document.getElementById('live-status')?.textContent,
      selectedTarget: document.getElementById('selected-target-text')?.textContent
    }));
    console.log('[Popup Status]:', popupStatus);

    // Verify other.test was converted to EUR
    await otherPage.bringToFront();
    const otherResult = await otherPage.evaluate(() => {
      const text = document.body.textContent;
      return {
        hasEur: text.includes('EUR') || text.includes('€'),
        hasNgn: text.includes('NGN') || text.includes('₦')
      };
    });
    console.log('[Step 2 - Other Page Result after popup EUR]:', otherResult);
    assert.equal(otherResult.hasEur, true, 'Other page must convert to EUR via popup');

    // 4. Reload the Always site: MUST convert to default NGN, NOT EUR!
    await alwaysPage.bringToFront();
    await alwaysPage.reload();
    await alwaysPage.waitForTimeout(3000);

    const reloadResult = await alwaysPage.evaluate(() => {
      const text = document.body.textContent;
      return {
        hasNgn: text.includes('NGN') || text.includes('₦'),
        hasEur: text.includes('EUR') || text.includes('€')
      };
    });
    console.log('[Step 3 - Reloaded Always Site Result]:', reloadResult);
    assert.equal(
      reloadResult.hasNgn,
      true,
      `Reloaded Always site must convert to default NGN, but got EUR=${reloadResult.hasEur}, NGN=${reloadResult.hasNgn}`
    );

    // 5. Open a NEW page on the Always domain (shop.test/cart): MUST convert to NGN, NOT EUR!
    const newPage = await context.newPage();
    await newPage.goto('http://shop.test/cart');
    await newPage.waitForTimeout(3000);

    const newPageResult = await newPage.evaluate(() => {
      const text = document.body.textContent;
      return {
        hasNgn: text.includes('NGN') || text.includes('₦'),
        hasEur: text.includes('EUR') || text.includes('€')
      };
    });
    console.log('[Step 4 - New Page on Always Site Result]:', newPageResult);
    assert.equal(
      newPageResult.hasNgn,
      true,
      `New page must convert to default NGN, but got EUR=${newPageResult.hasEur}, NGN=${newPageResult.hasNgn}`
    );

    console.log('[D1 Test Complete] Default target currency invariant preserved.');
  } finally {
    await browser.close();
  }
});
