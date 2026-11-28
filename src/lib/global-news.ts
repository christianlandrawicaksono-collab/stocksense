import type { LiveMarketNewsItem, SentimentType } from "@/types/market";
import type { MarketProvider } from "./market-data";

export type GlobalNewsChapterId = "US" | "EU" | "ME" | "ASIA" | "ID";
export type GlobalNewsPinId = "US" | "EU" | "ME" | "CN" | "JP" | "ID";

export interface GlobalNewsItem {
  id: string;
  regionId: GlobalNewsPinId;
  chapterId: GlobalNewsChapterId;
  title: string;
  summary: string;
  publisher: string;
  publishedAt: string;
  publishedWib: string;
  link: string;
  language: "EN" | "ID";
  sentiment: SentimentType;
  impactTickers: string[];
  isFallback?: boolean;
}

export interface GlobalNewsChapterMeta {
  id: GlobalNewsChapterId;
  numberLabel: string;
  pinId: GlobalNewsPinId;
  title: string;
  shortLabel: string;
  subtitle: string;
  cityLabel: string;
  lat: number;
  lon: number;
  isoNumeric: string;
  accentHex: string;
  ambientRgba: string;
  transmissionNote: string;
  sensitiveBeiTickers: string[];
}

export interface GlobalNewsChapterData extends GlobalNewsChapterMeta {
  items: GlobalNewsItem[];
  liveCount: number;
  dominantSentiment: SentimentType;
}

export interface GlobeNewsPin {
  id: GlobalNewsPinId;
  chapterId: GlobalNewsChapterId;
  label: string;
  city: string;
  lat: number;
  lon: number;
  isoNumeric: string;
  newsCount: number;
  sentiment: SentimentType;
  accentHex: string;
}

export interface GlobalNewsApiResponse {
  provider: MarketProvider;
  isFallback: boolean;
  items: GlobalNewsItem[];
  timestamp: string;
  error?: string;
}

export const GLOBAL_NEWS_CHAPTERS: readonly GlobalNewsChapterMeta[] = [
  {
    id: "US",
    numberLabel: "01",
    pinId: "US",
    title: "Wall Street & The Fed",
    shortLabel: "Wall Street",
    subtitle: "Arah suku bunga The Fed, yield US Treasury, dan arus dana global dari Wall Street.",
    cityLabel: "New York · Washington",
    lat: 40.7128,
    lon: -74.006,
    isoNumeric: "840",
    accentHex: "#0F5499",
    ambientRgba: "rgba(15, 84, 153, 0.08)",
    transmissionNote:
      "Arah suku bunga The Fed dan indeks Dolar (DXY) paling cepat ngaruh ke foreign flow saham bank big-caps dan pergerakan Rupiah.",
    sensitiveBeiTickers: ["BBCA", "BMRI", "BBRI", "TLKM"],
  },
  {
    id: "EU",
    numberLabel: "02",
    pinId: "EU",
    title: "Eropa & Geopolitik",
    shortLabel: "Eropa",
    subtitle: "Kebijakan ECB/BoE, tensi dagang lintas Atlantik, dan denyut manufaktur Eropa.",
    cityLabel: "London · Frankfurt",
    lat: 51.5074,
    lon: -0.1278,
    isoNumeric: "826",
    accentHex: "#4F46E5",
    ambientRgba: "rgba(79, 70, 229, 0.075)",
    transmissionNote:
      "Sentimen risk-on/risk-off Eropa dan kurs Euro berdampak ke eksportir komoditas, rantai pasok otomotif, dan appetite dana asing.",
    sensitiveBeiTickers: ["ASII", "ICBP", "MEDC", "ADRO"],
  },
  {
    id: "ME",
    numberLabel: "03",
    pinId: "ME",
    title: "Timur Tengah & Energi",
    shortLabel: "Energi",
    subtitle: "Kuota OPEC+, jalur pasokan minyak Brent, dan premi risiko geopolitik global.",
    cityLabel: "Dubai · Teluk Persia",
    lat: 25.2048,
    lon: 55.2708,
    isoNumeric: "784",
    accentHex: "#B45309",
    ambientRgba: "rgba(180, 83, 9, 0.085)",
    transmissionNote:
      "Reli minyak Brent & emas safe-haven langsung mendongkrak margin emiten migas dan tambang emas BEI, tapi bikin biaya energi makin ketat.",
    sensitiveBeiTickers: ["MEDC", "ADRO", "ANTM"],
  },
  {
    id: "ASIA",
    numberLabel: "04",
    pinId: "CN",
    title: "Asia & Komoditas",
    shortLabel: "Asia",
    subtitle: "Stimulus ekonomi Tiongkok, suku bunga BoJ Jepang, dan demand nikel serta batu bara.",
    cityLabel: "Shanghai · Tokyo",
    lat: 31.2304,
    lon: 121.4737,
    isoNumeric: "156",
    accentHex: "#0D6343",
    ambientRgba: "rgba(13, 99, 67, 0.08)",
    transmissionNote:
      "Tiongkok & Jepang adalah partner dagang utama RI — stimulus industri Tiongkok langsung jadi bensin buat harga batu bara, nikel, dan CPO.",
    sensitiveBeiTickers: ["ANTM", "ADRO", "ASII", "ICBP"],
  },
  {
    id: "ID",
    numberLabel: "05",
    pinId: "ID",
    title: "Domestik & IHSG",
    shortLabel: "Indonesia",
    subtitle: "Kebijakan BI-Rate, stabilitas Rupiah, belanja fiskal, dan aksi korporasi emiten BEI.",
    cityLabel: "Jakarta · IDX",
    lat: -6.2088,
    lon: 106.8456,
    isoNumeric: "360",
    accentHex: "#0D7680",
    ambientRgba: "rgba(13, 118, 128, 0.09)",
    transmissionNote:
      "Semua sentimen global akhirnya bermuara di likuiditas domestik, kurs Rupiah, dan kinerja laba emiten unggulan Bursa Efek Indonesia.",
    sensitiveBeiTickers: ["BBCA", "BMRI", "BBRI", "TLKM", "ADRO", "ANTM"],
  },
];

const EXTRA_ASIA_PIN = {
  id: "JP" as const,
  chapterId: "ASIA" as const,
  label: "JP",
  city: "Tokyo",
  lat: 35.6762,
  lon: 139.6503,
  isoNumeric: "392",
  accentHex: "#22C55E",
};

/**
 * Memetakan simbol di Orbital Velocity Ticker ke Bab Kawasan 3D Globe Berita.
 */
export function mapMacroSymbolToNewsChapter(symbol: string): GlobalNewsChapterId {
  const clean = symbol.trim().toUpperCase();
  if (clean.includes("S&P") || clean.includes("SP500") || clean.includes("NASDAQ") || clean.includes("DOW")) {
    return "US";
  }
  if (clean.includes("BRENT") || clean.includes("OIL") || clean.includes("WTI")) {
    return "ME";
  }
  if (clean.includes("COAL") || clean.includes("GOLD") || clean.includes("NIKKEI") || clean.includes("HSI")) {
    return "ASIA";
  }
  if (clean.includes("FTSE") || clean.includes("DAX") || clean.includes("EUR")) {
    return "EU";
  }
  return "ID";
}

/**
 * Mengklasifikasikan artikel berita global/lokal ke pin koordinat 3D Globe.
 */
export function classifyGlobalNewsRegion(
  title: string,
  summary: string = "",
  hint?: GlobalNewsPinId
): { regionId: GlobalNewsPinId; chapterId: GlobalNewsChapterId } {
  const text = `${title} ${summary}`.toLowerCase();

  if (/\b(indonesia|ihsg|idx|bei|bank indonesia|rupiah|jakarta|bumn|danantara|bbca|bmri|bbri)\b/i.test(text)) {
    return { regionId: "ID", chapterId: "ID" };
  }
  if (/\b(opec|middle east|iran|israel|saudi|gaza|red sea|hormuz|brent|crude oil|timur tengah|minyak mentah)\b/i.test(text)) {
    return { regionId: "ME", chapterId: "ME" };
  }
  if (/\b(japan|tokyo|nikkei|boj|bank of japan|yen|toyota|sony|korea|kospi|samsung|jepang)\b/i.test(text)) {
    return { regionId: "JP", chapterId: "ASIA" };
  }
  if (/\b(china|beijing|shanghai|pboc|yuan|hong kong|hang seng|alibaba|tencent|stimulus|tiongkok|nikel|batu bara|coal)\b/i.test(text)) {
    return { regionId: "CN", chapterId: "ASIA" };
  }
  if (/\b(europe|european|ecb|uk|britain|london|ftse|germany|dax|france|eurozone|bank of england|eropa|inggris|jerman)\b/i.test(text)) {
    return { regionId: "EU", chapterId: "EU" };
  }
  if (/\b(fed|federal reserve|wall street|s&p 500|nasdaq|dow jones|treasury|us stocks|u\.s\.|nvidia|apple|microsoft|tesla|trump|tariff|amerika|dolar as)\b/i.test(text)) {
    return { regionId: "US", chapterId: "US" };
  }

  const resolvedPin = hint ?? "US";
  const chapterId: GlobalNewsChapterId =
    resolvedPin === "CN" || resolvedPin === "JP" ? "ASIA" : resolvedPin;
  return { regionId: resolvedPin, chapterId };
}

/**
 * Deteksi sentimen pasar bilingual (EN / ID) untuk pewarnaan pin & arc 3D.
 */
export function detectGlobalNewsSentiment(title: string, summary: string = ""): SentimentType {
  const text = `${title} ${summary}`.toLowerCase();
  const bullishMatches = (
    text.match(
      /\b(rally|surge|soar|gain|jumps?|rise[sd]?|record high|beat[s]?|rebound|stimulus|rate cut|growth|bullish|optimis|menguat|melonjak|naik|rekor|tumbuh|surplus|laba)\b/gi
    ) || []
  ).length;
  const bearishMatches = (
    text.match(
      /\b(fall[s]?|drop[s]?|plunge|slump|tumble|sink|recession|crisis|conflict|war|tariff|inflation fears|rate hike|selloff|sell-off|bearish|melemah|anjlok|turun|koreksi|tekanan|risiko|defisit)\b/gi
    ) || []
  ).length;

  if (bullishMatches > bearishMatches) return "BULLISH";
  if (bearishMatches > bullishMatches) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Fallback berita makro terkurasi agar 5 Bab Scrollytelling selalu penuh & informatif
 * saat mode ilustrasi aktif atau saat feed global tertentu sementara tidak terjangkau.
 */
export function buildFallbackGlobalNewsItems(): GlobalNewsItem[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: "fb-us-1",
      regionId: "US",
      chapterId: "US",
      title: "Wall Street monitors Federal Reserve rate path and Treasury yields",
      summary:
        "Investor global mencermati proyeksi pemangkasan suku bunga The Fed serta rilis data inflasi AS yang mengarahkan arus dana ke pasar berkembang.",
      publisher: "Global Macro Desk",
      publishedAt: nowIso,
      publishedWib: "Acuan Makro",
      link: "https://www.cnbc.com/world/",
      language: "EN",
      sentiment: "NEUTRAL",
      impactTickers: ["BBCA", "BMRI", "BBRI"],
      isFallback: true,
    },
    {
      id: "fb-eu-1",
      regionId: "EU",
      chapterId: "EU",
      title: "European equities track ECB policy outlook and industrial trade flows",
      summary:
        "Bursa London dan Frankfurt bergerak selektif menimbang arah kebijakan suku bunga Eropa serta prospek ekspor manufaktur global.",
      publisher: "Global Macro Desk",
      publishedAt: nowIso,
      publishedWib: "Acuan Makro",
      link: "https://www.bbc.com/news/business",
      language: "EN",
      sentiment: "NEUTRAL",
      impactTickers: ["ASII", "ICBP", "MEDC"],
      isFallback: true,
    },
    {
      id: "fb-me-1",
      regionId: "ME",
      chapterId: "ME",
      title: "Brent crude oil and safe-haven gold react to OPEC+ supply discipline",
      summary:
        "Ketegangan jalur energi Timur Tengah dan kuota produksi OPEC+ menjaga volatilitas harga minyak Brent serta menopang reli emas global.",
      publisher: "Global Macro Desk",
      publishedAt: nowIso,
      publishedWib: "Acuan Makro",
      link: "https://www.cnbc.com/energy/",
      language: "EN",
      sentiment: "BULLISH",
      impactTickers: ["MEDC", "ADRO", "ANTM"],
      isFallback: true,
    },
    {
      id: "fb-asia-1",
      regionId: "CN",
      chapterId: "ASIA",
      title: "China fiscal stimulus and Japan Nikkei momentum steer Asian commodities",
      summary:
        "Kebijakan dorongan kredit Tiongkok dan pergerakan Yen Jepang menjadi katalis utama permintaan nikel, batu bara, dan arus modal Asia.",
      publisher: "Global Macro Desk",
      publishedAt: nowIso,
      publishedWib: "Acuan Makro",
      link: "https://www.cnbc.com/asia-markets/",
      language: "EN",
      sentiment: "BULLISH",
      impactTickers: ["ANTM", "ADRO", "ASII"],
      isFallback: true,
    },
    {
      id: "fb-id-1",
      regionId: "ID",
      chapterId: "ID",
      title: "IHSG mencermati stabilitas Rupiah, arah BI-Rate, dan kinerja emiten big-caps",
      summary:
        "Investor domestik dan asing memantau ketahanan pertumbuhan kredit perbankan utama serta dividen emiten komoditas BEI.",
      publisher: "StocksSense Desk",
      publishedAt: nowIso,
      publishedWib: "Acuan Domestik",
      link: "https://www.idx.co.id/",
      language: "ID",
      sentiment: "BULLISH",
      impactTickers: ["BBCA", "BMRI", "BBRI", "TLKM"],
      isFallback: true,
    },
  ];
}

function resolveDominantSentiment(items: GlobalNewsItem[]): SentimentType {
  let bull = 0;
  let bear = 0;
  for (const item of items) {
    if (item.sentiment === "BULLISH") bull += 1;
    else if (item.sentiment === "BEARISH") bear += 1;
  }
  if (bull > bear) return "BULLISH";
  if (bear > bull) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Menggabungkan item global RSS + berita domestik RSS ke 5 Bab Scrollytelling & 6 Pin 3D Globe.
 */
export function buildGlobalNewsChaptersAndPins(
  globalItems: GlobalNewsItem[],
  domesticNewsItems: LiveMarketNewsItem[]
): {
  chapters: GlobalNewsChapterData[];
  pins: GlobeNewsPin[];
  totalLiveGlobalCount: number;
} {
  const fallbacks = buildFallbackGlobalNewsItems();

  // Konversi berita domestik BEI (RSS Indonesia) menjadi GlobalNewsItem untuk Bab 05 (ID)
  // sekaligus tangkap berita global berbahasa Indonesia bila relevan
  const domesticMapped: GlobalNewsItem[] = domesticNewsItems.map((item) => {
    const tagged = classifyGlobalNewsRegion(item.title, item.summary, "ID");
    return {
      id: `dom-${item.id}`,
      regionId: tagged.regionId,
      chapterId: tagged.chapterId,
      title: item.title,
      summary: item.summary,
      publisher: item.publisher,
      publishedAt: item.publishedAt,
      publishedWib: item.publishedWib,
      link: item.link,
      language: "ID",
      sentiment: item.sentiment,
      impactTickers: item.tickers.length > 0 ? item.tickers.slice(0, 4) : ["BBCA", "BMRI"],
      isFallback: false,
    };
  });

  const combined = [...globalItems, ...domesticMapped];
  const totalLiveGlobalCount = globalItems.filter((i) => !i.isFallback).length;

  const chapters: GlobalNewsChapterData[] = GLOBAL_NEWS_CHAPTERS.map((meta) => {
    // Untuk bab ID utamakan berita berbahasa Indonesia dari RSS lokal
    const matched =
      meta.id === "ID"
        ? domesticMapped.filter((i) => i.chapterId === "ID")
        : combined.filter((i) => i.chapterId === meta.id);

    // Deduplikasi judul ringan & batasi maks 4 berita unggulan per bab
    const seenTitles = new Set<string>();
    const unique: GlobalNewsItem[] = [];
    for (const it of matched) {
      const key = it.title.toLowerCase().slice(0, 48);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      unique.push(it);
      if (unique.length >= 4) break;
    }

    const finalItems =
      unique.length > 0
        ? unique
        : fallbacks.filter((f) => f.chapterId === meta.id);

    return {
      ...meta,
      items: finalItems,
      liveCount: unique.filter((u) => !u.isFallback).length,
      dominantSentiment: resolveDominantSentiment(finalItems),
    };
  });

  const pinCounts = new Map<GlobalNewsPinId, GlobalNewsItem[]>();
  for (const ch of chapters) {
    for (const item of ch.items) {
      const list = pinCounts.get(item.regionId) ?? [];
      list.push(item);
      pinCounts.set(item.regionId, list);
    }
  }

  const pins: GlobeNewsPin[] = chapters.map((ch) => {
    const pinItems = pinCounts.get(ch.pinId) ?? ch.items;
    return {
      id: ch.pinId,
      chapterId: ch.id,
      label: ch.pinId,
      city: ch.cityLabel.split("·")[0].trim(),
      lat: ch.lat,
      lon: ch.lon,
      isoNumeric: ch.isoNumeric,
      newsCount: Math.max(1, pinItems.length),
      sentiment: resolveDominantSentiment(pinItems),
      accentHex: ch.accentHex,
    };
  });

  // Tambahkan pin JP tersendiri di Asia Timur agar Jepang ikut bersinar di Globe
  const jpItems = combined.filter((i) => i.regionId === "JP");
  if (jpItems.length > 0) {
    pins.push({
      ...EXTRA_ASIA_PIN,
      newsCount: Math.min(9, jpItems.length),
      sentiment: resolveDominantSentiment(jpItems),
    });
  }

  return { chapters, pins, totalLiveGlobalCount };
}
