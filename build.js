// build.js
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const chromeDir = path.join(distDir, 'chrome');
const firefoxDir = path.join(distDir, 'firefox');
const packagesDir = path.join(distDir, 'packages');

const VERSION = '2.0.0';

// Ensure output directories exist
[
  distDir,
  chromeDir,
  firefoxDir,
  packagesDir,
  path.join(chromeDir, 'icons'),
  path.join(firefoxDir, 'icons'),
  path.join(chromeDir, 'popup'),
  path.join(firefoxDir, 'popup'),
  path.join(chromeDir, 'options'),
  path.join(firefoxDir, 'options')
].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

console.log(`[Build] Bundling Currency Convertr v${VERSION} with esbuild...`);

// 1. Bundle scripts with esbuild for Chrome and Firefox
const entryPoints = {
  'background': path.join(srcDir, 'background.js'),
  'content': path.join(srcDir, 'content', 'content.js'),
  'popup/popup': path.join(srcDir, 'popup', 'popup.js'),
  'options/options': path.join(srcDir, 'options', 'options.js')
};

// Bundle for Chrome
esbuild.buildSync({
  entryPoints,
  bundle: true,
  outdir: chromeDir,
  target: 'es2022',
  format: 'iife',
  loader: { '.css': 'text' },
  sourcemap: false
});

// Bundle for Firefox
esbuild.buildSync({
  entryPoints,
  bundle: true,
  outdir: firefoxDir,
  target: 'es2022',
  format: 'iife',
  loader: { '.css': 'text' },
  sourcemap: false
});

console.log('[Build] esbuild bundling completed successfully.');

// 2. Copy static files (HTML, CSS, Icons)
function copyStaticFiles(targetDir) {
  // Icons
  const iconSizes = [16, 48, 96, 128];
  iconSizes.forEach(size => {
    const src = path.join(srcDir, 'icons', `icon${size}.png`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, 'icons', `icon${size}.png`));
    }
  });

  // Popup HTML & CSS
  fs.copyFileSync(path.join(srcDir, 'popup', 'popup.html'), path.join(targetDir, 'popup', 'popup.html'));
  fs.copyFileSync(path.join(srcDir, 'popup', 'popup.css'), path.join(targetDir, 'popup', 'popup.css'));

  // Options HTML & CSS
  fs.copyFileSync(path.join(srcDir, 'options', 'options.html'), path.join(targetDir, 'options', 'options.html'));
  fs.copyFileSync(path.join(srcDir, 'options', 'options.css'), path.join(targetDir, 'options', 'options.css'));
}

copyStaticFiles(chromeDir);
copyStaticFiles(firefoxDir);

// 3. Manifest for Chrome (Manifest V3 with service_worker)
const commonManifest = {
  manifest_version: 3,
  name: "Currency Convertr",
  version: VERSION,
  description: "In-page price converter that transforms prices into your preferred currency with live exchange rates.",
  permissions: [
    "contextMenus",
    "notifications",
    "storage",
    "activeTab",
    "scripting"
  ],
  optional_host_permissions: [
    "<all_urls>"
  ],
  host_permissions: [
    "https://api.frankfurter.dev/*",
    "https://cdn.jsdelivr.net/*",
    "https://latest.currency-api.pages.dev/*"
  ],
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "96": "icons/icon96.png",
    "128": "icons/icon128.png"
  },
  action: {
    default_popup: "popup/popup.html",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  options_ui: {
    page: "options/options.html",
    open_in_tab: true
  },
  commands: {
    "toggle-page-conversion": {
      suggested_key: {
        default: "Alt+Shift+C",
        mac: "Alt+Shift+C"
      },
      description: "Toggle in-page price conversion"
    }
  }
};

const chromeManifest = {
  ...commonManifest,
  background: {
    service_worker: "background.js"
  }
};
fs.writeFileSync(path.join(chromeDir, 'manifest.json'), JSON.stringify(chromeManifest, null, 2));

// 4. Manifest for Firefox (Manifest V3 with background.scripts & Gecko settings)
const firefoxManifest = {
  ...commonManifest,
  browser_specific_settings: {
    gecko: {
      id: "currency-converter-fx@richmond.addons",
      strict_min_version: "140.0",
      data_collection_permissions: {
        required: ["none"]
      }
    },
    gecko_android: {
      strict_min_version: "142.0"
    }
  },
  background: {
    scripts: ["background.js"]
  }
};
fs.writeFileSync(path.join(firefoxDir, 'manifest.json'), JSON.stringify(firefoxManifest, null, 2));

console.log('[Build] Manifests generated for Chrome and Firefox.');

// 5. Package ZIP archives for Chrome Web Store and Firefox Add-ons
function createZip(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const items = fs.readdirSync(sourceDir);
  execSync(`tar -a -c -f "${zipPath}" -C "${sourceDir}" ${items.join(' ')}`);
  console.log(`[Build] Created package: ${zipPath}`);
}

const chromeZip = path.join(packagesDir, `currency-converter-chrome-v${VERSION}.zip`);
const firefoxZip = path.join(packagesDir, `currency-converter-firefox-v${VERSION}.zip`);

try {
  createZip(chromeDir, chromeZip);
  createZip(firefoxDir, firefoxZip);
  console.log(`[Build] Build completed successfully for v${VERSION}.`);
} catch (err) {
  console.error('[Build] ZIP packaging error:', err.message);
}
