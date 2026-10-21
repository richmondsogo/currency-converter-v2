import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchExtensionBrowser, ensureBuilds } from './launch-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures');
const AUDIT_DIR = path.join(REPO_ROOT, 'docs', 'audits', '2026-10-21-live-diagnosis');

if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

export function startFixtureServer(port = 3456) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/ebay_us_prefix.html';
    const filePath = path.join(FIXTURES_DIR, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'application/javascript';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not found: ' + reqPath);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function runDiagnosis() {
  console.log('=== STARTING REAL-BROWSER DIAGNOSIS ===\n');
  const server = await startFixtureServer(3456);
  console.log('[Server] Local fixture server running on http://127.0.0.1:3456\n');

  ensureBuilds();

  const results = {};

  try {
    // -------------------------------------------------------------------------
    // R1: DUPLICATE PILLS (STALE and FRESH)
    // -------------------------------------------------------------------------
    console.log('--- R1: Duplicate Pills Investigation ---');
    for (const buildType of ['stale', 'fresh']) {
      console.log(`\nTesting R1 on build: ${buildType.toUpperCase()}`);
      const browser = await launchExtensionBrowser({ build: buildType });
      try {
        const page = await browser.context.newPage();
        await page.goto('http://127.0.0.1:3456/iframe_prices.html');
        await page.waitForLoadState('domcontentloaded');

        // Check before convert
        console.log(`Initial frame count: ${page.frames().length}`);

        // Trigger manual convert once via background executeScript (allFrames: true) + CC_CONVERT_PAGE
        const convertRes1 = await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (!tabs[0]) return { error: 'No tab found' };
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id, allFrames: true },
              files: ['content.js']
            });
          } catch (e) {
            return { error: 'executeScript failed: ' + e.message };
          }
          const res = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CC_CONVERT_PAGE',
            payload: {
              targetCurrency: 'NGN',
              ratesTable: { USD: 1, NGN: 1500, EUR: 0.9 },
              displayMode: 'replace',
              showInPageBar: true,
              manual: true
            }
          });
          return { success: true, res };
        });
        console.log(`[Convert 1 Result]:`, convertRes1);
        await page.waitForTimeout(1000);

        // Inspect every frame
        const frames1 = page.frames();
        const r1Counts1 = [];
        for (let i = 0; i < frames1.length; i++) {
          const f = frames1[i];
          const hostCount = await f.locator('#cc-dynamic-island-host').count();
          const ranContent = await f.evaluate(() => typeof window.document !== 'undefined' && Boolean(document.getElementById('cc-dynamic-island-host') || document.querySelector('[data-cc-original]')));
          r1Counts1.push({ frame: i, url: f.url(), hostCount, ranContent });
          console.log(`[Convert 1] Frame ${i} (${f.url()}): hostCount = ${hostCount}, ranContent = ${ranContent}`);
        }

        // Trigger convert second time (simulate manual convert click 2)
        const convertRes2 = await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (!tabs[0]) return { error: 'No tab found' };
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id, allFrames: true },
              files: ['content.js']
            });
          } catch (e) {
            return { error: 'executeScript failed: ' + e.message };
          }
          const res = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'CC_CONVERT_PAGE',
            payload: {
              targetCurrency: 'NGN',
              ratesTable: { USD: 1, NGN: 1500, EUR: 0.9 },
              displayMode: 'replace',
              showInPageBar: true,
              manual: true
            }
          });
          return { success: true, res };
        });
        console.log(`[Convert 2 Result]:`, convertRes2);
        await page.waitForTimeout(1000);

        const frames2 = page.frames();
        const r1Counts2 = [];
        for (let i = 0; i < frames2.length; i++) {
          const f = frames2[i];
          const hostCount = await f.locator('#cc-dynamic-island-host').count();
          const ranContent = await f.evaluate(() => typeof window.document !== 'undefined' && Boolean(document.getElementById('cc-dynamic-island-host') || document.querySelector('[data-cc-original]')));
          r1Counts2.push({ frame: i, url: f.url(), hostCount, ranContent });
          console.log(`[Convert 2] Frame ${i} (${f.url()}): hostCount = ${hostCount}, ranContent = ${ranContent}`);
        }

        // Check if there are duplicate pills inside any single frame
        const totalTopPills = await page.locator('#cc-dynamic-island-host').count();
        console.log(`Total #cc-dynamic-island-host in top page: ${totalTopPills}`);

        await page.screenshot({ path: path.join(AUDIT_DIR, `r1-duplicate-pills-${buildType}.png`) });
        results[`r1_${buildType}`] = { convert1: r1Counts1, convert2: r1Counts2, totalTopPills };
      } finally {
        await browser.close();
      }
    }

    // -------------------------------------------------------------------------
    // R2: STRAY LABELS (FRESH BUILD)
    // -------------------------------------------------------------------------
    console.log('\n--- R2: Stray Labels Verification (FRESH) ---');
    {
      const browser = await launchExtensionBrowser({ build: 'fresh' });
      try {
        const page = await browser.context.newPage();
        await page.goto('http://127.0.0.1:3456/usd_suffix.html');
        await page.waitForLoadState('domcontentloaded');

        const beforeTexts = await page.evaluate(() => ({
          price1: document.querySelector('.current-price')?.textContent?.trim(),
          price2: document.querySelector('.compare-price')?.textContent?.trim(),
          priceCase: document.querySelector('.test-price-1')?.textContent?.trim(),
          priceCharger: document.querySelector('.test-price-2')?.textContent?.trim(),
          priceCable: document.querySelector('.test-price-3')?.textContent?.trim()
        }));

        // Convert page to NGN (rate: 1 USD = 1500 NGN)
        await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (tabs[0]) {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            });
            await chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CC_CONVERT_PAGE',
              payload: {
                targetCurrency: 'NGN',
                ratesTable: { USD: 1, NGN: 1500 },
                displayMode: 'replace',
                showInPageBar: true,
                manual: true
              }
            });
          }
        });
        await page.waitForTimeout(1000);

        const afterTexts = await page.evaluate(() => ({
          price1: document.querySelector('.current-price')?.textContent?.trim(),
          price2: document.querySelector('.compare-price')?.textContent?.trim(),
          priceCase: document.querySelector('.test-price-1')?.textContent?.trim(),
          priceCharger: document.querySelector('.test-price-2')?.textContent?.trim(),
          priceCable: document.querySelector('.test-price-3')?.textContent?.trim()
        }));

        console.log('Plug/USD Suffix Before:', beforeTexts);
        console.log('Plug/USD Suffix After:', afterTexts);
        await page.screenshot({ path: path.join(AUDIT_DIR, 'r2-stray-labels-plug-fixture.png') });

        // Now eBay fixture ("US $133.00", shipping lines)
        await page.goto('http://127.0.0.1:3456/ebay_us_prefix.html');
        await page.waitForLoadState('domcontentloaded');

        const ebayBefore = await page.evaluate(() => ({
          price133: document.querySelectorAll('.price')[0]?.textContent?.trim(),
          shipping15: document.querySelectorAll('.shipping')[0]?.textContent?.trim(),
          convertedApprox: document.querySelector('.converted')?.textContent?.trim(),
          price650: document.querySelectorAll('.price')[1]?.textContent?.trim()
        }));

        await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (tabs[0]) {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            });
            await chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CC_CONVERT_PAGE',
              payload: {
                targetCurrency: 'NGN',
                ratesTable: { USD: 1, NGN: 1500 },
                displayMode: 'replace',
                showInPageBar: true,
                manual: true
              }
            });
          }
        });
        await page.waitForTimeout(1000);

        const ebayAfter = await page.evaluate(() => ({
          price133: document.querySelectorAll('.price')[0]?.textContent?.trim(),
          shipping15: document.querySelectorAll('.shipping')[0]?.textContent?.trim(),
          convertedApprox: document.querySelector('.converted')?.textContent?.trim(),
          price650: document.querySelectorAll('.price')[1]?.textContent?.trim()
        }));

        console.log('eBay Before:', ebayBefore);
        console.log('eBay After:', ebayAfter);
        await page.screenshot({ path: path.join(AUDIT_DIR, 'r2-stray-labels-ebay-fixture.png') });

        results.r2 = {
          plug: { before: beforeTexts, after: afterTexts },
          ebay: { before: ebayBefore, after: ebayAfter }
        };
      } finally {
        await browser.close();
      }
    }

    // -------------------------------------------------------------------------
    // R3: COUNT AFTER RE-CONVERT (FRESH BUILD)
    // -------------------------------------------------------------------------
    console.log('\n--- R3: Count After Re-convert (FRESH) ---');
    {
      const browser = await launchExtensionBrowser({ build: 'fresh' });
      try {
        const page = await browser.context.newPage();
        await page.goto('http://127.0.0.1:3456/ebay_us_prefix.html');
        await page.waitForLoadState('domcontentloaded');

        const inspectPillAndDom = async () => {
          return page.evaluate(() => {
            const host = document.getElementById('cc-dynamic-island-host');
            if (!host || !host.shadowRoot) return { host: false };
            const shadow = host.shadowRoot;
            const countBadge = shadow.querySelector('.cc-count-badge')?.textContent?.trim();
            const currencyCode = shadow.querySelector('.cc-currency-code')?.textContent?.trim();
            const statusDot = shadow.querySelector('.cc-status-dot');
            const dotInactive = statusDot ? statusDot.classList.contains('cc-status-inactive') : null;
            const dotColor = statusDot ? window.getComputedStyle(statusDot).backgroundColor : null;
            const convertedSpans = document.querySelectorAll('[data-cc-original]').length;
            return {
              host: true,
              countBadge: Number(countBadge),
              currencyCode,
              dotInactive,
              dotColor,
              convertedSpans
            };
          });
        };

        // Pass 1: Convert to NGN
        await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (tabs[0]) {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            });
            await chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CC_CONVERT_PAGE',
              payload: {
                targetCurrency: 'NGN',
                ratesTable: { USD: 1, NGN: 1500 },
                displayMode: 'replace',
                showInPageBar: true,
                manual: true
              }
            });
          }
        });
        await page.waitForTimeout(1000);
        const pass1 = await inspectPillAndDom();
        console.log('Pass 1 State:', pass1);
        await page.screenshot({ path: path.join(AUDIT_DIR, 'r3-reconvert-pass1.png') });

        // Pass 2: Convert to NGN again (re-convert)
        await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (tabs[0]) {
            await chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CC_CONVERT_PAGE',
              payload: {
                targetCurrency: 'NGN',
                ratesTable: { USD: 1, NGN: 1500 },
                displayMode: 'replace',
                showInPageBar: true,
                manual: true
              }
            });
          }
        });
        await page.waitForTimeout(1000);
        const pass2 = await inspectPillAndDom();
        console.log('Pass 2 State:', pass2);
        await page.screenshot({ path: path.join(AUDIT_DIR, 'r3-reconvert-pass2.png') });

        results.r3 = { pass1, pass2 };
      } finally {
        await browser.close();
      }
    }

    // -------------------------------------------------------------------------
    // R4: ALWAYS / NEVER RULE (STALE vs FRESH)
    // -------------------------------------------------------------------------
    console.log('\n--- R4: Always / Never Rule Verification (STALE vs FRESH) ---');
    for (const buildType of ['stale', 'fresh']) {
      console.log(`\nTesting R4 on build: ${buildType.toUpperCase()}`);
      const browser = await launchExtensionBrowser({ build: buildType });
      try {
        const optionsPage = await browser.context.newPage();
        await optionsPage.goto(`chrome-extension://${browser.extensionId}/options/options.html`);
        await optionsPage.waitForLoadState('domcontentloaded');

        // Set Always for 127.0.0.1 through options UI
        await optionsPage.locator('#input-rule-domain').fill('127.0.0.1');
        await optionsPage.locator('#select-rule-behavior').selectOption('always');
        await optionsPage.locator('#btn-add-rule-submit').click();
        await optionsPage.waitForTimeout(500);

        // Inspect chrome.scripting.getRegisteredContentScripts() in SW
        const registeredScripts = await browser.sw.evaluate(async () => {
          if (chrome.scripting && chrome.scripting.getRegisteredContentScripts) {
            return await chrome.scripting.getRegisteredContentScripts();
          }
          return [];
        });
        console.log(`[${buildType}] Registered scripts after Options UI save:`, registeredScripts);

        // Test navigation / reload to http://127.0.0.1:3456/ebay_us_prefix.html
        const testPage = await browser.context.newPage();
        await testPage.goto('http://127.0.0.1:3456/ebay_us_prefix.html');
        console.log(`[${buildType}] Page loaded, waiting 10s for auto-convert trigger...`);
        await testPage.waitForTimeout(10000);

        const autoConvertState = await testPage.evaluate(() => {
          const host = document.getElementById('cc-dynamic-island-host');
          const convertedSpans = document.querySelectorAll('[data-cc-original]').length;
          const bodyText = document.body.textContent;
          return {
            hasHost: Boolean(host),
            convertedSpans,
            hasConvertedText: bodyText.includes('NGN') || bodyText.includes('€') || bodyText.includes('£')
          };
        });
        console.log(`[${buildType}] Auto-convert state:`, autoConvertState);
        await testPage.screenshot({ path: path.join(AUDIT_DIR, `r4-always-rule-${buildType}.png`) });

        // Test Never convert rule on test domain
        await optionsPage.bringToFront();
        await optionsPage.locator('#input-rule-domain').fill('localhost');
        await optionsPage.locator('#select-rule-behavior').selectOption('never');
        await optionsPage.locator('#btn-add-rule-submit').click();
        await optionsPage.waitForTimeout(500);

        const neverScripts = await browser.sw.evaluate(async () => {
          if (chrome.scripting && chrome.scripting.getRegisteredContentScripts) {
            return await chrome.scripting.getRegisteredContentScripts();
          }
          return [];
        });

        const localhostPage = await browser.context.newPage();
        await localhostPage.goto('http://localhost:3456/ebay_us_prefix.html');
        await localhostPage.waitForTimeout(3000);
        const neverState = await localhostPage.evaluate(() => ({
          hasHost: Boolean(document.getElementById('cc-dynamic-island-host')),
          convertedSpans: document.querySelectorAll('[data-cc-original]').length
        }));
        console.log(`[${buildType}] Never rule state:`, neverState);

        results[`r4_${buildType}`] = {
          registeredScripts,
          autoConvertState,
          neverScripts,
          neverState
        };
      } finally {
        await browser.close();
      }
    }

    // -------------------------------------------------------------------------
    // R5: PILL DROPDOWN (FRESH)
    // -------------------------------------------------------------------------
    console.log('\n--- R5: Pill Currency Dropdown (FRESH) ---');
    {
      const browser = await launchExtensionBrowser({ build: 'fresh' });
      try {
        const page = await browser.context.newPage();
        await page.goto('http://127.0.0.1:3456/ebay_us_prefix.html');
        await page.waitForLoadState('domcontentloaded');

        await browser.sw.evaluate(async () => {
          const tabs = await chrome.tabs.query({ url: '*://127.0.0.1/*' });
          if (tabs[0]) {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            });
            await chrome.tabs.sendMessage(tabs[0].id, {
              type: 'CC_CONVERT_PAGE',
              payload: {
                targetCurrency: 'NGN',
                ratesTable: { USD: 1, NGN: 1500 },
                displayMode: 'replace',
                showInPageBar: true,
                manual: true
              }
            });
          }
        });
        await page.waitForTimeout(1000);

        // Click pill to expand it
        const host = page.locator('#cc-dynamic-island-host');
        await host.locator('.cc-dynamic-island').click();
        await page.waitForTimeout(300);

        // Dump select and option computed styles inside shadow root
        const styles = await host.evaluate((el) => {
          const shadow = el.shadowRoot;
          const select = shadow.querySelector('.cc-select');
          if (!select) return { error: 'No select found' };
          const selectStyle = window.getComputedStyle(select);
          const firstOption = select.querySelector('option');
          const optStyle = firstOption ? window.getComputedStyle(firstOption) : null;
          return {
            select: {
              color: selectStyle.color,
              backgroundColor: selectStyle.backgroundColor,
              background: selectStyle.background,
              fontFamily: selectStyle.fontFamily,
              fontSize: selectStyle.fontSize,
              border: selectStyle.border,
              outline: selectStyle.outline
            },
            option: optStyle ? {
              color: optStyle.color,
              backgroundColor: optStyle.backgroundColor
            } : null
          };
        });
        console.log('R5 Select & Option Computed Styles:', styles);

        await page.screenshot({ path: path.join(AUDIT_DIR, 'r5-pill-dropdown.png') });
        results.r5 = styles;
      } finally {
        await browser.close();
      }
    }

    // -------------------------------------------------------------------------
    // R6: OPTIONS PAGE AND POPUP AUDIT (FRESH)
    // -------------------------------------------------------------------------
    console.log('\n--- R6: Options Page & Popup Audit (FRESH) ---');
    {
      const browser = await launchExtensionBrowser({ build: 'fresh' });
      try {
        const optionsPage = await browser.context.newPage();
        await optionsPage.goto(`chrome-extension://${browser.extensionId}/options/options.html`);
        await optionsPage.waitForLoadState('domcontentloaded');

        // Screenshots at 1280px & 900px, light & dark
        await optionsPage.setViewportSize({ width: 1280, height: 900 });
        await optionsPage.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
        await optionsPage.screenshot({ path: path.join(AUDIT_DIR, 'r6-options-1280-light.png'), fullPage: true });

        await optionsPage.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await optionsPage.screenshot({ path: path.join(AUDIT_DIR, 'r6-options-1280-dark.png'), fullPage: true });

        await optionsPage.setViewportSize({ width: 900, height: 900 });
        await optionsPage.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
        await optionsPage.screenshot({ path: path.join(AUDIT_DIR, 'r6-options-900-light.png'), fullPage: true });

        await optionsPage.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await optionsPage.screenshot({ path: path.join(AUDIT_DIR, 'r6-options-900-dark.png'), fullPage: true });

        // Add Rule button DOM dump
        const addRuleBtn = await optionsPage.evaluate(() => {
          const btn = document.getElementById('btn-add-rule-submit');
          return btn ? { outerHTML: btn.outerHTML, textContent: btn.textContent.trim(), innerHTML: btn.innerHTML } : null;
        });
        console.log('R6 Add Rule Button DOM:', addRuleBtn);

        // Popup Page
        const popupPage = await browser.context.newPage();
        await popupPage.goto(`chrome-extension://${browser.extensionId}/popup/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        // Popup light and dark
        await popupPage.evaluate(() => document.body.setAttribute('data-theme', 'light'));
        await popupPage.screenshot({ path: path.join(AUDIT_DIR, 'r6-popup-light.png') });

        await popupPage.evaluate(() => document.body.setAttribute('data-theme', 'dark'));
        await popupPage.screenshot({ path: path.join(AUDIT_DIR, 'r6-popup-dark.png') });

        // Measured width/height of popup toggle tracks and knobs, row spacing
        const popupMeasurements = await popupPage.evaluate(() => {
          const alwaysSwitch = document.getElementById('toggle-always-site');
          const neverSwitch = document.getElementById('toggle-never-site');
          const rect = alwaysSwitch ? alwaysSwitch.getBoundingClientRect() : null;
          const comp = alwaysSwitch ? window.getComputedStyle(alwaysSwitch) : null;
          const rowComp = document.querySelector('.setting-row') ? window.getComputedStyle(document.querySelector('.setting-row')) : null;

          return {
            trackRect: rect ? { width: rect.width, height: rect.height } : null,
            trackStyles: comp ? {
              width: comp.width,
              height: comp.height,
              borderRadius: comp.borderRadius,
              backgroundColor: comp.backgroundColor
            } : null,
            rowStyles: rowComp ? {
              padding: rowComp.padding,
              margin: rowComp.margin,
              display: rowComp.display,
              justifyContent: rowComp.justifyContent,
              alignItems: rowComp.alignItems
            } : null
          };
        });
        console.log('R6 Popup Measurements:', popupMeasurements);

        // Check whether Always and Never can both be ON simultaneously
        const toggleCheck = await popupPage.evaluate(() => {
          const always = document.getElementById('toggle-always-site');
          const never = document.getElementById('toggle-never-site');
          always.checked = true;
          never.checked = true;
          return {
            bothCheckedInDOM: always.checked && never.checked
          };
        });
        console.log('R6 Toggles Both Checked:', toggleCheck);

        results.r6 = {
          addRuleBtn,
          popupMeasurements,
          toggleCheck
        };
      } finally {
        await browser.close();
      }
    }

    fs.writeFileSync(path.join(AUDIT_DIR, 'diagnosis-results.json'), JSON.stringify(results, null, 2));
    console.log('\n=== REAL-BROWSER DIAGNOSIS COMPLETED SUCCESSFULLY ===');
  } finally {
    server.close();
  }
}

runDiagnosis().catch(err => {
  console.error('[Diagnosis Error]:', err);
  process.exit(1);
});
