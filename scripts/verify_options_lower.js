import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const distDir = path.join(__dirname, '..', 'dist', 'chrome');
const outDir = path.join(__dirname, '..', 'screenshots');

const optionsHtml = path.join(distDir, 'options', 'options.html').replace(/\\/g, '/');
const fullPageOut = path.join(outDir, 'verify-options-fullpage-shadcn.png').replace(/\\/g, '/');

const cmd = `"${chromePath}" --headless --disable-gpu --virtual-time-budget=2000 --screenshot="${fullPageOut}" --window-size=1200,2400 "file:///${optionsHtml}"`;
execSync(cmd);
console.log(`[Verify] Options full-page screenshot saved: ${fullPageOut}`);
