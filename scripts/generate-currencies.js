// scripts/generate-currencies.js
// Generates static currency metadata (src/shared/currencies-data.js)

const fs = require('fs');
const path = require('path');

// Curated list of popular cryptos that Fawaz API carries
const POPULAR_CRYPTOS = {
  BTC: { name: 'Bitcoin', symbol: '₿', aliases: ['BTC', '₿'], digits: 8 },
  ETH: { name: 'Ethereum', symbol: 'Ξ', aliases: ['ETH', 'Ξ'], digits: 6 },
  USDT: { name: 'Tether USD', symbol: 'USDT', aliases: ['USDT'], digits: 2 },
  USDC: { name: 'USD Coin', symbol: 'USDC', aliases: ['USDC'], digits: 2 },
  BNB: { name: 'BNB', symbol: 'BNB', aliases: ['BNB'], digits: 4 },
  SOL: { name: 'Solana', symbol: 'SOL', aliases: ['SOL'], digits: 4 },
  XRP: { name: 'XRP', symbol: 'XRP', aliases: ['XRP'], digits: 4 },
  DOGE: { name: 'Dogecoin', symbol: 'Ð', aliases: ['DOGE', 'Ð'], digits: 2 },
  ADA: { name: 'Cardano', symbol: 'ADA', aliases: ['ADA'], digits: 4 },
  AVAX: { name: 'Avalanche', symbol: 'AVAX', aliases: ['AVAX'], digits: 4 },
  DOT: { name: 'Polkadot', symbol: 'DOT', aliases: ['DOT'], digits: 4 },
  MATIC: { name: 'Polygon', symbol: 'MATIC', aliases: ['MATIC'], digits: 4 },
  LTC: { name: 'Litecoin', symbol: 'Ł', aliases: ['LTC', 'Ł'], digits: 4 },
  LINK: { name: 'Chainlink', symbol: 'LINK', aliases: ['LINK'], digits: 4 }
};

// Hand-curated overrides for symbols, aliases, and ccTLD mappings
const CURRENCY_OVERRIDES = {
  USD: { symbol: '$', narrowSymbol: '$', aliases: ['$', 'US$', 'USD', 'U.S. Dollar', 'US Dollar'], ccTLDs: ['us', 'gov', 'mil', 'com'] },
  EUR: { symbol: '€', narrowSymbol: '€', aliases: ['€', 'EUR', 'Euro'], ccTLDs: ['eu', 'de', 'fr', 'es', 'it', 'nl', 'ie', 'pt', 'be', 'at', 'fi', 'gr', 'sk', 'ee', 'lv', 'lt', 'cy', 'mt', 'si', 'lu', 'hr'] },
  GBP: { symbol: '£', narrowSymbol: '£', aliases: ['£', 'GBP', 'GB£'], ccTLDs: ['uk', 'co.uk'] },
  CAD: { symbol: 'CA$', narrowSymbol: '$', aliases: ['CA$', 'CAD$', 'C$', 'CAD'], ccTLDs: ['ca'] },
  AUD: { symbol: 'A$', narrowSymbol: '$', aliases: ['AU$', 'A$', 'AUD$', 'AUD'], ccTLDs: ['au', 'com.au'] },
  NZD: { symbol: 'NZ$', narrowSymbol: '$', aliases: ['NZ$', 'NZD'], ccTLDs: ['nz', 'co.nz'] },
  JPY: { symbol: '¥', narrowSymbol: '¥', aliases: ['¥', 'JPY', '円'], digits: 0, ccTLDs: ['jp', 'co.jp'] },
  CNY: { symbol: 'CN¥', narrowSymbol: '¥', aliases: ['CN¥', 'RMB', 'CNY', '元'], digits: 2, ccTLDs: ['cn', 'com.cn'] },
  INR: { symbol: '₹', narrowSymbol: '₹', aliases: ['₹', 'Rs', 'Rs.', 'INR', '₨'], digits: 2, ccTLDs: ['in', 'co.in'] },
  NGN: { symbol: '₦', narrowSymbol: '₦', aliases: ['₦', 'NGN', 'Naira'], digits: 2, ccTLDs: ['ng', 'com.ng'] },
  BRL: { symbol: 'R$', narrowSymbol: 'R$', aliases: ['R$', 'BRL'], digits: 2, ccTLDs: ['br', 'com.br'] },
  ZAR: { symbol: 'R', narrowSymbol: 'R', aliases: ['R', 'ZAR', 'Rand'], digits: 2, ccTLDs: ['za', 'co.za'] },
  MXN: { symbol: 'MX$', narrowSymbol: '$', aliases: ['MX$', 'Mex$', 'MXN'], digits: 2, ccTLDs: ['mx', 'com.mx'] },
  SGD: { symbol: 'S$', narrowSymbol: '$', aliases: ['S$', 'SG$', 'SGD'], digits: 2, ccTLDs: ['sg', 'com.sg'] },
  HKD: { symbol: 'HK$', narrowSymbol: '$', aliases: ['HK$', 'HKD'], digits: 2, ccTLDs: ['hk', 'com.hk'] },
  KRW: { symbol: '₩', narrowSymbol: '₩', aliases: ['₩', 'KRW', '원'], digits: 0, ccTLDs: ['kr', 'co.kr'] },
  CHF: { symbol: 'CHF', narrowSymbol: 'CHF', aliases: ['CHF', 'SFr', 'Fr.'], digits: 2, ccTLDs: ['ch'] },
  SEK: { symbol: 'kr', narrowSymbol: 'kr', aliases: ['SEK', 'kr', ':-'], digits: 2, ccTLDs: ['se'] },
  NOK: { symbol: 'kr', narrowSymbol: 'kr', aliases: ['NOK', 'kr'], digits: 2, ccTLDs: ['no'] },
  DKK: { symbol: 'kr.', narrowSymbol: 'kr', aliases: ['DKK', 'kr.'], digits: 2, ccTLDs: ['dk'] },
  ISK: { symbol: 'kr', narrowSymbol: 'kr', aliases: ['ISK', 'kr'], digits: 0, ccTLDs: ['is'] },
  PLN: { symbol: 'zł', narrowSymbol: 'zł', aliases: ['zł', 'PLN', 'zl'], digits: 2, ccTLDs: ['pl'] },
  CZK: { symbol: 'Kč', narrowSymbol: 'Kč', aliases: ['Kč', 'CZK', 'Kc'], digits: 2, ccTLDs: ['cz'] },
  HUF: { symbol: 'Ft', narrowSymbol: 'Ft', aliases: ['Ft', 'HUF'], digits: 0, ccTLDs: ['hu'] },
  TRY: { symbol: '₺', narrowSymbol: '₺', aliases: ['₺', 'TRY', 'TL'], digits: 2, ccTLDs: ['tr', 'com.tr'] },
  RUB: { symbol: '₽', narrowSymbol: '₽', aliases: ['₽', 'RUB', 'руб'], digits: 2, ccTLDs: ['ru'] },
  UAH: { symbol: '₴', narrowSymbol: '₴', aliases: ['₴', 'UAH', 'грн'], digits: 2, ccTLDs: ['ua'] },
  ILS: { symbol: '₪', narrowSymbol: '₪', aliases: ['₪', 'ILS', 'NIS'], digits: 2, ccTLDs: ['il'] },
  AED: { symbol: 'AED', narrowSymbol: 'AED', aliases: ['AED', 'د.إ', 'Dhs'], digits: 2, ccTLDs: ['ae'] },
  SAR: { symbol: 'SAR', narrowSymbol: 'SAR', aliases: ['SAR', 'ر.س', 'SR'], digits: 2, ccTLDs: ['sa'] },
  QAR: { symbol: 'QAR', narrowSymbol: 'QAR', aliases: ['QAR', 'ر.ق'], digits: 2, ccTLDs: ['qa'] },
  KWD: { symbol: 'KWD', narrowSymbol: 'KWD', aliases: ['KWD', 'د.ك', 'KD'], digits: 3, ccTLDs: ['kw'] },
  BHD: { symbol: 'BHD', narrowSymbol: 'BHD', aliases: ['BHD', 'د.ب', 'BD'], digits: 3, ccTLDs: ['bh'] },
  OMR: { symbol: 'OMR', narrowSymbol: 'OMR', aliases: ['OMR', 'ر.ع.'], digits: 3, ccTLDs: ['om'] },
  JOD: { symbol: 'JOD', narrowSymbol: 'JOD', aliases: ['JOD', 'د.أ'], digits: 3, ccTLDs: ['jo'] },
  EGP: { symbol: 'EGP', narrowSymbol: 'E£', aliases: ['EGP', 'E£', 'ج.م'], digits: 2, ccTLDs: ['eg'] },
  KES: { symbol: 'KSh', narrowSymbol: 'KSh', aliases: ['KES', 'KSh', 'Ksh'], digits: 2, ccTLDs: ['ke'] },
  GHS: { symbol: 'GH₵', narrowSymbol: 'GH₵', aliases: ['GHS', 'GH₵', 'GHc'], digits: 2, ccTLDs: ['gh'] },
  THB: { symbol: '฿', narrowSymbol: '฿', aliases: ['฿', 'THB'], digits: 2, ccTLDs: ['th'] },
  VND: { symbol: '₫', narrowSymbol: '₫', aliases: ['₫', 'VND', 'd'], digits: 0, ccTLDs: ['vn'] },
  PHP: { symbol: '₱', narrowSymbol: '₱', aliases: ['₱', 'PHP'], digits: 2, ccTLDs: ['ph'] },
  MYR: { symbol: 'RM', narrowSymbol: 'RM', aliases: ['RM', 'MYR'], digits: 2, ccTLDs: ['my'] },
  IDR: { symbol: 'Rp', narrowSymbol: 'Rp', aliases: ['Rp', 'IDR'], digits: 0, ccTLDs: ['id'] },
  PKR: { symbol: 'PKR', narrowSymbol: 'Rs', aliases: ['PKR', 'PKRs'], digits: 2, ccTLDs: ['pk'] },
  BDT: { symbol: '৳', narrowSymbol: '৳', aliases: ['৳', 'BDT', 'Tk'], digits: 2, ccTLDs: ['bd'] },
  CLP: { symbol: 'CLP$', narrowSymbol: '$', aliases: ['CLP$', 'CLP'], digits: 0, ccTLDs: ['cl'] },
  COP: { symbol: 'COL$', narrowSymbol: '$', aliases: ['COL$', 'COP$', 'COP'], digits: 0, ccTLDs: ['co'] },
  PEN: { symbol: 'S/.', narrowSymbol: 'S/.', aliases: ['S/.', 'PEN', 'S/'], digits: 2, ccTLDs: ['pe'] },
  ARS: { symbol: 'AR$', narrowSymbol: '$', aliases: ['AR$', 'ARS'], digits: 2, ccTLDs: ['ar'] }
};

// Ambiguous markers that require context or fallback resolution
const AMBIGUOUS_SYMBOLS = {
  '$': { default: 'USD', candidates: ['USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN', 'CLP', 'COP', 'ARS'] },
  '¥': { default: 'JPY', candidates: ['JPY', 'CNY'] },
  'kr': { default: 'SEK', candidates: ['SEK', 'NOK', 'DKK', 'ISK'] },
  '£': { default: 'GBP', candidates: ['GBP', 'EGP'] },
  'Rs': { default: 'INR', candidates: ['INR', 'PKR', 'NPR', 'LKR', 'MUR'] },
  '₨': { default: 'INR', candidates: ['INR', 'PKR', 'NPR', 'LKR'] },
  'R': { default: 'ZAR', candidates: ['ZAR', 'BRL'] },
  'د.ك': { default: 'KWD', candidates: ['KWD'] }
};

function main() {
  const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
  const allIsoCodes = Intl.supportedValuesOf('currency');
  const currencies = {};
  const cctldMap = {};

  for (const code of allIsoCodes) {
    let name = code;
    try {
      name = displayNames.of(code) || code;
    } catch {
      // fallback
    }

    let narrowSymbol = code;
    let symbol = code;
    let digits = 2;

    try {
      const nfNarrow = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
      const parts = nfNarrow.formatToParts(1);
      const curPart = parts.find(p => p.type === 'currency');
      if (curPart) narrowSymbol = curPart.value;
    } catch {}

    try {
      const nfSymbol = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'symbol' });
      const parts = nfSymbol.formatToParts(1);
      const curPart = parts.find(p => p.type === 'currency');
      if (curPart) symbol = curPart.value;
      digits = nfSymbol.resolvedOptions().maximumFractionDigits ?? 2;
    } catch {}

    const override = CURRENCY_OVERRIDES[code] || {};

    const meta = {
      code,
      name: override.name || name,
      symbol: override.symbol || symbol,
      narrowSymbol: override.narrowSymbol || narrowSymbol,
      digits: override.digits !== undefined ? override.digits : digits,
      aliases: Array.from(new Set([code, override.symbol || symbol, override.narrowSymbol || narrowSymbol, ...(override.aliases || [])])).filter(Boolean),
      ccTLDs: override.ccTLDs || [],
      crypto: false
    };

    currencies[code] = meta;

    for (const tld of meta.ccTLDs) {
      if (!cctldMap[tld]) {
        cctldMap[tld] = code;
      }
    }
  }

  // Add popular cryptos
  for (const [code, cryptoMeta] of Object.entries(POPULAR_CRYPTOS)) {
    currencies[code] = {
      code,
      name: cryptoMeta.name,
      symbol: cryptoMeta.symbol,
      narrowSymbol: cryptoMeta.symbol,
      digits: cryptoMeta.digits,
      aliases: cryptoMeta.aliases,
      ccTLDs: [],
      crypto: true
    };
  }

  const outDir = path.join(__dirname, '..', 'src', 'shared');
  fs.mkdirSync(outDir, { recursive: true });

  const fileContent = `// Auto-generated by scripts/generate-currencies.js. Do not edit directly.
// Generated on: ${new Date().toISOString()}

export const CURRENCIES_DATA = ${JSON.stringify(currencies, null, 2)};

export const CCTLD_TO_CURRENCY = ${JSON.stringify(cctldMap, null, 2)};

export const AMBIGUOUS_SYMBOLS = ${JSON.stringify(AMBIGUOUS_SYMBOLS, null, 2)};

export const POPULAR_CRYPTO_CODES = ${JSON.stringify(Object.keys(POPULAR_CRYPTOS), null, 2)};
`;

  fs.writeFileSync(path.join(outDir, 'currencies-data.js'), fileContent, 'utf8');
  console.log(`Generated currencies-data.js successfully with ${Object.keys(currencies).length} currencies (${Object.keys(POPULAR_CRYPTOS).length} crypto).`);
}

main();
