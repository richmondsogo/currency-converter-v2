// tests/theme.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_STORAGE_KEY,
  isSystemDark,
  resolveEffectiveTheme,
  applyTheme,
  subscribeSystemTheme
} from '../src/shared/theme.js';

test('theme: resolveEffectiveTheme handles explicit and system themes', () => {
  assert.equal(resolveEffectiveTheme('dark'), 'dark');
  assert.equal(resolveEffectiveTheme('light'), 'light');

  // Test system resolution with mock window.matchMedia
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      matchMedia: (query) => ({
        matches: query.includes('dark'),
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    };
    assert.equal(resolveEffectiveTheme('system'), 'dark');
    assert.equal(resolveEffectiveTheme('unknown_theme'), 'dark');

    globalThis.window = {
      matchMedia: () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {}
      })
    };
    assert.equal(resolveEffectiveTheme('system'), 'light');
    assert.equal(resolveEffectiveTheme(undefined), 'light');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('theme: applyTheme applies symmetric classes, data-theme, and colorScheme to DOM document', () => {
  const originalDoc = globalThis.document;
  const originalLocal = globalThis.localStorage;

  const storageMap = {};
  globalThis.localStorage = {
    getItem: (k) => storageMap[k] || null,
    setItem: (k, v) => { storageMap[k] = String(v); }
  };

  const classListSet = new Set();
  const attributes = {};
  const mockDoc = {
    documentElement: {
      classList: {
        add: (c) => classListSet.add(c),
        remove: (c) => classListSet.delete(c),
        contains: (c) => classListSet.has(c)
      },
      setAttribute: (k, v) => { attributes[k] = v; },
      getAttribute: (k) => attributes[k] || null,
      style: {}
    }
  };

  try {
    // 1. Apply dark theme
    const effDark = applyTheme('dark', mockDoc);
    assert.equal(effDark, 'dark');
    assert.ok(mockDoc.documentElement.classList.contains('dark'), 'Must have dark class');
    assert.ok(!mockDoc.documentElement.classList.contains('light'), 'Must NOT have light class');
    assert.equal(mockDoc.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(mockDoc.documentElement.style.colorScheme, 'dark');
    assert.equal(storageMap[THEME_STORAGE_KEY], 'dark');

    // 2. Apply light theme
    const effLight = applyTheme('light', mockDoc);
    assert.equal(effLight, 'light');
    assert.ok(mockDoc.documentElement.classList.contains('light'), 'Must have light class');
    assert.ok(!mockDoc.documentElement.classList.contains('dark'), 'Must NOT have dark class');
    assert.equal(mockDoc.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(mockDoc.documentElement.style.colorScheme, 'light');
    assert.equal(storageMap[THEME_STORAGE_KEY], 'light');
  } finally {
    globalThis.document = originalDoc;
    globalThis.localStorage = originalLocal;
  }
});

test('theme: subscribeSystemTheme attaches and cleans up matchMedia listeners', () => {
  let attachedHandler = null;
  let removedHandler = null;

  const originalWindow = globalThis.window;
  try {
    globalThis.window = {
      matchMedia: (query) => ({
        matches: false,
        addEventListener: (event, handler) => {
          if (event === 'change') attachedHandler = handler;
        },
        removeEventListener: (event, handler) => {
          if (event === 'change') removedHandler = handler;
        }
      })
    };

    let received = null;
    const unsubscribe = subscribeSystemTheme((theme) => {
      received = theme;
    });

    assert.ok(attachedHandler !== null, 'Listener must be attached');

    // Simulate system switching to dark
    attachedHandler({ matches: true });
    assert.equal(received, 'dark');

    // Simulate system switching to light
    attachedHandler({ matches: false });
    assert.equal(received, 'light');

    // Clean up
    unsubscribe();
    assert.strictEqual(attachedHandler, removedHandler, 'removeEventListener must be called with the same handler');
  } finally {
    globalThis.window = originalWindow;
  }
});
