// src/options/theme-boot.js
// Synchronous theme bootloader executed before first paint to prevent flash of unstyled theme (FOUC).
// Reads cached theme preference from localStorage and sets root classes/attributes before React mounts.
(function () {
  try {
    var stored = localStorage.getItem('currency_converter_theme');
    if (!stored) {
      var raw = localStorage.getItem('currency_converter_settings_v2');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.theme) {
          stored = parsed.theme;
        }
      }
    }
    var theme = stored || 'system';
    var isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    var root = document.documentElement;
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
  } catch (e) {
    // Non-blocking fallback
  }
})();
