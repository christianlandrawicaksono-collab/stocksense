export const CUSTOM_WATCHLIST_STORAGE_KEY = "stocksense:custom-watchlist:v1";
export const WATCHLIST_NOTES_STORAGE_KEY = "stocksense:watchlist-notes:v1";
export const MAX_CUSTOM_WATCHLIST = 15;
export const MAX_NEWS_WATCHLIST_ENRICHMENT = 5;
export const MAX_WATCHLIST_NOTE_LENGTH = 120;

export interface WatchlistEntryMeta {
  targetBuyPrice?: number;
  note?: string;
}

export type TargetBuyStatusKind = "hit" | "near" | "above" | "none";

export interface TargetBuyEvaluation {
  status: TargetBuyStatusKind;
  diffPercent: number;
}

/**
 * Evaluates current market price against user-defined target buy price.
 * "hit" when currentPrice <= targetBuyPrice; "near" within +5% above target.
 */
export function evaluateTargetBuyStatus(
  currentPrice: number,
  targetBuyPrice?: number
): TargetBuyEvaluation {
  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    !targetBuyPrice ||
    !Number.isFinite(targetBuyPrice) ||
    targetBuyPrice <= 0
  ) {
    return { status: "none", diffPercent: 0 };
  }

  const diffPercent = ((currentPrice - targetBuyPrice) / targetBuyPrice) * 100;
  if (currentPrice <= targetBuyPrice) {
    return { status: "hit", diffPercent };
  }
  if (currentPrice <= targetBuyPrice * 1.05) {
    return { status: "near", diffPercent };
  }
  return { status: "above", diffPercent };
}

export type WatchlistFilterPreset =
  | "ALL"
  | "TARGET_BUY"
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
    targetStatus?: TargetBuyStatusKind;
  },
  preset: WatchlistFilterPreset
): boolean {
  if (preset === "TARGET_BUY") {
    return stock.targetStatus === "hit" || stock.targetStatus === "near";
  }
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

// --- Client-side localStorage store for Watchlist Target Buy Price & Notes ---
export function sanitizeWatchlistNotes(raw: unknown): Record<string, WatchlistEntryMeta> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, WatchlistEntryMeta> = {};

  for (const [rawKey, rawVal] of Object.entries(raw as Record<string, unknown>)) {
    const ticker = normalizeIdxTicker(rawKey);
    if (!ticker || !rawVal || typeof rawVal !== "object" || Array.isArray(rawVal)) continue;

    const entry = rawVal as Record<string, unknown>;
    const rawPrice = entry.targetBuyPrice;
    const targetBuyPrice =
      typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice > 0
        ? Math.round(rawPrice)
        : undefined;
    const rawNote = typeof entry.note === "string" ? entry.note.trim().slice(0, MAX_WATCHLIST_NOTE_LENGTH) : "";
    const note = rawNote.length > 0 ? rawNote : undefined;

    if (targetBuyPrice !== undefined || note !== undefined) {
      result[ticker] = {
        ...(targetBuyPrice !== undefined ? { targetBuyPrice } : {}),
        ...(note !== undefined ? { note } : {}),
      };
    }
  }

  return result;
}

export function parseWatchlistNotesJson(
  rawJson: string | null | undefined
): Record<string, WatchlistEntryMeta> {
  if (!rawJson) return {};
  try {
    return sanitizeWatchlistNotes(JSON.parse(rawJson));
  } catch {
    return {};
  }
}

const notesListeners = new Set<() => void>();

function notifyNotesListeners() {
  for (const listener of notesListeners) {
    listener();
  }
}

export function readWatchlistNotesStorageSnapshot(): string {
  if (typeof window === "undefined") return "{}";
  try {
    return window.localStorage.getItem(WATCHLIST_NOTES_STORAGE_KEY) || "{}";
  } catch {
    return "{}";
  }
}

export function getWatchlistNotesServerSnapshot(): string {
  return "{}";
}

export function subscribeWatchlistNotesStorage(listener: () => void): () => void {
  notesListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === WATCHLIST_NOTES_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    notesListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function saveWatchlistEntryMetaStorage(
  rawTicker: string,
  meta: WatchlistEntryMeta | null
): Record<string, WatchlistEntryMeta> {
  const ticker = normalizeIdxTicker(rawTicker);
  const current = parseWatchlistNotesJson(readWatchlistNotesStorageSnapshot());
  if (!ticker) return current;

  const cleaned = meta ? sanitizeWatchlistNotes({ [ticker]: meta })[ticker] : undefined;
  const next = { ...current };
  if (cleaned) {
    next[ticker] = cleaned;
  } else {
    delete next[ticker];
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(WATCHLIST_NOTES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  notifyNotesListeners();
  return next;
}

export interface WatchlistBuySignalItem {
  ticker: string;
  price: number;
  targetBuyPrice: number;
  diffPercent: number;
  status: "hit" | "near";
}

export interface WatchlistTargetSummary {
  hitItems: WatchlistBuySignalItem[];
  nearItems: WatchlistBuySignalItem[];
  totalActionable: number;
}

/**
 * Evaluates active custom watchlist stocks against saved Target Harga Beli prices.
 * Only evaluates tickers currently in customWatchlist so deleted items' stale notes do not alert.
 */
export function summarizeWatchlistBuySignals(
  customWatchlist: string[],
  watchlistNotes: Record<string, WatchlistEntryMeta>,
  priceByTicker: Record<string, number>
): WatchlistTargetSummary {
  const hitItems: WatchlistBuySignalItem[] = [];
  const nearItems: WatchlistBuySignalItem[] = [];
  const seen = new Set<string>();

  for (const rawTicker of customWatchlist) {
    const ticker = normalizeIdxTicker(rawTicker);
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);

    const targetBuyPrice = watchlistNotes[ticker]?.targetBuyPrice;
    const price = priceByTicker[ticker] ?? 0;
    if (!targetBuyPrice || targetBuyPrice <= 0 || !Number.isFinite(price) || price <= 0) {
      continue;
    }

    const evalRes = evaluateTargetBuyStatus(price, targetBuyPrice);
    if (evalRes.status === "hit") {
      hitItems.push({
        ticker,
        price,
        targetBuyPrice,
        diffPercent: evalRes.diffPercent,
        status: "hit",
      });
    } else if (evalRes.status === "near") {
      nearItems.push({
        ticker,
        price,
        targetBuyPrice,
        diffPercent: evalRes.diffPercent,
        status: "near",
      });
    }
  }

  hitItems.sort((a, b) => a.diffPercent - b.diffPercent);
  nearItems.sort((a, b) => a.diffPercent - b.diffPercent);

  return {
    hitItems,
    nearItems,
    totalActionable: hitItems.length + nearItems.length,
  };
}
