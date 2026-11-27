import type { LiveMarketNewsItem, LiveNewsCategory, SentimentType } from "@/types/market";

export const NEWS_BOOKMARKS_STORAGE_KEY = "stocksense:news-bookmarks:v1";
export const MAX_BOOKMARKED_NEWS = 30;

const BOOKMARKS_CHANGE_EVENT = "stocksense:news-bookmarks-change";
const VALID_CATEGORIES = new Set<LiveNewsCategory>([
  "CORPORATE",
  "MONETARY_CURRENCY",
  "GLOBAL_MACRO",
  "DOMESTIC_POLITICS",
  "COMMODITIES",
]);
const VALID_SENTIMENTS = new Set<SentimentType>(["BULLISH", "BEARISH", "NEUTRAL"]);

function sanitizeBookmarkItem(raw: unknown): LiveMarketNewsItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  const title = typeof rec.title === "string" ? rec.title.trim() : "";
  const link = typeof rec.link === "string" ? rec.link.trim() : "";
  const publisher = typeof rec.publisher === "string" ? rec.publisher.trim() : "";
  const publishedAt = typeof rec.publishedAt === "string" ? rec.publishedAt.trim() : "";
  const publishedWib = typeof rec.publishedWib === "string" ? rec.publishedWib.trim() : "";

  if (!id || !title || !link || !publisher) return null;
  if (!link.startsWith("https://") && !link.startsWith("http://")) return null;

  const rawCategory = typeof rec.category === "string" ? (rec.category as LiveNewsCategory) : "CORPORATE";
  const category: LiveNewsCategory = VALID_CATEGORIES.has(rawCategory) ? rawCategory : "CORPORATE";

  const rawSentiment = typeof rec.sentiment === "string" ? (rec.sentiment as SentimentType) : "NEUTRAL";
  const sentiment: SentimentType = VALID_SENTIMENTS.has(rawSentiment) ? rawSentiment : "NEUTRAL";

  const tickers = Array.isArray(rec.tickers)
    ? rec.tickers
        .filter((t): t is string => typeof t === "string" && /^[A-Z]{4}$/.test(t.trim().toUpperCase()))
        .map((t) => t.trim().toUpperCase())
        .slice(0, 6)
    : [];

  const imageUrl =
    typeof rec.imageUrl === "string" && rec.imageUrl.startsWith("https://")
      ? rec.imageUrl
      : undefined;
  const sourceDomain =
    typeof rec.sourceDomain === "string" && rec.sourceDomain.trim().length > 0
      ? rec.sourceDomain.trim()
      : undefined;
  const summary = typeof rec.summary === "string" ? rec.summary.trim().slice(0, 320) : "";

  return {
    id,
    title,
    link,
    publisher,
    sourceDomain,
    imageUrl,
    publishedAt,
    publishedWib,
    summary,
    category,
    sentiment,
    tickers,
  };
}

export function parseNewsBookmarksJson(rawJson: string | null | undefined): LiveMarketNewsItem[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const clean: LiveMarketNewsItem[] = [];
    for (const entry of parsed) {
      const item = sanitizeBookmarkItem(entry);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      clean.push(item);
      if (clean.length >= MAX_BOOKMARKED_NEWS) break;
    }
    return clean;
  } catch {
    return [];
  }
}

export function toggleNewsBookmark(
  current: LiveMarketNewsItem[],
  item: LiveMarketNewsItem
): LiveMarketNewsItem[] {
  const exists = current.some((entry) => entry.id === item.id);
  if (exists) {
    return current.filter((entry) => entry.id !== item.id);
  }
  const clean = sanitizeBookmarkItem(item);
  if (!clean) return current;
  return [clean, ...current].slice(0, MAX_BOOKMARKED_NEWS);
}

/**
 * Menggabungkan berita tersimpan dengan item live terbaru sehingga jika artikel masih ada
 * di feed live, data segarnya dipakai; jika sudah keluar dari feed, snapshot tersimpan tetap terbaca.
 */
export function resolveBookmarkedNewsPool(
  liveItems: LiveMarketNewsItem[],
  bookmarkedItems: LiveMarketNewsItem[]
): LiveMarketNewsItem[] {
  if (bookmarkedItems.length === 0) return [];
  const liveById = new Map(liveItems.map((item) => [item.id, item]));
  return bookmarkedItems.map((saved) => liveById.get(saved.id) || saved);
}

export function getNewsBookmarksServerSnapshot(): string {
  return "[]";
}

export function readNewsBookmarksStorageSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(NEWS_BOOKMARKS_STORAGE_KEY) || "[]";
  } catch {
    return "[]";
  }
}

export function writeNewsBookmarksStorage(items: LiveMarketNewsItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const capped = items.slice(0, MAX_BOOKMARKED_NEWS);
    window.localStorage.setItem(NEWS_BOOKMARKS_STORAGE_KEY, JSON.stringify(capped));
    window.dispatchEvent(new Event(BOOKMARKS_CHANGE_EVENT));
  } catch {
    // Abaikan kuota storage penuh / private browsing restriction
  }
}

export function subscribeNewsBookmarksStorage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === NEWS_BOOKMARKS_STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleCustom = () => onStoreChange();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(BOOKMARKS_CHANGE_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(BOOKMARKS_CHANGE_EVENT, handleCustom);
  };
}
