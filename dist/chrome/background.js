(() => {
  // src/shared/rates.js
  var RATES_CACHE_KEY = "currency_rates_cache_v2";
  var CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
  var REQUEST_TIMEOUT_MS = 8e3;
  var TIER1_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";
  var TIER2_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json";
  var TIER3_URL = "https://latest.currency-api.pages.dev/v1/currencies/eur.json";
  function calculateRate(from, to, ratesTable) {
    if (!from || !to) throw new Error("Source and target currency codes are required.");
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return 1;
    if (!ratesTable) {
      throw new Error("Rates table is empty or unavailable.");
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
  var RatesEngine = class {
    /**
     * @param {Object} options
     * @param {Function} [options.fetchFn] - Injectable fetch
     * @param {Object} [options.storage] - Injectable storage ({ get, set })
     */
    constructor({ fetchFn = null, storage = null } = {}) {
      this.fetchFn = fetchFn || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
      this.storage = storage || this._resolveBrowserStorage();
      this.inFlightPromise = null;
    }
    _resolveBrowserStorage() {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        return chrome.storage.local;
      }
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        return browser.storage.local;
      }
      const mem = {};
      return {
        get: async (keys) => {
          if (typeof keys === "string") return { [keys]: mem[keys] };
          const res = {};
          for (const k of keys) if (mem[k] !== void 0) res[k] = mem[k];
          return res;
        },
        set: async (obj) => {
          Object.assign(mem, obj);
        }
      };
    }
    async _fetchWithTimeout(url) {
      if (!this.fetchFn) throw new Error("Fetch function not available.");
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
      try {
        const response = await this.fetchFn(url, { signal: controller ? controller.signal : void 0 });
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
      try {
        frankfurterData = await this._fetchWithTimeout(TIER1_URL);
      } catch (err) {
      }
      try {
        fawazData = await this._fetchWithTimeout(TIER2_URL);
        fawazTier = "Tier 2 (jsDelivr)";
      } catch {
        try {
          fawazData = await this._fetchWithTimeout(TIER3_URL);
          fawazTier = "Tier 3 (Cloudflare Pages)";
        } catch (err3) {
        }
      }
      if (!frankfurterData && !fawazData) {
        throw new Error("All exchange rate network providers failed.");
      }
      const mergedRates = { EUR: 1 };
      let providerName = "";
      let rateDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (fawazData && fawazData.eur) {
        if (fawazData.date) rateDate = fawazData.date;
        for (const [code, rate] of Object.entries(fawazData.eur)) {
          if (typeof rate === "number" && rate > 0) {
            mergedRates[code.toUpperCase()] = rate;
          }
        }
        providerName = `Currency API (${fawazTier})`;
      }
      if (frankfurterData && frankfurterData.rates) {
        if (frankfurterData.date) rateDate = frankfurterData.date;
        for (const [code, rate] of Object.entries(frankfurterData.rates)) {
          if (typeof rate === "number" && rate > 0) {
            mergedRates[code.toUpperCase()] = rate;
          }
        }
        providerName = fawazData ? "ECB + Fallback" : "ECB (Frankfurter)";
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
      let cached = null;
      try {
        const data = await this.storage.get(RATES_CACHE_KEY);
        cached = data ? data[RATES_CACHE_KEY] : null;
      } catch {
      }
      const now = Date.now();
      const isCacheFresh = cached && now - cached.timestamp < CACHE_TTL_MS;
      if (isCacheFresh && !forceRefresh) {
        return {
          ...cached,
          isStale: false
        };
      }
      if (!this.inFlightPromise) {
        this.inFlightPromise = (async () => {
          try {
            const freshData = await this.fetchNetworkRates();
            await this.storage.set({ [RATES_CACHE_KEY]: freshData });
            return freshData;
          } catch (err) {
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
      if (cached && !forceRefresh) {
        this.inFlightPromise.catch(() => {
        });
        return {
          ...cached,
          isStale: true
        };
      }
      try {
        const freshData = await this.inFlightPromise;
        return {
          ...freshData,
          isStale: false
        };
      } catch (err) {
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
  };

  // src/shared/settings.js
  var SETTINGS_STORAGE_KEY = "currency_converter_settings_v2";
  var CURRENT_SCHEMA_VERSION = 2;
  var DEFAULT_SETTINGS = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    targetCurrency: "USD",
    lastUsedTarget: "USD",
    pinnedCurrencies: ["NGN", "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR"],
    displayMode: "replace",
    // 'replace' | 'append' | 'replace_highlight'
    roundWhole: false,
    ambiguousDollar: "USD",
    showCrypto: false,
    showInPageBar: true,
    autoConvertAll: false,
    theme: "system",
    // 'system' | 'light' | 'dark'
    perSite: {}
    // { [hostname]: { autoConvert?: boolean, neverConvert?: boolean, assumedCurrency?: string } }
  };
  function migrateSettings(raw) {
    if (!raw || typeof raw !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) {
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        perSite: { ...raw.perSite }
      };
    }
    const migrated = {
      ...DEFAULT_SETTINGS,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      targetCurrency: raw.targetCurrency || DEFAULT_SETTINGS.targetCurrency,
      lastUsedTarget: raw.lastUsedTarget || raw.targetCurrency || DEFAULT_SETTINGS.lastUsedTarget,
      pinnedCurrencies: Array.isArray(raw.pinnedCurrencies) && raw.pinnedCurrencies.length > 0 ? raw.pinnedCurrencies.slice(0, 8) : [...DEFAULT_SETTINGS.pinnedCurrencies],
      displayMode: ["replace", "append", "replace_highlight"].includes(raw.displayMode) ? raw.displayMode : DEFAULT_SETTINGS.displayMode,
      roundWhole: Boolean(raw.roundWhole),
      ambiguousDollar: raw.ambiguousDollar || DEFAULT_SETTINGS.ambiguousDollar,
      showCrypto: Boolean(raw.showCrypto),
      showInPageBar: raw.showInPageBar !== void 0 ? Boolean(raw.showInPageBar) : DEFAULT_SETTINGS.showInPageBar,
      autoConvertAll: Boolean(raw.autoConvertAll),
      theme: ["system", "light", "dark"].includes(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
      perSite: raw.perSite && typeof raw.perSite === "object" ? { ...raw.perSite } : {}
    };
    return migrated;
  }
  function validateSettings(settings) {
    const s = migrateSettings(settings);
    if (s.pinnedCurrencies.length > 8) {
      s.pinnedCurrencies = s.pinnedCurrencies.slice(0, 8);
    }
    return s;
  }
  var SettingsManager = class {
    constructor({ storage = null } = {}) {
      this.storage = storage || this._resolveBrowserStorage();
    }
    _resolveBrowserStorage() {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        return chrome.storage.local;
      }
      if (typeof browser !== "undefined" && browser.storage && browser.storage.local) {
        return browser.storage.local;
      }
      const mem = {};
      return {
        get: async (k) => typeof k === "string" ? { [k]: mem[k] } : mem,
        set: async (obj) => Object.assign(mem, obj)
      };
    }
    async getSettings() {
      try {
        const data = await this.storage.get(SETTINGS_STORAGE_KEY);
        return migrateSettings(data ? data[SETTINGS_STORAGE_KEY] : null);
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }
    async updateSettings(partial) {
      const current = await this.getSettings();
      const updated = validateSettings({
        ...current,
        ...partial
      });
      await this.storage.set({ [SETTINGS_STORAGE_KEY]: updated });
      return updated;
    }
    async setSiteRule(hostname, rule) {
      if (!hostname) return;
      const current = await this.getSettings();
      const perSite = { ...current.perSite };
      perSite[hostname] = {
        ...perSite[hostname] || {},
        ...rule
      };
      return this.updateSettings({ perSite });
    }
    async getSiteRule(hostname) {
      if (!hostname) return null;
      const settings = await this.getSettings();
      return settings.perSite[hostname] || null;
    }
    async removeSiteRule(hostname) {
      if (!hostname) return;
      const current = await this.getSettings();
      const perSite = { ...current.perSite };
      delete perSite[hostname];
      return this.updateSettings({ perSite });
    }
    async resetDefaults() {
      await this.storage.set({ [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS } });
      return { ...DEFAULT_SETTINGS };
    }
    async exportJson() {
      const settings = await this.getSettings();
      return JSON.stringify(settings, null, 2);
    }
    async importJson(jsonString) {
      const parsed = JSON.parse(jsonString);
      const validated = validateSettings(parsed);
      await this.storage.set({ [SETTINGS_STORAGE_KEY]: validated });
      return validated;
    }
  };

  // src/shared/currencies-data.js
  var CURRENCIES_DATA = {
    "AED": {
      "code": "AED",
      "name": "United Arab Emirates Dirham",
      "symbol": "AED",
      "narrowSymbol": "AED",
      "digits": 2,
      "aliases": [
        "AED",
        "\u062F.\u0625",
        "Dhs"
      ],
      "ccTLDs": [
        "ae"
      ],
      "crypto": false
    },
    "AFN": {
      "code": "AFN",
      "name": "Afghan Afghani",
      "symbol": "AFN",
      "narrowSymbol": "\u060B",
      "digits": 0,
      "aliases": [
        "AFN",
        "\u060B"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ALL": {
      "code": "ALL",
      "name": "Albanian Lek",
      "symbol": "ALL",
      "narrowSymbol": "ALL",
      "digits": 0,
      "aliases": [
        "ALL"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "AMD": {
      "code": "AMD",
      "name": "Armenian Dram",
      "symbol": "AMD",
      "narrowSymbol": "\u058F",
      "digits": 2,
      "aliases": [
        "AMD",
        "\u058F"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ANG": {
      "code": "ANG",
      "name": "Netherlands Antillean Guilder",
      "symbol": "ANG",
      "narrowSymbol": "ANG",
      "digits": 2,
      "aliases": [
        "ANG"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "AOA": {
      "code": "AOA",
      "name": "Angolan Kwanza",
      "symbol": "AOA",
      "narrowSymbol": "Kz",
      "digits": 2,
      "aliases": [
        "AOA",
        "Kz"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ARS": {
      "code": "ARS",
      "name": "Argentine Peso",
      "symbol": "AR$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "ARS",
        "AR$",
        "$"
      ],
      "ccTLDs": [
        "ar"
      ],
      "crypto": false
    },
    "AUD": {
      "code": "AUD",
      "name": "Australian Dollar",
      "symbol": "A$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "AUD",
        "A$",
        "$",
        "AU$",
        "AUD$"
      ],
      "ccTLDs": [
        "au",
        "com.au"
      ],
      "crypto": false
    },
    "AWG": {
      "code": "AWG",
      "name": "Aruban Florin",
      "symbol": "AWG",
      "narrowSymbol": "AWG",
      "digits": 2,
      "aliases": [
        "AWG"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "AZN": {
      "code": "AZN",
      "name": "Azerbaijani Manat",
      "symbol": "AZN",
      "narrowSymbol": "\u20BC",
      "digits": 2,
      "aliases": [
        "AZN",
        "\u20BC"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BAM": {
      "code": "BAM",
      "name": "Bosnia-Herzegovina Convertible Mark",
      "symbol": "BAM",
      "narrowSymbol": "KM",
      "digits": 2,
      "aliases": [
        "BAM",
        "KM"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BBD": {
      "code": "BBD",
      "name": "Barbadian Dollar",
      "symbol": "BBD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "BBD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BDT": {
      "code": "BDT",
      "name": "Bangladeshi Taka",
      "symbol": "\u09F3",
      "narrowSymbol": "\u09F3",
      "digits": 2,
      "aliases": [
        "BDT",
        "\u09F3",
        "Tk"
      ],
      "ccTLDs": [
        "bd"
      ],
      "crypto": false
    },
    "BGN": {
      "code": "BGN",
      "name": "Bulgarian Lev",
      "symbol": "BGN",
      "narrowSymbol": "BGN",
      "digits": 2,
      "aliases": [
        "BGN"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BHD": {
      "code": "BHD",
      "name": "Bahraini Dinar",
      "symbol": "BHD",
      "narrowSymbol": "BHD",
      "digits": 3,
      "aliases": [
        "BHD",
        "\u062F.\u0628",
        "BD"
      ],
      "ccTLDs": [
        "bh"
      ],
      "crypto": false
    },
    "BIF": {
      "code": "BIF",
      "name": "Burundian Franc",
      "symbol": "BIF",
      "narrowSymbol": "BIF",
      "digits": 0,
      "aliases": [
        "BIF"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BMD": {
      "code": "BMD",
      "name": "Bermudan Dollar",
      "symbol": "BMD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "BMD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BND": {
      "code": "BND",
      "name": "Brunei Dollar",
      "symbol": "BND",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "BND",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BOB": {
      "code": "BOB",
      "name": "Bolivian Boliviano",
      "symbol": "BOB",
      "narrowSymbol": "Bs",
      "digits": 2,
      "aliases": [
        "BOB",
        "Bs"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BRL": {
      "code": "BRL",
      "name": "Brazilian Real",
      "symbol": "R$",
      "narrowSymbol": "R$",
      "digits": 2,
      "aliases": [
        "BRL",
        "R$"
      ],
      "ccTLDs": [
        "br",
        "com.br"
      ],
      "crypto": false
    },
    "BSD": {
      "code": "BSD",
      "name": "Bahamian Dollar",
      "symbol": "BSD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "BSD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BTN": {
      "code": "BTN",
      "name": "Bhutanese Ngultrum",
      "symbol": "BTN",
      "narrowSymbol": "BTN",
      "digits": 2,
      "aliases": [
        "BTN"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BWP": {
      "code": "BWP",
      "name": "Botswanan Pula",
      "symbol": "BWP",
      "narrowSymbol": "P",
      "digits": 2,
      "aliases": [
        "BWP",
        "P"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BYN": {
      "code": "BYN",
      "name": "Belarusian Ruble",
      "symbol": "BYN",
      "narrowSymbol": "BYN",
      "digits": 2,
      "aliases": [
        "BYN"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BZD": {
      "code": "BZD",
      "name": "Belize Dollar",
      "symbol": "BZD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "BZD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "CAD": {
      "code": "CAD",
      "name": "Canadian Dollar",
      "symbol": "CA$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "CAD",
        "CA$",
        "$",
        "CAD$",
        "C$"
      ],
      "ccTLDs": [
        "ca"
      ],
      "crypto": false
    },
    "CDF": {
      "code": "CDF",
      "name": "Congolese Franc",
      "symbol": "CDF",
      "narrowSymbol": "CDF",
      "digits": 2,
      "aliases": [
        "CDF"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "CHF": {
      "code": "CHF",
      "name": "Swiss Franc",
      "symbol": "CHF",
      "narrowSymbol": "CHF",
      "digits": 2,
      "aliases": [
        "CHF",
        "SFr",
        "Fr."
      ],
      "ccTLDs": [
        "ch"
      ],
      "crypto": false
    },
    "CLP": {
      "code": "CLP",
      "name": "Chilean Peso",
      "symbol": "CLP$",
      "narrowSymbol": "$",
      "digits": 0,
      "aliases": [
        "CLP",
        "CLP$",
        "$"
      ],
      "ccTLDs": [
        "cl"
      ],
      "crypto": false
    },
    "CNY": {
      "code": "CNY",
      "name": "Chinese Yuan",
      "symbol": "CN\xA5",
      "narrowSymbol": "\xA5",
      "digits": 2,
      "aliases": [
        "CNY",
        "CN\xA5",
        "\xA5",
        "RMB",
        "\u5143"
      ],
      "ccTLDs": [
        "cn",
        "com.cn"
      ],
      "crypto": false
    },
    "COP": {
      "code": "COP",
      "name": "Colombian Peso",
      "symbol": "COL$",
      "narrowSymbol": "$",
      "digits": 0,
      "aliases": [
        "COP",
        "COL$",
        "$",
        "COP$"
      ],
      "ccTLDs": [
        "co"
      ],
      "crypto": false
    },
    "CRC": {
      "code": "CRC",
      "name": "Costa Rican Col\xF3n",
      "symbol": "CRC",
      "narrowSymbol": "\u20A1",
      "digits": 2,
      "aliases": [
        "CRC",
        "\u20A1"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "CUC": {
      "code": "CUC",
      "name": "Cuban Convertible Peso",
      "symbol": "CUC",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "CUC",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "CUP": {
      "code": "CUP",
      "name": "Cuban Peso",
      "symbol": "CUP",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "CUP",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "CVE": {
      "code": "CVE",
      "name": "Cape Verdean Escudo",
      "symbol": "CVE",
      "narrowSymbol": "CVE",
      "digits": 2,
      "aliases": [
        "CVE"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "CZK": {
      "code": "CZK",
      "name": "Czech Koruna",
      "symbol": "K\u010D",
      "narrowSymbol": "K\u010D",
      "digits": 2,
      "aliases": [
        "CZK",
        "K\u010D",
        "Kc"
      ],
      "ccTLDs": [
        "cz"
      ],
      "crypto": false
    },
    "DJF": {
      "code": "DJF",
      "name": "Djiboutian Franc",
      "symbol": "DJF",
      "narrowSymbol": "DJF",
      "digits": 0,
      "aliases": [
        "DJF"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "DKK": {
      "code": "DKK",
      "name": "Danish Krone",
      "symbol": "kr.",
      "narrowSymbol": "kr",
      "digits": 2,
      "aliases": [
        "DKK",
        "kr.",
        "kr"
      ],
      "ccTLDs": [
        "dk"
      ],
      "crypto": false
    },
    "DOP": {
      "code": "DOP",
      "name": "Dominican Peso",
      "symbol": "DOP",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "DOP",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "DZD": {
      "code": "DZD",
      "name": "Algerian Dinar",
      "symbol": "DZD",
      "narrowSymbol": "DZD",
      "digits": 2,
      "aliases": [
        "DZD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "EGP": {
      "code": "EGP",
      "name": "Egyptian Pound",
      "symbol": "EGP",
      "narrowSymbol": "E\xA3",
      "digits": 2,
      "aliases": [
        "EGP",
        "E\xA3",
        "\u062C.\u0645"
      ],
      "ccTLDs": [
        "eg"
      ],
      "crypto": false
    },
    "ERN": {
      "code": "ERN",
      "name": "Eritrean Nakfa",
      "symbol": "ERN",
      "narrowSymbol": "ERN",
      "digits": 2,
      "aliases": [
        "ERN"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ETB": {
      "code": "ETB",
      "name": "Ethiopian Birr",
      "symbol": "ETB",
      "narrowSymbol": "ETB",
      "digits": 2,
      "aliases": [
        "ETB"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "EUR": {
      "code": "EUR",
      "name": "Euro",
      "symbol": "\u20AC",
      "narrowSymbol": "\u20AC",
      "digits": 2,
      "aliases": [
        "EUR",
        "\u20AC",
        "Euro"
      ],
      "ccTLDs": [
        "eu",
        "de",
        "fr",
        "es",
        "it",
        "nl",
        "ie",
        "pt",
        "be",
        "at",
        "fi",
        "gr",
        "sk",
        "ee",
        "lv",
        "lt",
        "cy",
        "mt",
        "si",
        "lu",
        "hr"
      ],
      "crypto": false
    },
    "FJD": {
      "code": "FJD",
      "name": "Fijian Dollar",
      "symbol": "FJD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "FJD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "FKP": {
      "code": "FKP",
      "name": "Falkland Islands Pound",
      "symbol": "FKP",
      "narrowSymbol": "\xA3",
      "digits": 2,
      "aliases": [
        "FKP",
        "\xA3"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "GBP": {
      "code": "GBP",
      "name": "British Pound",
      "symbol": "\xA3",
      "narrowSymbol": "\xA3",
      "digits": 2,
      "aliases": [
        "GBP",
        "\xA3",
        "GB\xA3"
      ],
      "ccTLDs": [
        "uk",
        "co.uk"
      ],
      "crypto": false
    },
    "GEL": {
      "code": "GEL",
      "name": "Georgian Lari",
      "symbol": "GEL",
      "narrowSymbol": "\u20BE",
      "digits": 2,
      "aliases": [
        "GEL",
        "\u20BE"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "GHS": {
      "code": "GHS",
      "name": "Ghanaian Cedi",
      "symbol": "GH\u20B5",
      "narrowSymbol": "GH\u20B5",
      "digits": 2,
      "aliases": [
        "GHS",
        "GH\u20B5",
        "GHc"
      ],
      "ccTLDs": [
        "gh"
      ],
      "crypto": false
    },
    "GIP": {
      "code": "GIP",
      "name": "Gibraltar Pound",
      "symbol": "GIP",
      "narrowSymbol": "\xA3",
      "digits": 2,
      "aliases": [
        "GIP",
        "\xA3"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "GMD": {
      "code": "GMD",
      "name": "Gambian Dalasi",
      "symbol": "GMD",
      "narrowSymbol": "GMD",
      "digits": 2,
      "aliases": [
        "GMD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "GNF": {
      "code": "GNF",
      "name": "Guinean Franc",
      "symbol": "GNF",
      "narrowSymbol": "FG",
      "digits": 0,
      "aliases": [
        "GNF",
        "FG"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "GTQ": {
      "code": "GTQ",
      "name": "Guatemalan Quetzal",
      "symbol": "GTQ",
      "narrowSymbol": "Q",
      "digits": 2,
      "aliases": [
        "GTQ",
        "Q"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "GYD": {
      "code": "GYD",
      "name": "Guyanaese Dollar",
      "symbol": "GYD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "GYD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "HKD": {
      "code": "HKD",
      "name": "Hong Kong Dollar",
      "symbol": "HK$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "HKD",
        "HK$",
        "$"
      ],
      "ccTLDs": [
        "hk",
        "com.hk"
      ],
      "crypto": false
    },
    "HNL": {
      "code": "HNL",
      "name": "Honduran Lempira",
      "symbol": "HNL",
      "narrowSymbol": "L",
      "digits": 2,
      "aliases": [
        "HNL",
        "L"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "HRK": {
      "code": "HRK",
      "name": "Croatian Kuna",
      "symbol": "HRK",
      "narrowSymbol": "kn",
      "digits": 2,
      "aliases": [
        "HRK",
        "kn"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "HTG": {
      "code": "HTG",
      "name": "Haitian Gourde",
      "symbol": "HTG",
      "narrowSymbol": "HTG",
      "digits": 2,
      "aliases": [
        "HTG"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "HUF": {
      "code": "HUF",
      "name": "Hungarian Forint",
      "symbol": "Ft",
      "narrowSymbol": "Ft",
      "digits": 0,
      "aliases": [
        "HUF",
        "Ft"
      ],
      "ccTLDs": [
        "hu"
      ],
      "crypto": false
    },
    "IDR": {
      "code": "IDR",
      "name": "Indonesian Rupiah",
      "symbol": "Rp",
      "narrowSymbol": "Rp",
      "digits": 0,
      "aliases": [
        "IDR",
        "Rp"
      ],
      "ccTLDs": [
        "id"
      ],
      "crypto": false
    },
    "ILS": {
      "code": "ILS",
      "name": "Israeli New Shekel",
      "symbol": "\u20AA",
      "narrowSymbol": "\u20AA",
      "digits": 2,
      "aliases": [
        "ILS",
        "\u20AA",
        "NIS"
      ],
      "ccTLDs": [
        "il"
      ],
      "crypto": false
    },
    "INR": {
      "code": "INR",
      "name": "Indian Rupee",
      "symbol": "\u20B9",
      "narrowSymbol": "\u20B9",
      "digits": 2,
      "aliases": [
        "INR",
        "\u20B9",
        "Rs",
        "Rs.",
        "\u20A8"
      ],
      "ccTLDs": [
        "in",
        "co.in"
      ],
      "crypto": false
    },
    "IQD": {
      "code": "IQD",
      "name": "Iraqi Dinar",
      "symbol": "IQD",
      "narrowSymbol": "IQD",
      "digits": 0,
      "aliases": [
        "IQD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "IRR": {
      "code": "IRR",
      "name": "Iranian Rial",
      "symbol": "IRR",
      "narrowSymbol": "IRR",
      "digits": 0,
      "aliases": [
        "IRR"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ISK": {
      "code": "ISK",
      "name": "Icelandic Kr\xF3na",
      "symbol": "kr",
      "narrowSymbol": "kr",
      "digits": 0,
      "aliases": [
        "ISK",
        "kr"
      ],
      "ccTLDs": [
        "is"
      ],
      "crypto": false
    },
    "JMD": {
      "code": "JMD",
      "name": "Jamaican Dollar",
      "symbol": "JMD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "JMD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "JOD": {
      "code": "JOD",
      "name": "Jordanian Dinar",
      "symbol": "JOD",
      "narrowSymbol": "JOD",
      "digits": 3,
      "aliases": [
        "JOD",
        "\u062F.\u0623"
      ],
      "ccTLDs": [
        "jo"
      ],
      "crypto": false
    },
    "JPY": {
      "code": "JPY",
      "name": "Japanese Yen",
      "symbol": "\xA5",
      "narrowSymbol": "\xA5",
      "digits": 0,
      "aliases": [
        "JPY",
        "\xA5",
        "\u5186"
      ],
      "ccTLDs": [
        "jp",
        "co.jp"
      ],
      "crypto": false
    },
    "KES": {
      "code": "KES",
      "name": "Kenyan Shilling",
      "symbol": "KSh",
      "narrowSymbol": "KSh",
      "digits": 2,
      "aliases": [
        "KES",
        "KSh",
        "Ksh"
      ],
      "ccTLDs": [
        "ke"
      ],
      "crypto": false
    },
    "KGS": {
      "code": "KGS",
      "name": "Kyrgyz Som",
      "symbol": "KGS",
      "narrowSymbol": "\u20C0",
      "digits": 2,
      "aliases": [
        "KGS",
        "\u20C0"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "KHR": {
      "code": "KHR",
      "name": "Cambodian Riel",
      "symbol": "KHR",
      "narrowSymbol": "\u17DB",
      "digits": 2,
      "aliases": [
        "KHR",
        "\u17DB"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "KMF": {
      "code": "KMF",
      "name": "Comorian Franc",
      "symbol": "KMF",
      "narrowSymbol": "CF",
      "digits": 0,
      "aliases": [
        "KMF",
        "CF"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "KPW": {
      "code": "KPW",
      "name": "North Korean Won",
      "symbol": "KPW",
      "narrowSymbol": "\u20A9",
      "digits": 0,
      "aliases": [
        "KPW",
        "\u20A9"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "KRW": {
      "code": "KRW",
      "name": "South Korean Won",
      "symbol": "\u20A9",
      "narrowSymbol": "\u20A9",
      "digits": 0,
      "aliases": [
        "KRW",
        "\u20A9",
        "\uC6D0"
      ],
      "ccTLDs": [
        "kr",
        "co.kr"
      ],
      "crypto": false
    },
    "KWD": {
      "code": "KWD",
      "name": "Kuwaiti Dinar",
      "symbol": "KWD",
      "narrowSymbol": "KWD",
      "digits": 3,
      "aliases": [
        "KWD",
        "\u062F.\u0643",
        "KD"
      ],
      "ccTLDs": [
        "kw"
      ],
      "crypto": false
    },
    "KYD": {
      "code": "KYD",
      "name": "Cayman Islands Dollar",
      "symbol": "KYD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "KYD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "KZT": {
      "code": "KZT",
      "name": "Kazakhstani Tenge",
      "symbol": "KZT",
      "narrowSymbol": "\u20B8",
      "digits": 2,
      "aliases": [
        "KZT",
        "\u20B8"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "LAK": {
      "code": "LAK",
      "name": "Laotian Kip",
      "symbol": "LAK",
      "narrowSymbol": "\u20AD",
      "digits": 0,
      "aliases": [
        "LAK",
        "\u20AD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "LBP": {
      "code": "LBP",
      "name": "Lebanese Pound",
      "symbol": "LBP",
      "narrowSymbol": "L\xA3",
      "digits": 0,
      "aliases": [
        "LBP",
        "L\xA3"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "LKR": {
      "code": "LKR",
      "name": "Sri Lankan Rupee",
      "symbol": "LKR",
      "narrowSymbol": "Rs",
      "digits": 2,
      "aliases": [
        "LKR",
        "Rs"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "LRD": {
      "code": "LRD",
      "name": "Liberian Dollar",
      "symbol": "LRD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "LRD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "LSL": {
      "code": "LSL",
      "name": "Lesotho Loti",
      "symbol": "LSL",
      "narrowSymbol": "LSL",
      "digits": 2,
      "aliases": [
        "LSL"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "LYD": {
      "code": "LYD",
      "name": "Libyan Dinar",
      "symbol": "LYD",
      "narrowSymbol": "LYD",
      "digits": 3,
      "aliases": [
        "LYD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MAD": {
      "code": "MAD",
      "name": "Moroccan Dirham",
      "symbol": "MAD",
      "narrowSymbol": "MAD",
      "digits": 2,
      "aliases": [
        "MAD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MDL": {
      "code": "MDL",
      "name": "Moldovan Leu",
      "symbol": "MDL",
      "narrowSymbol": "MDL",
      "digits": 2,
      "aliases": [
        "MDL"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MGA": {
      "code": "MGA",
      "name": "Malagasy Ariary",
      "symbol": "MGA",
      "narrowSymbol": "Ar",
      "digits": 0,
      "aliases": [
        "MGA",
        "Ar"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MKD": {
      "code": "MKD",
      "name": "Macedonian Denar",
      "symbol": "MKD",
      "narrowSymbol": "MKD",
      "digits": 2,
      "aliases": [
        "MKD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MMK": {
      "code": "MMK",
      "name": "Myanmar Kyat",
      "symbol": "MMK",
      "narrowSymbol": "K",
      "digits": 0,
      "aliases": [
        "MMK",
        "K"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MNT": {
      "code": "MNT",
      "name": "Mongolian Tugrik",
      "symbol": "MNT",
      "narrowSymbol": "\u20AE",
      "digits": 2,
      "aliases": [
        "MNT",
        "\u20AE"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MOP": {
      "code": "MOP",
      "name": "Macanese Pataca",
      "symbol": "MOP",
      "narrowSymbol": "MOP",
      "digits": 2,
      "aliases": [
        "MOP"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MRU": {
      "code": "MRU",
      "name": "Mauritanian Ouguiya",
      "symbol": "MRU",
      "narrowSymbol": "MRU",
      "digits": 2,
      "aliases": [
        "MRU"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MUR": {
      "code": "MUR",
      "name": "Mauritian Rupee",
      "symbol": "MUR",
      "narrowSymbol": "Rs",
      "digits": 2,
      "aliases": [
        "MUR",
        "Rs"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MVR": {
      "code": "MVR",
      "name": "Maldivian Rufiyaa",
      "symbol": "MVR",
      "narrowSymbol": "MVR",
      "digits": 2,
      "aliases": [
        "MVR"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MWK": {
      "code": "MWK",
      "name": "Malawian Kwacha",
      "symbol": "MWK",
      "narrowSymbol": "MWK",
      "digits": 2,
      "aliases": [
        "MWK"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "MXN": {
      "code": "MXN",
      "name": "Mexican Peso",
      "symbol": "MX$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "MXN",
        "MX$",
        "$",
        "Mex$"
      ],
      "ccTLDs": [
        "mx",
        "com.mx"
      ],
      "crypto": false
    },
    "MYR": {
      "code": "MYR",
      "name": "Malaysian Ringgit",
      "symbol": "RM",
      "narrowSymbol": "RM",
      "digits": 2,
      "aliases": [
        "MYR",
        "RM"
      ],
      "ccTLDs": [
        "my"
      ],
      "crypto": false
    },
    "MZN": {
      "code": "MZN",
      "name": "Mozambican Metical",
      "symbol": "MZN",
      "narrowSymbol": "MZN",
      "digits": 2,
      "aliases": [
        "MZN"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "NAD": {
      "code": "NAD",
      "name": "Namibian Dollar",
      "symbol": "NAD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "NAD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "NGN": {
      "code": "NGN",
      "name": "Nigerian Naira",
      "symbol": "\u20A6",
      "narrowSymbol": "\u20A6",
      "digits": 2,
      "aliases": [
        "NGN",
        "\u20A6",
        "Naira"
      ],
      "ccTLDs": [
        "ng",
        "com.ng"
      ],
      "crypto": false
    },
    "NIO": {
      "code": "NIO",
      "name": "Nicaraguan C\xF3rdoba",
      "symbol": "NIO",
      "narrowSymbol": "C$",
      "digits": 2,
      "aliases": [
        "NIO",
        "C$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "NOK": {
      "code": "NOK",
      "name": "Norwegian Krone",
      "symbol": "kr",
      "narrowSymbol": "kr",
      "digits": 2,
      "aliases": [
        "NOK",
        "kr"
      ],
      "ccTLDs": [
        "no"
      ],
      "crypto": false
    },
    "NPR": {
      "code": "NPR",
      "name": "Nepalese Rupee",
      "symbol": "NPR",
      "narrowSymbol": "Rs",
      "digits": 2,
      "aliases": [
        "NPR",
        "Rs"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "NZD": {
      "code": "NZD",
      "name": "New Zealand Dollar",
      "symbol": "NZ$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "NZD",
        "NZ$",
        "$"
      ],
      "ccTLDs": [
        "nz",
        "co.nz"
      ],
      "crypto": false
    },
    "OMR": {
      "code": "OMR",
      "name": "Omani Rial",
      "symbol": "OMR",
      "narrowSymbol": "OMR",
      "digits": 3,
      "aliases": [
        "OMR",
        "\u0631.\u0639."
      ],
      "ccTLDs": [
        "om"
      ],
      "crypto": false
    },
    "PAB": {
      "code": "PAB",
      "name": "Panamanian Balboa",
      "symbol": "PAB",
      "narrowSymbol": "PAB",
      "digits": 2,
      "aliases": [
        "PAB"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "PEN": {
      "code": "PEN",
      "name": "Peruvian Sol",
      "symbol": "S/.",
      "narrowSymbol": "S/.",
      "digits": 2,
      "aliases": [
        "PEN",
        "S/.",
        "S/"
      ],
      "ccTLDs": [
        "pe"
      ],
      "crypto": false
    },
    "PGK": {
      "code": "PGK",
      "name": "Papua New Guinean Kina",
      "symbol": "PGK",
      "narrowSymbol": "PGK",
      "digits": 2,
      "aliases": [
        "PGK"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "PHP": {
      "code": "PHP",
      "name": "Philippine Peso",
      "symbol": "\u20B1",
      "narrowSymbol": "\u20B1",
      "digits": 2,
      "aliases": [
        "PHP",
        "\u20B1"
      ],
      "ccTLDs": [
        "ph"
      ],
      "crypto": false
    },
    "PKR": {
      "code": "PKR",
      "name": "Pakistani Rupee",
      "symbol": "PKR",
      "narrowSymbol": "Rs",
      "digits": 2,
      "aliases": [
        "PKR",
        "Rs",
        "PKRs"
      ],
      "ccTLDs": [
        "pk"
      ],
      "crypto": false
    },
    "PLN": {
      "code": "PLN",
      "name": "Polish Zloty",
      "symbol": "z\u0142",
      "narrowSymbol": "z\u0142",
      "digits": 2,
      "aliases": [
        "PLN",
        "z\u0142",
        "zl"
      ],
      "ccTLDs": [
        "pl"
      ],
      "crypto": false
    },
    "PYG": {
      "code": "PYG",
      "name": "Paraguayan Guarani",
      "symbol": "PYG",
      "narrowSymbol": "\u20B2",
      "digits": 0,
      "aliases": [
        "PYG",
        "\u20B2"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "QAR": {
      "code": "QAR",
      "name": "Qatari Riyal",
      "symbol": "QAR",
      "narrowSymbol": "QAR",
      "digits": 2,
      "aliases": [
        "QAR",
        "\u0631.\u0642"
      ],
      "ccTLDs": [
        "qa"
      ],
      "crypto": false
    },
    "RON": {
      "code": "RON",
      "name": "Romanian Leu",
      "symbol": "RON",
      "narrowSymbol": "lei",
      "digits": 2,
      "aliases": [
        "RON",
        "lei"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "RSD": {
      "code": "RSD",
      "name": "Serbian Dinar",
      "symbol": "RSD",
      "narrowSymbol": "RSD",
      "digits": 2,
      "aliases": [
        "RSD"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "RUB": {
      "code": "RUB",
      "name": "Russian Ruble",
      "symbol": "\u20BD",
      "narrowSymbol": "\u20BD",
      "digits": 2,
      "aliases": [
        "RUB",
        "\u20BD",
        "\u0440\u0443\u0431"
      ],
      "ccTLDs": [
        "ru"
      ],
      "crypto": false
    },
    "RWF": {
      "code": "RWF",
      "name": "Rwandan Franc",
      "symbol": "RWF",
      "narrowSymbol": "RF",
      "digits": 0,
      "aliases": [
        "RWF",
        "RF"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SAR": {
      "code": "SAR",
      "name": "Saudi Riyal",
      "symbol": "SAR",
      "narrowSymbol": "SAR",
      "digits": 2,
      "aliases": [
        "SAR",
        "\u0631.\u0633",
        "SR"
      ],
      "ccTLDs": [
        "sa"
      ],
      "crypto": false
    },
    "SBD": {
      "code": "SBD",
      "name": "Solomon Islands Dollar",
      "symbol": "SBD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "SBD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SCR": {
      "code": "SCR",
      "name": "Seychellois Rupee",
      "symbol": "SCR",
      "narrowSymbol": "SCR",
      "digits": 2,
      "aliases": [
        "SCR"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SDG": {
      "code": "SDG",
      "name": "Sudanese Pound",
      "symbol": "SDG",
      "narrowSymbol": "SDG",
      "digits": 2,
      "aliases": [
        "SDG"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SEK": {
      "code": "SEK",
      "name": "Swedish Krona",
      "symbol": "kr",
      "narrowSymbol": "kr",
      "digits": 2,
      "aliases": [
        "SEK",
        "kr",
        ":-"
      ],
      "ccTLDs": [
        "se"
      ],
      "crypto": false
    },
    "SGD": {
      "code": "SGD",
      "name": "Singapore Dollar",
      "symbol": "S$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "SGD",
        "S$",
        "$",
        "SG$"
      ],
      "ccTLDs": [
        "sg",
        "com.sg"
      ],
      "crypto": false
    },
    "SHP": {
      "code": "SHP",
      "name": "St. Helena Pound",
      "symbol": "SHP",
      "narrowSymbol": "\xA3",
      "digits": 2,
      "aliases": [
        "SHP",
        "\xA3"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SLE": {
      "code": "SLE",
      "name": "Sierra Leonean Leone",
      "symbol": "SLE",
      "narrowSymbol": "SLE",
      "digits": 2,
      "aliases": [
        "SLE"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SLL": {
      "code": "SLL",
      "name": "Sierra Leonean Leone (1964\u20142022)",
      "symbol": "SLL",
      "narrowSymbol": "SLL",
      "digits": 0,
      "aliases": [
        "SLL"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SOS": {
      "code": "SOS",
      "name": "Somali Shilling",
      "symbol": "SOS",
      "narrowSymbol": "SOS",
      "digits": 0,
      "aliases": [
        "SOS"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SRD": {
      "code": "SRD",
      "name": "Surinamese Dollar",
      "symbol": "SRD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "SRD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SSP": {
      "code": "SSP",
      "name": "South Sudanese Pound",
      "symbol": "SSP",
      "narrowSymbol": "\xA3",
      "digits": 2,
      "aliases": [
        "SSP",
        "\xA3"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "STN": {
      "code": "STN",
      "name": "S\xE3o Tom\xE9 & Pr\xEDncipe Dobra",
      "symbol": "STN",
      "narrowSymbol": "Db",
      "digits": 2,
      "aliases": [
        "STN",
        "Db"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SVC": {
      "code": "SVC",
      "name": "Salvadoran Col\xF3n",
      "symbol": "SVC",
      "narrowSymbol": "SVC",
      "digits": 2,
      "aliases": [
        "SVC"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SYP": {
      "code": "SYP",
      "name": "Syrian Pound",
      "symbol": "SYP",
      "narrowSymbol": "\xA3",
      "digits": 0,
      "aliases": [
        "SYP",
        "\xA3"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "SZL": {
      "code": "SZL",
      "name": "Swazi Lilangeni",
      "symbol": "SZL",
      "narrowSymbol": "SZL",
      "digits": 2,
      "aliases": [
        "SZL"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "THB": {
      "code": "THB",
      "name": "Thai Baht",
      "symbol": "\u0E3F",
      "narrowSymbol": "\u0E3F",
      "digits": 2,
      "aliases": [
        "THB",
        "\u0E3F"
      ],
      "ccTLDs": [
        "th"
      ],
      "crypto": false
    },
    "TJS": {
      "code": "TJS",
      "name": "Tajikistani Somoni",
      "symbol": "TJS",
      "narrowSymbol": "TJS",
      "digits": 2,
      "aliases": [
        "TJS"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "TMT": {
      "code": "TMT",
      "name": "Turkmenistani Manat",
      "symbol": "TMT",
      "narrowSymbol": "TMT",
      "digits": 2,
      "aliases": [
        "TMT"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "TND": {
      "code": "TND",
      "name": "Tunisian Dinar",
      "symbol": "TND",
      "narrowSymbol": "TND",
      "digits": 3,
      "aliases": [
        "TND"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "TOP": {
      "code": "TOP",
      "name": "Tongan Pa\u02BBanga",
      "symbol": "TOP",
      "narrowSymbol": "T$",
      "digits": 2,
      "aliases": [
        "TOP",
        "T$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "TRY": {
      "code": "TRY",
      "name": "Turkish Lira",
      "symbol": "\u20BA",
      "narrowSymbol": "\u20BA",
      "digits": 2,
      "aliases": [
        "TRY",
        "\u20BA",
        "TL"
      ],
      "ccTLDs": [
        "tr",
        "com.tr"
      ],
      "crypto": false
    },
    "TTD": {
      "code": "TTD",
      "name": "Trinidad & Tobago Dollar",
      "symbol": "TTD",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "TTD",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "TWD": {
      "code": "TWD",
      "name": "New Taiwan Dollar",
      "symbol": "NT$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "TWD",
        "NT$",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "TZS": {
      "code": "TZS",
      "name": "Tanzanian Shilling",
      "symbol": "TZS",
      "narrowSymbol": "TZS",
      "digits": 2,
      "aliases": [
        "TZS"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "UAH": {
      "code": "UAH",
      "name": "Ukrainian Hryvnia",
      "symbol": "\u20B4",
      "narrowSymbol": "\u20B4",
      "digits": 2,
      "aliases": [
        "UAH",
        "\u20B4",
        "\u0433\u0440\u043D"
      ],
      "ccTLDs": [
        "ua"
      ],
      "crypto": false
    },
    "UGX": {
      "code": "UGX",
      "name": "Ugandan Shilling",
      "symbol": "UGX",
      "narrowSymbol": "UGX",
      "digits": 0,
      "aliases": [
        "UGX"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "USD": {
      "code": "USD",
      "name": "US Dollar",
      "symbol": "$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "USD",
        "$",
        "US$",
        "U.S. Dollar",
        "US Dollar"
      ],
      "ccTLDs": [
        "us",
        "gov",
        "mil",
        "com"
      ],
      "crypto": false
    },
    "UYU": {
      "code": "UYU",
      "name": "Uruguayan Peso",
      "symbol": "UYU",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "UYU",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "UZS": {
      "code": "UZS",
      "name": "Uzbekistani Som",
      "symbol": "UZS",
      "narrowSymbol": "UZS",
      "digits": 2,
      "aliases": [
        "UZS"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "VES": {
      "code": "VES",
      "name": "Venezuelan Bol\xEDvar",
      "symbol": "VES",
      "narrowSymbol": "VES",
      "digits": 2,
      "aliases": [
        "VES"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "VND": {
      "code": "VND",
      "name": "Vietnamese Dong",
      "symbol": "\u20AB",
      "narrowSymbol": "\u20AB",
      "digits": 0,
      "aliases": [
        "VND",
        "\u20AB",
        "d"
      ],
      "ccTLDs": [
        "vn"
      ],
      "crypto": false
    },
    "VUV": {
      "code": "VUV",
      "name": "Vanuatu Vatu",
      "symbol": "VUV",
      "narrowSymbol": "VUV",
      "digits": 0,
      "aliases": [
        "VUV"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "WST": {
      "code": "WST",
      "name": "Samoan Tala",
      "symbol": "WST",
      "narrowSymbol": "WST",
      "digits": 2,
      "aliases": [
        "WST"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XAF": {
      "code": "XAF",
      "name": "Central African CFA Franc",
      "symbol": "FCFA",
      "narrowSymbol": "FCFA",
      "digits": 0,
      "aliases": [
        "XAF",
        "FCFA"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XCD": {
      "code": "XCD",
      "name": "East Caribbean Dollar",
      "symbol": "EC$",
      "narrowSymbol": "$",
      "digits": 2,
      "aliases": [
        "XCD",
        "EC$",
        "$"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XCG": {
      "code": "XCG",
      "name": "Caribbean guilder",
      "symbol": "Cg.",
      "narrowSymbol": "Cg.",
      "digits": 2,
      "aliases": [
        "XCG",
        "Cg."
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XDR": {
      "code": "XDR",
      "name": "Special Drawing Rights",
      "symbol": "XDR",
      "narrowSymbol": "XDR",
      "digits": 2,
      "aliases": [
        "XDR"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XOF": {
      "code": "XOF",
      "name": "West African CFA Franc",
      "symbol": "F\u202FCFA",
      "narrowSymbol": "F\u202FCFA",
      "digits": 0,
      "aliases": [
        "XOF",
        "F\u202FCFA"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XPF": {
      "code": "XPF",
      "name": "CFP Franc",
      "symbol": "CFPF",
      "narrowSymbol": "CFPF",
      "digits": 0,
      "aliases": [
        "XPF",
        "CFPF"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "XSU": {
      "code": "XSU",
      "name": "Sucre",
      "symbol": "XSU",
      "narrowSymbol": "XSU",
      "digits": 2,
      "aliases": [
        "XSU"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "YER": {
      "code": "YER",
      "name": "Yemeni Rial",
      "symbol": "YER",
      "narrowSymbol": "YER",
      "digits": 0,
      "aliases": [
        "YER"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ZAR": {
      "code": "ZAR",
      "name": "South African Rand",
      "symbol": "R",
      "narrowSymbol": "R",
      "digits": 2,
      "aliases": [
        "ZAR",
        "R",
        "Rand"
      ],
      "ccTLDs": [
        "za",
        "co.za"
      ],
      "crypto": false
    },
    "ZMW": {
      "code": "ZMW",
      "name": "Zambian Kwacha",
      "symbol": "ZMW",
      "narrowSymbol": "ZK",
      "digits": 2,
      "aliases": [
        "ZMW",
        "ZK"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ZWG": {
      "code": "ZWG",
      "name": "Zimbabwean Gold",
      "symbol": "ZWG",
      "narrowSymbol": "ZWG",
      "digits": 2,
      "aliases": [
        "ZWG"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "ZWL": {
      "code": "ZWL",
      "name": "Zimbabwean Dollar (2009\u20132024)",
      "symbol": "ZWL",
      "narrowSymbol": "ZWL",
      "digits": 2,
      "aliases": [
        "ZWL"
      ],
      "ccTLDs": [],
      "crypto": false
    },
    "BTC": {
      "code": "BTC",
      "name": "Bitcoin",
      "symbol": "\u20BF",
      "narrowSymbol": "\u20BF",
      "digits": 8,
      "aliases": [
        "BTC",
        "\u20BF"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "ETH": {
      "code": "ETH",
      "name": "Ethereum",
      "symbol": "\u039E",
      "narrowSymbol": "\u039E",
      "digits": 6,
      "aliases": [
        "ETH",
        "\u039E"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "USDT": {
      "code": "USDT",
      "name": "Tether USD",
      "symbol": "USDT",
      "narrowSymbol": "USDT",
      "digits": 2,
      "aliases": [
        "USDT"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "USDC": {
      "code": "USDC",
      "name": "USD Coin",
      "symbol": "USDC",
      "narrowSymbol": "USDC",
      "digits": 2,
      "aliases": [
        "USDC"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "BNB": {
      "code": "BNB",
      "name": "BNB",
      "symbol": "BNB",
      "narrowSymbol": "BNB",
      "digits": 4,
      "aliases": [
        "BNB"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "SOL": {
      "code": "SOL",
      "name": "Solana",
      "symbol": "SOL",
      "narrowSymbol": "SOL",
      "digits": 4,
      "aliases": [
        "SOL"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "XRP": {
      "code": "XRP",
      "name": "XRP",
      "symbol": "XRP",
      "narrowSymbol": "XRP",
      "digits": 4,
      "aliases": [
        "XRP"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "DOGE": {
      "code": "DOGE",
      "name": "Dogecoin",
      "symbol": "\xD0",
      "narrowSymbol": "\xD0",
      "digits": 2,
      "aliases": [
        "DOGE",
        "\xD0"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "ADA": {
      "code": "ADA",
      "name": "Cardano",
      "symbol": "ADA",
      "narrowSymbol": "ADA",
      "digits": 4,
      "aliases": [
        "ADA"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "AVAX": {
      "code": "AVAX",
      "name": "Avalanche",
      "symbol": "AVAX",
      "narrowSymbol": "AVAX",
      "digits": 4,
      "aliases": [
        "AVAX"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "DOT": {
      "code": "DOT",
      "name": "Polkadot",
      "symbol": "DOT",
      "narrowSymbol": "DOT",
      "digits": 4,
      "aliases": [
        "DOT"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "MATIC": {
      "code": "MATIC",
      "name": "Polygon",
      "symbol": "MATIC",
      "narrowSymbol": "MATIC",
      "digits": 4,
      "aliases": [
        "MATIC"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "LTC": {
      "code": "LTC",
      "name": "Litecoin",
      "symbol": "\u0141",
      "narrowSymbol": "\u0141",
      "digits": 4,
      "aliases": [
        "LTC",
        "\u0141"
      ],
      "ccTLDs": [],
      "crypto": true
    },
    "LINK": {
      "code": "LINK",
      "name": "Chainlink",
      "symbol": "LINK",
      "narrowSymbol": "LINK",
      "digits": 4,
      "aliases": [
        "LINK"
      ],
      "ccTLDs": [],
      "crypto": true
    }
  };
  var CCTLD_TO_CURRENCY = {
    "ae": "AED",
    "ar": "ARS",
    "au": "AUD",
    "com.au": "AUD",
    "bd": "BDT",
    "bh": "BHD",
    "br": "BRL",
    "com.br": "BRL",
    "ca": "CAD",
    "ch": "CHF",
    "cl": "CLP",
    "cn": "CNY",
    "com.cn": "CNY",
    "co": "COP",
    "cz": "CZK",
    "dk": "DKK",
    "eg": "EGP",
    "eu": "EUR",
    "de": "EUR",
    "fr": "EUR",
    "es": "EUR",
    "it": "EUR",
    "nl": "EUR",
    "ie": "EUR",
    "pt": "EUR",
    "be": "EUR",
    "at": "EUR",
    "fi": "EUR",
    "gr": "EUR",
    "sk": "EUR",
    "ee": "EUR",
    "lv": "EUR",
    "lt": "EUR",
    "cy": "EUR",
    "mt": "EUR",
    "si": "EUR",
    "lu": "EUR",
    "hr": "EUR",
    "uk": "GBP",
    "co.uk": "GBP",
    "gh": "GHS",
    "hk": "HKD",
    "com.hk": "HKD",
    "hu": "HUF",
    "id": "IDR",
    "il": "ILS",
    "in": "INR",
    "co.in": "INR",
    "is": "ISK",
    "jo": "JOD",
    "jp": "JPY",
    "co.jp": "JPY",
    "ke": "KES",
    "kr": "KRW",
    "co.kr": "KRW",
    "kw": "KWD",
    "mx": "MXN",
    "com.mx": "MXN",
    "my": "MYR",
    "ng": "NGN",
    "com.ng": "NGN",
    "no": "NOK",
    "nz": "NZD",
    "co.nz": "NZD",
    "om": "OMR",
    "pe": "PEN",
    "ph": "PHP",
    "pk": "PKR",
    "pl": "PLN",
    "qa": "QAR",
    "ru": "RUB",
    "sa": "SAR",
    "se": "SEK",
    "sg": "SGD",
    "com.sg": "SGD",
    "th": "THB",
    "tr": "TRY",
    "com.tr": "TRY",
    "ua": "UAH",
    "us": "USD",
    "gov": "USD",
    "mil": "USD",
    "com": "USD",
    "vn": "VND",
    "za": "ZAR",
    "co.za": "ZAR"
  };
  var AMBIGUOUS_SYMBOLS = {
    "$": {
      "default": "USD",
      "candidates": [
        "USD",
        "CAD",
        "AUD",
        "NZD",
        "SGD",
        "HKD",
        "MXN",
        "CLP",
        "COP",
        "ARS"
      ]
    },
    "\xA5": {
      "default": "JPY",
      "candidates": [
        "JPY",
        "CNY"
      ]
    },
    "kr": {
      "default": "SEK",
      "candidates": [
        "SEK",
        "NOK",
        "DKK",
        "ISK"
      ]
    },
    "\xA3": {
      "default": "GBP",
      "candidates": [
        "GBP",
        "EGP"
      ]
    },
    "Rs": {
      "default": "INR",
      "candidates": [
        "INR",
        "PKR",
        "NPR",
        "LKR",
        "MUR"
      ]
    },
    "\u20A8": {
      "default": "INR",
      "candidates": [
        "INR",
        "PKR",
        "NPR",
        "LKR"
      ]
    },
    "R": {
      "default": "ZAR",
      "candidates": [
        "ZAR",
        "BRL"
      ]
    },
    "\u062F.\u0643": {
      "default": "KWD",
      "candidates": [
        "KWD"
      ]
    }
  };

  // src/shared/currencies.js
  var REGION_TO_CURRENCY = {
    US: "USD",
    CA: "CAD",
    GB: "GBP",
    UK: "GBP",
    AU: "AUD",
    NZ: "NZD",
    JP: "JPY",
    CN: "CNY",
    IN: "INR",
    NG: "NGN",
    BR: "BRL",
    ZA: "ZAR",
    MX: "MXN",
    SG: "SGD",
    HK: "HKD",
    KR: "KRW",
    CH: "CHF",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    IS: "ISK",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    TR: "TRY",
    RU: "RUB",
    UA: "UAH",
    IL: "ILS",
    AE: "AED",
    SA: "SAR",
    EG: "EGP",
    KE: "KES",
    GH: "GHS",
    TH: "THB",
    VN: "VND",
    PH: "PHP",
    MY: "MYR",
    ID: "IDR",
    PK: "PKR",
    BD: "BDT",
    // Eurozone countries
    DE: "EUR",
    FR: "EUR",
    ES: "EUR",
    IT: "EUR",
    NL: "EUR",
    IE: "EUR",
    PT: "EUR",
    BE: "EUR",
    AT: "EUR",
    FI: "EUR",
    GR: "EUR"
  };
  function getCurrencyMeta(code) {
    if (!code) return null;
    const upper = code.toUpperCase();
    return CURRENCIES_DATA[upper] || null;
  }
  function getCurrencyByTld(hostnameOrTld) {
    if (!hostnameOrTld) return null;
    const lower = hostnameOrTld.toLowerCase();
    if (CCTLD_TO_CURRENCY[lower]) {
      return CCTLD_TO_CURRENCY[lower];
    }
    const parts = lower.split(".");
    if (parts.length >= 2) {
      const lastTwo = parts.slice(-2).join(".");
      if (CCTLD_TO_CURRENCY[lastTwo]) {
        return CCTLD_TO_CURRENCY[lastTwo];
      }
      const lastOne = parts[parts.length - 1];
      if (CCTLD_TO_CURRENCY[lastOne]) {
        return CCTLD_TO_CURRENCY[lastOne];
      }
    }
    return null;
  }
  function getCurrencyByLang(langString) {
    if (!langString) return null;
    const normalized = langString.trim().replace("_", "-");
    const match = normalized.match(/^[a-zA-Z]{2,3}(?:-([a-zA-Z]{2}))?/);
    if (!match) return null;
    const region = match[1] ? match[1].toUpperCase() : null;
    if (region && REGION_TO_CURRENCY[region]) {
      return REGION_TO_CURRENCY[region];
    }
    const primaryLang = normalized.split("-")[0].toLowerCase();
    const langFallback = {
      ja: "JPY",
      ko: "KRW",
      th: "THB",
      vi: "VND",
      pl: "PLN",
      cs: "CZK",
      hu: "HUF",
      tr: "TRY",
      uk: "UAH",
      he: "ILS",
      el: "EUR",
      da: "DKK",
      sv: "SEK",
      nb: "NOK",
      nn: "NOK"
    };
    return langFallback[primaryLang] || null;
  }
  function resolveAmbiguousSymbol(symbol, context = {}) {
    const config = AMBIGUOUS_SYMBOLS[symbol];
    if (!config) {
      return "USD";
    }
    const {
      siteOverride,
      structuredHint,
      tld,
      htmlLang,
      ambiguousDollarSetting
    } = context;
    if (siteOverride && config.candidates.includes(siteOverride.toUpperCase())) {
      return siteOverride.toUpperCase();
    }
    if (structuredHint && config.candidates.includes(structuredHint.toUpperCase())) {
      return structuredHint.toUpperCase();
    }
    if (tld) {
      const tldCurrency = getCurrencyByTld(tld);
      if (tldCurrency && config.candidates.includes(tldCurrency)) {
        return tldCurrency;
      }
    }
    if (htmlLang) {
      const langCurrency = getCurrencyByLang(htmlLang);
      if (langCurrency && config.candidates.includes(langCurrency)) {
        return langCurrency;
      }
    }
    if (symbol === "$" && ambiguousDollarSetting && config.candidates.includes(ambiguousDollarSetting.toUpperCase())) {
      return ambiguousDollarSetting.toUpperCase();
    }
    return config.default;
  }

  // src/shared/format.js
  function formatCurrency(amount, currencyCode, options = {}) {
    const code = (currencyCode || "USD").toUpperCase();
    const meta = getCurrencyMeta(code);
    const roundWhole = Boolean(options.roundWhole);
    const locale = options.locale || "en-US";
    const digits = roundWhole ? 0 : meta ? meta.digits : 2;
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
      return formatter.format(amount);
    } catch {
    }
    let numFormatted;
    try {
      numFormatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(amount);
    } catch {
      numFormatted = digits === 0 ? Math.round(amount).toString() : amount.toFixed(digits);
    }
    const symbol = meta ? meta.narrowSymbol || meta.symbol || code : code;
    if (/^[^a-zA-Z0-9]$/.test(symbol)) {
      return `${symbol}${numFormatted}`;
    }
    return `${numFormatted} ${code}`;
  }

  // src/shared/parser.js
  var EXPLICIT_SYMBOL_MAP = {
    "CAD$": "CAD",
    "CA$": "CAD",
    "C$": "CAD",
    "AUD$": "AUD",
    "AU$": "AUD",
    "A$": "AUD",
    "NZ$": "NZD",
    "HK$": "HKD",
    "SG$": "SGD",
    "S$": "SGD",
    "US$": "USD",
    "U.S.$": "USD",
    "R$": "BRL",
    "MX$": "MXN",
    "Mex$": "MXN",
    "COL$": "COP",
    "CLP$": "CLP",
    "AR$": "ARS",
    "GH\u20B5": "GHS",
    "GHc": "GHS",
    "KSh": "KES",
    "Ksh": "KES",
    "CHF": "CHF",
    "SFr": "CHF",
    "Fr.": "CHF",
    "\u20AC": "EUR",
    "\u20A6": "NGN",
    "\u20B9": "INR",
    "\u20A9": "KRW",
    "z\u0142": "PLN",
    "zl": "PLN",
    "K\u010D": "CZK",
    "Kc": "CZK",
    "Ft": "HUF",
    "\u20BA": "TRY",
    "\u20BD": "RUB",
    "\u20B4": "UAH",
    "\u20AA": "ILS",
    "\u0E3F": "THB",
    "\u20AB": "VND",
    "\u20B1": "PHP",
    "RM": "MYR",
    "Rp": "IDR",
    "\u09F3": "BDT",
    "\u062F.\u0625": "AED",
    "\u0631.\u0633": "SAR",
    "\u0631.\u0642": "QAR",
    "\u062F.\u0628": "BHD",
    "\u0631.\u0639.": "OMR",
    "\u062F.\u0623": "JOD"
  };
  var AMBIGUOUS_SYMBOL_KEYS = ["$", "\xA5", "kr", "\xA3", "Rs", "Rs.", "\u20A8", "R", "\u062F.\u0643"];
  var ISO_CODES = Object.keys(CURRENCIES_DATA);
  function parseNumberString(rawNum, multiplier = 1) {
    if (!rawNum) return null;
    let s = String(rawNum).trim();
    s = s.replace(/^\((.+)\)$/, "$1");
    s = s.replace(/'/g, "");
    s = s.replace(/[\s\u00A0\u202F]+/g, "");
    if (s.includes(",") && s.includes(".")) {
      if (s.indexOf(",") < s.indexOf(".")) {
        s = s.replace(/,/g, "");
      } else {
        s = s.replace(/\./g, "").replace(",", ".");
      }
    } else if (s.includes(",")) {
      const commaCount = (s.match(/,/g) || []).length;
      if (commaCount === 1 && /,\d{1,2}$/.test(s)) {
        s = s.replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (s.includes(".")) {
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1) {
        s = s.replace(/\./g, "");
      }
    }
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    const result = n * (multiplier || 1);
    return result;
  }
  function detectCurrency(text, context = {}) {
    if (!text) return "USD";
    const explicitKeys = Object.keys(EXPLICIT_SYMBOL_MAP).sort((a, b) => b.length - a.length);
    for (const sym of explicitKeys) {
      if (text.includes(sym)) {
        return EXPLICIT_SYMBOL_MAP[sym];
      }
    }
    const upper = text.toUpperCase();
    for (const code of ISO_CODES) {
      if (new RegExp(`\\b${code}\\b`).test(upper)) {
        return code;
      }
    }
    for (const sym of AMBIGUOUS_SYMBOL_KEYS) {
      if (text.includes(sym)) {
        return resolveAmbiguousSymbol(sym, context);
      }
    }
    if (context.siteOverride) return context.siteOverride.toUpperCase();
    if (context.structuredHint) return context.structuredHint.toUpperCase();
    if (context.tld) {
      const tldCur = resolveAmbiguousSymbol("$", context);
      if (tldCur) return tldCur;
    }
    return "USD";
  }
  function extractAmount(text) {
    if (!text) return null;
    if (/^\s*0(?:\.0+|,0+)?\s*$/.test(text)) return null;
    let s = text.replace(/[£€₦₹₩¥₣$]/g, " ").replace(/\b[A-Z]{3}\b/g, " ").trim();
    const match = s.match(/\d[\d,. \u00A0\u202F']*/);
    if (!match) return null;
    const raw = match[0].trim();
    const n = parseNumberString(raw, 1);
    return n === null || isNaN(n) || n <= 0 ? null : n;
  }

  // src/shared/messaging.js
  var MSG = {
    // Page scanning & conversion
    CONVERT_PAGE: "CC_CONVERT_PAGE",
    REVERT_PAGE: "CC_REVERT_PAGE",
    GET_PAGE_STATUS: "CC_GET_PAGE_STATUS",
    PAGE_STATUS: "CC_PAGE_STATUS",
    PAGE_MUTATION_CONVERT: "CC_PAGE_MUTATION_CONVERT",
    // Rates
    GET_RATES: "CC_GET_RATES",
    RATES_DATA: "CC_RATES_DATA",
    // Settings
    GET_SETTINGS: "CC_GET_SETTINGS",
    SETTINGS_DATA: "CC_SETTINGS_DATA",
    UPDATE_SETTINGS: "CC_UPDATE_SETTINGS",
    SET_SITE_RULE: "CC_SET_SITE_RULE",
    // UI Bar & Tooltip events
    BAR_DISMISSED: "CC_BAR_DISMISSED",
    CHANGE_TARGET_CURRENCY: "CC_CHANGE_TARGET_CURRENCY",
    // Selection conversion (v1 feature)
    CONVERT_SELECTION: "CC_CONVERT_SELECTION",
    // Permissions & Auto-convert orchestration
    REQUEST_ORIGIN_PERMISSION: "CC_REQUEST_ORIGIN_PERMISSION",
    CHECK_ORIGIN_PERMISSION: "CC_CHECK_ORIGIN_PERMISSION"
  };

  // src/shared/browser.js
  function getBrowser() {
    if (typeof browser !== "undefined" && browser.runtime) {
      return browser;
    }
    if (typeof chrome !== "undefined" && chrome.runtime) {
      return chrome;
    }
    return null;
  }
  var api = getBrowser();
  async function sendTabMessage(tabId, msg) {
    const b = getBrowser();
    if (!b || !b.tabs || !b.tabs.sendMessage) {
      throw new Error("Browser tabs messaging is not available");
    }
    return new Promise((resolve, reject) => {
      b.tabs.sendMessage(tabId, msg, (response) => {
        if (b.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  // src/background.js
  var api2 = getBrowser();
  var ratesEngine = new RatesEngine();
  var settingsManager = new SettingsManager();
  var tabStatusMap = /* @__PURE__ */ new Map();
  function notify(title, message) {
    if (!api2 || !api2.notifications) return;
    const notifId = `cc-notif-${Date.now()}`;
    try {
      api2.notifications.create(notifId, {
        type: "basic",
        iconUrl: api2.runtime.getURL("icons/icon48.png"),
        title,
        message
      }, () => {
        if (api2.runtime.lastError) {
        }
      });
    } catch (err) {
      console.warn("[CurrencyConverter] Notification failed:", err);
    }
  }
  async function buildMenus() {
    if (!api2 || !api2.contextMenus) return;
    api2.contextMenus.removeAll(async () => {
      try {
        const settings = await settingsManager.getSettings();
        const pinned = settings.pinnedCurrencies || DEFAULT_SETTINGS.pinnedCurrencies;
        const lastTarget = settings.lastUsedTarget || settings.targetCurrency || "USD";
        api2.contextMenus.create({
          id: "cc-parent",
          title: "Convert currency",
          contexts: ["selection"]
        }, () => {
          if (api2.runtime.lastError) {
          }
        });
        for (const cur of pinned) {
          api2.contextMenus.create({
            id: `cc-sel-${cur}`,
            parentId: "cc-parent",
            title: `To ${cur}`,
            contexts: ["selection"]
          }, () => {
            if (api2.runtime.lastError) {
            }
          });
        }
        api2.contextMenus.create({
          id: "cc-page-convert",
          title: `Convert prices on this page to ${lastTarget}`,
          contexts: ["page"]
        }, () => {
          if (api2.runtime.lastError) {
          }
        });
        api2.contextMenus.create({
          id: "cc-page-revert",
          title: "Show original prices",
          contexts: ["page"]
        }, () => {
          if (api2.runtime.lastError) {
          }
        });
      } catch (err) {
        console.warn("[CurrencyConverter] Failed to build context menus:", err);
      }
    });
  }
  async function ensureContentScriptInjected(tabId) {
    if (!api2.scripting || !api2.scripting.executeScript) return false;
    const status = await sendTabMessage(tabId, { type: MSG.GET_PAGE_STATUS });
    if (status !== null && status !== void 0) {
      return true;
    }
    try {
      await api2.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["content.js"]
      });
      return true;
    } catch (err) {
      console.warn("[CurrencyConverter] executeScript failed on tab", tabId, err.message);
      return false;
    }
  }
  async function convertPageOnTab(tabId, targetCurrency = null) {
    const injected = await ensureContentScriptInjected(tabId);
    if (!injected) return;
    const settings = await settingsManager.getSettings();
    const target = targetCurrency || settings.lastUsedTarget || settings.targetCurrency || "USD";
    const ratesData = await ratesEngine.getRates();
    await settingsManager.updateSettings({ lastUsedTarget: target });
    buildMenus();
    const response = await sendTabMessage(tabId, {
      type: MSG.CONVERT_PAGE,
      payload: {
        targetCurrency: target,
        ratesTable: ratesData.rates,
        rateDate: ratesData.date,
        provider: ratesData.provider,
        displayMode: settings.displayMode,
        roundWhole: settings.roundWhole,
        showInPageBar: settings.showInPageBar
      }
    });
    if (response && response.success) {
      tabStatusMap.set(tabId, {
        isConverted: true,
        count: response.count,
        targetCurrency: target
      });
    }
  }
  async function revertPageOnTab(tabId) {
    const response = await sendTabMessage(tabId, { type: MSG.REVERT_PAGE });
    if (response && response.success) {
      tabStatusMap.set(tabId, {
        isConverted: false,
        count: 0,
        targetCurrency: null
      });
    }
  }
  async function togglePageConversionOnTab(tabId) {
    const currentStatus = tabStatusMap.get(tabId);
    if (currentStatus && currentStatus.isConverted) {
      await revertPageOnTab(tabId);
    } else {
      await convertPageOnTab(tabId);
    }
  }
  async function handleSelectionConversion(text, targetCurrency) {
    const raw = (text || "").trim();
    if (!raw) {
      notify("Currency Converter", "No text selected. Highlight a price and try again.");
      return;
    }
    const amount = extractAmount(raw);
    if (amount === null) {
      notify("Currency Converter", `No valid numeric price found in "${raw.slice(0, 50)}".`);
      return;
    }
    const fromCurrency = detectCurrency(raw);
    try {
      const ratesData = await ratesEngine.getRates();
      const rate = calculateRate(fromCurrency, targetCurrency, ratesData.rates);
      const converted = amount * rate;
      const formattedFrom = formatCurrency(amount, fromCurrency);
      const formattedTo = formatCurrency(converted, targetCurrency);
      const formattedUnit = formatCurrency(rate, targetCurrency);
      notify(
        "Currency Converter",
        `${formattedFrom} = ${formattedTo}
Rate: 1 ${fromCurrency} = ${formattedUnit}`
      );
    } catch (err) {
      console.error("[CurrencyConverter] Selection conversion failed:", err);
      notify(
        "Currency Converter",
        `Unable to convert ${fromCurrency} to ${targetCurrency}. Verify network connection.`
      );
    }
  }
  if (api2 && api2.contextMenus && api2.contextMenus.onClicked) {
    api2.contextMenus.onClicked.addListener(async (info, tab) => {
      const menuId = info.menuItemId;
      if (menuId.startsWith("cc-sel-")) {
        const targetCurrency = menuId.replace("cc-sel-", "");
        await handleSelectionConversion(info.selectionText, targetCurrency);
        return;
      }
      if (menuId === "cc-page-convert" && tab && tab.id) {
        await convertPageOnTab(tab.id);
        return;
      }
      if (menuId === "cc-page-revert" && tab && tab.id) {
        await revertPageOnTab(tab.id);
        return;
      }
    });
  }
  if (api2 && api2.commands && api2.commands.onCommand) {
    api2.commands.onCommand.addListener(async (command) => {
      if (command === "toggle-page-conversion") {
        if (api2.tabs && api2.tabs.query) {
          api2.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
              await togglePageConversionOnTab(tabs[0].id);
            }
          });
        }
      }
    });
  }
  if (api2 && api2.runtime && api2.runtime.onMessage) {
    api2.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;
      if (message.type === MSG.GET_RATES) {
        ratesEngine.getRates().then((ratesData) => sendResponse(ratesData)).catch((err) => sendResponse({ error: err.message }));
        return true;
      }
      if (message.type === MSG.GET_SETTINGS) {
        settingsManager.getSettings().then((settings) => sendResponse(settings)).catch((err) => sendResponse({ error: err.message }));
        return true;
      }
      if (message.type === MSG.UPDATE_SETTINGS) {
        settingsManager.updateSettings(message.payload || {}).then((updated) => {
          buildMenus();
          sendResponse({ success: true, settings: updated });
        }).catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }
      if (message.type === MSG.PAGE_STATUS) {
        if (sender && sender.tab && sender.tab.id) {
          tabStatusMap.set(sender.tab.id, message.payload);
        }
        sendResponse({ received: true });
        return false;
      }
    });
  }
  async function syncAutoConvertRules() {
    try {
      const settings = await settingsManager.getSettings();
      const approvedSites = [];
      for (const [hostname, rule] of Object.entries(settings.perSite || {})) {
        if (rule.autoConvert) {
          approvedSites.push(hostname);
        }
      }
      if (api2.scripting && api2.scripting.registerContentScripts) {
        try {
          const existing = await api2.scripting.getRegisteredContentScripts();
          const existingIds = existing.map((s) => s.id);
          if (existingIds.includes("cc-autoconvert-sites")) {
            await api2.scripting.unregisterContentScripts({ ids: ["cc-autoconvert-sites"] });
          }
          if (approvedSites.length > 0) {
            const matches = approvedSites.map((h) => `*://*.${h}/*`).concat(approvedSites.map((h) => `*://${h}/*`));
            await api2.scripting.registerContentScripts([{
              id: "cc-autoconvert-sites",
              matches,
              js: ["content.js"],
              runAt: "document_idle",
              allFrames: true
            }]);
          }
        } catch (scriptingErr) {
        }
      }
    } catch {
    }
  }
  if (api2 && api2.tabs && api2.tabs.onUpdated) {
    api2.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab && tab.url && tab.url.startsWith("http")) {
        try {
          const url = new URL(tab.url);
          const hostname = url.hostname;
          const settings = await settingsManager.getSettings();
          const rule = settings.perSite && settings.perSite[hostname];
          const shouldAutoConvert = rule && rule.autoConvert || settings.autoConvertAll && (!rule || !rule.neverConvert);
          if (shouldAutoConvert) {
            await convertPageOnTab(tabId);
          }
        } catch {
        }
      }
    });
  }
  if (api2 && api2.tabs && api2.tabs.onRemoved) {
    api2.tabs.onRemoved.addListener((tabId) => {
      tabStatusMap.delete(tabId);
    });
  }
  if (api2 && api2.runtime && api2.runtime.onInstalled) {
    api2.runtime.onInstalled.addListener(() => {
      buildMenus();
      syncAutoConvertRules();
    });
  }
  if (api2 && api2.runtime && api2.runtime.onStartup) {
    api2.runtime.onStartup.addListener(() => {
      buildMenus();
      syncAutoConvertRules();
    });
  }
})();
