/**
 * Server-side cache, rate limiter, and Yahoo Finance fetcher.
 * Digunakan hanya di server (Next.js route handlers) - TIDAK diimpor di komponen klien.
 */

import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import { MarketTickerItem } from "@/types/market";
import { getIdxMarketStatus } from "./market-hours";
import { normalizeHistoryRange, sliceIllustrativeSeries } from "./market-data";
import { formatDesimal, formatNumber } from "./format";
import {
  fetchYahooQuotesCached,
  fetchYahooChartCached,
  fetchYahooProfileCached,
  fetchYahooSearchCached,
} from "./yahoo-cache";

// 9 kode saham IDX bawaan di daftar pantau kurasi
export const SUPPORTED_TICKERS = [
  "ADRO",
  "ANTM",
  "ASII",
  "BBCA",
  "BBRI",
  "BMRI",
  "ICBP",
  "MEDC",
  "TLKM",
] as const;

export type SupportedTicker = (typeof SUPPORTED_TICKERS)[number];

export function isValidIdxTickerFormat(ticker: string): boolean {
  return /^[A-Z]{4}$/.test(ticker);
}

export interface ServerQuoteItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  lastUpdated: string;
  marketState: "OPEN" | "CLOSED";
  isFallback?: boolean;
  peRatio?: number;
  pbvRatio?: number;
  eps?: number;
  bvps?: number;
  dividendYield?: number;
  marketCapTrillion?: number;
  financialCurrency?: string;
}

export interface ServerHistoryPoint {
  time: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dividend?: number;
}

export interface ServerStockSearchItem {
  ticker: string;
  name: string;
  sector?: string;
  isDefaultWatchlist: boolean;
}

export interface ServerStockProfile {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  hasCuratedBands: boolean;
  isLive: boolean;
  currentPrice: number;
  changePercent: number;
  peRatio?: number;
  pbvRatio?: number;
  eps?: number;
  bvps?: number;
  dividendYield?: number;
  marketCapTrillion?: number;
  financialCurrency?: string;
  roe?: number;
  der?: number;
  payoutRatio?: number;
  historicalPeMean?: number;
  peSd1Plus?: number;
  peSd1Minus?: number;
  peSd2Plus?: number;
  peSd2Minus?: number;
  description: string;
  strengths: string[];
  risks: string[];
}

function toWibDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ==============================================================================
// In-Memory Server Cache & Simple Rate Limiter
// ==============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  wibDate?: string;
}

const QUOTE_CACHE_TTL_MS = 60 * 1000;
const HISTORY_CACHE_TTL_MS = 60 * 1000;
const MACRO_CACHE_TTL_MS = 60 * 1000;

const quotesCache = new Map<string, CacheEntry<ServerQuoteItem>>();
const historyCache = new Map<string, CacheEntry<ServerHistoryPoint[]>>();
let macroCache: CacheEntry<MarketTickerItem[]> | null = null;
let usdIdrCache: CacheEntry<number> | null = null;

// Pembatas laju sederhana: maksimum 80 permintaan server per 60 detik
let requestCountWindow = 0;
let windowStartTime = Date.now();

export function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - windowStartTime > 60000) {
    windowStartTime = now;
    requestCountWindow = 0;
  }
  requestCountWindow++;
  return requestCountWindow <= 80;
}

// ==============================================================================
// Fallback Generator dari Data Ilustrasi (khusus 9 saham kurasi)
// ==============================================================================

export function getIllustrativeQuote(ticker: string): ServerQuoteItem | null {
  const stock = STOCKS_DATA.find((s) => s.ticker === ticker);
  if (!stock) return null;

  const marketStatus = getIdxMarketStatus();
  const eps = stock.peRatio > 0 ? stock.currentPrice / stock.peRatio : undefined;
  const bvps = stock.pbvRatio > 0 ? stock.currentPrice / stock.pbvRatio : undefined;

  return {
    ticker: stock.ticker,
    name: stock.name,
    price: stock.currentPrice,
    change: Math.round((stock.currentPrice * stock.change1D) / 100),
    changePercent: stock.change1D,
    previousClose: Math.round(stock.currentPrice / (1 + stock.change1D / 100)),
    lastUpdated: marketStatus.formattedTime,
    marketState: marketStatus.isOpen ? "OPEN" : "CLOSED",
    isFallback: true,
    peRatio: stock.peRatio,
    pbvRatio: stock.pbvRatio,
    eps,
    bvps,
    dividendYield: stock.dividendYield,
    marketCapTrillion: stock.marketCapTrillion,
    financialCurrency: "IDR",
  };
}

export function getIllustrativeHistory(
  ticker: string,
  range: string = "Semua"
): ServerHistoryPoint[] {
  const safeRange = normalizeHistoryRange(range, "Semua");
  const quarterly = ticker === "IHSG" ? IHSG_HISTORICAL : HISTORICAL_SERIES[ticker] || [];
  const sliced = sliceIllustrativeSeries(quarterly, safeRange);

  return sliced.map((item) => ({
    time: `${item.date}-01`,
    open: item.price,
    high: item.price,
    low: item.price,
    close: item.price,
    volume: 1000000,
    dividend: item.dividend,
  }));
}

// ==============================================================================
// Yahoo Finance Fetchers (Backed by Next.js "use cache" + in-memory guard)
// ==============================================================================

function readPositiveNum(obj: Record<string, unknown>, key: string): number | undefined {
  const val = obj[key];
  return typeof val === "number" && isFinite(val) && val > 0 ? val : undefined;
}

function readNum(obj: Record<string, unknown>, key: string): number | undefined {
  const val = obj[key];
  return typeof val === "number" && isFinite(val) ? val : undefined;
}

function readStr(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  return typeof val === "string" && val.length > 0 ? val : undefined;
}

/**
 * Mengambil harga terakhir dan metrik valuasi untuk banyak kode saham IDX sekaligus.
 */
export async function getBatchQuotesServer(
  tickers: string[]
): Promise<Record<string, ServerQuoteItem>> {
  const result: Record<string, ServerQuoteItem> = {};
  const tickersToFetch: string[] = [];
  const now = Date.now();
  const marketStatus = getIdxMarketStatus();

  for (const ticker of tickers) {
    const cached = quotesCache.get(ticker);
    if (cached && now - cached.cachedAt < QUOTE_CACHE_TTL_MS) {
      result[ticker] = cached.data;
    } else {
      tickersToFetch.push(ticker);
    }
  }

  if (tickersToFetch.length === 0) {
    return result;
  }

  if (!checkRateLimit()) {
    console.warn("[MarketServer] Rate limit reached, using cached or illustrative data");
    for (const ticker of tickersToFetch) {
      const cached = quotesCache.get(ticker);
      if (cached) {
        result[ticker] = cached.data;
      } else {
        const illus = getIllustrativeQuote(ticker);
        if (illus) result[ticker] = illus;
      }
    }
    return result;
  }

  try {
    const symbols = tickersToFetch.map((t) => `${t}.JK`);
    const needUsdIdr = !usdIdrCache || now - usdIdrCache.cachedAt >= QUOTE_CACHE_TTL_MS;
    if (needUsdIdr) {
      symbols.push("IDR=X");
    }

    const symbolsKey = [...symbols].sort().join(",");
    const quoteList = await fetchYahooQuotesCached(symbolsKey);

    let activeUsdIdrRate = usdIdrCache?.data ?? 0;
    for (const qRec of quoteList) {
      if (readStr(qRec, "symbol") === "IDR=X") {
        const rate = readPositiveNum(qRec, "regularMarketPrice");
        if (rate) {
          activeUsdIdrRate = rate;
          usdIdrCache = { data: rate, cachedAt: now };
        }
      }
    }

    for (const qRec of quoteList) {
      const rawSym = readStr(qRec, "symbol");
      if (!rawSym || rawSym === "IDR=X") continue;
      const cleanTicker = rawSym.replace(/\.JK$/i, "").toUpperCase();
      const stockMeta = STOCKS_DATA.find((s) => s.ticker === cleanTicker);

      const price = readPositiveNum(qRec, "regularMarketPrice") ?? 0;
      const change = readNum(qRec, "regularMarketChange") ?? 0;
      const changePercent = readNum(qRec, "regularMarketChangePercent") ?? 0;
      const prevClose = readPositiveNum(qRec, "regularMarketPreviousClose") ?? price - change;

      if (price > 0) {
        const financialCurrency = readStr(qRec, "financialCurrency");
        const eps = readPositiveNum(qRec, "epsTrailingTwelveMonths");
        const rawPe = readPositiveNum(qRec, "trailingPE");
        const peRatio = rawPe ?? (eps ? price / eps : undefined);

        const rawBv = readPositiveNum(qRec, "bookValue");
        const rawPbv = readPositiveNum(qRec, "priceToBook");

        let bvps: number | undefined;
        let pbvRatio: number | undefined;

        if (financialCurrency && financialCurrency !== "IDR") {
          if (financialCurrency === "USD" && activeUsdIdrRate > 0 && rawBv) {
            bvps = rawBv * activeUsdIdrRate;
            pbvRatio = price / bvps;
          }
        } else {
          if (rawBv) {
            bvps = rawBv;
          }
          if (rawPbv && rawPbv < 100) {
            pbvRatio = rawPbv;
          } else if (bvps) {
            const computedPbv = price / bvps;
            if (computedPbv < 100) pbvRatio = computedPbv;
          }
        }

        if (pbvRatio !== undefined && (pbvRatio <= 0 || pbvRatio > 100)) {
          pbvRatio = undefined;
          bvps = undefined;
        }

        const rawDivYield = readNum(qRec, "dividendYield");
        const dividendYield =
          rawDivYield !== undefined && rawDivYield >= 0 && rawDivYield < 100
            ? rawDivYield
            : undefined;

        const rawMcap = readPositiveNum(qRec, "marketCap");
        const marketCapTrillion = rawMcap ? rawMcap / 1e12 : undefined;

        const item: ServerQuoteItem = {
          ticker: cleanTicker,
          name: readStr(qRec, "shortName") || readStr(qRec, "longName") || stockMeta?.name || cleanTicker,
          price,
          change,
          changePercent,
          previousClose: prevClose,
          lastUpdated: marketStatus.formattedTime,
          marketState: marketStatus.isOpen ? "OPEN" : "CLOSED",
          isFallback: false,
          peRatio,
          pbvRatio,
          eps,
          bvps,
          dividendYield,
          marketCapTrillion,
          financialCurrency,
        };
        quotesCache.set(cleanTicker, { data: item, cachedAt: now });
        result[cleanTicker] = item;
      }
    }
  } catch (error) {
    console.error("[MarketServer] Failed to fetch quotes from Yahoo Finance:", error);
  }

  for (const ticker of tickersToFetch) {
    if (!result[ticker]) {
      const cached = quotesCache.get(ticker);
      if (cached) {
        result[ticker] = cached.data;
      } else {
        const illus = getIllustrativeQuote(ticker);
        if (illus) {
          result[ticker] = illus;
        }
      }
    }
  }

  return result;
}

const MACRO_SYMBOL_DEFS = [
  { yahooSymbol: "^JKSE", displaySymbol: "IHSG", name: "Indeks Harga Saham Gabungan", format: "decimal2" },
  { yahooSymbol: "IDR=X", displaySymbol: "USD/IDR", name: "Kurs Dolar AS / Rupiah", format: "integer" },
  { yahooSymbol: "BZ=F", displaySymbol: "BRENT", name: "Minyak Mentah Brent (USD/bbl)", format: "usd2_bbl" },
  { yahooSymbol: "MTF=F", displaySymbol: "COAL", name: "Batu Bara API2 (USD/t)", format: "usd2_ton" },
  { yahooSymbol: "GC=F", displaySymbol: "GOLD", name: "Emas Dunia COMEX (USD/oz)", format: "usd2_oz" },
  { yahooSymbol: "^GSPC", displaySymbol: "S&P 500", name: "Indeks S&P 500 Amerika Serikat", format: "decimal2" },
] as const;

function formatMacroValue(price: number, formatType: (typeof MACRO_SYMBOL_DEFS)[number]["format"]): string {
  switch (formatType) {
    case "integer":
      return formatNumber(price);
    case "usd2_bbl":
      return `$${formatDesimal(price, 2)}/bbl`;
    case "usd2_ton":
      return `$${formatDesimal(price, 2)}/t`;
    case "usd2_oz":
      return `$${formatDesimal(price, 2)}/oz`;
    case "decimal2":
    default:
      return formatDesimal(price, 2);
  }
}

/**
 * Mengambil daftar indikator makro & pasar global langsung dari Yahoo Finance.
 */
export async function getMacroTickersServer(): Promise<{
  tickers: MarketTickerItem[];
  isFallback: boolean;
}> {
  const now = Date.now();
  if (macroCache && now - macroCache.cachedAt < MACRO_CACHE_TTL_MS && macroCache.data.length > 0) {
    return { tickers: macroCache.data, isFallback: false };
  }

  if (!checkRateLimit()) {
    console.warn("[MarketServer] Rate limit reached on macro tickers");
    return macroCache && macroCache.data.length > 0
      ? { tickers: macroCache.data, isFallback: false }
      : { tickers: [], isFallback: true };
  }

  try {
    const symbolsKey = MACRO_SYMBOL_DEFS.map((m) => m.yahooSymbol).sort().join(",");
    const quoteList = await fetchYahooQuotesCached(symbolsKey);

    const bySymbol = new Map<string, Record<string, unknown>>();
    for (const qRec of quoteList) {
      const sym = readStr(qRec, "symbol");
      if (sym) {
        bySymbol.set(sym, qRec);
      }
    }

    const items: MarketTickerItem[] = [];
    for (const def of MACRO_SYMBOL_DEFS) {
      const qRec = bySymbol.get(def.yahooSymbol);
      if (!qRec) continue;

      const price = readPositiveNum(qRec, "regularMarketPrice");
      if (!price) continue;

      if (def.yahooSymbol === "IDR=X") {
        usdIdrCache = { data: price, cachedAt: now };
      }

      const change = readNum(qRec, "regularMarketChangePercent") ?? 0;
      items.push({
        symbol: def.displaySymbol,
        name: def.name,
        value: formatMacroValue(price, def.format),
        change,
        isPositive: change >= 0,
        isFallback: false,
      });
    }

    if (items.length === 0) {
      throw new Error("No macro quotes parsed from Yahoo Finance");
    }

    macroCache = { data: items, cachedAt: now };
    return { tickers: items, isFallback: false };
  } catch (error) {
    console.error("[MarketServer] Failed to fetch macro tickers from Yahoo Finance:", error);
    return { tickers: [], isFallback: true };
  }
}

/**
 * Mengambil riwayat harga harian/mingguan dan dividen dari Yahoo Finance.
 */
export async function getHistoryServer(
  ticker: string,
  rawRange: string = "Semua"
): Promise<{ points: ServerHistoryPoint[]; isFallback: boolean }> {
  const range = normalizeHistoryRange(rawRange, "Semua");
  const todayWib = toWibDateString(new Date());
  const cacheKey = `${ticker}_${range}_${todayWib}`;
  const now = Date.now();
  const cached = historyCache.get(cacheKey);

  for (const [key, entry] of historyCache.entries()) {
    if (entry.wibDate && entry.wibDate !== todayWib) {
      historyCache.delete(key);
    }
  }

  if (cached && cached.wibDate === todayWib && now - cached.cachedAt < HISTORY_CACHE_TTL_MS) {
    return { points: cached.data, isFallback: false };
  }

  if (!checkRateLimit()) {
    console.warn("[MarketServer] Rate limit reached on history, return empty without mixing illustrative");
    return { points: [], isFallback: true };
  }

  const today = new Date();
  let startDate = new Date();
  let interval: "1d" | "1wk" = "1d";

  if (range === "1Bl") {
    startDate.setMonth(today.getMonth() - 1);
  } else if (range === "3Bl") {
    startDate.setMonth(today.getMonth() - 3);
  } else if (range === "6Bl") {
    startDate.setMonth(today.getMonth() - 6);
  } else if (range === "1Th") {
    startDate.setFullYear(today.getFullYear() - 1);
  } else if (range === "3Th") {
    startDate.setFullYear(today.getFullYear() - 3);
  } else if (range === "5Th") {
    startDate.setFullYear(today.getFullYear() - 5);
    interval = "1wk";
  } else {
    startDate = new Date("2000-01-01");
    interval = "1wk";
  }

  const period1 = startDate.toISOString().split("T")[0];

  try {
    const symbol = ticker === "IHSG" ? "^JKSE" : `${ticker}.JK`;
    const includeDividends = ticker !== "IHSG";
    const chartResult = await fetchYahooChartCached(
      symbol,
      period1,
      interval,
      includeDividends,
      todayWib
    );

    const dividendMap = new Map<string, number>();
    const dividendList: { date: string; amount: number }[] = [];
    for (const div of chartResult.dividends) {
      const divDate = toWibDateString(new Date(div.date));
      if (interval === "1d") {
        dividendMap.set(divDate, div.amount);
      } else {
        dividendList.push({ date: divDate, amount: div.amount });
      }
    }

    const points: ServerHistoryPoint[] = [];
    for (const q of chartResult.quotes) {
      const closeVal = readNum(q, "close");
      if (closeVal === undefined || isNaN(closeVal)) continue;

      const rawDate = q.date;
      if (typeof rawDate !== "string" && !(rawDate instanceof Date)) continue;
      const timeStr = toWibDateString(new Date(rawDate));
      const divAmount = interval === "1d" ? dividendMap.get(timeStr) : undefined;

      points.push({
        time: timeStr,
        open: readNum(q, "open") ?? closeVal,
        high: readNum(q, "high") ?? closeVal,
        low: readNum(q, "low") ?? closeVal,
        close: closeVal,
        volume: readNum(q, "volume") ?? 0,
        dividend: divAmount,
      });
    }

    if (points.length === 0) {
      throw new Error("Parsed points length is 0");
    }

    if (interval === "1wk" && dividendList.length > 0) {
      for (const div of dividendList) {
        let matchedBar: ServerHistoryPoint | null = null;
        for (let i = points.length - 1; i >= 0; i--) {
          if (points[i].time <= div.date) {
            matchedBar = points[i];
            break;
          }
        }
        if (matchedBar) {
          matchedBar.dividend = (matchedBar.dividend || 0) + div.amount;
        }
      }
    }

    const latestPrice = chartResult.metaPrice;
    const metaMarketTime = chartResult.metaTime ? new Date(chartResult.metaTime) : null;

    if (latestPrice && points.length > 0 && metaMarketTime) {
      const quoteDateWib = toWibDateString(metaMarketTime);
      const lastPoint = points[points.length - 1];

      if (quoteDateWib > lastPoint.time) {
        points.push({
          time: quoteDateWib,
          open: latestPrice,
          high: latestPrice,
          low: latestPrice,
          close: latestPrice,
          volume: 0,
        });
      } else if (quoteDateWib === lastPoint.time) {
        lastPoint.close = latestPrice;
        if (lastPoint.high < latestPrice) lastPoint.high = latestPrice;
        if (lastPoint.low > latestPrice) lastPoint.low = latestPrice;
      }
    }

    historyCache.set(cacheKey, { data: points, cachedAt: now, wibDate: todayWib });
    return { points, isFallback: false };
  } catch (error) {
    console.error(`[MarketServer] Failed to fetch history for ${ticker} from Yahoo:`, error);
    return { points: [], isFallback: true };
  }
}

/**
 * Pencarian emiten IDX (menggabungkan 9 watchlist kurasi + pencarian .JK via Yahoo Search / direct ticker lookup).
 */
export async function searchIdxStocksServer(
  rawQuery: string,
  provider: string
): Promise<ServerStockSearchItem[]> {
  const q = rawQuery.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const upper = q.toUpperCase();

  const curatedMatches: ServerStockSearchItem[] = STOCKS_DATA.filter(
    (s) =>
      s.ticker.toLowerCase().includes(lower) ||
      s.name.toLowerCase().includes(lower) ||
      s.sector.toLowerCase().includes(lower)
  ).map((s) => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    isDefaultWatchlist: true,
  }));

  if (provider !== "yahoo") {
    return curatedMatches;
  }

  const seen = new Set(curatedMatches.map((m) => m.ticker));
  const combined = [...curatedMatches];

  try {
    const yahooItems = await fetchYahooSearchCached(q);
    for (const item of yahooItems) {
      if (!seen.has(item.symbol)) {
        seen.add(item.symbol);
        combined.push({
          ticker: item.symbol,
          name: item.name,
          sector: item.sector,
          isDefaultWatchlist: false,
        });
      }
    }

    // Jika pengguna mengetik kode 4 huruf persis dan belum muncul di search, verifikasi langsung via yf.quote
    if (isValidIdxTickerFormat(upper) && !seen.has(upper)) {
      const directQuotes = await getBatchQuotesServer([upper]);
      const match = directQuotes[upper];
      if (match && !match.isFallback) {
        combined.unshift({
          ticker: match.ticker,
          name: match.name,
          isDefaultWatchlist: false,
        });
      }
    }
  } catch (error) {
    console.warn(`[MarketServer] Search failed for "${q}":`, error);
  }

  return combined.slice(0, 12);
}

/**
 * Mengambil profil & metrik emiten untuk 9 saham kurasi maupun saham IDX kustom.
 */
export async function getStockProfileServer(
  rawTicker: string,
  provider: string
): Promise<ServerStockProfile | null> {
  const ticker = rawTicker.trim().toUpperCase();
  const curated = STOCKS_DATA.find((s) => s.ticker === ticker);

  if (curated) {
    if (provider !== "yahoo") {
      return {
        ticker: curated.ticker,
        name: curated.name,
        sector: curated.sector,
        subsector: curated.subsector,
        hasCuratedBands: true,
        isLive: false,
        currentPrice: curated.currentPrice,
        changePercent: curated.change1D,
        peRatio: curated.peRatio,
        pbvRatio: curated.pbvRatio,
        eps: curated.currentPrice / curated.peRatio,
        bvps: curated.currentPrice / curated.pbvRatio,
        dividendYield: curated.dividendYield,
        marketCapTrillion: curated.marketCapTrillion,
        financialCurrency: "IDR",
        roe: curated.roe,
        der: curated.der,
        payoutRatio: curated.payoutRatio,
        historicalPeMean: curated.historicalPeMean,
        peSd1Plus: curated.peSd1Plus,
        peSd1Minus: curated.peSd1Minus,
        peSd2Plus: curated.peSd2Plus,
        peSd2Minus: curated.peSd2Minus,
        description: curated.description,
        strengths: curated.strengths,
        risks: curated.risks,
      };
    }

    const quotes = await getBatchQuotesServer([ticker]);
    const q = quotes[ticker];
    const isLive = Boolean(q && !q.isFallback);

    return {
      ticker: curated.ticker,
      name: curated.name,
      sector: curated.sector,
      subsector: curated.subsector,
      hasCuratedBands: true,
      isLive,
      currentPrice: q?.price ?? curated.currentPrice,
      changePercent: q?.changePercent ?? curated.change1D,
      peRatio: isLive && q?.peRatio ? q.peRatio : curated.peRatio,
      pbvRatio: isLive && q?.pbvRatio ? q.pbvRatio : curated.pbvRatio,
      eps: isLive && q?.eps ? q.eps : curated.currentPrice / curated.peRatio,
      bvps: isLive && q?.bvps ? q.bvps : curated.currentPrice / curated.pbvRatio,
      dividendYield:
        isLive && q?.dividendYield !== undefined ? q.dividendYield : curated.dividendYield,
      marketCapTrillion:
        isLive && q?.marketCapTrillion ? q.marketCapTrillion : curated.marketCapTrillion,
      financialCurrency: q?.financialCurrency ?? "IDR",
      roe: curated.roe,
      der: curated.der,
      payoutRatio: curated.payoutRatio,
      historicalPeMean: curated.historicalPeMean,
      peSd1Plus: curated.peSd1Plus,
      peSd1Minus: curated.peSd1Minus,
      peSd2Plus: curated.peSd2Plus,
      peSd2Minus: curated.peSd2Minus,
      description: curated.description,
      strengths: curated.strengths,
      risks: curated.risks,
    };
  }

  // Emiten kustom di luar 9 saham kurasi: wajib valid format 4 huruf dan mode Yahoo aktif
  if (provider !== "yahoo" || !isValidIdxTickerFormat(ticker)) {
    return null;
  }

  const [quotesRes, profileRes] = await Promise.allSettled([
    getBatchQuotesServer([ticker]),
    fetchYahooProfileCached(`${ticker}.JK`),
  ]);

  const quoteMap = quotesRes.status === "fulfilled" ? quotesRes.value : {};
  const q = quoteMap[ticker];
  if (!q || q.isFallback || q.price <= 0) {
    return null;
  }

  const profileMeta = profileRes.status === "fulfilled" ? profileRes.value : {};

  return {
    ticker: q.ticker,
    name: q.name,
    sector: profileMeta.sector || "Bursa Efek Indonesia",
    subsector: profileMeta.industry || "Saham Tercatat BEI",
    hasCuratedBands: false,
    isLive: true,
    currentPrice: q.price,
    changePercent: q.changePercent,
    peRatio: q.peRatio,
    pbvRatio: q.pbvRatio,
    eps: q.eps,
    bvps: q.bvps,
    dividendYield: q.dividendYield,
    marketCapTrillion: q.marketCapTrillion,
    financialCurrency: q.financialCurrency,
    roe: profileMeta.roe,
    der: profileMeta.der,
    description:
      profileMeta.description ||
      `Profil emiten ${q.name} (${q.ticker}.JK) pada Bursa Efek Indonesia melalui Yahoo Finance.`,
    strengths: [],
    risks: [],
  };
}
