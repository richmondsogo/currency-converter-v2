import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RatesEngine,
  calculateRate,
  convertAmount
} from '../src/shared/rates.js';

// In-memory mock storage
class MockStorage {
  constructor(initialData = {}) {
    this.data = { ...initialData };
  }
  async get(keys) {
    if (typeof keys === 'string') {
      return { [keys]: this.data[keys] };
    }
    const res = {};
    for (const k of keys) {
      if (this.data[k] !== undefined) res[k] = this.data[k];
    }
    return res;
  }
  async set(obj) {
    Object.assign(this.data, obj);
  }
}

test('rates: cross-rate math and calculations', () => {
  const ratesTable = {
    EUR: 1.0,
    USD: 1.10,   // 1 EUR = 1.10 USD
    NGN: 1650.0, // 1 EUR = 1650 NGN
    JPY: 160.0
  };

  // Identity
  assert.equal(calculateRate('USD', 'USD', ratesTable), 1.0);
  assert.equal(convertAmount(100, 'USD', 'USD', ratesTable), 100);

  // EUR to USD: r[USD] / r[EUR] = 1.10
  assert.equal(calculateRate('EUR', 'USD', ratesTable), 1.10);
  assert.ok(Math.abs(convertAmount(100, 'EUR', 'USD', ratesTable) - 110) < 1e-9);

  // USD to EUR: r[EUR] / r[USD] = 1 / 1.10
  assert.equal(calculateRate('USD', 'EUR', ratesTable), 1 / 1.10);

  // USD to NGN: r[NGN] / r[USD] = 1650 / 1.10 = 1500
  assert.ok(Math.abs(calculateRate('USD', 'NGN', ratesTable) - 1500) < 1e-9);
  assert.ok(Math.abs(convertAmount(100, 'USD', 'NGN', ratesTable) - 150000) < 1e-9);

  // Missing currency throws descriptive error
  assert.throws(() => calculateRate('USD', 'UNKNOWN', ratesTable), /Rate not available/);
  assert.throws(() => calculateRate('UNKNOWN', 'USD', ratesTable), /Rate not available/);
});

test('rates: merge precedence prefers ECB over Fawaz', async () => {
  const frankfurterData = {
    amount: 1,
    base: 'EUR',
    date: '2026-10-16',
    rates: {
      USD: 1.1250, // ECB rate
      GBP: 0.8500
    }
  };

  const fawazData = {
    date: '2026-10-16',
    eur: {
      usd: 1.1200, // Slightly different fallback rate
      gbp: 0.8490,
      ngn: 1495.0, // Regional currency only in Fawaz
      btc: 0.000015
    }
  };

  const mockFetch = async (url) => {
    if (url.includes('frankfurter')) {
      return { ok: true, status: 200, json: async () => frankfurterData };
    }
    if (url.includes('jsdelivr') || url.includes('pages.dev')) {
      return { ok: true, status: 200, json: async () => fawazData };
    }
    throw new Error('Unknown URL');
  };

  const storage = new MockStorage();
  const engine = new RatesEngine({ fetchFn: mockFetch, storage });

  const result = await engine.getRates({ forceRefresh: true });
  assert.equal(result.rates.EUR, 1.0);
  // ECB takes precedence for USD and GBP
  assert.equal(result.rates.USD, 1.1250);
  assert.equal(result.rates.GBP, 0.8500);
  // Fawaz fills NGN and BTC
  assert.equal(result.rates.NGN, 1495.0);
  assert.equal(result.rates.BTC, 0.000015);
  assert.equal(result.provider, 'ECB + Fallback');
});

test('rates: fallback tiers when primary tiers fail', async () => {
  let callCount = 0;
  const mockFetch = async (url) => {
    callCount++;
    if (url.includes('frankfurter')) {
      throw new Error('Frankfurter down');
    }
    if (url.includes('jsdelivr')) {
      throw new Error('jsDelivr blocked');
    }
    if (url.includes('pages.dev')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          date: '2026-10-17',
          eur: { usd: 1.12, ngn: 1500, eur: 1 }
        })
      };
    }
    throw new Error('Unknown URL');
  };

  const storage = new MockStorage();
  const engine = new RatesEngine({ fetchFn: mockFetch, storage });

  const result = await engine.getRates({ forceRefresh: true });
  assert.equal(result.rates.USD, 1.12);
  assert.equal(result.rates.NGN, 1500);
  assert.ok(result.provider.includes('Tier 3'));
  assert.equal(callCount, 3);
});

test('rates: deduplication of concurrent in-flight fetches', async () => {
  let networkFetches = 0;
  const mockFetch = async () => {
    networkFetches++;
    await new Promise(r => setTimeout(r, 50));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        amount: 1,
        base: 'EUR',
        date: '2026-10-16',
        rates: { USD: 1.10 }
      })
    };
  };

  const storage = new MockStorage();
  const engine = new RatesEngine({ fetchFn: mockFetch, storage });

  // Spy on fetchNetworkRates
  let fetchNetworkRatesCalls = 0;
  const origFetchNetworkRates = engine.fetchNetworkRates.bind(engine);
  engine.fetchNetworkRates = async () => {
    fetchNetworkRatesCalls++;
    return origFetchNetworkRates();
  };

  // Fire two concurrent calls
  const [res1, res2] = await Promise.all([
    engine.getRates({ forceRefresh: true }),
    engine.getRates({ forceRefresh: true })
  ]);

  assert.equal(res1.rates.USD, 1.10);
  assert.equal(res2.rates.USD, 1.10);
  // fetchNetworkRates was called only once despite 2 concurrent getRates calls!
  assert.equal(fetchNetworkRatesCalls, 1);
});

test('rates: stale-while-revalidate and offline behavior', async () => {
  const staleTimestamp = Date.now() - (7 * 3600 * 1000); // 7 hours ago (> 6 hr TTL)
  const cachedRates = {
    rates: { EUR: 1.0, USD: 1.10 },
    timestamp: staleTimestamp,
    date: '2026-10-10',
    provider: 'Cached ECB'
  };

  const storage = new MockStorage({
    currency_rates_cache_v2: cachedRates
  });

  // When network fails completely, it should return stale cache with isStale: true
  const failingFetch = async () => { throw new Error('Offline'); };
  const engine = new RatesEngine({ fetchFn: failingFetch, storage });

  const result = await engine.getRates();
  assert.equal(result.rates.USD, 1.10);
  assert.equal(result.isStale, true);
  assert.equal(result.date, '2026-10-10');
});
