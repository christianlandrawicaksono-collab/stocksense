/**
 * Server-side cache, rate limiter, and Yahoo Finance fetcher.
 * Digunakan hanya di server (Next.js route handlers) - TIDAK diimpor di komponen klien.
 */

import YahooFinance from "yahoo-finance2";
import { STOCKS_DATA, HISTORICAL_SERIES } from "@/data/stocksData";
import { getIdxMarketStatus } from "./market-hours";

// Inisialisasi YahooFinance instance (singleton per proses server)
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// 9 kode saham IDX yang didukung
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

// ==============================================================================
// In-Memory Server Cache & Simple Rate Limiter
// ==============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const QUOTE_CACHE_TTL_MS = 60 * 1000; // 60 detik untuk quote harga
const HISTORY_CACHE_TTL_MS = 300 * 1000; // 5 menit untuk riwayat harian

// Global in-memory cache
const quotesCache = new Map<string, CacheEntry<ServerQuoteItem>>();
const historyCache = new Map<string, CacheEntry<ServerHistoryPoint[]>>();

// Pembatas laju sederhana: maksimum 60 permintaan server per 60 detik
let requestCountWindow = 0;
let windowStartTime = Date.now();

export function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - windowStartTime > 60000) {
    windowStartTime = now;
    requestCountWindow = 0;
  }
  requestCountWindow++;
  return requestCountWindow <= 60;
}

// ==============================================================================
// Fallback Generator dari Data Ilustrasi
// ==============================================================================

export function getIllustrativeQuote(ticker: string): ServerQuoteItem {
  const stock = STOCKS_DATA.find((s) => s.ticker === ticker) || STOCKS_DATA[0];
  const marketStatus = getIdxMarketStatus();

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
  };
}

export function getIllustrativeHistory(
  ticker: string,
  range: string = "Semua"
): ServerHistoryPoint[] {
  const quarterly = HISTORICAL_SERIES[ticker] || [];
  let sliced = quarterly;
  if (range === "1Th") sliced = quarterly.slice(-5);
  else if (range === "3Th") sliced = quarterly.slice(-13);
  else if (range === "5Th") sliced = quarterly.slice(-21);

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
// Yahoo Finance Fetchers dengan Batching & Error Handling
// ==============================================================================

/**
 * Mengambil harga terakhir dan perubahan hari ini untuk banyak kode saham sekaligus.
 * Menggunakan batch call `yf.quote` untuk menghemat panggilan jaringan.
 */
export async function getBatchQuotesServer(
  tickers: string[]
): Promise<Record<string, ServerQuoteItem>> {
  const result: Record<string, ServerQuoteItem> = {};
  const tickersToFetch: string[] = [];
  const now = Date.now();
  const marketStatus = getIdxMarketStatus();

  // 1. Cek cache in-memory terlebih dahulu
  for (const ticker of tickers) {
    const cached = quotesCache.get(ticker);
    if (cached && now - cached.cachedAt < QUOTE_CACHE_TTL_MS) {
      result[ticker] = cached.data;
    } else {
      tickersToFetch.push(ticker);
    }
  }

  // Jika semua sudah tersedia di cache, langsung kembalikan
  if (tickersToFetch.length === 0) {
    return result;
  }

  // 2. Cek pembatas laju
  if (!checkRateLimit()) {
    console.warn("[MarketServer] Rate limit reached, using cached or illustrative data");
    for (const ticker of tickersToFetch) {
      const cached = quotesCache.get(ticker);
      result[ticker] = cached ? cached.data : getIllustrativeQuote(ticker);
    }
    return result;
  }

  // 3. Panggilan batch ke Yahoo Finance
  try {
    const symbols = tickersToFetch.map((t) => `${t}.JK`);
    const quotes = await yf.quote(symbols);

    // Normalize quotes array
    const quoteList = Array.isArray(quotes) ? quotes : [quotes];

    for (const quote of quoteList) {
      if (!quote || !quote.symbol) continue;
      const cleanTicker = quote.symbol.replace(/\.JK$/i, "").toUpperCase();
      const stockMeta = STOCKS_DATA.find((s) => s.ticker === cleanTicker);

      const price = typeof quote.regularMarketPrice === "number" ? quote.regularMarketPrice : 0;
      const change = typeof quote.regularMarketChange === "number" ? quote.regularMarketChange : 0;
      const changePercent =
        typeof quote.regularMarketChangePercent === "number"
          ? quote.regularMarketChangePercent
          : 0;
      const prevClose =
        typeof quote.regularMarketPreviousClose === "number"
          ? quote.regularMarketPreviousClose
          : price - change;

      if (price > 0) {
        const item: ServerQuoteItem = {
          ticker: cleanTicker,
          name: quote.shortName || quote.longName || stockMeta?.name || cleanTicker,
          price,
          change,
          changePercent,
          previousClose: prevClose,
          lastUpdated: marketStatus.formattedTime,
          marketState: marketStatus.isOpen ? "OPEN" : "CLOSED",
          isFallback: false,
        };
        quotesCache.set(cleanTicker, { data: item, cachedAt: now });
        result[cleanTicker] = item;
      }
    }
  } catch (error) {
    console.error("[MarketServer] Failed to fetch quotes from Yahoo Finance:", error);
  }

  // 4. Fallback jika ada emiten yang gagal diambil dari Yahoo
  for (const ticker of tickersToFetch) {
    if (!result[ticker]) {
      const cached = quotesCache.get(ticker);
      if (cached) {
        result[ticker] = cached.data;
      } else {
        result[ticker] = getIllustrativeQuote(ticker);
      }
    }
  }

  return result;
}

/**
 * Mengambil riwayat harga harian dan dividen dari Yahoo Finance.
 */
export async function getHistoryServer(
  ticker: string,
  range: string = "Semua"
): Promise<{ points: ServerHistoryPoint[]; isFallback: boolean }> {
  const cacheKey = `${ticker}_${range}`;
  const now = Date.now();
  const cached = historyCache.get(cacheKey);

  if (cached && now - cached.cachedAt < HISTORY_CACHE_TTL_MS) {
    return { points: cached.data, isFallback: false };
  }

  if (!checkRateLimit()) {
    console.warn("[MarketServer] Rate limit reached on history, fallback to illustrative");
    return { points: getIllustrativeHistory(ticker, range), isFallback: true };
  }

  // Hitung period1 berdasarkan rentang
  const today = new Date();
  let startDate = new Date();

  if (range === "1Th") {
    startDate.setFullYear(today.getFullYear() - 1);
  } else if (range === "3Th") {
    startDate.setFullYear(today.getFullYear() - 3);
  } else if (range === "5Th") {
    startDate.setFullYear(today.getFullYear() - 5);
  } else {
    // Semua: ambil riwayat maksimum yang tersedia di Yahoo Finance
    startDate = new Date("2000-01-01");
  }

  const period1 = startDate.toISOString().split("T")[0];

  try {
    const symbol = `${ticker}.JK`;
    const chartResult = await yf.chart(symbol, {
      period1,
      interval: "1d",
      events: "div",
    });

    if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
      throw new Error(`No chart data returned for ${symbol}`);
    }

    // Peta dividen berdasarkan tanggal (YYYY-MM-DD)
    const dividendMap = new Map<string, number>();
    if (chartResult.events && chartResult.events.dividends) {
      for (const div of chartResult.events.dividends) {
        const divDate = new Date(div.date).toISOString().split("T")[0];
        dividendMap.set(divDate, div.amount);
      }
    }

    // Ekstrak data harian yang valid (gunakan Close Asli / unadjusted close untuk grafik harga nominal bursa)
    const points: ServerHistoryPoint[] = [];
    for (const q of chartResult.quotes) {
      if (typeof q.close !== "number" || isNaN(q.close)) continue;
      const timeStr = new Date(q.date).toISOString().split("T")[0];
      const divAmount = dividendMap.get(timeStr);

      points.push({
        time: timeStr,
        open: typeof q.open === "number" ? q.open : q.close,
        high: typeof q.high === "number" ? q.high : q.close,
        low: typeof q.low === "number" ? q.low : q.close,
        close: q.close,
        volume: typeof q.volume === "number" ? q.volume : 0,
        dividend: divAmount,
      });
    }

    if (points.length === 0) {
      throw new Error("Parsed points length is 0");
    }

    // Sinkronkan harga titik terakhir dengan regularMarketPrice dari meta Yahoo
    // agar harga pada sumbu kanan grafik PASTI konsisten dengan harga di header
    const latestPrice =
      typeof chartResult.meta?.regularMarketPrice === "number" && chartResult.meta.regularMarketPrice > 0
        ? chartResult.meta.regularMarketPrice
        : null;

    if (latestPrice && points.length > 0) {
      const lastPoint = points[points.length - 1];
      lastPoint.close = latestPrice;
      if (lastPoint.high < latestPrice) lastPoint.high = latestPrice;
      if (lastPoint.low > latestPrice) lastPoint.low = latestPrice;
    }

    // Simpan ke cache
    historyCache.set(cacheKey, { data: points, cachedAt: now });
    return { points, isFallback: false };
  } catch (error) {
    console.error(`[MarketServer] Failed to fetch history for ${ticker} from Yahoo:`, error);
    return { points: getIllustrativeHistory(ticker, range), isFallback: true };
  }
}
