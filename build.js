const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const chromeDir = path.join(distDir, 'chrome');
const firefoxDir = path.join(distDir, 'firefox');
const packagesDir = path.join(distDir, 'packages');

// Ensure output directories exist
[
  path.join(srcDir, 'icons'),
  chromeDir,
  path.join(chromeDir, 'icons'),
  firefoxDir,
  path.join(firefoxDir, 'icons'),
  packagesDir
].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// 1. Copy icon files from src/icons to target build outputs
const iconSizes = [16, 48, 96, 128];
iconSizes.forEach(size => {
  const iconSrc = path.join(srcDir, 'icons', `icon${size}.png`);
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(chromeDir, 'icons', `icon${size}.png`));
    fs.copyFileSync(iconSrc, path.join(firefoxDir, 'icons', `icon${size}.png`));
  }
});

// 2. Copy universal background script
const backgroundSrc = path.join(srcDir, 'background.js');
fs.copyFileSync(backgroundSrc, path.join(chromeDir, 'background.js'));
fs.copyFileSync(backgroundSrc, path.join(firefoxDir, 'background.js'));

// 3. Manifest for Chrome (Manifest V3 with service_worker)
const chromeManifest = {
  manifest_version: 3,
  name: "Currency Converter",
  version: "1.1.0",
  description: "Highlight a price on any webpage, right-click, and convert it instantly with live exchange rates.",
  permissions: [
    "contextMenus",
    "notifications"
  ],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "96": "icons/icon96.png",
    "128": "icons/icon128.png"
  },
  action: {
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  host_permissions: [
    "https://api.frankfurter.dev/*",
    "https://cdn.jsdelivr.net/*"
  ],
  background: {
    service_worker: "background.js"
  }
};
fs.writeFileSync(path.join(chromeDir, 'manifest.json'), JSON.stringify(chromeManifest, null, 2));

// 4. Manifest for Firefox (Manifest V3 with background.scripts & Gecko settings)
const firefoxManifest = {
  manifest_version: 3,
  name: "Currency Converter",
  version: "1.1.0",
  description: "Highlight a price on any webpage, right-click, and convert it instantly with live exchange rates.",
  browser_specific_settings: {
    gecko: {
      id: "currency-converter-fx@richmond.addons",
      strict_min_version: "109.0"
    }
  },
  permissions: [
    "contextMenus",
    "notifications"
  ],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "96": "icons/icon96.png",
    "128": "icons/icon128.png"
  },
  host_permissions: [
    "https://api.frankfurter.dev/*",
    "https://cdn.jsdelivr.net/*"
  ],
  background: {
    scripts: ["background.js"]
  }
};
fs.writeFileSync(path.join(firefoxDir, 'manifest.json'), JSON.stringify(firefoxManifest, null, 2));

console.log('Build directories prepared successfully.');

// 5. Package ZIP archives for Chrome Web Store and Firefox Add-ons
const chromeZip = path.join(packagesDir, 'currency-converter-chrome-v1.1.0.zip');
const firefoxZip = path.join(packagesDir, 'currency-converter-firefox-v1.1.0.zip');

if (fs.existsSync(chromeZip)) fs.unlinkSync(chromeZip);
if (fs.existsSync(firefoxZip)) fs.unlinkSync(firefoxZip);

try {
  execSync(`powershell -Command "Compress-Archive -Path '${chromeDir}\\*' -DestinationPath '${chromeZip}' -Force"`);
  console.log(`Created: ${chromeZip}`);
  execSync(`powershell -Command "Compress-Archive -Path '${firefoxDir}\\*' -DestinationPath '${firefoxZip}' -Force"`);
  console.log(`Created: ${firefoxZip}`);
} catch (err) {
  console.error('ZIP packaging error:', err.message);
}
