import { describe, expect, it } from "vitest";
import {
  allocateEditorialBuckets,
  areTitlesTopicallySimilar,
  buildLiveMarketBrief,
  buildMarketQaInsights,
  classifyNewsPublisherGroup,
  computeNewsCategoryCounts,
  computeNewsPublisherCounts,
  countTodayNewsItems,
  filterLiveNewsItems,
  filterNewsByTicker,
  isNewsFromToday,
  normalizeNewsImageKey,
  prioritizeWatchlistNews,
} from "@/lib/news-brief";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";

const SAMPLE_ITEMS: LiveMarketNewsItem[] = [
  {
    id: "n1",
    title: "Rights Issue, BSI (BRIS) Mau Terbitkan 6,8 Miliar Saham",
    link: "https://example.com/1",
    publisher: "CNBC Indonesia",
    publishedAt: "2026-11-26T03:05:00.000Z",
    publishedWib: "26 Nov 2026, 10.05 WIB",
    summary: "BRIS menerbitkan saham baru untuk ekspansi pembiayaan.",
    category: "CORPORATE",
    sentiment: "BULLISH",
    tickers: ["BRIS"],
  },
  {
    id: "n2",
    title: "Laba Bersih Bank Central Asia Meningkat Pesat",
    link: "https://example.com/2",
    publisher: "ANTARA Ekonomi",
    publishedAt: "2026-11-26T02:30:00.000Z",
    publishedWib: "26 Nov 2026, 09.30 WIB",
    summary: "Pertumbuhan kredit menopang kinerja bank swasta.",
    category: "CORPORATE",
    sentiment: "BULLISH",
    tickers: ["BBCA", "BRIS"],
  },
  {
    id: "n3",
    title: "Harga Batubara Melemah, Saham PTBA Terkoreksi",
    link: "https://example.com/3",
    publisher: "Kontan",
    publishedAt: "2026-11-26T01:45:00.000Z",
    publishedWib: "26 Nov 2026, 08.45 WIB",
    summary: "",
    category: "COMMODITIES",
    sentiment: "BEARISH",
    tickers: ["PTBA"],
  },
  {
    id: "n4",
    title: "IHSG Dibuka Mendatar Jelang Pengumuman Suku Bunga",
    link: "https://example.com/4",
    publisher: "Bisnis Indonesia",
    publishedAt: "2026-11-26T01:10:00.000Z",
    publishedWib: "26 Nov 2026, 08.10 WIB",
    summary: "Pelaku pasar menanti arah kebijakan moneter.",
    category: "MONETARY_CURRENCY",
    sentiment: "NEUTRAL",
    tickers: [],
  },
];

describe("news-brief & filterNewsByTicker helpers", () => {
  it("builds deterministic market brief with sentiment counts, macro snapshot, and top tickers", () => {
    const macroTickers: MarketTickerItem[] = [
      { symbol: "IHSG", name: "IHSG", value: "5.261,09", change: 1.22, isPositive: true },
      { symbol: "USD/IDR", name: "USD/IDR", value: "18.303", change: 0.0, isPositive: true },
    ];

    const brief = buildLiveMarketBrief(SAMPLE_ITEMS, macroTickers);
    expect(brief.source).toBe("deterministic");
    expect(brief.sentimentCounts).toEqual({ bullish: 2, bearish: 1, neutral: 1 });
    expect(brief.dominantCategory).toBe("Korporasi & bursa");
    expect(brief.topTickers[0]).toBe("BRIS");
    expect(brief.summary).toContain("IHSG berada di 5.261,09 (+1,22%)");
    expect(brief.summary).toContain("BRIS");
  });

  it("handles empty news list gracefully", () => {
    const emptyBrief = buildLiveMarketBrief([]);
    expect(emptyBrief.topTickers).toEqual([]);
    expect(emptyBrief.sentimentCounts).toEqual({ bullish: 0, bearish: 0, neutral: 0 });
  });

  it("filters news by explicit ticker or company name hint", () => {
    expect(filterNewsByTicker(SAMPLE_ITEMS, "BRIS")).toHaveLength(2);
    expect(filterNewsByTicker(SAMPLE_ITEMS, "PTBA")).toHaveLength(1);

    const untaggedItem: LiveMarketNewsItem = {
      id: "n5",
      title: "Ekspansi Jaringan Unilever Indonesia Capai Target",
      link: "https://example.com/5",
      publisher: "CNBC Indonesia",
      publishedAt: "2026-11-26T04:00:00.000Z",
      publishedWib: "26 Nov 2026, 11.00 WIB",
      summary: "",
      category: "CORPORATE",
      sentiment: "BULLISH",
      tickers: [],
    };
    const matchedUnvr = filterNewsByTicker([untaggedItem], "UNVR", "PT Unilever Indonesia Tbk");
    expect(matchedUnvr).toHaveLength(1);
    expect(filterNewsByTicker(SAMPLE_ITEMS, "INVALID")).toEqual([]);
  });

  it("prioritizes watchlist stories first while keeping general market stories below", () => {
    const prioritized = prioritizeWatchlistNews(SAMPLE_ITEMS, new Set(["PTBA"]));
    expect(prioritized.map((item) => item.id)).toEqual(["n3", "n1", "n2", "n4"]);

    expect(prioritizeWatchlistNews(SAMPLE_ITEMS, new Set())).toBe(SAMPLE_ITEMS);
  });

  it("computes category counts accurately under active sentiment/search/watchlist filters", () => {
    const countsAll = computeNewsCategoryCounts(SAMPLE_ITEMS, {});
    expect(countsAll).toEqual({
      ALL: 4,
      CORPORATE: 2,
      MONETARY_CURRENCY: 1,
      GLOBAL_MACRO: 0,
      DOMESTIC_POLITICS: 0,
      COMMODITIES: 1,
    });

    const countsBullish = computeNewsCategoryCounts(SAMPLE_ITEMS, { sentiment: "BULLISH" });
    expect(countsBullish.ALL).toBe(2);
    expect(countsBullish.CORPORATE).toBe(2);
    expect(countsBullish.COMMODITIES).toBe(0);

    const filteredCorp = filterLiveNewsItems(SAMPLE_ITEMS, {
      category: "CORPORATE",
      sentiment: "BULLISH",
      watchlistSet: new Set(["BBCA"]),
    });
    expect(filteredCorp.map((i) => i.id)).toEqual(["n2", "n1"]);

    const countsForPtba = computeNewsCategoryCounts(SAMPLE_ITEMS, { tickerFilter: "ptba" });
    expect(countsForPtba).toEqual({
      ALL: 1,
      CORPORATE: 0,
      MONETARY_CURRENCY: 0,
      GLOBAL_MACRO: 0,
      DOMESTIC_POLITICS: 0,
      COMMODITIES: 1,
    });
    expect(filterLiveNewsItems(SAMPLE_ITEMS, { tickerFilter: "BRIS" }).map((i) => i.id)).toEqual([
      "n1",
      "n2",
    ]);
  });

  it("curates editorial grid slots to avoid duplicate images/topics while prioritizing diversity and watchlist", () => {
    expect(areTitlesTopicallySimilar(
      "BEI Perkuat Pengawasan Perdagangan Saham dan Transparansi",
      "BEI Perkuat Sistem Pengawasan Perdagangan Saham, Tingkatkan Transparansi"
    )).toBe(true);
    expect(areTitlesTopicallySimilar(
      "IHSG Ditutup Menguat ke Level 5.242",
      "Harga Emas Dunia Melonjak ke Rekor Baru"
    )).toBe(false);

    expect(normalizeNewsImageKey("https://cdn.example.com/photo-1200x675.jpg?w=800")).toBe(
      "cdn.example.com/photo.jpg"
    );

    const curatedFeed: LiveMarketNewsItem[] = [
      {
        ...SAMPLE_ITEMS[0],
        id: "lead",
        title: "Kemenkeu Raup Dana Lelang SBN Rp35 Triliun",
        category: "DOMESTIC_POLITICS",
        imageUrl: "https://cdn.example.com/lead.jpg",
      },
      {
        ...SAMPLE_ITEMS[0],
        id: "dup-photo",
        title: "Danantara Bongkar Modus BUMN dan Tutup Anak Usaha",
        category: "DOMESTIC_POLITICS",
        imageUrl: "https://cdn.example.com/danantara-800x450.jpg",
      },
      {
        ...SAMPLE_ITEMS[0],
        id: "dup-photo-same-img",
        title: "Bukan Akuisisi! Status Danantara di Lahan RAPP Diungkap",
        category: "DOMESTIC_POLITICS",
        imageUrl: "https://cdn.example.com/danantara-1200x675.jpg?q=80",
      },
      {
        ...SAMPLE_ITEMS[1],
        id: "corp-photo",
        title: "Bank Mandiri Cetak Kenaikan Laba Kuartal III",
        category: "CORPORATE",
        imageUrl: "https://cdn.example.com/bmri.jpg",
      },
      {
        ...SAMPLE_ITEMS[2],
        id: "comm-photo",
        title: "Harga Batubara Dunia Menguat Menopang Emiten Energi",
        category: "COMMODITIES",
        imageUrl: "https://cdn.example.com/coal.jpg",
      },
      {
        ...SAMPLE_ITEMS[3],
        id: "fx-photo",
        title: "Bank Indonesia Jaga Stabilitas Rupiah di Pasar Spot",
        category: "MONETARY_CURRENCY",
        imageUrl: "https://cdn.example.com/bi.jpg",
      },
    ];

    const buckets = allocateEditorialBuckets(curatedFeed);
    expect(buckets.leadStory?.id).toBe("lead");
    // Top 3 grid should prefer diverse categories/images and skip the duplicate danantara photo
    const gridIds = buckets.gridStories.map((s) => s.id);
    expect(gridIds).toHaveLength(3);
    expect(gridIds).toContain("corp-photo");
    expect(gridIds).toContain("comm-photo");
    expect(gridIds).toContain("fx-photo");
    expect(buckets.overlayStory?.id).toBe("dup-photo");
    expect(buckets.stackedStories.map((s) => s.id)).toEqual(["dup-photo-same-img"]);
  });

  it("identifies and filters today-only WIB news cleanly alongside category counts", () => {
    const multiDayItems: LiveMarketNewsItem[] = [
      {
        ...SAMPLE_ITEMS[0],
        id: "today-1",
        publishedAt: "2026-11-27T04:00:00.000Z", // 2026-11-27 11:00 WIB
        category: "CORPORATE",
      },
      {
        ...SAMPLE_ITEMS[3],
        id: "today-2",
        publishedAt: "2026-11-26T18:00:00.000Z", // 2026-11-27 01:00 WIB (sudah hari ini di Jakarta!)
        category: "MONETARY_CURRENCY",
      },
      {
        ...SAMPLE_ITEMS[2],
        id: "yesterday-1",
        publishedAt: "2026-11-26T10:00:00.000Z", // 2026-11-26 17:00 WIB
        category: "COMMODITIES",
      },
    ];

    const todayKey = "2026-11-27";
    expect(isNewsFromToday(multiDayItems[0], todayKey)).toBe(true);
    expect(isNewsFromToday(multiDayItems[1], todayKey)).toBe(true);
    expect(isNewsFromToday(multiDayItems[2], todayKey)).toBe(false);
    expect(countTodayNewsItems(multiDayItems, todayKey)).toBe(2);

    const todayOnly = filterLiveNewsItems(multiDayItems, {
      timeRange: "TODAY",
      todayWibKey: todayKey,
    });
    expect(todayOnly.map((item) => item.id)).toEqual(["today-1", "today-2"]);

    const todayCounts = computeNewsCategoryCounts(multiDayItems, {
      timeRange: "TODAY",
      todayWibKey: todayKey,
    });
    expect(todayCounts.ALL).toBe(2);
    expect(todayCounts.CORPORATE).toBe(1);
    expect(todayCounts.MONETARY_CURRENCY).toBe(1);
    expect(todayCounts.COMMODITIES).toBe(0);
  });

  it("classifies publisher groups, computes publisher counts, and builds deterministic market Q&A insights", () => {
    expect(classifyNewsPublisherGroup("CNBC Indonesia")).toBe("CNBC");
    expect(classifyNewsPublisherGroup("ANTARA Finansial")).toBe("ANTARA");
    expect(classifyNewsPublisherGroup("CNN Indonesia")).toBe("CNN");
    expect(classifyNewsPublisherGroup("Kontan Investasi")).toBe("KONTAN");
    expect(classifyNewsPublisherGroup("Bloomberg Technoz")).toBe("OTHER");

    const pubCounts = computeNewsPublisherCounts(SAMPLE_ITEMS, {});
    expect(pubCounts).toEqual({
      ALL: 4,
      CNBC: 1,
      ANTARA: 1,
      CNN: 0,
      KONTAN: 1,
      OTHER: 1,
    });

    const kontanOnly = filterLiveNewsItems(SAMPLE_ITEMS, { publisherGroup: "KONTAN" });
    expect(kontanOnly.map((i) => i.id)).toEqual(["n3"]);

    const macroTickers: MarketTickerItem[] = [
      { symbol: "IHSG", name: "IHSG", value: "5.338,46", change: 1.84, isPositive: true },
      { symbol: "USD/IDR", name: "USD/IDR", value: "18.295", change: -0.04, isPositive: false },
    ];
    const qa = buildMarketQaInsights(SAMPLE_ITEMS, macroTickers);
    expect(qa).toHaveLength(4);
    expect(qa[0].answer).toContain("2 bernada positif");
    expect(qa[1].answer).toContain("Korporasi & bursa");
    expect(qa[2].tickers).toContain("BRIS");
    expect(qa[3].answer).toContain("IHSG di 5.338,46 (+1,84%)");
  });
});
