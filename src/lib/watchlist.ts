export const CUSTOM_WATCHLIST_STORAGE_KEY = "stocksense:custom-watchlist:v1";
export const MAX_CUSTOM_WATCHLIST = 15;
export const MAX_NEWS_WATCHLIST_ENRICHMENT = 5;

export type WatchlistFilterPreset =
  | "ALL"
  | "DIVIDEND"
  | "UNDERVALUED"
  | "PROFITABLE"
  | "LOW_DEBT";

export function matchesWatchlistFilterPreset(
  stock: {
    dividendYield: number;
    peRatio: number;
    roe?: number;
    der?: number;
  },
  preset: WatchlistFilterPreset
): boolean {
  if (preset === "DIVIDEND") return stock.dividendYield >= 5.0;
  if (preset === "UNDERVALUED") return stock.peRatio > 0 && stock.peRatio <= 12.0;
  if (preset === "PROFITABLE") return stock.roe !== undefined && stock.roe >= 18.0;
  if (preset === "LOW_DEBT") return stock.der !== undefined && stock.der >= 0 && stock.der <= 1.0;
  return true;
}

const WATCHLIST_TICKER_RE = /^[A-Z]{4}$/;

/**
 * Normalizes and validates an Indonesian stock ticker (exactly 4 uppercase letters).
 */
export function normalizeIdxTicker(raw: string): string | null {
  const clean = raw.trim().toUpperCase();
  return WATCHLIST_TICKER_RE.test(clean) ? clean : null;
}

/**
 * Deduplicates and caps an arbitrary ticker array into valid IDX 4-letter codes.
 */
export function sanitizeWatchlistTickers(
  tickers: unknown,
  maxItems: number = MAX_CUSTOM_WATCHLIST
): string[] {
  if (!Array.isArray(tickers) || maxItems <= 0) return [];
  const res: string[] = [];
  const seen = new Set<string>();

  for (const raw of tickers) {
    if (typeof raw !== "string") continue;
    const clean = normalizeIdxTicker(raw);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    res.push(clean);
    if (res.length >= maxItems) break;
  }

  return res;
}

export function parseWatchlistJson(rawJson: string | null | undefined): string[] {
  if (!rawJson) return [];
  try {
    return sanitizeWatchlistTickers(JSON.parse(rawJson), MAX_CUSTOM_WATCHLIST);
  } catch {
    return [];
  }
}

export function addTickerToWatchlist(current: string[], rawTicker: string): string[] {
  const clean = normalizeIdxTicker(rawTicker);
  if (!clean) return current;
  if (current.includes(clean)) return current;
  if (current.length >= MAX_CUSTOM_WATCHLIST) return current;
  return [clean, ...current];
}

export function removeTickerFromWatchlist(current: string[], rawTicker: string): string[] {
  const clean = normalizeIdxTicker(rawTicker);
  if (!clean) return current;
  if (!current.includes(clean)) return current;
  return current.filter((t) => t !== clean);
}

export function toggleTickerInWatchlist(current: string[], rawTicker: string): string[] {
  const clean = normalizeIdxTicker(rawTicker);
  if (!clean) return current;
  if (current.includes(clean)) {
    return removeTickerFromWatchlist(current, clean);
  }
  return addTickerToWatchlist(current, clean);
}

// --- Client-side localStorage store compatible with React useSyncExternalStore ---
const watchlistListeners = new Set<() => void>();

function notifyWatchlistListeners() {
  for (const listener of watchlistListeners) {
    listener();
  }
}

export function readWatchlistStorageSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(CUSTOM_WATCHLIST_STORAGE_KEY) || "[]";
  } catch {
    return "[]";
  }
}

export function getWatchlistServerSnapshot(): string {
  return "[]";
}

export function subscribeWatchlistStorage(listener: () => void): () => void {
  watchlistListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CUSTOM_WATCHLIST_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    watchlistListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function writeCustomWatchlistStorage(tickers: string[]): string[] {
  const sanitized = sanitizeWatchlistTickers(tickers, MAX_CUSTOM_WATCHLIST);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_WATCHLIST_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage quota or private-mode access errors
    }
  }
  notifyWatchlistListeners();
  return sanitized;
}
