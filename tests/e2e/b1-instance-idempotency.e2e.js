import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchExtensionBrowser } from '../../scripts/launch-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

// Start local HTTP server for fixtures
let server;
let serverPort;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${serverPort}`);
      const filePath = path.join(FIXTURES_DIR, parsedUrl.pathname.replace(/^\//, ''));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

test('B1 Regression: One instance, one pill, honest count, and iframe isolation', async () => {
  await startServer();
  const browser = await launchExtensionBrowser({ build: 'fresh' });

  try {
    const page = await browser.context.newPage();
    const testUrl = `http://127.0.0.1:${serverPort}/usd_suffix.html`;
    await page.goto(testUrl);
    await page.waitForLoadState('domcontentloaded');

    // 1. Initial conversion pass via service worker
    await browser.sw.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const targetTab = tabs.find(t => t.url === url);
      if (!targetTab) throw new Error('Target tab not found in SW');

      // Unfixed background injects with allFrames: true
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id, allFrames: true },
        files: ['content.js']
      });

      await chrome.tabs.sendMessage(targetTab.id, {
        type: 'CC_CONVERT_PAGE',
        payload: {
          manual: true,
          targetCurrency: 'NGN',
          ratesTable: { USD: 1, NGN: 1500, EUR: 0.92 },
          displayMode: 'replace',
          showInPageBar: true
        }
      });
    }, testUrl);

    await page.waitForSelector('#cc-dynamic-island-host', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(1000);

    const pass1Metrics = await page.evaluate(() => {
      const host = document.getElementById('cc-dynamic-island-host');
      const root = host?.shadowRoot;
      const countEl = root?.querySelector('.cc-count-badge');
      const dotEl = root?.querySelector('.cc-status-dot');
      return {
        hostCount: document.querySelectorAll('#cc-dynamic-island-host').length,
        count: countEl ? parseInt(countEl.textContent.trim(), 10) : null,
        isDotInactive: dotEl ? dotEl.classList.contains('cc-status-inactive') : true
      };
    });

    assert.equal(pass1Metrics.hostCount, 1, 'Pass 1 must mount exactly 1 host');
    assert.ok(pass1Metrics.count > 0, 'Pass 1 count must be positive');
    assert.equal(pass1Metrics.isDotInactive, false, 'Pass 1 dot must be active (green)');

    // 2. Second convert pass on the same page (re-convert request)
    await browser.sw.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const targetTab = tabs.find(t => t.url === url);
      await chrome.tabs.sendMessage(targetTab.id, {
        type: 'CC_CONVERT_PAGE',
        payload: {
          manual: true,
          targetCurrency: 'NGN',
          ratesTable: { USD: 1, NGN: 1500, EUR: 0.92 },
          displayMode: 'replace',
          showInPageBar: true
        }
      });
    }, testUrl);

    await page.waitForTimeout(1000);

    const pass2Metrics = await page.evaluate(() => {
      const host = document.getElementById('cc-dynamic-island-host');
      const root = host?.shadowRoot;
      const countEl = root?.querySelector('.cc-count-badge');
      const dotEl = root?.querySelector('.cc-status-dot');
      return {
        hostCount: document.querySelectorAll('#cc-dynamic-island-host').length,
        count: countEl ? parseInt(countEl.textContent.trim(), 10) : null,
        isDotInactive: dotEl ? dotEl.classList.contains('cc-status-inactive') : true
      };
    });

    assert.equal(pass2Metrics.hostCount, 1, 'Pass 2 must still have exactly 1 host');
    assert.equal(pass2Metrics.count, pass1Metrics.count, 'Pass 2 count must equal Pass 1 count');
    assert.equal(pass2Metrics.isDotInactive, false, 'Pass 2 dot must remain active (green)');

    // 3. Force 3 re-injections of content.js
    await browser.sw.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const targetTab = tabs.find(t => t.url === url);
      if (!targetTab) throw new Error('Tab not found in sw');

      for (let i = 0; i < 3; i++) {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id, allFrames: false },
          files: ['content.js']
        });
      }
    }, testUrl);

    await page.waitForTimeout(1000);

    const postReinjectMetrics = await page.evaluate(() => {
      const host = document.getElementById('cc-dynamic-island-host');
      const root = host?.shadowRoot;
      const countEl = root?.querySelector('.cc-count-badge');
      const dotEl = root?.querySelector('.cc-status-dot');
      return {
        hostCount: document.querySelectorAll('#cc-dynamic-island-host').length,
        count: countEl ? parseInt(countEl.textContent.trim(), 10) : null,
        isDotInactive: dotEl ? dotEl.classList.contains('cc-status-inactive') : true
      };
    });

    assert.equal(postReinjectMetrics.hostCount, 1, 'Must still have exactly 1 host after 3 forced re-injections');
    assert.equal(postReinjectMetrics.count, pass1Metrics.count, 'Count must remain honest and unchanged after re-injections');
    assert.equal(postReinjectMetrics.isDotInactive, false, 'Dot must remain active (green)');

    // 4. Test iframe fixture: only top frame should have host
    const iframeUrl = `http://127.0.0.1:${serverPort}/iframe_prices.html`;
    await page.goto(iframeUrl);
    await page.waitForLoadState('domcontentloaded');

    // Trigger conversion via service worker
    await browser.sw.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const targetTab = tabs.find(t => t.url === url);
      if (!targetTab) throw new Error('Iframe tab not found');

      // Fixed background uses allFrames: false (top frame only)
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id, allFrames: false },
        files: ['content.js']
      });
      await chrome.tabs.sendMessage(targetTab.id, {
        type: 'CC_CONVERT_PAGE',
        payload: {
          targetCurrency: 'NGN',
          manual: true,
          ratesTable: { USD: 1, NGN: 1500, EUR: 0.92 }
        }
      });
    }, iframeUrl);

    await page.waitForTimeout(1500);

    // Count host elements across all frames in page
    let totalHostsAcrossFrames = 0;
    for (const frame of page.frames()) {
      const frameHosts = await frame.evaluate(() => {
        return document.querySelectorAll('#cc-dynamic-island-host').length;
      }).catch(() => 0);
      totalHostsAcrossFrames += frameHosts;
    }

    assert.equal(totalHostsAcrossFrames, 1, 'Iframe fixture: exactly 1 host across all frames in the tab');
  } finally {
    await browser.close();
    await stopServer();
  }
});
