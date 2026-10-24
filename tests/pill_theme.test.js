// tests/pill_theme.test.js
// Step 11: the in-page Dynamic Island pill must follow the Paper & Pine theme
// (extension Theme setting: system | light | dark) instead of a fixed OLED black.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { INLINE_UI_CSS, InPageUI } from '../src/content/ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_CSS_FILE = fs.readFileSync(path.join(__dirname, '..', 'src', 'content', 'ui.css'), 'utf8');

// ---------- helpers ----------

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalize(css) {
  return stripComments(css).replace(/\s+/g, ' ').trim();
}

/** Parses flat `selector { declarations }` rules (descends into @media). */
function parseRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(stripComments(css))) !== null) {
    rules.push({ selector: m[1].trim(), body: m[2] });
  }
  return rules;
}

function tokenRule(css, selector) {
  const rule = parseRules(css).find(
    (r) => r.selector === selector && r.body.includes('--cc-text')
  );
  assert.ok(rule, `Missing token block for selector: ${selector}`);
  const tokens = {};
  for (const [, name, value] of rule.body.matchAll(/(--cc-[a-z-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const DARK_MEDIA_SELECTOR = '.cc-island-container:not([data-theme="light"])';
const DARK_EXPLICIT_SELECTOR = '.cc-island-container[data-theme="dark"]';
const LIGHT_SELECTOR = '.cc-island-container';

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return { r: parseInt(c.slice(0, 2), 16), g: parseInt(c.slice(2, 4), 16), b: parseInt(c.slice(4, 6), 16) };
}
function lin(v) {
  const n = v / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function mount(theme) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const ui = new InPageUI({ doc: dom.window.document, targetCurrency: 'USD', isConverted: true, convertedCount: 2, theme });
  ui.mount();
  return ui;
}

// ---------- tests ----------

test('pill css: ui.css and INLINE_UI_CSS stay in sync (comments/whitespace ignored)', () => {
  assert.equal(normalize(INLINE_UI_CSS), normalize(UI_CSS_FILE));
});

test('pill css: defines light default, explicit dark, and system-dark token blocks', () => {
  for (const css of [INLINE_UI_CSS, UI_CSS_FILE]) {
    for (const selector of [LIGHT_SELECTOR, DARK_EXPLICIT_SELECTOR, DARK_MEDIA_SELECTOR]) {
      const t = tokenRule(css, selector);
      for (const name of ['--cc-surface', '--cc-surface-solid', '--cc-raised', '--cc-hairline', '--cc-text', '--cc-muted', '--cc-accent', '--cc-accent-fg', '--cc-ring']) {
        assert.ok(t[name], `${selector} must define ${name}`);
      }
    }
    assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  }
});

test('pill css: system-dark block is scoped so explicit light wins on a dark OS', () => {
  assert.match(INLINE_UI_CSS, /prefers-color-scheme:\s*dark\)\s*\{\s*\.cc-island-container:not\(\[data-theme="light"\]\)/);
});

test('pill css: no hard-coded OLED/zinc/emerald literals outside token blocks', () => {
  for (const css of [INLINE_UI_CSS, UI_CSS_FILE]) {
    const withoutTokens = parseRules(css)
      .filter((r) => !r.body.includes('--cc-text'))
      .map((r) => `${r.selector}{${r.body}}`)
      .join('\n');
    const banned = /#09090b|#fafafa|#e4e4e7|#a1a1aa|#71717a|#27272a|#18181b|#10b981|#ffffff|rgba\(\s*255\s*,\s*255\s*,\s*255/i;
    const hit = withoutTokens.match(banned);
    assert.equal(hit, null, `Hard-coded literal found outside tokens: ${hit && hit[0]}`);
  }
});

test('pill css: uses theme tokens for surface, text, segmented control and select', () => {
  assert.match(INLINE_UI_CSS, /\.cc-dynamic-island\s*\{[^}]*background(?:-color)?:\s*var\(--cc-surface\)/);
  assert.match(INLINE_UI_CSS, /\.cc-dynamic-island\s*\{[^}]*border:\s*1px solid var\(--cc-hairline\)/);
  assert.match(INLINE_UI_CSS, /\.cc-segment-btn\.active\s*\{[^}]*background:\s*var\(--cc-accent\)/);
  assert.match(INLINE_UI_CSS, /\.cc-tooltip\s*\{[^}]*background:\s*var\(--cc-surface-solid\)/);
});

test('pill css: accessibility fallbacks for transparency and contrast preferences', () => {
  assert.match(INLINE_UI_CSS, /prefers-reduced-transparency:\s*reduce/);
  assert.match(INLINE_UI_CSS, /prefers-contrast:\s*more/);
  assert.match(INLINE_UI_CSS, /prefers-reduced-motion:\s*reduce/);
});

test('pill css: single-capsule horizontal expansion architecture is preserved', () => {
  assert.match(INLINE_UI_CSS, /\.cc-dynamic-island\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(INLINE_UI_CSS, /\.cc-island-expandable\s*\{[^}]*grid-template-columns:\s*0fr/s);
});

test('pill theme: data-theme attribute follows theme at mount and on update', () => {
  const dark = mount('dark');
  assert.equal(dark.barContainer.getAttribute('data-theme'), 'dark');

  const light = mount('light');
  assert.equal(light.barContainer.getAttribute('data-theme'), 'light');

  const system = mount('system');
  assert.equal(system.barContainer.hasAttribute('data-theme'), false);

  system.update({ theme: 'dark' });
  assert.equal(system.barContainer.getAttribute('data-theme'), 'dark');
  system.update({ theme: 'light' });
  assert.equal(system.barContainer.getAttribute('data-theme'), 'light');
  system.update({ theme: 'system' });
  assert.equal(system.barContainer.hasAttribute('data-theme'), false);
});

test('pill theme: token pairs meet WCAG AA against the solid (worst-case) surface', async (t) => {
  const themes = [
    { name: 'light', selector: LIGHT_SELECTOR },
    { name: 'dark (explicit)', selector: DARK_EXPLICIT_SELECTOR },
    { name: 'dark (system)', selector: DARK_MEDIA_SELECTOR }
  ];
  for (const th of themes) {
    const tk = tokenRule(INLINE_UI_CSS, th.selector);
    const pairs = [
      ['text on surface', tk['--cc-text'], tk['--cc-surface-solid'], 4.5],
      ['muted on surface', tk['--cc-muted'], tk['--cc-surface-solid'], 4.5],
      ['text on raised', tk['--cc-text'], tk['--cc-raised'], 4.5],
      ['muted on raised', tk['--cc-muted'], tk['--cc-raised'], 4.5],
      ['accent-fg on accent (active segment)', tk['--cc-accent-fg'], tk['--cc-accent'], 4.5],
      ['accent dot on surface (non-text)', tk['--cc-accent'], tk['--cc-surface-solid'], 3]
    ];
    for (const [label, fg, bg, min] of pairs) {
      await t.test(`${th.name}: ${label}`, () => {
        assert.match(fg, /^#[0-9a-f]{6}$/i, `${label}: fg must be a 6-digit hex, got ${fg}`);
        assert.match(bg, /^#[0-9a-f]{6}$/i, `${label}: bg must be a 6-digit hex, got ${bg}`);
        const ratio = contrast(fg, bg);
        assert.ok(ratio >= min, `${label}: expected >= ${min}:1, got ${ratio.toFixed(2)}:1 (${fg} on ${bg})`);
      });
    }
  }
});
