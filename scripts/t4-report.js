import fs from 'node:fs';
import path from 'node:path';
import { launchExtensionBrowser } from './launch-browser.js';

async function runT4() {
  const browser = await launchExtensionBrowser({ build: 'fresh' });
  try {
    const context = browser.context;
    const fixtureHtml = fs.readFileSync(path.resolve('tests/fixtures/simple.html'), 'utf8');

    await context.route(/^http:\/\//, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fixtureHtml
      });
    });

    const page = await context.newPage();

    // 1. Set default target NGN in options page and add 'always' rule for always.shop.test
    console.log('[T4 Step 1] Configuring options: targetCurrency = NGN, always.shop.test = always');
    await page.goto(`chrome-extension://${browser.extensionId}/options/options.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#default-target-currency').selectOption('NGN');
    await page.locator('#input-rule-domain').fill('always.shop.test');
    await page.locator('#select-rule-behavior').selectOption('always');
    await page.locator('#btn-add-rule-submit').click();
    await page.waitForTimeout(1000);

    const storageAfterOptions = await browser.sw.evaluate(async () => {
      const all = await new Promise(r => chrome.storage.local.get(null, r));
      return all.currency_converter_settings_v2;
    });
    console.log('[T4 Storage after Options]:', {
      targetCurrency: storageAfterOptions?.targetCurrency,
      lastUsedTarget: storageAfterOptions?.lastUsedTarget,
      perSite: storageAfterOptions?.perSite
    });

    // 2. Open popup and convert a page to EUR
    console.log('[T4 Step 2] Converting a page to EUR via popup');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${browser.extensionId}/popup/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');

    // Simulate popup convert with target EUR on an active tab (sets lastUsedTarget to EUR)
    await browser.sw.evaluate(async () => {
      const data = await new Promise(r => chrome.storage.local.get('currency_converter_settings_v2', r));
      const settings = data.currency_converter_settings_v2;
      settings.lastUsedTarget = 'EUR';
      await new Promise(r => chrome.storage.local.set({ currency_converter_settings_v2: settings }, r));
    });

    const storageAfterPopup = await browser.sw.evaluate(async () => {
      const all = await new Promise(r => chrome.storage.local.get(null, r));
      return all.currency_converter_settings_v2;
    });
    console.log('[T4 Storage after Popup EUR convert]:', {
      targetCurrency: storageAfterPopup?.targetCurrency,
      lastUsedTarget: storageAfterPopup?.lastUsedTarget
    });

    // 3. Reload an Always site: http://always.shop.test/product
    console.log('[T4 Step 3] Navigating to http://always.shop.test/product (Always site)');
    await page.goto('http://always.shop.test/product');
    await page.waitForTimeout(3000);

    // 4. Inspect what currency was used by auto-convert on reload
    const result = await page.evaluate(() => {
      const host = document.getElementById('cc-dynamic-island-host');
      const shadow = host?.shadowRoot;
      const currencyCode = shadow?.querySelector('.cc-currency-code')?.textContent;
      const count = shadow?.querySelector('.cc-count-badge')?.textContent;
      const text = document.body.textContent;
      return {
        hasHost: Boolean(host),
        currencyCodeInPill: currencyCode,
        countInPill: count,
        bodySample: text.trim().slice(0, 150),
        usedEUR: text.includes('EUR') || text.includes('€') || currencyCode?.includes('EUR'),
        usedNGN: text.includes('NGN') || text.includes('₦') || currencyCode?.includes('NGN')
      };
    });

    console.log('\n================== T4 REPORT EVIDENCE ==================');
    console.log('Options default targetCurrency: NGN');
    console.log('Popup converted lastUsedTarget: EUR');
    console.log('Auto-convert on reload result:', result);
    console.log('Which currency did auto-convert use?', result.usedEUR ? 'EUR' : (result.usedNGN ? 'NGN' : 'OTHER'));
    console.log('========================================================\n');
  } finally {
    await browser.close();
  }
}

runT4().catch(console.error);
