import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratchDir = path.join(os.tmpdir(), 'currency-converter-v2-screenshots');
const outDir = path.join(__dirname, '..', 'screenshots');

fs.mkdirSync(scratchDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const browserHeader = `
<div class="browser-bar">
  <div class="traffic-lights">
    <span class="light"></span>
    <span class="light"></span>
    <span class="light"></span>
  </div>
  <div class="omnibox">
    <span class="lock">https://</span>electronics-store.example.com/item/laptop-pro
  </div>
  <div class="extension-icon-slot">
    <div class="ext-badge">fx</div>
  </div>
</div>
`;

const globalStyles = `
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
  .extension-icon-slot {
    display: flex;
    align-items: center;
  }
  .ext-badge {
    background: #18181b;
    color: #fafafa;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 6px;
  }
  .viewport {
    flex: 1;
    background: #ffffff;
    padding: 60px 80px 48px;
    display: flex;
    justify-content: center;
    position: relative;
    overflow-y: auto;
  }
  .content-container {
    width: 820px;
  }
  .item-header {
    border-bottom: 1px solid #e4e4e7;
    padding-bottom: 20px;
    margin-bottom: 24px;
  }
  .item-title {
    font-size: 26px;
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
    margin-bottom: 24px;
    position: relative;
  }
  .price-label {
    font-size: 14px;
    color: #71717a;
  }
  .price-val {
    font-size: 32px;
    font-weight: 700;
    color: #09090b;
    font-variant-numeric: tabular-nums;
  }
  .cc-highlight {
    background: rgba(37, 99, 235, 0.08);
    color: #1d4ed8;
    padding: 2px 6px;
    border-radius: 4px;
    border-bottom: 2px solid #3b82f6;
  }
  .specs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin-bottom: 28px;
  }
  .specs-table td {
    padding: 10px 0;
    border-bottom: 1px solid #f4f4f5;
  }
  .specs-table td:first-child {
    color: #71717a;
    width: 220px;
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
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
  }

  /* In-Page Floating Translate Bar */
  .inpage-bar-container {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 9999px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    padding: 6px 12px 6px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 1000;
    font-size: 13px;
    animation: slideDown 0.25s ease-out;
  }
  .bar-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #18181b;
    border-right: 1px solid #e4e4e7;
    padding-right: 10px;
  }
  .bar-brand-badge {
    background: #18181b;
    color: #ffffff;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 4px;
  }
  .bar-message {
    color: #3f3f46;
  }
  .bar-currency-badge {
    background: #f4f4f5;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
    color: #18181b;
  }
  .bar-btn-revert {
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    color: #18181b;
    cursor: pointer;
  }
  .bar-btn-revert:hover {
    background: #e4e4e7;
  }
  .bar-currency-select {
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 12px;
    color: #18181b;
  }
  .bar-btn-close {
    background: transparent;
    border: none;
    color: #a1a1aa;
    font-size: 15px;
    cursor: pointer;
    padding: 0 4px;
  }
  .bar-btn-close:hover {
    color: #18181b;
  }

  /* Tooltip */
  .custom-tooltip {
    position: absolute;
    top: 75px;
    left: 170px;
    background: #18181b;
    color: #fafafa;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    z-index: 1001;
    pointer-events: none;
  }
  .custom-tooltip::after {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 24px;
    border-width: 5px;
    border-style: solid;
    border-color: transparent transparent #18181b transparent;
  }
  .tooltip-title {
    font-weight: 600;
    margin-bottom: 2px;
  }
  .tooltip-meta {
    font-size: 11px;
    color: #a1a1aa;
  }
`;

// 1. Page with in-page Translate Bar + Converted Price + Tooltip
const htmlInPageBar = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>${globalStyles}</style></head>
<body>
${browserHeader}
<div class="viewport">
  <div class="inpage-bar-container">
    <div class="bar-brand">
      <span class="bar-brand-badge">fx</span>
      <span>Currency Convertr</span>
    </div>
    <span class="bar-message">Prices converted to <span class="bar-currency-badge">NGN (₦)</span></span>
    <button class="bar-btn-revert">Show original</button>
    <select class="bar-currency-select">
      <option selected>NGN (₦)</option>
      <option>USD ($)</option>
      <option>EUR (€)</option>
      <option>GBP (£)</option>
    </select>
    <button class="bar-btn-close">✕</button>
  </div>

  <div class="content-container">
    <div class="item-header">
      <h1 class="item-title">Apple MacBook Pro 16" (M3 Max, 36GB Unified Memory)</h1>
      <p class="item-description">High-performance workstation laptop for developers, engineers, and creatives.</p>
    </div>
    <div class="price-row">
      <span class="price-label">Price:</span>
      <span class="price-val cc-highlight">₦5,773,350.00</span>
      <div class="custom-tooltip">
        <div class="tooltip-title">Original: $3,499.00 USD</div>
        <div class="tooltip-meta">Rate: 1 USD = 1,650.00 NGN · ECB Reference</div>
      </div>
    </div>
    <table class="specs-table">
      <tr><td>Configuration</td><td>16-core CPU, 40-core GPU, 1TB SSD Storage</td></tr>
      <tr><td>Display</td><td>16.2-inch Liquid Retina XDR display (3456 × 2234)</td></tr>
      <tr><td>Shipping & Import Duty</td><td>Included at checkout</td></tr>
      <tr><td>Estimated Delivery</td><td>3 - 5 Business Days</td></tr>
    </table>
    <button class="btn-action">Add to Cart</button>
  </div>
</div>
</body>
</html>`;

// 2. Action Popup View (Floating over browser viewport)
const htmlPopup = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${globalStyles}
.popup-preview-container {
  position: absolute;
  top: 10px;
  right: 24px;
  width: 340px;
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  z-index: 2000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
}
.p-header {
  padding: 12px 16px;
  border-bottom: 1px solid #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.p-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #09090b;
}
.p-badge {
  background: #18181b;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
}
.p-body {
  padding: 16px;
}
.p-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.p-col {
  flex: 1;
}
.p-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #71717a;
  margin-bottom: 4px;
}
.p-box {
  background: #f4f4f5;
  border: 1px solid #e4e4e7;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #18181b;
}
.p-btn-primary {
  width: 100%;
  background: #18181b;
  color: #fafafa;
  border: none;
  border-radius: 6px;
  padding: 10px 0;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  cursor: pointer;
}
.p-status {
  text-align: center;
  font-size: 12px;
  color: #16a34a;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 16px;
  font-weight: 500;
}
.p-site-section {
  background: #fafafa;
  border: 1px solid #f4f4f5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.p-site-title {
  font-size: 12px;
  font-weight: 600;
  color: #3f3f46;
  margin-bottom: 10px;
}
.p-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #18181b;
  margin-bottom: 8px;
}
.p-footer {
  padding: 10px 16px;
  background: #fafafa;
  border-top: 1px solid #f4f4f5;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #71717a;
}
</style>
</head>
<body>
${browserHeader}
<div class="viewport">
  <div class="content-container" style="opacity: 0.35;">
    <div class="item-header">
      <h1 class="item-title">Ultra-Wide 34-Inch Curved Monitor</h1>
      <p class="item-description">Professional workspace display with calibrated sRGB panel.</p>
    </div>
    <div class="price-row">
      <span class="price-label">Price:</span>
      <span class="price-val">₦2,143,350.00</span>
    </div>
  </div>

  <div class="popup-preview-container">
    <div class="p-header">
      <div class="p-brand">
        <span class="p-badge">fx</span>
        <span>Currency Convertr</span>
      </div>
      <span style="color: #71717a; font-size: 14px;">⚙</span>
    </div>
    <div class="p-body">
      <div class="p-row">
        <div class="p-col">
          <span class="p-label">From</span>
          <div class="p-box">Auto-detect</div>
        </div>
        <div style="color: #a1a1aa; font-weight: bold; padding-top: 16px;">→</div>
        <div class="p-col">
          <span class="p-label">To</span>
          <div class="p-box" style="display: flex; justify-content: space-between;">
            <span>NGN (₦)</span>
            <span style="color: #71717a;">▾</span>
          </div>
        </div>
      </div>
      <button class="p-btn-primary">Show original</button>
      <div class="p-status">✓ 4 prices converted on page</div>
      <div class="p-site-section">
        <div class="p-site-title">electronics-store.example.com</div>
        <div class="p-toggle">
          <span>Always convert on this site</span>
          <span style="color: #16a34a; font-weight: bold;">[ON]</span>
        </div>
        <div class="p-toggle" style="margin-bottom: 0;">
          <span>Never convert on this site</span>
          <span style="color: #a1a1aa;">[OFF]</span>
        </div>
      </div>
    </div>
    <div class="p-footer">
      <span>Rates: ECB Reference · Live</span>
      <span style="text-decoration: underline;">Options</span>
    </div>
  </div>
</div>
</body>
</html>`;

// 3. Options Page Dashboard
const htmlOptions = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 800px;
    background: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #09090b;
    overflow-y: auto;
    padding: 32px 48px;
  }
  .container {
    max-width: 860px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #e4e4e7;
    padding-bottom: 20px;
    margin-bottom: 32px;
  }
  .badge {
    background: #18181b;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .title {
    font-size: 22px;
    font-weight: 700;
  }
  .section {
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  .section-desc {
    font-size: 13px;
    color: #71717a;
    margin-bottom: 20px;
  }
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }
  .chip {
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .chip-close {
    color: #71717a;
    cursor: pointer;
  }
  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .table th {
    text-align: left;
    padding: 8px 12px;
    background: #f4f4f5;
    border-bottom: 1px solid #e4e4e7;
    font-weight: 600;
    color: #3f3f46;
  }
  .table td {
    padding: 10px 12px;
    border-bottom: 1px solid #f4f4f5;
  }
  .tag-always {
    background: #dcfce7;
    color: #15803d;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 11px;
  }
  .btn-remove {
    background: transparent;
    border: 1px solid #e4e4e7;
    border-radius: 4px;
    padding: 2px 8px;
    color: #ef4444;
    font-size: 12px;
    font-weight: 500;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="badge">fx</span>
    <h1 class="title">Currency Convertr Settings & Preferences</h1>
  </div>

  <div class="section">
    <h2 class="section-title">Pinned Currencies (Context Menu & Quick Bar)</h2>
    <p class="section-desc">Up to 8 pinned currencies for instant conversion in the right-click menu.</p>
    <div class="chip-group">
      <div class="chip">NGN (₦) <span class="chip-close">✕</span></div>
      <div class="chip">USD ($) <span class="chip-close">✕</span></div>
      <div class="chip">EUR (€) <span class="chip-close">✕</span></div>
      <div class="chip">GBP (£) <span class="chip-close">✕</span></div>
      <div class="chip">JPY (¥) <span class="chip-close">✕</span></div>
      <div class="chip">CAD (CA$) <span class="chip-close">✕</span></div>
      <div class="chip">AUD (A$) <span class="chip-close">✕</span></div>
      <div class="chip">INR (₹) <span class="chip-close">✕</span></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Per-Site Conversion Rules</h2>
    <p class="section-desc">Manage websites configured for automated or restricted conversion.</p>
    <table class="table">
      <thead>
        <tr>
          <th>Website Domain</th>
          <th>Rule</th>
          <th>Assumed Currency</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>electronics-store.example.com</td>
          <td><span class="tag-always">Always Convert</span></td>
          <td>USD</td>
          <td><button class="btn-remove">Remove</button></td>
        </tr>
        <tr>
          <td>amazon.co.uk</td>
          <td><span class="tag-always">Always Convert</span></td>
          <td>GBP</td>
          <td><button class="btn-remove">Remove</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</body>
</html>`;

const renderTasks = [
  { html: 'v2_inpage.html', content: htmlInPageBar, out: 'screenshot-inpage-bar.png' },
  { html: 'v2_popup.html', content: htmlPopup, out: 'screenshot-popup.png' },
  { html: 'v2_options.html', content: htmlOptions, out: 'screenshot-options.png' }
];

renderTasks.forEach(t => {
  const htmlFile = path.join(scratchDir, t.html).replace(/\\/g, '/');
  const outFile = path.join(outDir, t.out).replace(/\\/g, '/');
  fs.writeFileSync(htmlFile, t.content);
  const cmd = `"${chromePath}" --headless --disable-gpu --screenshot="${outFile}" --window-size=1280,800 "file:///${htmlFile}"`;
  console.log(`Rendering ${t.out}...`);
  execSync(cmd);
});

console.log('v2.0.0 Screenshots rendered successfully!');
