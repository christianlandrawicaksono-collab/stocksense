import { describe, expect, it } from "vitest";
import { buildBuiltinSynthesis, buildContextSummary } from "@/lib/ai-context";

describe("ai-context helpers", () => {
  it("places live RSS news under DATA PASAR LIVE instead of illustrative section", () => {
    const summary = buildContextSummary({
      mode: "berita",
      provider: "yahoo",
      article: {
        title: "BBCA Catat Laba Bersih Naik 12% YoY",
        category: "CORPORATE",
        catalyst: "Sumber berita: CNBC Indonesia (25 Nov 2026, 10.00 WIB)",
        summary: "Pertumbuhan kredit menopang kinerja bank swasta terbesar.",
        overallImpact: "Emiten disebut: BBCA",
        isLive: true,
        publisher: "CNBC Indonesia",
        publishedWib: "25 Nov 2026, 10.00 WIB",
        tickers: ["BBCA"],
      },
    });

    expect(summary).toContain("DATA PASAR LIVE (Yahoo Finance & Berita RSS):");
    expect(summary).toContain("Berita Pasar Terkini (RSS Live):");
    expect(summary).not.toContain("DATA PROFIL & ACUAN RISET (Ilustrasi):");
    expect(summary).not.toContain("Artikel Skenario Terbuka");
  });

  it("places scenario articles under DATA PROFIL & ACUAN RISET and formats builtin response cleanly", () => {
    const context = {
      mode: "berita" as const,
      provider: "illustrative" as const,
      article: {
        title: "Skenario Kenaikan PPN",
        category: "DOMESTIC_POLITICS",
        catalyst: "Penyesuaian tarif fiskal",
        summary: "Dampak terhadap belanja ritel menengah.",
        overallImpact: "Ritel menahan belanja sekunder.",
        isLive: false,
      },
    };

    const summary = buildContextSummary(context);
    expect(summary).toContain("DATA PROFIL & ACUAN RISET (Ilustrasi):");
    expect(summary).toContain("Artikel Skenario Terbuka (Contoh):");

    const reply = buildBuiltinSynthesis("Jelaskan dampak skenario ini", context);
    expect(reply).toContain("### Analisis Transmisi: Skenario Kenaikan PPN");
  });

  it("formats builtin synthesis specifically for live RSS news", () => {
    const reply = buildBuiltinSynthesis("Bedah dampak berita ini", {
      mode: "berita",
      provider: "yahoo",
      article: {
        title: "ANTM dan MDKA Menguat Seiring Reli Emas",
        category: "COMMODITIES",
        catalyst: "Sumber berita: Kontan",
        summary: "",
        overallImpact: "Emiten disebut: ANTM, MDKA",
        isLive: true,
        publisher: "Kontan",
        publishedWib: "25 Nov 2026, 11.15 WIB",
        tickers: ["ANTM", "MDKA"],
      },
    });

    expect(reply).toContain("### Bedah Berita Pasar: ANTM dan MDKA Menguat Seiring Reli Emas");
    expect(reply).toContain("**ANTM, MDKA**");
    expect(reply).toContain("Komoditas dan energi");
    expect(reply).not.toContain("COMMODITIES");
    expect(reply).toContain("Kontan");
  });

  it("includes custom watchlist peers in context summary and supports watchlist comparison without zero division", () => {
    const context = {
      mode: "terminal" as const,
      provider: "yahoo" as const,
      customWatchlist: ["ACES", "BRIS"],
      stock: {
        ticker: "ACES",
        name: "Aspirasi Hidup Indonesia Tbk",
        sector: "Consumer Cyclicals",
        price: 820,
        changePercent: 1.2,
        peRatio: 15.2,
        historicalPeMean: 0,
        pbvRatio: 2.1,
        dividendYield: 3.4,
        isLive: true,
        isCurated: false,
      },
      watchlistPeers: [
        {
          ticker: "ACES",
          sector: "Consumer Cyclicals",
          price: 820,
          changePercent: 1.2,
          peRatio: 15.2,
          pbvRatio: 2.1,
          dividendYield: 3.4,
          isLive: true,
          isInCustomWatchlist: true,
        },
        {
          ticker: "BRIS",
          sector: "Financials",
          price: 2950,
          changePercent: -0.5,
          peRatio: 19.4,
          pbvRatio: 3.2,
          dividendYield: 0.9,
          isLive: true,
          isInCustomWatchlist: true,
        },
      ],
    };

    const summary = buildContextSummary(context);
    expect(summary).toContain("Watchlist Custom Pengguna (2 emiten):");
    expect(summary).toContain("ACES");
    expect(summary).toContain("BRIS");

    const watchlistCompare = buildBuiltinSynthesis("Bandingkan saham di watchlist saya", context);
    expect(watchlistCompare).toContain("Ringkasan Komparasi Watchlist Saya");
    expect(watchlistCompare).toContain("**ACES**");
    expect(watchlistCompare).toContain("**BRIS**");

    const stockEval = buildBuiltinSynthesis("Evaluasi saham ini", context);
    expect(stockEval).not.toContain("NaN");
    expect(stockEval).not.toContain("Infinity");
  });

  it("includes user watchlist target buy price and note in context summary and builtin synthesis", () => {
    const context = {
      mode: "terminal" as const,
      provider: "yahoo" as const,
      stock: {
        ticker: "BBCA",
        name: "Bank Central Asia Tbk",
        sector: "Financials",
        price: 5900,
        changePercent: 1.3,
        peRatio: 12.2,
        historicalPeMean: 21.8,
        targetMeanPrice: 10540,
        pbvRatio: 2.56,
        dividendYield: 6.5,
        isLive: true,
        isCurated: true,
        isInWatchlist: true,
        targetBuyPrice: 6000,
        watchlistNote: "Akumulasi bertahap saat diskon -2 SD",
      },
    };

    const summary = buildContextSummary(context);
    expect(summary).toContain("Rencana Watchlist Pengguna (BBCA):");
    expect(summary).toContain("Target Harga Beli Rp 6.000");
    expect(summary).toContain("SUDAH MASUK AREA BELI");
    expect(summary).toContain('Catatan riset: "Akumulasi bertahap saat diskon -2 SD"');

    const reply = buildBuiltinSynthesis("Evaluasi target beli BBCA", context);
    expect(reply).toContain("*Target Beli Watchlist:* **Rp 6.000**");
    expect(reply).toContain("SUDAH MASUK AREA BELI");
    expect(reply).toContain("Akumulasi bertahap saat diskon -2 SD");
  });
});
