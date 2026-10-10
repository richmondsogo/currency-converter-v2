const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scratchDir = path.join(require('os').tmpdir(), 'currency-converter-assets');
const iconsDir = path.join(__dirname, '..', 'src', 'icons');
const screenshotsDir = path.join(__dirname, '..', 'screenshots');

fs.mkdirSync(scratchDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(screenshotsDir, { recursive: true });

// 1. Generate clean, minimal shadcn-style icon HTML
function createIconHtml(size) {
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.48);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${size}px;
    height: ${size}px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .icon-box {
    width: ${size}px;
    height: ${size}px;
    background: #18181b;
    border-radius: ${radius}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .glyph {
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    font-weight: 700;
    font-size: ${fontSize}px;
    line-height: 1;
    letter-spacing: -0.04em;
    transform: translateY(-2%);
  }
</style>
</head>
<body>
  <div class="icon-box">
    <span class="glyph">fx</span>
  </div>
</body>
</html>`;
}

// 2. Generate clean, minimal Promo Tile (440x280) strictly adhering to DESIGN.md
const promoHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 440px;
    height: 280px;
    background: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid #e4e4e7;
    overflow: hidden;
  }
  .icon-container {
    width: 56px;
    height: 56px;
    background: #18181b;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }
  .icon-glyph {
    color: #fafafa;
    font-weight: 700;
    font-size: 26px;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .title {
    font-size: 18px;
    font-weight: 600;
    color: #09090b;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .subtitle {
    font-size: 13px;
    font-weight: 400;
    color: #71717a;
    line-height: 1.4;
    text-align: center;
    max-width: 320px;
  }
  .meta {
    margin-top: 24px;
    font-size: 11px;
    font-weight: 500;
    color: #a1a1aa;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
</head>
<body>
  <div class="icon-container">
    <span class="icon-glyph">fx</span>
  </div>
  <h1 class="title">Currency Converter</h1>
  <p class="subtitle">Context menu price conversion for web</p>
  <div class="meta">170+ Currencies • European Central Bank Reference</div>
</body>
</html>`;

// Render icons
const sizes = [16, 48, 96, 128];
sizes.forEach(size => {
  const htmlPath = path.join(scratchDir, `icon_${size}.html`).replace(/\\/g, '/');
  const outPath = path.join(iconsDir, `icon${size}.png`).replace(/\\/g, '/');
  fs.writeFileSync(htmlPath, createIconHtml(size));
  const cmd = `"${chromePath}" --headless --disable-gpu --screenshot="${outPath}" --window-size=${size},${size} --default-background-color=00000000 "file:///${htmlPath}"`;
  execSync(cmd);
  console.log(`Rendered clean icon${size}.png`);
});

// Render promo tile
const promoHtmlPath = path.join(scratchDir, 'promo_clean.html').replace(/\\/g, '/');
const promoOutPath = path.join(screenshotsDir, 'promo-small-440x280.png').replace(/\\/g, '/');
fs.writeFileSync(promoHtmlPath, promoHtml);
const promoCmd = `"${chromePath}" --headless --disable-gpu --screenshot="${promoOutPath}" --window-size=440,280 "file:///${promoHtmlPath}"`;
execSync(promoCmd);
console.log('Rendered clean promo-small-440x280.png');
