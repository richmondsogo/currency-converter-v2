// src/shared/theme.js
// Unified theme management for Currency Convertr across Chrome and Firefox.
// Enforces symmetrical .dark / .light class management, data-theme attribute,
// native color-scheme styling, and localStorage synchronization for theme-boot.js.

export const THEME_STORAGE_KEY = 'currency_converter_theme';

/**
 * Checks whether the host system OS prefers dark color scheme.
 * @returns {boolean}
 */
export function isSystemDark() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return Boolean(window.matchMedia('(prefers-color-scheme: dark)').matches);
}

/**
 * Resolves the effective rendered theme ('dark' | 'light') from a setting value.
 * @param {'system' | 'light' | 'dark' | string} themeSetting
 * @returns {'dark' | 'light'}
 */
export function resolveEffectiveTheme(themeSetting) {
  if (themeSetting === 'dark') return 'dark';
  if (themeSetting === 'light') return 'light';
  return isSystemDark() ? 'dark' : 'light';
}

/**
 * Applies theme classes, data attributes, and colorScheme to the document root element.
 * Synchronizes the setting to localStorage for zero-FOUC pre-boot execution.
 * 
 * @param {'system' | 'light' | 'dark' | string} themeSetting
 * @param {Document} [doc]
 * @returns {'dark' | 'light'} The resolved effective theme applied.
 */
export function applyTheme(themeSetting, doc = (typeof document !== 'undefined' ? document : null)) {
  const setting = ['system', 'light', 'dark'].includes(themeSetting) ? themeSetting : 'system';

  // Synchronize localStorage cache for synchronous pre-boot script
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, setting);
    }
  } catch {}

  if (!doc || !doc.documentElement) {
    return resolveEffectiveTheme(setting);
  }

  const root = doc.documentElement;
  const effective = resolveEffectiveTheme(setting);
  const isDark = effective === 'dark';

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    if (root.style) {
      root.style.colorScheme = 'dark';
    }
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    if (root.style) {
      root.style.colorScheme = 'light';
    }
  }

  return effective;
}

/**
 * Subscribes to system OS color scheme changes when theme is set to 'system'.
 * Supports modern addEventListener and legacy addListener APIs.
 * 
 * @param {(effectiveTheme: 'dark' | 'light') => void} callback
 * @returns {() => void} Unsubscribe cleanup function
 */
export function subscribeSystemTheme(callback) {
  if (typeof window === 'undefined' || !window.matchMedia || typeof callback !== 'function') {
    return () => {};
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    callback(e.matches ? 'dark' : 'light');
  };

  if (media.addEventListener) {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  } else if (media.addListener) {
    media.addListener(handler);
    return () => media.removeListener(handler);
  }

  return () => {};
}
