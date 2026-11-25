/**
 * Lapisan Data Pasar Tunggal (Unified Market Data Layer).
 * Komponen antarmuka (Watchlist, Chart, Header) hanya memanggil modul ini,
 * tidak memanggil penyedia pihak ketiga secara langsung.
 *
 * Provider:
 * - "illustrative" : Data statis dari stocksData.ts (default)
 * - "yahoo"        : Data live tertunda ~10 menit via route handler server /api/quotes & /api/history
 */

import { STOCKS_DATA, HISTORICAL_SERIES } from "@/data/stocksData";
import { getIdxMarketStatus, MarketStatus } from "./market-hours";

export type MarketProvider = "illustrative" | "yahoo";
export type HistoryRange = "1Th" | "3Th" | "5Th" | "Semua";

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
 * Mendapatkan konfigurasi provider saat ini dari env
 */
export function getActiveMarketProvider(): MarketProvider {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_MARKET_DATA_PROVIDER === "yahoo" || process.env.MARKET_DATA_PROVIDER === "yahoo") {
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
    };
  }
  return result;
}

export function getIllustrativeHistoryPoints(
  ticker: string,
  range: HistoryRange = "Semua"
): MarketHistoryPoint[] {
  const raw = HISTORICAL_SERIES[ticker] || [];
  let sliced = raw;
  if (range === "1Th") sliced = raw.slice(-5);
  else if (range === "3Th") sliced = raw.slice(-13);
  else if (range === "5Th") sliced = raw.slice(-21);

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
