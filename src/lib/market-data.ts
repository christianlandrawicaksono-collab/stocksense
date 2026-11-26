/**
 * Lapisan Data Pasar Tunggal (Unified Market Data Layer).
 * Komponen antarmuka (Watchlist, Chart, Header) hanya memanggil modul ini,
 * tidak memanggil penyedia pihak ketiga secara langsung.
 *
 * Provider:
 * - "illustrative" : Data statis dari stocksData.ts (default)
 * - "yahoo"        : Data live tertunda ~10 menit via route handler server /api/quotes & /api/history
 */

import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";
import { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";
import { getIdxMarketStatus, MarketStatus } from "./market-hours";
import { MAX_NEWS_WATCHLIST_ENRICHMENT, sanitizeWatchlistTickers } from "./watchlist";

export type MarketProvider = "illustrative" | "yahoo";
export const HISTORY_RANGES = ["1Bl", "3Bl", "6Bl", "1Th", "3Th", "5Th", "Semua"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export function normalizeHistoryRange(
  raw: string | null | undefined,
  fallback: HistoryRange = "Semua"
): HistoryRange {
  if (!raw) return fallback;
  return (HISTORY_RANGES as readonly string[]).includes(raw)
    ? (raw as HistoryRange)
    : fallback;
}

export function sliceIllustrativeSeries<T>(raw: T[], range: HistoryRange): T[] {
  if (range === "1Bl" || range === "3Bl" || range === "6Bl") return raw.slice(-4);
  if (range === "1Th") return raw.slice(-5);
  if (range === "3Th") return raw.slice(-13);
  if (range === "5Th") return raw.slice(-21);
  return raw;
}

export interface MarketQuote {
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

export interface MarketHistoryPoint {
  time: string; // Format "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dividend?: number;
}

export interface QuotesResponse {
  provider: MarketProvider;
  marketStatus: MarketStatus;
  quotes: Record<string, MarketQuote>;
  timestamp: string;
}

export interface MacroResponse {
  provider: MarketProvider;
  tickers: MarketTickerItem[];
  isFallback: boolean;
  marketStatus: MarketStatus;
  timestamp: string;
}

export interface StockSearchItem {
  ticker: string;
  name: string;
  sector?: string;
  isDefaultWatchlist: boolean;
}

export interface StockProfileData {
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

export interface HistoryResponse {
  provider: MarketProvider;
  ticker: string;
  range: HistoryRange;
  points: MarketHistoryPoint[];
  isFallback: boolean;
  marketStatus: MarketStatus;
  timestamp: string;
}

/**
 * Mendapatkan konfigurasi provider saat ini dari env publik (konsisten antara SSR dan Client hydration)
 */
export function getActiveMarketProvider(): MarketProvider {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_MARKET_DATA_PROVIDER === "yahoo") {
      return "yahoo";
    }
  }
  return "illustrative";
}

/**
 * Data ilustrasi sinkron (fallback & offline)
 */
export function getIllustrativeQuotesMap(tickers?: string[]): Record<string, MarketQuote> {
  const result: Record<string, MarketQuote> = {};
  const status = getIdxMarketStatus();
  const list = STOCKS_DATA.filter((s) => !tickers || tickers.includes(s.ticker));

  for (const s of list) {
    const eps = s.peRatio > 0 ? s.currentPrice / s.peRatio : undefined;
    const bvps = s.pbvRatio > 0 ? s.currentPrice / s.pbvRatio : undefined;
    result[s.ticker] = {
      ticker: s.ticker,
      name: s.name,
      price: s.currentPrice,
      change: Math.round((s.currentPrice * s.change1D) / 100),
      changePercent: s.change1D,
      previousClose: Math.round(s.currentPrice / (1 + s.change1D / 100)),
      lastUpdated: status.formattedTime,
      marketState: status.isOpen ? "OPEN" : "CLOSED",
      isFallback: true,
      peRatio: s.peRatio,
      pbvRatio: s.pbvRatio,
      eps,
      bvps,
      dividendYield: s.dividendYield,
      marketCapTrillion: s.marketCapTrillion,
      financialCurrency: "IDR",
    };
  }
  return result;
}

export function getIllustrativeHistoryPoints(
  ticker: string,
  range: HistoryRange = "Semua"
): MarketHistoryPoint[] {
  const raw = ticker === "IHSG" ? IHSG_HISTORICAL : HISTORICAL_SERIES[ticker] || [];
  const sliced = sliceIllustrativeSeries(raw, range);

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

/**
 * Mengambil harga terakhir (batch quotes) untuk daftar ticker
 */
export async function getQuotes(tickers?: string[]): Promise<QuotesResponse> {
  const query = tickers && tickers.length > 0 ? `?tickers=${tickers.join(",")}` : "";

  try {
    const res = await fetch(`/api/quotes${query}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data: QuotesResponse = await res.json();
    return data;
  } catch (error) {
    console.warn("[market-data] getQuotes fetch failed, falling back to illustrative:", error);
    return {
      provider: "illustrative",
      marketStatus: getIdxMarketStatus(),
      quotes: getIllustrativeQuotesMap(tickers),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Mengambil indikator makro & indeks pasar global dari server
 */
export async function getMacroTickers(): Promise<MacroResponse> {
  try {
    const res = await fetch("/api/macro", {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data: MacroResponse = await res.json();
    return data;
  } catch (error) {
    console.warn("[market-data] getMacroTickers fetch failed:", error);
    const isYahooMode = process.env.NEXT_PUBLIC_MARKET_DATA_PROVIDER === "yahoo";

    if (isYahooMode) {
      return {
        provider: "yahoo",
        tickers: [],
        isFallback: true,
        marketStatus: getIdxMarketStatus(),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      provider: "illustrative",
      tickers: LIVE_MARKET_TICKERS,
      isFallback: true,
      marketStatus: getIdxMarketStatus(),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Mengambil riwayat harga dan dividen untuk satu ticker
 */
export async function getHistory(
  ticker: string,
  range: HistoryRange = "Semua"
): Promise<HistoryResponse> {
  try {
    const res = await fetch(`/api/history/${ticker}?range=${range}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data: HistoryResponse = await res.json();
    return data;
  } catch (error) {
    console.warn(`[market-data] getHistory(${ticker}) failed:`, error);
    const isYahooMode = process.env.NEXT_PUBLIC_MARKET_DATA_PROVIDER === "yahoo";

    if (isYahooMode) {
      return {
        provider: "yahoo",
        ticker,
        range,
        points: [],
        isFallback: true,
        marketStatus: getIdxMarketStatus(),
        timestamp: new Date().toISOString(),
      };
    }

    return {
      provider: "illustrative",
      ticker,
      range,
      points: getIllustrativeHistoryPoints(ticker, range),
      isFallback: true,
      marketStatus: getIdxMarketStatus(),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Mencari saham IDX (.JK) berdasarkan kode atau nama emiten
 */
export async function searchStocks(query: string): Promise<StockSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: StockSearchItem[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/**
 * Mengambil profil & metrik valuasi lengkap untuk emiten kurasi maupun kustom IDX
 */
export async function getStockProfile(ticker: string): Promise<StockProfileData | null> {
  try {
    const res = await fetch(`/api/stocks/${encodeURIComponent(ticker.toUpperCase())}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: StockProfileData };
    return data.profile || null;
  } catch {
    return null;
  }
}

/**
 * Mengambil berita pasar modal Indonesia terkini (RSS CNBC Indonesia, ANTARA Ekonomi & Google News IDX),
 * berita spesifik per emiten apabila parameter ticker diberikan, atau feed gabungan + pengayaan watchlist.
 */
export async function getLiveMarketNews(
  ticker?: string,
  watchlistTickers?: string[]
): Promise<{
  provider: MarketProvider;
  items: LiveMarketNewsItem[];
  isFallback: boolean;
}> {
  try {
    const cleanTicker = ticker?.trim().toUpperCase() || "";
    const cleanWatchlist = watchlistTickers
      ? sanitizeWatchlistTickers(watchlistTickers, MAX_NEWS_WATCHLIST_ENRICHMENT)
      : [];
    const url = cleanTicker
      ? `/api/news?ticker=${encodeURIComponent(cleanTicker)}`
      : cleanWatchlist.length > 0
      ? `/api/news?watchlist=${encodeURIComponent(cleanWatchlist.join(","))}`
      : "/api/news";
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = (await res.json()) as {
      provider?: MarketProvider;
      items?: LiveMarketNewsItem[];
      isFallback?: boolean;
    };
    return {
      provider: data.provider || getActiveMarketProvider(),
      items: Array.isArray(data.items) ? data.items : [],
      isFallback: Boolean(data.isFallback),
    };
  } catch {
    return {
      provider: getActiveMarketProvider(),
      items: [],
      isFallback: true,
    };
  }
}

export interface LiveMarketBriefResponse {
  brief: {
    headline: string;
    summary: string;
    sentimentCounts: { bullish: number; bearish: number; neutral: number };
    dominantCategory: string;
    topTickers: string[];
    source: "deterministic" | "gemini";
    model?: string | null;
  } | null;
  warning?: string;
}

export async function getLiveMarketBriefAi(
  items: LiveMarketNewsItem[],
  macroTickers: MarketTickerItem[],
  customApiKey?: string
): Promise<LiveMarketBriefResponse> {
  try {
    const res = await fetch("/api/news/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.slice(0, 12),
        macroTickers,
        customApiKey: customApiKey?.trim() || undefined,
      }),
    });
    if (!res.ok) {
      return { brief: null, warning: `HTTP ${res.status}` };
    }
    return (await res.json()) as LiveMarketBriefResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { brief: null, warning: msg };
  }
}
