import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchExtensionBrowser } from './launch-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'docs', 'audits', '2026-10-23-options-rebuild');

fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('[Screenshots] Launching real extension browser...');
  const browser = await launchExtensionBrowser({ build: 'fresh' });

  try {
    const page = await browser.context.newPage();
    const optionsUrl = `chrome-extension://${browser.extensionId}/options/options.html`;

    const sections = ['general', 'currencies', 'sites', 'appearance', 'data', 'about'];

    // 1. Every section at 1280 light and dark
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1280, height: 850 });
      for (const sec of sections) {
        await page.goto(`${optionsUrl}#${sec}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(400);

        // Set theme
        await page.evaluate((t) => {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          if (t === 'dark') {
            root.classList.add('dark');
            root.setAttribute('data-theme', 'dark');
          } else {
            root.setAttribute('data-theme', 'light');
          }
        }, theme);
        await page.waitForTimeout(300);

        const filename = `options-1280-${sec}-${theme}.png`;
        await page.screenshot({ path: path.join(outDir, filename) });
        console.log(`[Screenshots] Captured ${filename}`);
      }
    }

    // 2. Sites at 900 and 600
    await page.goto(`${optionsUrl}#sites`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      const root = document.documentElement;
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    });

    await page.setViewportSize({ width: 900, height: 850 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'options-900-sites-light.png') });
    console.log('[Screenshots] Captured options-900-sites-light.png');

    await page.setViewportSize({ width: 600, height: 850 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(outDir, 'options-600-sites-light.png') });
    console.log('[Screenshots] Captured options-600-sites-light.png');

    // Reset viewport to 1280
    await page.setViewportSize({ width: 1280, height: 850 });

    // 3. The empty state (Sites section with no rules)
    await page.evaluate(async () => {
      const key = 'currency_converter_settings_v2';
      const stored = (await chrome.storage.local.get(key))[key] || {};
      stored.perSite = {};
      await chrome.storage.local.set({ [key]: stored });
    });
    await page.goto(`${optionsUrl}#sites`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 'options-sites-empty-state.png') });
    console.log('[Screenshots] Captured options-sites-empty-state.png');

    // 4. The 8-chip state (Currencies with 8 pinned)
    await page.evaluate(async () => {
      const key = 'currency_converter_settings_v2';
      const stored = (await chrome.storage.local.get(key))[key] || {};
      stored.pinnedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NGN', 'INR'];
      await chrome.storage.local.set({ [key]: stored });
    });
    await page.goto(`${optionsUrl}#currencies`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 'options-currencies-8chips.png') });
    console.log('[Screenshots] Captured options-currencies-8chips.png');

    // 5. The open combobox
    await page.goto(`${optionsUrl}#general`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);
    await page.locator('#select-target-currency').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'options-open-combobox.png') });
    console.log('[Screenshots] Captured options-open-combobox.png');

    // 6. The confirm dialog
    await page.goto(`${optionsUrl}#data`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);
    await page.locator('#btn-reset-defaults').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'options-confirm-dialog.png') });
    console.log('[Screenshots] Captured options-confirm-dialog.png');

    console.log('[Screenshots] All requested screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[Screenshots] Failed:', err);
  process.exit(1);
});
