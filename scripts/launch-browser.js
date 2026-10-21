import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

export const TMP_BUILDS_DIR = path.join(os.tmpdir(), 'cc_builds');

/**
 * Compiles a fresh build of the extension into an OS temp directory.
 * @param {string} [customOutDir]
 * @returns {string} Path to the freshly built unpacked extension directory
 */
export function buildFreshExtension(customOutDir) {
  const freshDir = customOutDir || fs.mkdtempSync(path.join(os.tmpdir(), 'cc-fresh-'));
  fs.mkdirSync(freshDir, { recursive: true });
  execSync('node build.js', { cwd: REPO_ROOT, stdio: 'pipe' });
  const distChrome = path.join(REPO_ROOT, 'dist', 'chrome');
  fs.cpSync(distChrome, freshDir, { recursive: true });
  return freshDir;
}

/**
 * Ensures that both stale and fresh builds exist in the temp directory.
 */
export function ensureBuilds() {
  const staleDir = path.join(TMP_BUILDS_DIR, 'stale');
  const freshDir = path.join(TMP_BUILDS_DIR, 'fresh');

  if (!fs.existsSync(staleDir)) {
    fs.mkdirSync(staleDir, { recursive: true });
    const archiveZip = path.join(TMP_BUILDS_DIR, 'stale_archive.zip');
    execSync(`git archive main dist/chrome --format=zip --output="${archiveZip}"`, { cwd: REPO_ROOT });
    const staleRaw = path.join(TMP_BUILDS_DIR, 'stale_raw');
    // Using powershell Expand-Archive on Windows
    execSync(`powershell -Command "Expand-Archive -Path '${archiveZip}' -DestinationPath '${staleRaw}' -Force"`, { cwd: REPO_ROOT });
    fs.cpSync(path.join(staleRaw, 'dist', 'chrome'), staleDir, { recursive: true });
    fs.rmSync(staleRaw, { recursive: true, force: true });
    fs.rmSync(archiveZip, { force: true });
  }

  buildFreshExtension(freshDir);

  return { staleDir, freshDir };
}

/**
 * Launch Chrome for Testing with the requested unpacked extension build.
 * @param {Object} options
 * @param {'fresh' | 'stale'} [options.build='fresh']
 * @param {boolean} [options.headed=true]
 * @param {string} [options.userDataDir]
 * @returns {Promise<{ context: import('playwright').BrowserContext, extensionId: string, sw: import('playwright').Worker, extensionPath: string, userDataDir: string, close: () => Promise<void> }>}
 */
export async function launchExtensionBrowser(options = {}) {
  const build = options.build || 'fresh';
  let extensionPath;
  let tempBuildDir = null;

  if (build === 'stale') {
    const { staleDir } = ensureBuilds();
    extensionPath = staleDir;
  } else {
    // Harness must build the extension into an OS temp dir at the start of each run (no dependence on leftover temp state)
    tempBuildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-ext-fresh-'));
    buildFreshExtension(tempBuildDir);
    extensionPath = tempBuildDir;
  }

  const userDataDir = options.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), `pw-cc-${build}-`));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Chrome extensions only load in headed mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  let sw = context.serviceWorkers()[0];
  if (!sw) {
    try {
      sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
    } catch (err) {
      throw new Error(`Failed to initialize extension service worker within 10s: ${err.message}`);
    }
  }

  const extensionId = new URL(sw.url()).hostname;

  return {
    context,
    extensionId,
    sw,
    extensionPath,
    userDataDir,
    close: async () => {
      await context.close();
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch (_) {}
      if (tempBuildDir) {
        try {
          fs.rmSync(tempBuildDir, { recursive: true, force: true });
        } catch (_) {}
      }
    }
  };
}

// CLI direct run support
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const buildArg = args.find(a => a.startsWith('--build='))?.split('=')[1] || 'fresh';
  const pageArg = args.find(a => a.startsWith('--page='))?.split('=')[1] || 'options';
  const urlArg = args.find(a => a.startsWith('--url='))?.split('=')[1];

  console.log(`[Launcher] Launching browser with build: ${buildArg}...`);
  launchExtensionBrowser({ build: buildArg })
    .then(async ({ context, extensionId }) => {
      console.log(`[Launcher] Extension ID: ${extensionId}`);
      const page = await context.newPage();
      if (urlArg) {
        await page.goto(urlArg);
      } else if (pageArg === 'popup') {
        await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      } else {
        await page.goto(`chrome-extension://${extensionId}/options/options.html`);
      }
      console.log(`[Launcher] Page opened. Press Ctrl+C to terminate browser session.`);
    })
    .catch(err => {
      console.error('[Launcher] Error:', err);
      process.exit(1);
    });
}
