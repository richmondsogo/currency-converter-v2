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

// Create a test page demonstrating the Dynamic Island Pill in both Compact and Expanded states
const testPageHtml = path.join(outDir, 'test-inpage-pill-expanded.html');
const contentBundle = fs.readFileSync(path.join(distDir, 'content.js'), 'utf8');

const testPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dynamic Island In-Page Expanded Test</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 80px 40px;
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

    // Force expanded class on pill shadow root for screenshot verification
    setTimeout(() => {
      const host = document.getElementById('cc-dynamic-island-host');
      if (host && host.shadowRoot) {
        const island = host.shadowRoot.querySelector('.cc-dynamic-island');
        if (island) {
          island.classList.add('cc-expanded');
        }
      }
    }, 150);
  </script>
</body>
</html>`;

fs.writeFileSync(testPageHtml, testPageContent);

console.log('[Verify] Rendering Expanded Dynamic Island Pill screenshot...');
const pillOut = path.join(outDir, 'verify-dynamic-island-expanded.png').replace(/\\/g, '/');
const testPageFileUrl = testPageHtml.replace(/\\/g, '/');
const pillCmd = `"${chromePath}" --headless --disable-gpu --virtual-time-budget=3000 --screenshot="${pillOut}" --window-size=1200,800 "file:///${testPageFileUrl}"`;
execSync(pillCmd);
console.log(`[Verify] Expanded Dynamic Island screenshot saved: ${pillOut}`);
