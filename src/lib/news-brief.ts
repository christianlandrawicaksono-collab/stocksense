import { formatNewsCategoryLabel, formatPersen } from "@/lib/format";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";

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
