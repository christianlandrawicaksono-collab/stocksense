/**
 * Server-side cache, rate limiter, and Yahoo Finance fetcher.
 * Digunakan hanya di server (Next.js route handlers) - TIDAK diimpor di komponen klien.
 */

import YahooFinance from "yahoo-finance2";
import { STOCKS_DATA, HISTORICAL_SERIES } from "@/data/stocksData";
import { MarketTickerItem } from "@/types/market";
import { getIdxMarketStatus } from "./market-hours";
import { formatDesimal, formatNumber } from "./format";

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

const QUOTE_CACHE_TTL_MS = 60 * 1000; // 60 detik untuk quote harga
const HISTORY_CACHE_TTL_MS = 60 * 1000; // 60 detik untuk riwayat harian (TTL pendek, tidak bertahan lintas hari)
const MACRO_CACHE_TTL_MS = 60 * 1000; // 60 detik untuk indikator makro

// Global in-memory cache
const quotesCache = new Map<string, CacheEntry<ServerQuoteItem>>();
const historyCache = new Map<string, CacheEntry<ServerHistoryPoint[]>>();
let macroCache: CacheEntry<MarketTickerItem[]> | null = null;
let usdIdrCache: CacheEntry<number> | null = null;

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
 * Mengambil harga terakhir dan metrik valuasi untuk banyak kode saham sekaligus.
 * Menggunakan batch call `yf.quote` (+ kurs IDR=X untuk konversi PBV laporan USD) untuk menghemat jaringan.
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
    const needUsdIdr = !usdIdrCache || now - usdIdrCache.cachedAt >= QUOTE_CACHE_TTL_MS;
    if (needUsdIdr) {
      symbols.push("IDR=X");
    }

    const quotes = await yf.quote(symbols);
    const quoteList = Array.isArray(quotes) ? quotes : [quotes];

    // Ekstrak kurs USD/IDR terbaru untuk normalisasi emiten ber-laporan keuangan USD (mis. ADRO, MEDC)
    let activeUsdIdrRate = usdIdrCache?.data ?? 0;
    for (const quote of quoteList) {
      if (quote && quote.symbol === "IDR=X") {
        const rate = readPositiveNum(quote as unknown as Record<string, unknown>, "regularMarketPrice");
        if (rate) {
          activeUsdIdrRate = rate;
          usdIdrCache = { data: rate, cachedAt: now };
        }
      }
    }

    for (const quote of quoteList) {
      if (!quote || !quote.symbol || quote.symbol === "IDR=X") continue;
      const cleanTicker = quote.symbol.replace(/\.JK$/i, "").toUpperCase();
      const stockMeta = STOCKS_DATA.find((s) => s.ticker === cleanTicker);
      const qRec = quote as unknown as Record<string, unknown>;

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
          // Emiten melapor dalam USD -> konversi nilai buku ke IDR memakai kurs IDR=X
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
          name: quote.shortName || quote.longName || stockMeta?.name || cleanTicker,
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
 * Tidak mencampur data statis ilustrasi: jika gagal, kembalikan array kosong + isFallback: true.
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
    const symbols = MACRO_SYMBOL_DEFS.map((m) => m.yahooSymbol);
    const quotes = await yf.quote(symbols);
    const quoteList = Array.isArray(quotes) ? quotes : [quotes];

    const bySymbol = new Map<string, Record<string, unknown>>();
    for (const q of quoteList) {
      if (q && q.symbol) {
        bySymbol.set(q.symbol, q as unknown as Record<string, unknown>);
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
 * Mengambil riwayat harga harian dan dividen dari Yahoo Finance.
 */
export async function getHistoryServer(
  ticker: string,
  range: string = "Semua"
): Promise<{ points: ServerHistoryPoint[]; isFallback: boolean }> {
  const todayWib = toWibDateString(new Date());
  const cacheKey = `${ticker}_${range}_${todayWib}`;
  const now = Date.now();
  const cached = historyCache.get(cacheKey);

  // Bersihkan entri cache yang sudah kedaluwarsa lintas hari (bukan hari ini)
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

  // Hitung period1 dan interval adaptif berdasarkan rentang waktu:
  // - 1Th & 3Th: interval harian ("1d") untuk detail pergerakan harian
  // - 5Th & Semua: interval mingguan ("1wk") agar payload ringan (~100KB vs >600KB), cepat, dan andal
  const today = new Date();
  let startDate = new Date();
  let interval: "1d" | "1wk" = "1d";

  if (range === "1Th") {
    startDate.setFullYear(today.getFullYear() - 1);
  } else if (range === "3Th") {
    startDate.setFullYear(today.getFullYear() - 3);
  } else if (range === "5Th") {
    startDate.setFullYear(today.getFullYear() - 5);
    interval = "1wk";
  } else {
    // Semua: ambil riwayat maksimum sejak 2000 dengan interval mingguan
    startDate = new Date("2000-01-01");
    interval = "1wk";
  }

  const period1 = startDate.toISOString().split("T")[0];

  try {
    const symbol = `${ticker}.JK`;
    const chartResult = await yf.chart(symbol, {
      period1,
      interval,
      events: "div",
    });

    if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
      throw new Error(`No chart data returned for ${symbol}`);
    }

    // Peta dividen berdasarkan tanggal (YYYY-MM-DD dalam zona waktu WIB)
    const dividendMap = new Map<string, number>();
    const dividendList: { date: string; amount: number }[] = [];
    if (chartResult.events && chartResult.events.dividends) {
      for (const div of chartResult.events.dividends) {
        const divDate = toWibDateString(new Date(div.date));
        if (interval === "1d") {
          dividendMap.set(divDate, div.amount);
        } else {
          dividendList.push({ date: divDate, amount: div.amount });
        }
      }
    }

    // Ekstrak data yang valid (gunakan Close Asli / unadjusted close untuk grafik harga nominal bursa)
    const points: ServerHistoryPoint[] = [];
    for (const q of chartResult.quotes) {
      if (typeof q.close !== "number" || isNaN(q.close)) continue;
      const timeStr = toWibDateString(new Date(q.date));
      const divAmount = interval === "1d" ? dividendMap.get(timeStr) : undefined;

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

    // Untuk interval mingguan (1wk): petakan dividen ke bar mingguan yang memuat tanggal dividen
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

    // Periksa apakah harga live dari quote lebih baru daripada bar riwayat harian terakhir.
    // JANGAN pernah menimpa bar riwayat hari sebelumnya dengan harga live.
    // Jika harga live lebih baru daripada bar terakhir, tambahkan sebagai titik baru bertanggal hari ini (WIB).
    // Jika bar terakhir sudah bertanggal sama dengan hari ini (intraday), update harga sesi hari ini.
    const latestPrice =
      typeof chartResult.meta?.regularMarketPrice === "number" && chartResult.meta.regularMarketPrice > 0
        ? chartResult.meta.regularMarketPrice
        : null;
    const metaMarketTime = chartResult.meta?.regularMarketTime
      ? new Date(chartResult.meta.regularMarketTime)
      : null;

    if (latestPrice && points.length > 0 && metaMarketTime) {
      const quoteDateWib = toWibDateString(metaMarketTime);
      const lastPoint = points[points.length - 1];

      if (quoteDateWib > lastPoint.time) {
        // Tanggal quote lebih baru daripada bar terakhir -> tambahkan titik baru hari ini (WIB)
        points.push({
          time: quoteDateWib,
          open: latestPrice,
          high: latestPrice,
          low: latestPrice,
          close: latestPrice,
          volume: 0,
        });
      } else if (quoteDateWib === lastPoint.time) {
        // Bar terakhir adalah bar hari ini (intraday) -> update harga close tick hari ini
        lastPoint.close = latestPrice;
        if (lastPoint.high < latestPrice) lastPoint.high = latestPrice;
        if (lastPoint.low > latestPrice) lastPoint.low = latestPrice;
      }
    }

    // Simpan ke cache dengan stempel waktu dan tanggal WIB
    historyCache.set(cacheKey, { data: points, cachedAt: now, wibDate: todayWib });
    return { points, isFallback: false };
  } catch (error) {
    console.error(`[MarketServer] Failed to fetch history for ${ticker} from Yahoo:`, error);
    return { points: [], isFallback: true };
  }
}
