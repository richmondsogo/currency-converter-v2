// src/shared/rates.js
export const RATES_CACHE_KEY = 'currency_rates_cache_v2';
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const REQUEST_TIMEOUT_MS = 8000; // 8 seconds

export const TIER1_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR';
export const TIER2_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json';
export const TIER3_URL = 'https://latest.currency-api.pages.dev/v1/currencies/eur.json';

/**
 * Calculates the cross-exchange rate between two currencies using a EUR-base rate table.
 * formula: rate(from -> to) = r[to] / r[from]
 */
export function calculateRate(from, to, ratesTable) {
  if (!from || !to) throw new Error('Source and target currency codes are required.');
  const f = from.toUpperCase();
  const t = to.toUpperCase();

  if (f === t) return 1.0;

  if (!ratesTable) {
    throw new Error('Rates table is empty or unavailable.');
  }

  const rateFrom = ratesTable[f];
  const rateTo = ratesTable[t];

  if (rateFrom == null || isNaN(rateFrom) || rateFrom <= 0) {
    throw new Error(`Rate not available for source currency "${f}".`);
  }
  if (rateTo == null || isNaN(rateTo) || rateTo <= 0) {
    throw new Error(`Rate not available for target currency "${t}".`);
  }

  return rateTo / rateFrom;
}

/**
 * Converts numeric amount from one currency to another using a EUR-base rate table.
 */
export function convertAmount(amount, from, to, ratesTable) {
  const rate = calculateRate(from, to, ratesTable);
  return amount * rate;
}

export class RatesEngine {
  /**
   * @param {Object} options
   * @param {Function} [options.fetchFn] - Injectable fetch
   * @param {Object} [options.storage] - Injectable storage ({ get, set })
   */
  constructor({ fetchFn = null, storage = null } = {}) {
    this.fetchFn = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.storage = storage || this._resolveBrowserStorage();
    this.inFlightPromise = null;
  }

  _resolveBrowserStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    // In-memory fallback
    const mem = {};
    return {
      get: async (keys) => {
        if (typeof keys === 'string') return { [keys]: mem[keys] };
        const res = {};
        for (const k of keys) if (mem[k] !== undefined) res[k] = mem[k];
        return res;
      },
      set: async (obj) => {
        Object.assign(mem, obj);
      }
    };
  }

  async _fetchWithTimeout(url) {
    if (!this.fetchFn) throw new Error('Fetch function not available.');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;

    try {
      const response = await this.fetchFn(url, { signal: controller ? controller.signal : undefined });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      return await response.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Fetches rates from the 3 network tiers and merges them.
   */
  async fetchNetworkRates() {
    let frankfurterData = null;
    let fawazData = null;
    let fawazTier = null;

    // Tier 1: Frankfurter (ECB)
    try {
      frankfurterData = await this._fetchWithTimeout(TIER1_URL);
    } catch (err) {
      // Tier 1 failed, continue to fallback
    }

    // Tier 2: Fawaz via jsDelivr CDN
    try {
      fawazData = await this._fetchWithTimeout(TIER2_URL);
      fawazTier = 'Tier 2 (jsDelivr)';
    } catch {
      // Tier 2 failed, try Tier 3
      try {
        fawazData = await this._fetchWithTimeout(TIER3_URL);
        fawazTier = 'Tier 3 (Cloudflare Pages)';
      } catch (err3) {
        // Both Fawaz tiers failed
      }
    }

    // If both Frankfurter and all Fawaz tiers failed, throw
    if (!frankfurterData && !fawazData) {
      throw new Error('All exchange rate network providers failed.');
    }

    // Merge rates
    const mergedRates = { EUR: 1.0 };
    let providerName = '';
    let rateDate = new Date().toISOString().split('T')[0];

    // Populate from Fawaz first (broad coverage)
    if (fawazData && fawazData.eur) {
      if (fawazData.date) rateDate = fawazData.date;
      for (const [code, rate] of Object.entries(fawazData.eur)) {
        if (typeof rate === 'number' && rate > 0) {
          mergedRates[code.toUpperCase()] = rate;
        }
      }
      providerName = `Currency API (${fawazTier})`;
    }

    // Overwrite with Frankfurter (ECB reference rates have highest precedence)
    if (frankfurterData && frankfurterData.rates) {
      if (frankfurterData.date) rateDate = frankfurterData.date;
      for (const [code, rate] of Object.entries(frankfurterData.rates)) {
        if (typeof rate === 'number' && rate > 0) {
          mergedRates[code.toUpperCase()] = rate;
        }
      }
      providerName = fawazData ? 'ECB + Fallback' : 'ECB (Frankfurter)';
    }

    return {
      rates: mergedRates,
      date: rateDate,
      provider: providerName,
      timestamp: Date.now()
    };
  }

  /**
   * Retrieves cached rates or fetches fresh rates with stale-while-revalidate.
   */
  async getRates({ forceRefresh = false } = {}) {
    // 1. Check storage cache
    let cached = null;
    try {
      const data = await this.storage.get(RATES_CACHE_KEY);
      cached = data ? data[RATES_CACHE_KEY] : null;
    } catch {}

    const now = Date.now();
    const isCacheFresh = cached && (now - cached.timestamp < CACHE_TTL_MS);

    // If cache is fresh and refresh not forced, return immediately
    if (isCacheFresh && !forceRefresh) {
      return {
        ...cached,
        isStale: false
      };
    }

    // Deduplicate in-flight fetch
    if (!this.inFlightPromise) {
      this.inFlightPromise = (async () => {
        try {
          const freshData = await this.fetchNetworkRates();
          // Update storage
          await this.storage.set({ [RATES_CACHE_KEY]: freshData });
          return freshData;
        } catch (err) {
          // If we have cached rates, background failure is suppressed
          if (!cached) throw err;
          return {
            ...cached,
            isStale: true,
            error: err.message
          };
        } finally {
          this.inFlightPromise = null;
        }
      })();
    }

    // Stale-while-revalidate: if we have stale cache and not explicitly forced,
    // return stale cache now and let background fetch continue
    if (cached && !forceRefresh) {
      // In-flight fetch is already triggered in background above, attach no-op catch to prevent unhandled rejection
      this.inFlightPromise.catch(() => {});
      return {
        ...cached,
        isStale: true
      };
    }

    // Otherwise await the in-flight fetch
    try {
      const freshData = await this.inFlightPromise;
      return {
        ...freshData,
        isStale: false
      };
    } catch (err) {
      // Network failed; fallback to stale cache if available
      if (cached) {
        return {
          ...cached,
          isStale: true,
          error: err.message
        };
      }
      throw err;
    }
  }
}
