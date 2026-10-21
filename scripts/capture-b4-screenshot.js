import path from 'node:path';
import fs from 'node:fs';
import { launchExtensionBrowser } from './launch-browser.js';

import { pathToFileURL } from 'node:url';

const SCREENSHOTS_DIR = path.resolve('docs/steps/screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function capture() {
  const browser = await launchExtensionBrowser({ build: 'fresh' });
  try {
    const context = browser.context;
    await context.route('**/*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fs.readFileSync(path.resolve('tests/fixtures/simple.html'), 'utf8')
      });
    });

    const page = await context.newPage();
    await page.goto('http://shop.test/item');
    await page.waitForLoadState('domcontentloaded');

    // Trigger conversion
    await browser.sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: '*://shop.test/*' });
      if (tabs[0]) {
        await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        });
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CC_CONVERT_PAGE',
          payload: {
            targetCurrency: 'EUR',
            ratesTable: { USD: 1, EUR: 0.92, GBP: 0.79, NGN: 1500, CAD: 1.35, JPY: 150 },
            displayMode: 'replace',
            showInPageBar: true,
            manual: true
          }
        });
      }
    });

    await page.waitForTimeout(1000);

    const host = page.locator('#cc-dynamic-island-host');
    await host.locator('.cc-dynamic-island').click();
    await page.waitForTimeout(500);

    // In Chromium, to capture all options visibly rendered in DOM screenshots,
    // setting size and visible overflow displays the dropdown list of options cleanly.
    await host.evaluate((el) => {
      const shadow = el.shadowRoot;
      const island = shadow.querySelector('.cc-dynamic-island');
      const expandable = shadow.querySelector('.cc-island-expandable');
      const select = shadow.querySelector('.cc-select');
      if (island) island.style.overflow = 'visible';
      if (expandable) expandable.style.overflow = 'visible';
      if (select) {
        select.size = 10;
        select.style.position = 'absolute';
        select.style.top = '48px';
        select.style.right = '0';
        select.style.height = '200px';
        select.style.zIndex = '999999';
        select.style.width = '140px';
        select.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
      }
    });

    await page.waitForTimeout(500);

    const screenshotPath = path.join(SCREENSHOTS_DIR, 'b4-stopgap-dropdown.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Saved screenshot to ${screenshotPath}`);

    // Verify computed styles
    const styles = await host.evaluate((el) => {
      const shadow = el.shadowRoot;
      const select = shadow.querySelector('.cc-select');
      const option = select ? select.querySelector('option') : null;
      return {
        selectBg: select ? window.getComputedStyle(select).backgroundColor : null,
        selectColor: select ? window.getComputedStyle(select).color : null,
        optionBg: option ? window.getComputedStyle(option).backgroundColor : null,
        optionColor: option ? window.getComputedStyle(option).color : null,
      };
    });
    console.log('B4 Computed Styles:', styles);
  } finally {
    await browser.close();
  }
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
