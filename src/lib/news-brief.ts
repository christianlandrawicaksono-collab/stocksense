import { formatNewsCategoryLabel, formatPersen, getJakartaDateKey } from "@/lib/format";
import type {
  LiveMarketNewsItem,
  LiveNewsCategory,
  MarketTickerItem,
  SentimentType,
} from "@/types/market";

export interface LiveMarketBrief {
  headline: string;
  summary: string;
  sentimentCounts: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  dominantCategory: string;
  topTickers: string[];
  source: "deterministic" | "gemini";
  model?: string | null;
}

/**
 * Menghasilkan ringkasan pasar harian deterministik dari daftar berita RSS terkini dan indikator makro.
 */
export function buildLiveMarketBrief(
  items: LiveMarketNewsItem[],
  macroTickers: MarketTickerItem[] = []
): LiveMarketBrief {
  if (items.length === 0) {
    return {
      headline: "Menunggu pembaruan berita pasar",
      summary:
        "Ringkasan pasar harian akan muncul otomatis setelah feed berita pasar modal berhasil dimuat.",
      sentimentCounts: { bullish: 0, bearish: 0, neutral: 0 },
      dominantCategory: "Makroekonomi",
      topTickers: [],
      source: "deterministic",
    };
  }

  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  const categoryCount = new Map<string, number>();
  const tickerCount = new Map<string, number>();

  for (const item of items) {
    if (item.sentiment === "BULLISH") bullish += 1;
    else if (item.sentiment === "BEARISH") bearish += 1;
    else neutral += 1;

    categoryCount.set(item.category, (categoryCount.get(item.category) ?? 0) + 1);
    for (const ticker of item.tickers) {
      tickerCount.set(ticker, (tickerCount.get(ticker) ?? 0) + 1);
    }
  }

  const topCategoryCode =
    Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "CORPORATE";
  const dominantCategory = formatNewsCategoryLabel(topCategoryCode);

  const topTickers = Array.from(tickerCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ticker]) => ticker);

  let toneText = "berimbang antara sentimen positif dan negatif";
  if (bullish > bearish + 1) {
    toneText = "cenderung positif";
  } else if (bearish > bullish + 1) {
    toneText = "cenderung tertekan";
  }

  const ihsg = macroTickers.find((m) => m.symbol === "IHSG");
  const usdIdr = macroTickers.find((m) => m.symbol === "USD/IDR");

  const macroFragments: string[] = [];
  if (ihsg) {
    macroFragments.push(
      `IHSG berada di ${ihsg.value} (${formatPersen(ihsg.change, 2, true)})`
    );
  }
  if (usdIdr) {
    macroFragments.push(
      `USD/IDR di ${usdIdr.value} (${formatPersen(usdIdr.change, 2, true)})`
    );
  }

  const macroSentence =
    macroFragments.length > 0 ? ` Posisi pasar terkini: ${macroFragments.join(" dan ")}.` : "";
  const tickerSentence =
    topTickers.length > 0
      ? ` Emiten yang paling banyak disorot: ${topTickers.join(", ")}.`
      : "";

  const headline = `Nada berita ${toneText} • Fokus ${dominantCategory.toLowerCase()}`;
  const summary = `Dari ${items.length} berita pasar modal terkini, nada pemberitaan ${toneText} (${bullish} positif, ${bearish} negatif, ${neutral} netral) dengan dominasi topik ${dominantCategory.toLowerCase()}.${macroSentence}${tickerSentence}`;

  return {
    headline,
    summary,
    sentimentCounts: { bullish, bearish, neutral },
    dominantCategory,
    topTickers,
    source: "deterministic",
  };
}

/**
 * Membangun prompt ringkasan eksekutif pasar saham Indonesia untuk Gemini API.
 */
export function buildMarketBriefPrompt(headlinesDigest: string, macroDigest: string): string {
  return `Buat ringkasan eksekutif pasar saham Indonesia (IHSG) hari ini dalam 2-3 kalimat padat bahasa Indonesia gaya koran finansial (tanpa bullet, tanpa markdown heading, tanpa disclaimer). Fokus pada sentimen berita utama, pergerakan makro, dan sektor/emiten yang disorot.
Indikator makro terkini: ${macroDigest || "Tidak tersedia"}
Headline berita terbaru:
${headlinesDigest}`;
}

/**
 * Menyaring daftar berita agar hanya mengambil item yang relevan dengan kode saham IDX tertentu (aman untuk client & server).
 */
export function filterNewsByTicker(
  items: LiveMarketNewsItem[],
  rawTicker: string,
  companyHint?: string
): LiveMarketNewsItem[] {
  const ticker = rawTicker.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(ticker)) return [];

  const tickerRegex = new RegExp(`\\b${ticker}\\b`, "i");
  const cleanHint = companyHint
    ? companyHint
        .replace(/\b(PT|Tbk\.?|Persero)\b/gi, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .trim()
        .replace(/\s+/g, " ")
    : "";

  const hintWords = cleanHint
    .split(" ")
    .filter((w) => w.length >= 4 && !/^(bank|indonesia|indo|asia|jaya|mandiri|prima)$/i.test(w));

  return items.filter((item) => {
    if (item.tickers.includes(ticker)) return true;
    const text = `${item.title} ${item.summary}`;
    if (tickerRegex.test(text)) return true;
    if (cleanHint.length >= 5 && text.toLowerCase().includes(cleanHint.toLowerCase())) {
      return true;
    }
    return (
      hintWords.length >= 2 &&
      hintWords.every((w) => text.toLowerCase().includes(w.toLowerCase()))
    );
  });
}

/**
 * Mengurutkan berita dengan menempatkan item yang menyinggung saham di custom watchlist di urutan teratas,
 * namun tetap mempertahankan seluruh berita pasar lainnya di urutan berikutnya (terbaru terlebih dahulu).
 */
export function prioritizeWatchlistNews(
  items: LiveMarketNewsItem[],
  watchlistSet: ReadonlySet<string>
): LiveMarketNewsItem[] {
  if (items.length <= 1 || watchlistSet.size === 0) return items;

  const matched: LiveMarketNewsItem[] = [];
  const others: LiveMarketNewsItem[] = [];

  for (const item of items) {
    if (item.tickers.some((t) => watchlistSet.has(t))) {
      matched.push(item);
    } else {
      others.push(item);
    }
  }

  return [...matched, ...others];
}

export type NewsTimeRange = "ALL" | "TODAY";
export type NewsPublisherGroup = "ALL" | "CNBC" | "ANTARA" | "CNN" | "KONTAN" | "OTHER";

export function classifyNewsPublisherGroup(
  publisher: string
): Exclude<NewsPublisherGroup, "ALL"> {
  const norm = publisher.toLowerCase();
  if (norm.includes("cnbc")) return "CNBC";
  if (norm.includes("antara")) return "ANTARA";
  if (norm.includes("cnn")) return "CNN";
  if (norm.includes("kontan")) return "KONTAN";
  return "OTHER";
}

export function isNewsFromToday(
  item: Pick<LiveMarketNewsItem, "publishedAt">,
  todayWibKey?: string
): boolean {
  if (!todayWibKey || !item.publishedAt) return false;
  const parsed = new Date(item.publishedAt);
  if (isNaN(parsed.getTime())) return false;
  return getJakartaDateKey(parsed) === todayWibKey;
}

export function countTodayNewsItems(
  items: LiveMarketNewsItem[],
  todayWibKey?: string
): number {
  if (!todayWibKey) return 0;
  let count = 0;
  for (const item of items) {
    if (isNewsFromToday(item, todayWibKey)) count += 1;
  }
  return count;
}

export interface NewsFilterOptions {
  category?: "ALL" | LiveNewsCategory;
  sentiment?: "ALL" | SentimentType;
  onlyWatchlist?: boolean;
  watchlistSet?: ReadonlySet<string>;
  searchQuery?: string;
  tickerFilter?: string | null;
  timeRange?: NewsTimeRange;
  todayWibKey?: string;
  publisherGroup?: NewsPublisherGroup;
}

export function matchesNewsBaseFilters(
  item: LiveMarketNewsItem,
  options: Omit<NewsFilterOptions, "category">
): boolean {
  const {
    sentiment = "ALL",
    onlyWatchlist = false,
    watchlistSet,
    searchQuery = "",
    tickerFilter = null,
    timeRange = "ALL",
    todayWibKey,
    publisherGroup = "ALL",
  } = options;

  if (timeRange === "TODAY" && todayWibKey && !isNewsFromToday(item, todayWibKey)) {
    return false;
  }

  if (publisherGroup !== "ALL" && classifyNewsPublisherGroup(item.publisher) !== publisherGroup) {
    return false;
  }

  if (sentiment !== "ALL" && (item.sentiment || "NEUTRAL") !== sentiment) {
    return false;
  }

  if (onlyWatchlist && watchlistSet && watchlistSet.size > 0) {
    if (!item.tickers.some((t) => watchlistSet.has(t))) {
      return false;
    }
  }

  const normalizedTicker = tickerFilter?.trim().toUpperCase();
  if (normalizedTicker && /^[A-Z]{4}$/.test(normalizedTicker)) {
    const tickerMatch =
      item.tickers.includes(normalizedTicker) ||
      new RegExp(`\\b${normalizedTicker}\\b`, "i").test(`${item.title} ${item.summary}`);
    if (!tickerMatch) {
      return false;
    }
  }

  const trimmed = searchQuery.trim().toLowerCase();
  if (trimmed) {
    const inTitle = item.title.toLowerCase().includes(trimmed);
    const inSummary = item.summary.toLowerCase().includes(trimmed);
    const inPublisher = item.publisher.toLowerCase().includes(trimmed);
    const inTickers = item.tickers.some((t) => t.toLowerCase().includes(trimmed));
    if (!inTitle && !inSummary && !inPublisher && !inTickers) {
      return false;
    }
  }

  return true;
}

export function computeNewsCategoryCounts(
  items: LiveMarketNewsItem[],
  options: Omit<NewsFilterOptions, "category">
): Record<"ALL" | LiveNewsCategory, number> {
  const counts: Record<"ALL" | LiveNewsCategory, number> = {
    ALL: 0,
    CORPORATE: 0,
    MONETARY_CURRENCY: 0,
    GLOBAL_MACRO: 0,
    DOMESTIC_POLITICS: 0,
    COMMODITIES: 0,
  };

  for (const item of items) {
    if (!matchesNewsBaseFilters(item, options)) continue;
    counts.ALL += 1;
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }

  return counts;
}

export function computeNewsPublisherCounts(
  items: LiveMarketNewsItem[],
  options: Omit<NewsFilterOptions, "publisherGroup">
): Record<NewsPublisherGroup, number> {
  const { category = "ALL" } = options;
  const counts: Record<NewsPublisherGroup, number> = {
    ALL: 0,
    CNBC: 0,
    ANTARA: 0,
    CNN: 0,
    KONTAN: 0,
    OTHER: 0,
  };

  for (const item of items) {
    if (category !== "ALL" && item.category !== category) continue;
    if (!matchesNewsBaseFilters(item, { ...options, publisherGroup: "ALL" })) continue;
    counts.ALL += 1;
    const group = classifyNewsPublisherGroup(item.publisher);
    counts[group] += 1;
  }

  return counts;
}

export interface MarketQaItem {
  id: string;
  eyebrow: string;
  question: string;
  answer: string;
  tickers?: string[];
  relatedStory?: LiveMarketNewsItem;
}

/**
 * Menyusun 4 poin Tanya-Jawab konteks pasar deterministik langsung dari feed berita & indikator makro
 * tanpa latensi API tambahan.
 */
export function buildMarketQaInsights(
  items: LiveMarketNewsItem[],
  macroTickers: MarketTickerItem[] = []
): MarketQaItem[] {
  if (items.length === 0) return [];

  const brief = buildLiveMarketBrief(items, macroTickers);
  const total = items.length;
  const posPct = Math.round((brief.sentimentCounts.bullish / total) * 100);
  const negPct = Math.round((brief.sentimentCounts.bearish / total) * 100);

  const topBullish = items.find((i) => i.sentiment === "BULLISH");
  const topBearish = items.find((i) => i.sentiment === "BEARISH");

  // Hitung 2 kategori teratas
  const catCounts = new Map<LiveNewsCategory, number>();
  for (const item of items) {
    catCounts.set(item.category, (catCounts.get(item.category) ?? 0) + 1);
  }
  const sortedCats = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topCat1 = sortedCats[0];
  const topCat2 = sortedCats[1];
  const topCatStory = topCat1 ? items.find((i) => i.category === topCat1[0]) : items[0];

  // Emiten paling banyak disorot
  const topTickerStory =
    brief.topTickers.length > 0
      ? items.find((i) => i.tickers.includes(brief.topTickers[0]))
      : undefined;

  // Indikator makro kunci
  const ihsg = macroTickers.find((m) => m.symbol === "IHSG");
  const usdIdr = macroTickers.find((m) => m.symbol === "USD/IDR");
  const gold = macroTickers.find((m) => m.symbol === "GOLD");
  const brent = macroTickers.find((m) => m.symbol === "BRENT");
  const macroParts: string[] = [];
  if (ihsg) macroParts.push(`IHSG di ${ihsg.value} (${formatPersen(ihsg.change, 2, true)})`);
  if (usdIdr) macroParts.push(`USD/IDR di ${usdIdr.value} (${formatPersen(usdIdr.change, 2, true)})`);
  if (brent) macroParts.push(`Minyak Brent ${brent.value} (${formatPersen(brent.change, 2, true)})`);
  if (gold) macroParts.push(`Emas ${gold.value} (${formatPersen(gold.change, 2, true)})`);
  const macroStory = items.find(
    (i) => i.category === "MONETARY_CURRENCY" || i.category === "GLOBAL_MACRO"
  );

  const sentimentDetail =
    topBullish && topBearish
      ? `Salah satu katalis positif utama: "${topBullish.title}" (${topBullish.publisher}), sementara sisi kehati-hatian datang dari "${topBearish.title}" (${topBearish.publisher}).`
      : topBullish
      ? `Sorotan positif utama saat ini: "${topBullish.title}" (${topBullish.publisher}).`
      : topBearish
      ? `Sorotan tekanan utama saat ini: "${topBearish.title}" (${topBearish.publisher}).`
      : "Mayoritas pemberitaan bersifat informatif dan berimbang.";

  const qa: MarketQaItem[] = [
    {
      id: "qa-sentiment",
      eyebrow: "Sentimen",
      question: "Bagaimana arah sentimen pemberitaan pasar modal saat ini?",
      answer: `Dari ${total} berita terkini, ${brief.sentimentCounts.bullish} bernada positif (${posPct}%), ${brief.sentimentCounts.bearish} negatif (${negPct}%), dan ${brief.sentimentCounts.neutral} netral. ${sentimentDetail}`,
      relatedStory: topBullish || topBearish || items[0],
    },
    {
      id: "qa-sector",
      eyebrow: "Dominasi Topik",
      question: "Topik dan kanal berita apa yang paling ramai dibahas?",
      answer: topCat1
        ? `Kanal ${formatNewsCategoryLabel(topCat1[0])} memimpin dengan ${topCat1[1]} berita (${Math.round(
            (topCat1[1] / total) * 100
          )}% dari total feed)${
            topCat2
              ? `, disusul ${formatNewsCategoryLabel(topCat2[0])} sebanyak ${topCat2[1]} berita`
              : ""
          }. Fokus bacaan di kanal ini menjadi penggerak narasi utama pasar.`
        : "Berita tersebar merata lintas sektor pasar modal Indonesia.",
      relatedStory: topCatStory,
    },
    {
      id: "qa-tickers",
      eyebrow: "Emiten Disorot",
      question: "Saham BEI apa saja yang paling sering disebut di berita?",
      answer:
        brief.topTickers.length > 0
          ? `Emiten dengan frekuensi liputan tertinggi saat ini adalah ${brief.topTickers.join(
              ", "
            )}. Klik kode saham di bawah untuk langsung membuka valuasi, grafik, dan analisisnya di Terminal.`
          : "Pemberitaan saat ini lebih banyak menyoroti isu makroekonomi, kebijakan moneter, dan indeks secara luas dibanding emiten tunggal.",
      tickers: brief.topTickers,
      relatedStory: topTickerStory,
    },
    {
      id: "qa-macro",
      eyebrow: "Makro & Kurs",
      question: "Bagaimana posisi indikator makro kunci (IHSG, Rupiah, komoditas)?",
      answer:
        macroParts.length > 0
          ? `Pantauan indikator makro terkini mencatat ${macroParts.join(", ")}.${
              macroStory
                ? ` Berita makro relevan terbaru: "${macroStory.title}" (${macroStory.publisher}).`
                : ""
            }`
          : "Indikator makro live sedang disinkronkan. Pantau strip indikator di atas untuk pembaruan IHSG, USD/IDR, dan komoditas energi.",
      relatedStory: macroStory,
    },
  ];

  return qa;
}

export function filterLiveNewsItems(
  items: LiveMarketNewsItem[],
  options: NewsFilterOptions
): LiveMarketNewsItem[] {
  const { category = "ALL", watchlistSet } = options;
  const filtered = items.filter((item) => {
    if (category !== "ALL" && item.category !== category) return false;
    return matchesNewsBaseFilters(item, options);
  });

  return watchlistSet && watchlistSet.size > 0
    ? prioritizeWatchlistNews(filtered, watchlistSet)
    : filtered;
}

const NEWS_TOPIC_STOPWORDS = new Set([
  "dan",
  "yang",
  "di",
  "ke",
  "dari",
  "pada",
  "untuk",
  "dengan",
  "ini",
  "itu",
  "akan",
  "bisa",
  "jadi",
  "soal",
  "apa",
  "bagi",
  "atas",
  "atau",
  "hingga",
  "dalam",
  "tak",
  "tidak",
  "ada",
  "lagi",
  "baru",
  "masih",
  "bukan",
  "sudah",
  "telah",
  "saat",
  "tentang",
  "antara",
  "cara",
  "buat",
  "kata",
  "ungkap",
  "sebut",
  "nilai",
  "saham",
  "investor",
  "pasar",
  "indonesia",
  "hari",
  "tahun",
  "persen",
  "serta",
  "agar",
  "bila",
  "jika",
  "bakal",
  "mau",
]);

export function extractNewsTopicTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !NEWS_TOPIC_STOPWORDS.has(w));
  return new Set(words);
}

export function areTitlesTopicallySimilar(
  titleA: string,
  titleB: string,
  threshold: number = 0.55
): boolean {
  const tokensA = extractNewsTopicTokens(titleA);
  const tokensB = extractNewsTopicTokens(titleB);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }

  const minLen = Math.min(tokensA.size, tokensB.size);
  if (minLen < 2) return false;
  return shared / minLen >= threshold;
}

export function normalizeNewsImageKey(imageUrl?: string): string {
  if (!imageUrl) return "";
  try {
    const parsed = new URL(imageUrl);
    const cleanPath = parsed.pathname
      .toLowerCase()
      .replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
    return `${parsed.hostname.toLowerCase()}${cleanPath}`;
  } catch {
    return imageUrl.trim().toLowerCase().split("?")[0];
  }
}

export interface EditorialNewsBuckets {
  leadStory: LiveMarketNewsItem | null;
  gridStories: LiveMarketNewsItem[];
  overlayStory: LiveMarketNewsItem | null;
  stackedStories: LiveMarketNewsItem[];
  compactStories: LiveMarketNewsItem[];
}

function hasSimilarTitleIn(item: LiveMarketNewsItem, picked: LiveMarketNewsItem[]): boolean {
  return picked.some((other) => areTitlesTopicallySimilar(item.title, other.title));
}

function spreadSimilarNewsTopics(
  items: LiveMarketNewsItem[],
  anchorStories: LiveMarketNewsItem[],
  watchlistSet: ReadonlySet<string>
): LiveMarketNewsItem[] {
  if (items.length <= 1) return items;

  const isWatchlist = (item: LiveMarketNewsItem) =>
    watchlistSet.size > 0 && item.tickers.some((t) => watchlistSet.has(t));

  const primary: LiveMarketNewsItem[] = [];
  const followUps: LiveMarketNewsItem[] = [];
  const seenAnchorAndPrimary = [...anchorStories];

  for (const item of items) {
    if (!isWatchlist(item) && hasSimilarTitleIn(item, seenAnchorAndPrimary)) {
      followUps.push(item);
    } else {
      primary.push(item);
      seenAnchorAndPrimary.push(item);
    }
  }

  return [...primary, ...followUps];
}

/**
 * Mengelompokkan berita ke slot editorial broadsheet dengan menjaga prioritas Watchlist
 * sekaligus menghindari foto ganda dan topik berulang berdekatan di sorotan utama.
 */
export function allocateEditorialBuckets(
  items: LiveMarketNewsItem[],
  watchlistSet: ReadonlySet<string> = new Set()
): EditorialNewsBuckets {
  if (items.length === 0) {
    return {
      leadStory: null,
      gridStories: [],
      overlayStory: null,
      stackedStories: [],
      compactStories: [],
    };
  }

  const isWatchlist = (item: LiveMarketNewsItem) =>
    watchlistSet.size > 0 && item.tickers.some((t) => watchlistSet.has(t));

  const watchlistMatched = items.filter(isWatchlist);
  const leadStory =
    (watchlistMatched.length > 0
      ? watchlistMatched.find((item) => Boolean(item.imageUrl)) || watchlistMatched[0]
      : items.find((item) => Boolean(item.imageUrl)) || items[0]) || null;

  if (!leadStory) {
    return {
      leadStory: null,
      gridStories: [],
      overlayStory: null,
      stackedStories: [],
      compactStories: [],
    };
  }

  const remaining = items.filter((item) => item.id !== leadStory.id);
  const photoRemaining = remaining.filter((item) => Boolean(item.imageUrl));

  const usedIds = new Set<string>([leadStory.id]);
  const usedImageKeys = new Set<string>();
  const leadImgKey = normalizeNewsImageKey(leadStory.imageUrl);
  if (leadImgKey) usedImageKeys.add(leadImgKey);

  const pickedShowcase: LiveMarketNewsItem[] = [leadStory];

  const tryPickFromPool = (
    target: LiveMarketNewsItem[],
    limit: number,
    pool: LiveMarketNewsItem[],
    {
      requireUniqueCategory,
      requireDistinctTopic,
      requireUniqueImage,
      requireUniquePublisher = false,
    }: {
      requireUniqueCategory: boolean;
      requireDistinctTopic: boolean;
      requireUniqueImage: boolean;
      requireUniquePublisher?: boolean;
    },
    usedCategories: Set<string>,
    usedPublishers: Set<string>
  ) => {
    for (const candidate of pool) {
      if (target.length >= limit) break;
      if (usedIds.has(candidate.id)) continue;

      const imgKey = normalizeNewsImageKey(candidate.imageUrl);
      const pubKey = candidate.publisher.trim().toLowerCase();
      if (requireUniqueImage && imgKey && usedImageKeys.has(imgKey)) continue;
      if (requireDistinctTopic && hasSimilarTitleIn(candidate, pickedShowcase)) continue;
      if (requireUniqueCategory && usedCategories.has(candidate.category)) continue;
      if (requireUniquePublisher && pubKey && usedPublishers.has(pubKey)) continue;

      target.push(candidate);
      usedIds.add(candidate.id);
      if (imgKey) usedImageKeys.add(imgKey);
      usedCategories.add(candidate.category);
      if (pubKey) usedPublishers.add(pubKey);
      pickedShowcase.push(candidate);
    }
  };

  let gridTargetCount = 0;
  let needsOverlay = false;

  if (photoRemaining.length >= 4) {
    gridTargetCount = 3;
    needsOverlay = true;
  } else if (photoRemaining.length === 3) {
    gridTargetCount = 3;
  } else if (photoRemaining.length === 2 && remaining.length === 2) {
    gridTargetCount = 2;
  } else if (photoRemaining.length >= 1) {
    needsOverlay = true;
  }

  const gridStories: LiveMarketNewsItem[] = [];
  const usedPublishers = new Set<string>([leadStory.publisher.trim().toLowerCase()]);
  if (gridTargetCount > 0) {
    const watchlistPhotos = photoRemaining.filter(isWatchlist);
    const generalPhotos = photoRemaining.filter((item) => !isWatchlist(item));
    const gridCategories = new Set<string>([leadStory.category]);

    // Watchlist items keep priority in grid, then diversify general categories/publishers/topics/images
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      watchlistPhotos,
      { requireUniqueCategory: false, requireDistinctTopic: true, requireUniqueImage: true },
      gridCategories,
      usedPublishers
    );
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      generalPhotos,
      {
        requireUniqueCategory: true,
        requireDistinctTopic: true,
        requireUniqueImage: true,
        requireUniquePublisher: true,
      },
      gridCategories,
      usedPublishers
    );
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      generalPhotos,
      { requireUniqueCategory: true, requireDistinctTopic: true, requireUniqueImage: true },
      gridCategories,
      usedPublishers
    );
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      generalPhotos,
      {
        requireUniqueCategory: false,
        requireDistinctTopic: true,
        requireUniqueImage: true,
        requireUniquePublisher: true,
      },
      gridCategories,
      usedPublishers
    );
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      generalPhotos,
      { requireUniqueCategory: false, requireDistinctTopic: true, requireUniqueImage: true },
      gridCategories,
      usedPublishers
    );
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      photoRemaining,
      { requireUniqueCategory: false, requireDistinctTopic: false, requireUniqueImage: true },
      gridCategories,
      usedPublishers
    );
    tryPickFromPool(
      gridStories,
      gridTargetCount,
      photoRemaining,
      { requireUniqueCategory: false, requireDistinctTopic: false, requireUniqueImage: false },
      gridCategories,
      usedPublishers
    );
  }

  let overlayStory: LiveMarketNewsItem | null = null;
  if (needsOverlay) {
    const unusedPhotos = photoRemaining.filter((item) => !usedIds.has(item.id));
    const overlayCandidates: LiveMarketNewsItem[] = [];
    const dummyCats = new Set<string>();

    tryPickFromPool(
      overlayCandidates,
      1,
      unusedPhotos,
      { requireUniqueCategory: false, requireDistinctTopic: true, requireUniqueImage: true },
      dummyCats,
      usedPublishers
    );
    tryPickFromPool(
      overlayCandidates,
      1,
      unusedPhotos,
      { requireUniqueCategory: false, requireDistinctTopic: false, requireUniqueImage: true },
      dummyCats,
      usedPublishers
    );
    tryPickFromPool(
      overlayCandidates,
      1,
      unusedPhotos,
      { requireUniqueCategory: false, requireDistinctTopic: false, requireUniqueImage: false },
      dummyCats,
      usedPublishers
    );
    overlayStory = overlayCandidates[0] ?? null;
  }

  const tailRaw = remaining.filter((item) => !usedIds.has(item.id));
  const tailCurated = spreadSimilarNewsTopics(tailRaw, pickedShowcase, watchlistSet);
  const stackedLimit = overlayStory ? 3 : 4;
  const stackedStories = tailCurated.slice(0, stackedLimit);
  const compactStories = tailCurated.slice(stackedLimit);

  return {
    leadStory,
    gridStories,
    overlayStory,
    stackedStories,
    compactStories,
  };
}
