import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const distDir = path.join(__dirname, '..', 'dist', 'chrome');
const outDir = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

console.log('[Verify] Verifying Options UI render...');
const optionsHtml = path.join(distDir, 'options', 'options.html').replace(/\\/g, '/');
const optionsOut = path.join(outDir, 'verify-options-shadcn.png').replace(/\\/g, '/');

const optionsCmd = `"${chromePath}" --headless --disable-gpu --virtual-time-budget=2000 --screenshot="${optionsOut}" --window-size=1200,1000 "file:///${optionsHtml}"`;
execSync(optionsCmd);
console.log(`[Verify] Options screenshot saved: ${optionsOut}`);

console.log('[Verify] Verifying Popup UI render...');
const popupHtml = path.join(distDir, 'popup', 'popup.html').replace(/\\/g, '/');
const popupOut = path.join(outDir, 'verify-popup-shadcn.png').replace(/\\/g, '/');

const popupCmd = `"${chromePath}" --headless --disable-gpu --virtual-time-budget=2000 --screenshot="${popupOut}" --window-size=400,600 "file:///${popupHtml}"`;
execSync(popupCmd);
console.log(`[Verify] Popup screenshot saved: ${popupOut}`);

// Create a test page demonstrating the Dynamic Island Pill
const testPageHtml = path.join(outDir, 'test-inpage-pill.html');
const contentBundle = fs.readFileSync(path.join(distDir, 'content.js'), 'utf8');

const testPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dynamic Island In-Page Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 60px 40px;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.6;
      background: #fafafa;
      color: #09090b;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .price { font-size: 24px; font-weight: 700; color: #18181b; }
  </style>
</head>
<body>
  <h1>Product Checkout Demo</h1>
  <div class="card">
    <h2>Wireless Noise Cancelling Headphones</h2>
    <p>Premium audio with adaptive ANC and 40hr battery life.</p>
    <div class="price">€299.99</div>
  </div>

  <div class="card">
    <h2>Mechanical Keyboard</h2>
    <p>Custom switches, aluminum frame, RGB backlighting.</p>
    <div class="price">149,50 €</div>
  </div>

  <div class="card">
    <h2>Ultra-Wide Monitor 34"</h2>
    <p>144Hz curved display, HDR400, USB-C hub.</p>
    <div class="price">£649.00</div>
  </div>

  <script>
    // Mock browser runtime and rates for content script
    window.chrome = {
      runtime: {
        sendMessage: (msg, cb) => {
          if (msg && msg.type === 'GET_SETTINGS') {
            const s = { targetCurrency: 'USD', displayMode: 'replace', roundWhole: false, showInPageBar: true };
            if (cb) cb(s);
            return Promise.resolve(s);
          }
          if (msg && msg.type === 'GET_RATES') {
            const r = { rates: { EUR: 1.0, USD: 1.08, GBP: 0.85, NGN: 1750.0 }, date: '2026-10-20', provider: 'ECB' };
            if (cb) cb(r);
            return Promise.resolve(r);
          }
          if (cb) cb({});
          return Promise.resolve({});
        },
        onMessage: { addListener: () => {} }
      }
    };
  </script>
  <script>
    ${contentBundle}
  </script>
  <script>
    // Trigger conversion directly with rates table
    window.postMessage({
      type: 'CC_MANUAL_CONVERT',
      targetCurrency: 'USD',
      manual: true,
      showInPageBar: true,
      ratesTable: { EUR: 1.0, USD: 1.08, GBP: 0.85, NGN: 1750.0 },
      rateDate: '2026-10-20',
      provider: 'ECB'
    }, '*');
  </script>
</body>
</html>`;

fs.writeFileSync(testPageHtml, testPageContent);

console.log('[Verify] Rendering In-Page Dynamic Island Pill screenshot...');
const pillOut = path.join(outDir, 'verify-dynamic-island-pill.png').replace(/\\/g, '/');
const testPageFileUrl = testPageHtml.replace(/\\/g, '/');
const pillCmd = `"${chromePath}" --headless --disable-gpu --virtual-time-budget=3000 --screenshot="${pillOut}" --window-size=1200,800 "file:///${testPageFileUrl}"`;
execSync(pillCmd);
console.log(`[Verify] Dynamic Island screenshot saved: ${pillOut}`);

console.log('[Verify] All verification renders completed successfully.');
