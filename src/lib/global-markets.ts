import { getIdxMarketStatus } from "./market-hours";
import { formatDesimal, formatNumber, formatRupiah } from "./format";
import type { MarketProvider } from "./market-data";

export type GlobalMarketId =
  | "ID"
  | "US"
  | "JP"
  | "HK"
  | "SG"
  | "KR"
  | "CN"
  | "UK"
  | "DE"
  | "AU";

export type GlobalMarketRegion = "Asia-Pasifik" | "Amerika" | "Eropa";

export type GlobalCurrencyCode =
  | "IDR"
  | "USD"
  | "JPY"
  | "HKD"
  | "SGD"
  | "KRW"
  | "CNY"
  | "GBP"
  | "EUR"
  | "AUD";

export interface MarketSessionWindow {
  startMin: number;
  endMin: number;
}

export interface GlobalStockDefinition {
  symbol: string;
  displayTicker: string;
  name: string;
  sector: string;
  fallbackPrice: number;
  fallbackChangePercent: number;
  idxTicker?: string;
}

export interface GlobalMarketHubDefinition {
  id: GlobalMarketId;
  countryName: string;
  city: string;
  exchange: string;
  region: GlobalMarketRegion;
  lat: number;
  lon: number;
  isoNumeric: string;
  currency: GlobalCurrencyCode;
  timeZone: string;
  timeZoneAbbr: string;
  sessions: MarketSessionWindow[];
  indexSymbol: string;
  indexName: string;
  fallbackIndexValue: number;
  fallbackIndexChangePercent: number;
  secondaryIndexSymbol?: string;
  secondaryIndexName?: string;
  fallbackSecondaryValue?: number;
  fallbackSecondaryChangePercent?: number;
  stocks: GlobalStockDefinition[];
}

export interface GlobalMarketSessionStatus {
  isOpen: boolean;
  statusLabel: "Buka" | "Tutup";
  detailLabel: string;
  localTime: string;
}

export interface GlobalStockQuote {
  symbol: string;
  displayTicker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  currency: GlobalCurrencyCode;
  isFallback?: boolean;
  idxTicker?: string;
}

export interface GlobalMarketIndexQuote {
  symbol: string;
  name: string;
  value: number;
  changePercent: number;
  isFallback?: boolean;
}

export interface GlobalMarketHubSnapshot {
  id: GlobalMarketId;
  countryName: string;
  city: string;
  exchange: string;
  region: GlobalMarketRegion;
  lat: number;
  lon: number;
  isoNumeric: string;
  currency: GlobalCurrencyCode;
  session: GlobalMarketSessionStatus;
  primaryIndex: GlobalMarketIndexQuote;
  secondaryIndex?: GlobalMarketIndexQuote;
  stocks: GlobalStockQuote[];
}

export interface GlobalSentimentSummary {
  advancingCount: number;
  decliningCount: number;
  openCount: number;
  totalCount: number;
  avgChangePercent: number;
  moodLabel: "Risk-On" | "Campuran" | "Risk-Off";
  moodTone: "emerald" | "amber" | "coral";
}

export interface GlobalMarketsResponse {
  provider: MarketProvider;
  isFallback: boolean;
  hubs: GlobalMarketHubSnapshot[];
  timestamp: string;
  error?: string;
}

export const GLOBAL_MARKET_HUBS: GlobalMarketHubDefinition[] = [
  {
    id: "ID",
    countryName: "Indonesia",
    city: "Jakarta",
    exchange: "IDX / BEI",
    region: "Asia-Pasifik",
    lat: -6.2088,
    lon: 106.8456,
    isoNumeric: "360",
    currency: "IDR",
    timeZone: "Asia/Jakarta",
    timeZoneAbbr: "WIB",
    sessions: [
      { startMin: 9 * 60, endMin: 12 * 60 },
      { startMin: 13 * 60 + 30, endMin: 16 * 60 },
    ],
    indexSymbol: "^JKSE",
    indexName: "IHSG",
    fallbackIndexValue: 7285.4,
    fallbackIndexChangePercent: 0.64,
    stocks: [
      {
        symbol: "BBCA.JK",
        displayTicker: "BBCA",
        name: "Bank Central Asia",
        sector: "Perbankan",
        fallbackPrice: 9850,
        fallbackChangePercent: 0.77,
        idxTicker: "BBCA",
      },
      {
        symbol: "BMRI.JK",
        displayTicker: "BMRI",
        name: "Bank Mandiri",
        sector: "Perbankan",
        fallbackPrice: 6450,
        fallbackChangePercent: 1.18,
        idxTicker: "BMRI",
      },
      {
        symbol: "BBRI.JK",
        displayTicker: "BBRI",
        name: "Bank Rakyat Indonesia",
        sector: "Perbankan",
        fallbackPrice: 4680,
        fallbackChangePercent: 0.43,
        idxTicker: "BBRI",
      },
      {
        symbol: "TLKM.JK",
        displayTicker: "TLKM",
        name: "Telkom Indonesia",
        sector: "Telekomunikasi",
        fallbackPrice: 2890,
        fallbackChangePercent: -0.35,
        idxTicker: "TLKM",
      },
    ],
  },
  {
    id: "US",
    countryName: "Amerika Serikat",
    city: "New York",
    exchange: "NYSE / Nasdaq",
    region: "Amerika",
    lat: 40.7128,
    lon: -74.006,
    isoNumeric: "840",
    currency: "USD",
    timeZone: "America/New_York",
    timeZoneAbbr: "ET",
    sessions: [{ startMin: 9 * 60 + 30, endMin: 16 * 60 }],
    indexSymbol: "^GSPC",
    indexName: "S&P 500",
    fallbackIndexValue: 5984.2,
    fallbackIndexChangePercent: 0.82,
    secondaryIndexSymbol: "^IXIC",
    secondaryIndexName: "Nasdaq",
    fallbackSecondaryValue: 19245.6,
    fallbackSecondaryChangePercent: 1.14,
    stocks: [
      {
        symbol: "NVDA",
        displayTicker: "NVDA",
        name: "NVIDIA Corp",
        sector: "Semikonduktor",
        fallbackPrice: 141.8,
        fallbackChangePercent: 2.35,
      },
      {
        symbol: "AAPL",
        displayTicker: "AAPL",
        name: "Apple Inc",
        sector: "Teknologi",
        fallbackPrice: 234.6,
        fallbackChangePercent: 0.91,
      },
      {
        symbol: "MSFT",
        displayTicker: "MSFT",
        name: "Microsoft Corp",
        sector: "Perangkat Lunak",
        fallbackPrice: 428.4,
        fallbackChangePercent: 0.68,
      },
      {
        symbol: "TSLA",
        displayTicker: "TSLA",
        name: "Tesla Inc",
        sector: "Otomotif & EV",
        fallbackPrice: 312.5,
        fallbackChangePercent: -1.24,
      },
    ],
  },
  {
    id: "JP",
    countryName: "Jepang",
    city: "Tokyo",
    exchange: "TSE",
    region: "Asia-Pasifik",
    lat: 35.6762,
    lon: 139.6503,
    isoNumeric: "392",
    currency: "JPY",
    timeZone: "Asia/Tokyo",
    timeZoneAbbr: "JST",
    sessions: [
      { startMin: 9 * 60, endMin: 11 * 60 + 30 },
      { startMin: 12 * 60 + 30, endMin: 15 * 60 + 30 },
    ],
    indexSymbol: "^N225",
    indexName: "Nikkei 225",
    fallbackIndexValue: 39120.5,
    fallbackIndexChangePercent: 1.08,
    stocks: [
      {
        symbol: "7203.T",
        displayTicker: "7203",
        name: "Toyota Motor",
        sector: "Otomotif",
        fallbackPrice: 2745,
        fallbackChangePercent: 1.25,
      },
      {
        symbol: "6758.T",
        displayTicker: "6758",
        name: "Sony Group",
        sector: "Elektronik",
        fallbackPrice: 3120,
        fallbackChangePercent: 1.62,
      },
      {
        symbol: "9984.T",
        displayTicker: "9984",
        name: "SoftBank Group",
        sector: "Investasi & AI",
        fallbackPrice: 9380,
        fallbackChangePercent: 0.88,
      },
      {
        symbol: "8306.T",
        displayTicker: "8306",
        name: "Mitsubishi UFJ",
        sector: "Perbankan",
        fallbackPrice: 1842,
        fallbackChangePercent: -0.42,
      },
    ],
  },
  {
    id: "HK",
    countryName: "Hong Kong",
    city: "Hong Kong",
    exchange: "HKEX",
    region: "Asia-Pasifik",
    lat: 22.3193,
    lon: 114.1694,
    isoNumeric: "344",
    currency: "HKD",
    timeZone: "Asia/Hong_Kong",
    timeZoneAbbr: "HKT",
    sessions: [
      { startMin: 9 * 60 + 30, endMin: 12 * 60 },
      { startMin: 13 * 60, endMin: 16 * 60 },
    ],
    indexSymbol: "^HSI",
    indexName: "Hang Seng",
    fallbackIndexValue: 19840.3,
    fallbackIndexChangePercent: -0.58,
    stocks: [
      {
        symbol: "0700.HK",
        displayTicker: "0700",
        name: "Tencent Holdings",
        sector: "Teknologi",
        fallbackPrice: 412.4,
        fallbackChangePercent: 0.48,
      },
      {
        symbol: "9988.HK",
        displayTicker: "9988",
        name: "Alibaba Group",
        sector: "E-Commerce",
        fallbackPrice: 89.6,
        fallbackChangePercent: -1.32,
      },
      {
        symbol: "0005.HK",
        displayTicker: "0005",
        name: "HSBC Holdings",
        sector: "Perbankan",
        fallbackPrice: 72.1,
        fallbackChangePercent: 0.35,
      },
      {
        symbol: "3690.HK",
        displayTicker: "3690",
        name: "Meituan",
        sector: "Konsumer Digital",
        fallbackPrice: 168.5,
        fallbackChangePercent: -0.94,
      },
    ],
  },
  {
    id: "SG",
    countryName: "Singapura",
    city: "Singapura",
    exchange: "SGX",
    region: "Asia-Pasifik",
    lat: 1.3521,
    lon: 103.8198,
    isoNumeric: "702",
    currency: "SGD",
    timeZone: "Asia/Singapore",
    timeZoneAbbr: "SGT",
    sessions: [{ startMin: 9 * 60, endMin: 17 * 60 }],
    indexSymbol: "^STI",
    indexName: "STI",
    fallbackIndexValue: 3742.8,
    fallbackIndexChangePercent: 0.45,
    stocks: [
      {
        symbol: "D05.SI",
        displayTicker: "D05",
        name: "DBS Group",
        sector: "Perbankan",
        fallbackPrice: 42.35,
        fallbackChangePercent: 0.84,
      },
      {
        symbol: "O39.SI",
        displayTicker: "O39",
        name: "OCBC Bank",
        sector: "Perbankan",
        fallbackPrice: 16.48,
        fallbackChangePercent: 0.49,
      },
      {
        symbol: "U11.SI",
        displayTicker: "U11",
        name: "UOB",
        sector: "Perbankan",
        fallbackPrice: 36.12,
        fallbackChangePercent: 0.32,
      },
      {
        symbol: "Z74.SI",
        displayTicker: "Z74",
        name: "Singtel",
        sector: "Telekomunikasi",
        fallbackPrice: 3.16,
        fallbackChangePercent: -0.31,
      },
    ],
  },
  {
    id: "KR",
    countryName: "Korea Selatan",
    city: "Seoul",
    exchange: "KRX",
    region: "Asia-Pasifik",
    lat: 37.5665,
    lon: 126.978,
    isoNumeric: "410",
    currency: "KRW",
    timeZone: "Asia/Seoul",
    timeZoneAbbr: "KST",
    sessions: [{ startMin: 9 * 60, endMin: 15 * 60 + 30 }],
    indexSymbol: "^KS11",
    indexName: "KOSPI",
    fallbackIndexValue: 2518.6,
    fallbackIndexChangePercent: 0.34,
    stocks: [
      {
        symbol: "005930.KS",
        displayTicker: "005930",
        name: "Samsung Electronics",
        sector: "Semikonduktor",
        fallbackPrice: 57800,
        fallbackChangePercent: 0.7,
      },
      {
        symbol: "000660.KS",
        displayTicker: "000660",
        name: "SK Hynix",
        sector: "Memori & AI",
        fallbackPrice: 178400,
        fallbackChangePercent: 1.94,
      },
      {
        symbol: "005380.KS",
        displayTicker: "005380",
        name: "Hyundai Motor",
        sector: "Otomotif",
        fallbackPrice: 221500,
        fallbackChangePercent: -0.45,
      },
      {
        symbol: "035420.KS",
        displayTicker: "035420",
        name: "Naver Corp",
        sector: "Internet",
        fallbackPrice: 196800,
        fallbackChangePercent: 0.56,
      },
    ],
  },
  {
    id: "CN",
    countryName: "Tiongkok",
    city: "Shanghai",
    exchange: "SSE",
    region: "Asia-Pasifik",
    lat: 31.2304,
    lon: 121.4737,
    isoNumeric: "156",
    currency: "CNY",
    timeZone: "Asia/Shanghai",
    timeZoneAbbr: "CST",
    sessions: [
      { startMin: 9 * 60 + 30, endMin: 11 * 60 + 30 },
      { startMin: 13 * 60, endMin: 15 * 60 },
    ],
    indexSymbol: "000001.SS",
    indexName: "Shanghai Comp",
    fallbackIndexValue: 3348.2,
    fallbackIndexChangePercent: -0.28,
    stocks: [
      {
        symbol: "600519.SS",
        displayTicker: "600519",
        name: "Kweichow Moutai",
        sector: "Konsumer",
        fallbackPrice: 1538,
        fallbackChangePercent: -0.45,
      },
      {
        symbol: "601318.SS",
        displayTicker: "601318",
        name: "Ping An Insurance",
        sector: "Keuangan",
        fallbackPrice: 54.6,
        fallbackChangePercent: 0.55,
      },
      {
        symbol: "600036.SS",
        displayTicker: "600036",
        name: "China Merchants Bank",
        sector: "Perbankan",
        fallbackPrice: 38.4,
        fallbackChangePercent: 0.26,
      },
      {
        symbol: "601857.SS",
        displayTicker: "601857",
        name: "PetroChina",
        sector: "Energi",
        fallbackPrice: 8.32,
        fallbackChangePercent: -0.72,
      },
    ],
  },
  {
    id: "UK",
    countryName: "Inggris",
    city: "London",
    exchange: "LSE",
    region: "Eropa",
    lat: 51.5074,
    lon: -0.1278,
    isoNumeric: "826",
    currency: "GBP",
    timeZone: "Europe/London",
    timeZoneAbbr: "GMT",
    sessions: [{ startMin: 8 * 60, endMin: 16 * 60 + 30 }],
    indexSymbol: "^FTSE",
    indexName: "FTSE 100",
    fallbackIndexValue: 8276.4,
    fallbackIndexChangePercent: 0.39,
    stocks: [
      {
        symbol: "AZN.L",
        displayTicker: "AZN",
        name: "AstraZeneca",
        sector: "Farmasi",
        fallbackPrice: 106.4,
        fallbackChangePercent: 0.72,
      },
      {
        symbol: "SHEL.L",
        displayTicker: "SHEL",
        name: "Shell plc",
        sector: "Energi",
        fallbackPrice: 25.85,
        fallbackChangePercent: 0.64,
      },
      {
        symbol: "HSBA.L",
        displayTicker: "HSBA",
        name: "HSBC UK",
        sector: "Perbankan",
        fallbackPrice: 7.42,
        fallbackChangePercent: 0.41,
      },
      {
        symbol: "ULVR.L",
        displayTicker: "ULVR",
        name: "Unilever plc",
        sector: "Konsumer",
        fallbackPrice: 46.9,
        fallbackChangePercent: -0.22,
      },
    ],
  },
  {
    id: "DE",
    countryName: "Jerman",
    city: "Frankfurt",
    exchange: "XETRA",
    region: "Eropa",
    lat: 50.1109,
    lon: 8.6821,
    isoNumeric: "276",
    currency: "EUR",
    timeZone: "Europe/Berlin",
    timeZoneAbbr: "CET",
    sessions: [{ startMin: 9 * 60, endMin: 17 * 60 + 30 }],
    indexSymbol: "^GDAXI",
    indexName: "DAX 40",
    fallbackIndexValue: 19462.1,
    fallbackIndexChangePercent: 0.56,
    stocks: [
      {
        symbol: "SAP.DE",
        displayTicker: "SAP",
        name: "SAP SE",
        sector: "Perangkat Lunak",
        fallbackPrice: 224.8,
        fallbackChangePercent: 1.32,
      },
      {
        symbol: "SIE.DE",
        displayTicker: "SIE",
        name: "Siemens AG",
        sector: "Industri",
        fallbackPrice: 184.2,
        fallbackChangePercent: 0.64,
      },
      {
        symbol: "ALV.DE",
        displayTicker: "ALV",
        name: "Allianz SE",
        sector: "Asuransi",
        fallbackPrice: 294.5,
        fallbackChangePercent: 0.31,
      },
      {
        symbol: "MBG.DE",
        displayTicker: "MBG",
        name: "Mercedes-Benz",
        sector: "Otomotif",
        fallbackPrice: 54.1,
        fallbackChangePercent: -0.84,
      },
    ],
  },
  {
    id: "AU",
    countryName: "Australia",
    city: "Sydney",
    exchange: "ASX",
    region: "Asia-Pasifik",
    lat: -33.8688,
    lon: 151.2093,
    isoNumeric: "036",
    currency: "AUD",
    timeZone: "Australia/Sydney",
    timeZoneAbbr: "AEST",
    sessions: [{ startMin: 10 * 60, endMin: 16 * 60 }],
    indexSymbol: "^AXJO",
    indexName: "ASX 200",
    fallbackIndexValue: 8412.6,
    fallbackIndexChangePercent: 0.51,
    stocks: [
      {
        symbol: "BHP.AX",
        displayTicker: "BHP",
        name: "BHP Group",
        sector: "Tambang",
        fallbackPrice: 41.25,
        fallbackChangePercent: 0.92,
      },
      {
        symbol: "CBA.AX",
        displayTicker: "CBA",
        name: "Commonwealth Bank",
        sector: "Perbankan",
        fallbackPrice: 156.8,
        fallbackChangePercent: 0.44,
      },
      {
        symbol: "CSL.AX",
        displayTicker: "CSL",
        name: "CSL Limited",
        sector: "Bioteknologi",
        fallbackPrice: 282.4,
        fallbackChangePercent: 0.61,
      },
      {
        symbol: "WES.AX",
        displayTicker: "WES",
        name: "Wesfarmers",
        sector: "Ritel",
        fallbackPrice: 71.9,
        fallbackChangePercent: -0.18,
      },
    ],
  },
];

/**
 * Mengevaluasi status buka/tutup bursa global secara deterministik menggunakan timezone lokal.
 */
export function evaluateGlobalMarketSession(
  hub: GlobalMarketHubDefinition,
  date: Date = new Date()
): GlobalMarketSessionStatus {
  if (hub.id === "ID") {
    const idxStatus = getIdxMarketStatus(date);
    return {
      isOpen: idxStatus.isOpen,
      statusLabel: idxStatus.statusText,
      detailLabel: idxStatus.sessionText,
      localTime: idxStatus.timeWib,
    };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: hub.timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const weekday = partMap.weekday || "Mon";
  const hour = parseInt(partMap.hour || "0", 10) % 24;
  const minute = parseInt(partMap.minute || "0", 10);
  const minutes = hour * 60 + minute;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const localTime = `${pad(hour)}:${pad(minute)} ${hub.timeZoneAbbr}`;

  if (weekday === "Sat" || weekday === "Sun") {
    return {
      isOpen: false,
      statusLabel: "Tutup",
      detailLabel: "Akhir Pekan",
      localTime,
    };
  }

  for (let i = 0; i < hub.sessions.length; i += 1) {
    const win = hub.sessions[i];
    if (minutes >= win.startMin && minutes < win.endMin) {
      return {
        isOpen: true,
        statusLabel: "Buka",
        detailLabel: hub.sessions.length > 1 ? `Sesi ${i + 1} Aktif` : "Perdagangan Reguler",
        localTime,
      };
    }
  }

  if (hub.sessions.length > 1) {
    const first = hub.sessions[0];
    const second = hub.sessions[1];
    if (minutes >= first.endMin && minutes < second.startMin) {
      return {
        isOpen: false,
        statusLabel: "Tutup",
        detailLabel: "Istirahat Siang",
        localTime,
      };
    }
  }

  return {
    isOpen: false,
    statusLabel: "Tutup",
    detailLabel: "Di Luar Jam Bursa",
    localTime,
  };
}

/**
 * Format harga saham dalam mata uang bursa lokal dengan gaya angka Indonesia.
 */
export function formatGlobalCurrency(
  value: number,
  currency: GlobalCurrencyCode
): string {
  if (!Number.isFinite(value) || value <= 0) return "-";

  switch (currency) {
    case "IDR":
      return formatRupiah(value);
    case "USD":
      return `$${formatDesimal(value, 2)}`;
    case "JPY":
      return `¥${formatNumber(Math.round(value))}`;
    case "HKD":
      return `HK$${formatDesimal(value, 2)}`;
    case "SGD":
      return `S$${formatDesimal(value, 2)}`;
    case "KRW":
      return `₩${formatNumber(Math.round(value))}`;
    case "CNY":
      return `CN¥${formatDesimal(value, 2)}`;
    case "GBP":
      return `£${formatDesimal(value, 2)}`;
    case "EUR":
      return `€${formatDesimal(value, 2)}`;
    case "AUD":
      return `A$${formatDesimal(value, 2)}`;
    default:
      return formatDesimal(value, 2);
  }
}

/**
 * Format angka indeks global (e.g. 5.984,2 atau 39.120,5).
 */
export function formatGlobalIndexValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return formatDesimal(value, 1);
}

/**
 * Menghitung ringkasan sentimen bursa global untuk indikator Risk-On / Campuran / Risk-Off.
 */
export function summarizeGlobalSentiment(
  hubs: GlobalMarketHubSnapshot[]
): GlobalSentimentSummary {
  if (hubs.length === 0) {
    return {
      advancingCount: 0,
      decliningCount: 0,
      openCount: 0,
      totalCount: 0,
      avgChangePercent: 0,
      moodLabel: "Campuran",
      moodTone: "amber",
    };
  }

  let advancingCount = 0;
  let decliningCount = 0;
  let openCount = 0;
  let changeSum = 0;

  for (const hub of hubs) {
    if (hub.session.isOpen) openCount += 1;
    const chg = hub.primaryIndex.changePercent;
    changeSum += chg;
    if (chg > 0.05) advancingCount += 1;
    else if (chg < -0.05) decliningCount += 1;
  }

  const avgChangePercent = changeSum / hubs.length;
  let moodLabel: GlobalSentimentSummary["moodLabel"] = "Campuran";
  let moodTone: GlobalSentimentSummary["moodTone"] = "amber";

  if (advancingCount >= Math.ceil(hubs.length * 0.6) && avgChangePercent >= 0.15) {
    moodLabel = "Risk-On";
    moodTone = "emerald";
  } else if (decliningCount >= Math.ceil(hubs.length * 0.6) && avgChangePercent <= -0.15) {
    moodLabel = "Risk-Off";
    moodTone = "coral";
  }

  return {
    advancingCount,
    decliningCount,
    openCount,
    totalCount: hubs.length,
    avgChangePercent,
    moodLabel,
    moodTone,
  };
}

export function buildFallbackGlobalMarkets(
  date: Date = new Date()
): GlobalMarketHubSnapshot[] {
  return GLOBAL_MARKET_HUBS.map((hub) => ({
    id: hub.id,
    countryName: hub.countryName,
    city: hub.city,
    exchange: hub.exchange,
    region: hub.region,
    lat: hub.lat,
    lon: hub.lon,
    isoNumeric: hub.isoNumeric,
    currency: hub.currency,
    session: evaluateGlobalMarketSession(hub, date),
    primaryIndex: {
      symbol: hub.indexSymbol,
      name: hub.indexName,
      value: hub.fallbackIndexValue,
      changePercent: hub.fallbackIndexChangePercent,
      isFallback: true,
    },
    ...(hub.secondaryIndexSymbol && hub.secondaryIndexName
      ? {
          secondaryIndex: {
            symbol: hub.secondaryIndexSymbol,
            name: hub.secondaryIndexName,
            value: hub.fallbackSecondaryValue ?? 0,
            changePercent: hub.fallbackSecondaryChangePercent ?? 0,
            isFallback: true,
          },
        }
      : {}),
    stocks: hub.stocks.map((s) => ({
      symbol: s.symbol,
      displayTicker: s.displayTicker,
      name: s.name,
      sector: s.sector,
      price: s.fallbackPrice,
      changePercent: s.fallbackChangePercent,
      currency: hub.currency,
      isFallback: true,
      ...(s.idxTicker ? { idxTicker: s.idxTicker } : {}),
    })),
  }));
}
