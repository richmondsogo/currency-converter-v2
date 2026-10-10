const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratchDir = path.join(require('os').tmpdir(), 'currency-converter-screenshots');
const outDir = path.join(__dirname, '..', 'screenshots');

fs.mkdirSync(scratchDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

// Common browser header component (neutral, minimal, realistic)
const browserChrome = `
<div class="browser-bar">
  <div class="traffic-lights">
    <span class="light"></span>
    <span class="light"></span>
    <span class="light"></span>
  </div>
  <div class="omnibox">
    <span class="lock">https://</span>store.example.com/hardware/workstation
  </div>
</div>
`;

// Common CSS adhering strictly to DESIGN.md
const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 800px;
    background: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #09090b;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .browser-bar {
    background: #ffffff;
    border-bottom: 1px solid #e4e4e7;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .traffic-lights {
    display: flex;
    gap: 6px;
  }
  .light {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #d4d4d8;
  }
  .omnibox {
    flex: 1;
    max-width: 640px;
    margin: 0 auto;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    color: #71717a;
  }
  .lock { color: #a1a1aa; }
  .viewport {
    flex: 1;
    background: #ffffff;
    padding: 48px 80px;
    display: flex;
    justify-content: center;
    position: relative;
  }
  .content-container {
    width: 760px;
  }
  .item-header {
    border-bottom: 1px solid #e4e4e7;
    padding-bottom: 24px;
    margin-bottom: 24px;
  }
  .item-title {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #09090b;
    margin-bottom: 8px;
  }
  .item-description {
    font-size: 14px;
    color: #71717a;
    line-height: 1.5;
  }
  .price-row {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 28px;
  }
  .price-label {
    font-size: 13px;
    color: #71717a;
  }
  .price-val {
    font-size: 28px;
    font-weight: 600;
    color: #09090b;
    font-variant-numeric: tabular-nums;
  }
  .selected {
    background: #2563eb;
    color: #ffffff;
    padding: 0 4px;
    border-radius: 2px;
  }
  .specs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 32px;
  }
  .specs-table td {
    padding: 10px 0;
    border-bottom: 1px solid #f4f4f5;
  }
  .specs-table td:first-child {
    color: #71717a;
    width: 180px;
  }
  .specs-table td:last-child {
    color: #09090b;
    font-weight: 500;
  }
  .btn-action {
    display: inline-block;
    background: #18181b;
    color: #fafafa;
    border: none;
    border-radius: 6px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
  }

  /* Standard Native Context Menu (Shadcn / Chromium Style) */
  .context-menu-wrapper {
    position: absolute;
    top: 140px;
    left: 480px;
    display: flex;
    z-index: 50;
  }
  .menu {
    width: 200px;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    padding: 4px;
    font-size: 13px;
  }
  .menu-item {
    padding: 6px 10px;
    border-radius: 4px;
    color: #18181b;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .menu-item.active {
    background: #f4f4f5;
    font-weight: 500;
  }
  .menu-divider {
    height: 1px;
    background: #f4f4f5;
    margin: 4px 0;
  }
  .submenu {
    width: 220px;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    padding: 4px;
    margin-left: 2px;
  }
  .submenu-item {
    padding: 6px 10px;
    border-radius: 4px;
    color: #18181b;
    font-size: 13px;
  }
  .submenu-item.highlighted {
    background: #18181b;
    color: #fafafa;
  }

  /* Native Notification Toast */
  .notification-toast {
    position: absolute;
    top: 24px;
    right: 24px;
    width: 340px;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    padding: 16px;
    z-index: 100;
  }
  .toast-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .toast-icon {
    width: 18px;
    height: 18px;
    background: #18181b;
    border-radius: 4px;
    color: #fafafa;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .toast-app-name {
    font-size: 12px;
    font-weight: 600;
    color: #09090b;
  }
  .toast-time {
    margin-left: auto;
    font-size: 11px;
    color: #a1a1aa;
  }
  .toast-result {
    font-size: 15px;
    font-weight: 600;
    color: #09090b;
    font-variant-numeric: tabular-nums;
    margin-bottom: 4px;
  }
  .toast-rate {
    font-size: 12px;
    color: #71717a;
    font-variant-numeric: tabular-nums;
  }
`;

// 1. Screenshot 1: Context Menu
const html1 = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${baseStyles}</style></head>
<body>
${browserChrome}
<div class="viewport">
  <div class="content-container">
    <div class="item-header">
      <h1 class="item-title">Ultra-Wide 34-Inch Curved Monitor</h1>
      <p class="item-description">Professional workspace display with calibrated sRGB panel and USB-C connectivity.</p>
    </div>
    <div class="price-row">
      <span class="price-label">Unit Price:</span>
      <span class="price-val"><span class="selected">$1,299.00</span></span>
    </div>
    <table class="specs-table">
      <tr><td>Resolution</td><td>3440 × 1440 WQHD</td></tr>
      <tr><td>Refresh Rate</td><td>144 Hz</td></tr>
      <tr><td>Warranty</td><td>3 Years Manufacturer Coverage</td></tr>
    </table>
    <button class="btn-action">Purchase</button>
  </div>

  <div class="context-menu-wrapper">
    <div class="menu">
      <div class="menu-item">Copy</div>
      <div class="menu-item">Search Google for "$1,299.00"</div>
      <div class="menu-item">Print...</div>
      <div class="menu-item">Inspect</div>
      <div class="menu-divider"></div>
      <div class="menu-item active">
        <span>Convert currency</span>
        <span style="color:#71717a; font-size:11px;">▶</span>
      </div>
    </div>
    <div class="submenu">
      <div class="submenu-item highlighted">To NGN (Nigerian Naira)</div>
      <div class="submenu-item">To USD (US Dollar)</div>
      <div class="submenu-item">To EUR (Euro)</div>
      <div class="submenu-item">To GBP (British Pound)</div>
      <div class="submenu-item">To JPY (Japanese Yen)</div>
      <div class="submenu-item">To CAD (Canadian Dollar)</div>
      <div class="submenu-item">To AUD (Australian Dollar)</div>
      <div class="submenu-item">To INR (Indian Rupee)</div>
    </div>
  </div>
</div>
</body>
</html>`;

// 2. Screenshot 2: Conversion Result Notification
const html2 = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${baseStyles}</style></head>
<body>
${browserChrome}
<div class="viewport">
  <div class="content-container">
    <div class="item-header">
      <h1 class="item-title">Ultra-Wide 34-Inch Curved Monitor</h1>
      <p class="item-description">Professional workspace display with calibrated sRGB panel and USB-C connectivity.</p>
    </div>
    <div class="price-row">
      <span class="price-label">Unit Price:</span>
      <span class="price-val">$1,299.00</span>
    </div>
    <table class="specs-table">
      <tr><td>Resolution</td><td>3440 × 1440 WQHD</td></tr>
      <tr><td>Refresh Rate</td><td>144 Hz</td></tr>
      <tr><td>Warranty</td><td>3 Years Manufacturer Coverage</td></tr>
    </table>
    <button class="btn-action">Purchase</button>
  </div>

  <div class="notification-toast">
    <div class="toast-header">
      <div class="toast-icon">fx</div>
      <span class="toast-app-name">Currency Converter</span>
      <span class="toast-time">Just now</span>
    </div>
    <div class="toast-result">1,299.00 USD = 1,727,495.34 NGN</div>
    <div class="toast-rate">Rate: 1 USD = 1,329.87 NGN</div>
  </div>
</div>
</body>
</html>`;

// 3. Screenshot 3: European Comma Decimal Format
const html3 = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${baseStyles}</style></head>
<body>
${browserChrome}
<div class="viewport">
  <div class="content-container">
    <div class="item-header">
      <h1 class="item-title">Boutique Hotel Central — 2 Nights</h1>
      <p class="item-description">Standard double room reservation with breakfast included.</p>
    </div>
    <div class="price-row">
      <span class="price-label">Rate (European Format):</span>
      <span class="price-val"><span class="selected">149,50 €</span></span>
    </div>
    <table class="specs-table">
      <tr><td>Check-In</td><td>15:00</td></tr>
      <tr><td>Check-Out</td><td>11:00</td></tr>
      <tr><td>Cancellation</td><td>Free until 24 hours before check-in</td></tr>
    </table>
    <button class="btn-action">Confirm Reservation</button>
  </div>

  <div class="notification-toast">
    <div class="toast-header">
      <div class="toast-icon">fx</div>
      <span class="toast-app-name">Currency Converter</span>
      <span class="toast-time">Just now</span>
    </div>
    <div class="toast-result">149.50 EUR = 162.85 USD</div>
    <div class="toast-rate">Rate: 1 EUR = 1.09 USD</div>
  </div>
</div>
</body>
</html>`;

const tasks = [
  { html: 'clean_sc1.html', content: html1, out: 'real-work-test-context-menu.png' },
  { html: 'clean_sc2.html', content: html2, out: 'real-work-test-conversion-alert.png' },
  { html: 'clean_sc3.html', content: html3, out: 'real-work-test-european-decimal.png' }
];

tasks.forEach(t => {
  const htmlFile = path.join(scratchDir, t.html).replace(/\\/g, '/');
  const outFile = path.join(outDir, t.out).replace(/\\/g, '/');
  fs.writeFileSync(htmlFile, t.content);
  const cmd = `"${chromePath}" --headless --disable-gpu --screenshot="${outFile}" --window-size=1280,800 "file:///${htmlFile}"`;
  console.log(`Rendering ${t.out}...`);
  execSync(cmd);
});

console.log('Screenshots re-rendered cleanly according to DESIGN.md.');
