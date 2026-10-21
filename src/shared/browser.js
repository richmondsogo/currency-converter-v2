// src/shared/browser.js

/**
 * Universal browser API shim supporting both Chrome and Firefox MV3.
 * Firefox supports promise-based browser.* while Chrome supports chrome.* (with callbacks or promises in MV3).
 */
export function getBrowser() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  return null;
}

export const api = getBrowser();

/**
 * Send runtime message with promise return.
 */
export async function sendMessage(msg) {
  const b = getBrowser();
  if (!b || !b.runtime || !b.runtime.sendMessage) {
    throw new Error('Browser runtime messaging is not available');
  }

  // If browser.runtime.sendMessage returns a Promise (Firefox/standard)
  try {
    const res = b.runtime.sendMessage(msg);
    if (res && typeof res.then === 'function') {
      return await res;
    }
  } catch (err) {
    // If not returning a promise, try callback
  }

  return new Promise((resolve, reject) => {
    b.runtime.sendMessage(msg, (response) => {
      if (b.runtime.lastError) {
        reject(new Error(b.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to specific tab.
 */
export async function sendTabMessage(tabId, msg) {
  const b = getBrowser();
  if (!b || !b.tabs || !b.tabs.sendMessage) {
    throw new Error('Browser tabs messaging is not available');
  }

  return new Promise((resolve, reject) => {
    b.tabs.sendMessage(tabId, msg, (response) => {
      if (b.runtime.lastError) {
        // Silently resolve null if content script is not yet injected or tab closed
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Get active tab in current window.
 */
export async function getActiveTab() {
  const b = getBrowser();
  if (!b || !b.tabs || !b.tabs.query) return null;

  return new Promise((resolve) => {
    b.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (b.runtime.lastError || !tabs || tabs.length === 0) {
        resolve(null);
      } else {
        resolve(tabs[0]);
      }
    });
  });
}

/**
 * Checks if optional origin permission is granted.
 */
export async function hasOriginPermission(origin) {
  const b = getBrowser();
  if (!b || !b.permissions || !b.permissions.contains) return false;

  const pattern = origin.endsWith('/*') ? origin : `${origin}/*`;
  return new Promise((resolve) => {
    b.permissions.contains({ origins: [pattern] }, (result) => {
      if (b.runtime.lastError) resolve(false);
      else resolve(Boolean(result));
    });
  });
}

/**
 * Requests optional origin permission on user gesture.
 */
export async function requestOriginPermission(origin) {
  const b = getBrowser();
  if (!b || !b.permissions || !b.permissions.request) return false;

  const pattern = origin.endsWith('/*') ? origin : `${origin}/*`;
  return new Promise((resolve) => {
    b.permissions.request({ origins: [pattern] }, (granted) => {
      if (b.runtime.lastError) resolve(false);
      else resolve(Boolean(granted));
    });
  });
}

/**
 * Injects content script into a tab top frame if not already present.
 */
export async function injectContentScript(tabId) {
  const b = getBrowser();
  if (!b || !tabId) return false;

  try {
    if (b.scripting && b.scripting.executeScript) {
      await b.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ['content.js']
      });
      return true;
    } else if (b.tabs && b.tabs.executeScript) {
      return new Promise((resolve) => {
        b.tabs.executeScript(tabId, { file: 'content.js', allFrames: false }, () => {
          resolve(!b.runtime.lastError);
        });
      });
    }
  } catch (err) {
    console.warn('[Browser] Script injection error:', err);
  }
  return false;
}

/**
 * Ensures content script is injected into the top frame of a tab.
 * Pings tab first with GET_PAGE_STATUS and injects only if no listener answers.
 */
export async function ensureInjected(tabId) {
  if (!tabId) return false;
  try {
    const status = await sendTabMessage(tabId, { type: 'CC_GET_PAGE_STATUS' });
    if (status !== null && status !== undefined) {
      return true; // Already injected and listening
    }
  } catch {}
  return await injectContentScript(tabId);
}
