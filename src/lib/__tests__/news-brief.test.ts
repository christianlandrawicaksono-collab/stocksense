import { describe, expect, it } from "vitest";
import { buildLiveMarketBrief, filterNewsByTicker } from "@/lib/news-brief";
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
});
