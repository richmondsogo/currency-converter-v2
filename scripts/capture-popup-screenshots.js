// scripts/capture-popup-screenshots.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchExtensionBrowser } from './launch-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'docs', 'audits', '2026-10-23-popup-restyle');

fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('[Popup Screenshots] Launching real extension browser...');
  const browser = await launchExtensionBrowser({ build: 'fresh' });

  try {
    // 0. Intercept web requests and open a web tab so popup detects a valid active tab
    await browser.context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.protocol.startsWith('chrome-extension')) {
        return route.continue();
      }
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><head><title>Sample Store</title></head><body><h1>Sample Store</h1><p>$49.99</p></body></html>'
      });
    });

    const webPage = await browser.context.newPage();
    await webPage.goto('https://store.example.com/item/1');
    await webPage.waitForTimeout(500);

    const page = await browser.context.newPage();
    const popupUrl = `chrome-extension://${browser.extensionId}/popup/popup.html`;

    // 1. Popup in light and dark mode (ready state, 360px)
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 360, height: 600 });
      await page.goto(popupUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      await page.evaluate((t) => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        if (t === 'dark') {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else {
          root.classList.add('light');
          root.setAttribute('data-theme', 'light');
        }
      }, theme);
      await page.waitForTimeout(400);

      const filename = `popup-360-${theme}-ready.png`;
      await page.screenshot({ path: path.join(outDir, filename) });
      console.log(`[Popup Screenshots] Captured ${filename}`);
    }

    // 2. Open Combobox dropdown screenshot
    await page.goto(popupUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);
    await page.locator('#picker-to-btn').click();
    await page.waitForTimeout(400);
    const comboboxFilename = 'popup-360-combobox-open.png';
    await page.screenshot({ path: path.join(outDir, comboboxFilename) });
    console.log(`[Popup Screenshots] Captured ${comboboxFilename}`);

    // 3. Converted state in light and dark
    for (const theme of ['light', 'dark']) {
      await page.goto(popupUrl);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(400);

      await page.evaluate((t) => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        if (t === 'dark') {
          root.classList.add('dark');
          root.setAttribute('data-theme', 'dark');
        } else {
          root.classList.add('light');
          root.setAttribute('data-theme', 'light');
        }
        // Simulate converted status display
        const statusEl = document.getElementById('live-status');
        if (statusEl) {
          const span = statusEl.querySelector('span:last-child');
          if (span) span.textContent = '14 prices converted · Rates: ECB';
          const dot = statusEl.querySelector('span:first-child');
          if (dot) dot.className = 'w-2 h-2 rounded-full shrink-0 bg-accent';
        }
        const btn = document.getElementById('btn-convert-toggle');
        if (btn) {
          btn.textContent = 'Show original';
          btn.className = 'w-full h-10 text-xs font-semibold tracking-wide transition-colors bg-secondary text-foreground hover:bg-secondary/80 border border-border';
        }
      }, theme);
      await page.waitForTimeout(300);

      const filename = `popup-360-${theme}-converted.png`;
      await page.screenshot({ path: path.join(outDir, filename) });
      console.log(`[Popup Screenshots] Captured ${filename}`);
    }

    // 4. Restricted page notice
    await page.goto(popupUrl);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const notice = document.getElementById('unsupported-notice');
      if (notice) notice.style.display = 'flex';
      const btn = document.getElementById('btn-convert-toggle');
      if (btn) {
        btn.setAttribute('disabled', 'true');
        btn.textContent = 'Unavailable on this page';
      }
    });
    await page.waitForTimeout(300);
    const restrictedFilename = 'popup-360-restricted.png';
    await page.screenshot({ path: path.join(outDir, restrictedFilename) });
    console.log(`[Popup Screenshots] Captured ${restrictedFilename}`);

    console.log(`[Popup Screenshots] All screenshots captured in ${outDir}`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[Popup Screenshots] Error:', err);
  process.exit(1);
});
