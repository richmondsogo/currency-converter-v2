// ============================================================
// Currency Converter – Universal Background Script (MV3)
// Supports both Chromium (Chrome/Edge/Brave) & Firefox (Gecko)
//
// Dual-API Architecture:
// 1. Primary: Frankfurter (api.frankfurter.dev) - fast ECB rates
// 2. Fallback: Fawaz Ahmed API (jsdelivr) - 170+ currencies (NGN, etc.)
// ============================================================

// ----------------------------------------------------------
// 0. BROWSER API COMPATIBILITY SHIM
// ----------------------------------------------------------
const api = typeof browser !== "undefined" ? browser : chrome;

// ----------------------------------------------------------
// 1. CURRENCY SYMBOL / CODE MAPS
// ----------------------------------------------------------
const SYMBOL_MAP = {
  "CAD$": "CAD",
  "CA$":  "CAD",
  "NZ$":  "NZD",
  "HK$":  "HKD",
  "US$":  "USD",
  "A$":   "AUD",
  "AU$":  "AUD",
  "S$":   "SGD",
  "SG$":  "SGD",
  "R$":   "BRL",
  "CHF":  "CHF",
  "€":    "EUR",
  "£":    "GBP",
  "¥":    "JPY",
  "₦":    "NGN",
  "₹":    "INR",
  "₩":    "KRW",
  "zł":   "PLN",
  "Kč":   "CZK",
  "kr":   "SEK",
  "$":    "USD", // must be LAST so multi-char symbols match first
};

const ISO_CODES = [
  "USD","EUR","GBP","CAD","AUD","NZD","JPY","INR","KRW","CHF",
  "ZAR","HKD","SGD","MXN","BRL","SEK","NOK","DKK","PLN","CZK",
  "HUF","TRY","CNY","THB","MYR","PHP","IDR","AED","SAR","EGP",
  "NGN","KES","GHS","MAD","CLP","COP","PEN","ARS","PKR","ILS",
];

// Currencies Frankfurter supports natively as base/quote.
// Anything outside this set (e.g. NGN, GHS, KES) routes to Fawaz fallback API.
const FRANKFURTER_SUPPORTED = new Set([
  "USD","EUR","GBP","CAD","AUD","NZD","JPY","INR","KRW","CHF",
  "ZAR","HKD","SGD","MXN","BRL","SEK","NOK","DKK","PLN","CZK",
  "HUF","TRY","CNY","THB","MYR","PHP","IDR","AED","SAR","ILS",
]);

// ----------------------------------------------------------
// 2. TARGET CONVERSION CURRENCIES
// ----------------------------------------------------------
const TARGETS = [
  { id: "NGN", label: "To NGN (Nigerian Naira)"   },
  { id: "USD", label: "To USD (US Dollar)"         },
  { id: "EUR", label: "To EUR (Euro)"              },
  { id: "GBP", label: "To GBP (British Pound)"    },
  { id: "JPY", label: "To JPY (Japanese Yen)"     },
  { id: "CAD", label: "To CAD (Canadian Dollar)"  },
  { id: "AUD", label: "To AUD (Australian Dollar)"},
  { id: "INR", label: "To INR (Indian Rupee)"     },
];

// ----------------------------------------------------------
// 3. PARSING LOGIC
// ----------------------------------------------------------

function detectCurrency(text) {
  // Longest symbol first
  for (const [sym, code] of Object.entries(SYMBOL_MAP)) {
    if (text.includes(sym)) return code;
  }
  // ISO code search
  const upper = text.toUpperCase();
  for (const code of ISO_CODES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  return "USD"; // Safe default
}

function extractAmount(text) {
  // Strip currency symbols and ISO codes
  let s = text
    .replace(/[£€₦₹₩¥₣$]/g, " ")
    .replace(/\b[A-Z]{3}\b/g, " ")
    .trim();

  // Extract the first number sequence
  const match = s.match(/\d[\d,. ]*/);
  if (!match) return null;

  let raw = match[0].trim();

  // Normalize number formats:
  // 1. Both comma and dot present:
  //    1,299.99 -> comma is thousands, dot is decimal
  //    1.299,99 -> dot is thousands, comma is decimal
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.indexOf(",") < raw.indexOf(".")) {
      raw = raw.replace(/,/g, "");
    } else {
      raw = raw.replace(/\./g, "").replace(",", ".");
    }
  } else if (raw.includes(",")) {
    // Only comma present: e.g. "15,50" vs "1,500"
    // Standard price decimal typically has 1 or 2 digits after comma
    if (/,\d{1,2}$/.test(raw)) {
      raw = raw.replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  }

  // Remove whitespace separators
  raw = raw.replace(/\s+/g, "");

  const n = parseFloat(raw);
  return isNaN(n) || n <= 0 ? null : n;
}

// ----------------------------------------------------------
// 4. USER FEEDBACK / NOTIFICATION
// ----------------------------------------------------------
function notify(title, message) {
  const notifId = `cc-notif-${Date.now()}`;
  const options = {
    type: "basic",
    iconUrl: api.runtime.getURL("icons/icon48.png"),
    title,
    message,
  };

  try {
    api.notifications.create(notifId, options, () => {
      if (api.runtime.lastError) {
        console.warn("[CurrencyConverter] Notification callback error:", api.runtime.lastError.message);
      }
    });
  } catch (err) {
    console.error("[CurrencyConverter] Notification failed:", err);
  }
}

// ----------------------------------------------------------
// 5. CONVERSION APIS
// ----------------------------------------------------------

/**
 * PRIMARY: Frankfurter (api.frankfurter.dev/v1/latest)
 * Direct, fast, updated from European Central Bank reference rates.
 */
async function convertViaFrankfurter(amount, from, to) {
  const url = `https://api.frankfurter.dev/v1/latest?amount=${amount}&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = await res.json();
  if (!data.rates || data.rates[to] == null) {
    throw new Error("No rate in Frankfurter response");
  }
  return data.rates[to];
}

/**
 * FALLBACK: Fawaz Ahmed Currency API via jsDelivr CDN
 * Free, open, coverage for 170+ world currencies including NGN.
 */
async function convertViaFawaz(amount, from, to) {
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${f}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fawaz API HTTP ${res.status}`);
  const data = await res.json();
  const rate = data[f]?.[t];
  if (rate == null) {
    throw new Error(`No rate found for ${from}→${to} in fallback API`);
  }
  return amount * rate;
}

/**
 * Main convert function:
 * Routes to Frankfurter if both currencies are supported;
 * seamlessly falls back to Fawaz Ahmed API on failure or exotic currency pairs.
 */
async function convert(amount, from, to) {
  if (from === to) return amount;

  const useFrankfurter = FRANKFURTER_SUPPORTED.has(from) && FRANKFURTER_SUPPORTED.has(to);

  if (useFrankfurter) {
    try {
      return await convertViaFrankfurter(amount, from, to);
    } catch (err) {
      console.warn("[CurrencyConverter] Frankfurter failed, falling back to Fawaz:", err.message);
    }
  }

  return await convertViaFawaz(amount, from, to);
}

// ----------------------------------------------------------
// 6. BUILD CONTEXT MENUS
// ----------------------------------------------------------
function buildMenus() {
  if (!api.contextMenus) {
    console.warn("[CurrencyConverter] contextMenus API not available.");
    return;
  }

  api.contextMenus.removeAll(() => {
    // Parent Menu Item
    api.contextMenus.create({
      id: "cc-parent",
      title: "Convert currency",
      contexts: ["selection"],
    }, () => {
      if (api.runtime.lastError) {
        // Suppress benign duplicate ID or lifecycle warnings
      }
    });

    // Submenu Items
    for (const { id, label } of TARGETS) {
      api.contextMenus.create({
        id: `cc-${id}`,
        parentId: "cc-parent",
        title: label,
        contexts: ["selection"],
      }, () => {
        if (api.runtime.lastError) {
          // Suppress benign duplicate ID or lifecycle warnings
        }
      });
    }
  });
}

// Build menus on extension install / update
api.runtime.onInstalled.addListener(() => {
  buildMenus();
});

// Re-verify menus on browser startup
if (api.runtime.onStartup) {
  api.runtime.onStartup.addListener(() => {
    buildMenus();
  });
}

// ----------------------------------------------------------
// 7. CLICK HANDLER
// ----------------------------------------------------------
api.contextMenus.onClicked.addListener(async (info) => {
  if (!info.menuItemId || !info.menuItemId.startsWith("cc-") || info.menuItemId === "cc-parent") {
    return;
  }

  const toCurrency = info.menuItemId.replace("cc-", "");
  const raw = (info.selectionText || "").trim();

  // Guard: empty selection
  if (!raw) {
    notify("Currency Converter", "No text selected. Highlight a price and try again.");
    return;
  }

  // Parse Amount
  const amount = extractAmount(raw);
  if (amount === null) {
    notify("Currency Converter", `No valid numeric price found in "${raw.slice(0, 50)}".`);
    return;
  }

  // Detect Source Currency
  const fromCurrency = detectCurrency(raw);

  // Perform Conversion
  try {
    const result = await convert(amount, fromCurrency, toCurrency);

    const fmt = (n, cur) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n) + " " + cur;

    const unitRate = result / amount;

    notify(
      "Currency Converter",
      `${fmt(amount, fromCurrency)} = ${fmt(result, toCurrency)}\n` +
      `Rate: 1 ${fromCurrency} = ${fmt(unitRate, toCurrency)}`
    );
  } catch (err) {
    console.error("[CurrencyConverter] Conversion failed:", err);
    notify(
      "Currency Converter",
      `Unable to convert ${fromCurrency} to ${toCurrency}. Verify network connection.`
    );
  }
});
