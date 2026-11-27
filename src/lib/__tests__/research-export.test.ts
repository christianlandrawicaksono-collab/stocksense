import { describe, expect, it } from "vitest";
import {
  buildAllocationPlanMarkdown,
  buildComparisonResearchMarkdown,
  buildStockResearchMarkdown,
} from "@/lib/research-export";
import { simulatePortfolioAllocation } from "@/lib/portfolio-allocator";
import { computeComparisonWinners, type ComparableStockMetrics } from "@/lib/compare";

describe("research-export Markdown builders", () => {
  it("formats single-stock valuation, target buy, note, and fundamentals cleanly", () => {
    const md = buildStockResearchMarkdown({
      ticker: "BBCA",
      name: "Bank Central Asia Tbk",
      sector: "Financials",
      price: 5900,
      changePercent: 1.3,
      sourceLabel: "Yahoo Finance",
      updatedAt: "27 Nov 2026, 08.30 WIB",
      valuationLabel: "Undervalued (antara -2 SD dan -1 SD)",
      valuationVerdict: "Rasio P/E di bawah rerata historis.",
      peRatio: 12.2,
      pbvRatio: 2.56,
      dividendYield: 6.5,
      roe: 21.8,
      der: 0.5,
      payoutRatio: 64.0,
      grahamNumber: 6200,
      grahamUpsidePct: 5.1,
      bands: {
        kind: "curated",
        historicalPeMean: 18.0,
        peSd1Minus: 15.0,
        peSd2Minus: 12.0,
        targetMeanPrice: 8700,
        targetSd1MinusPrice: 7250,
        targetSd2MinusPrice: 5800,
        meanUpsidePct: 47.5,
      },
      targetBuyPrice: 6000,
      note: "Cicil beli bertahap",
    });

    expect(md).toContain("# BBCA — Bank Central Asia Tbk (Financials)");
    expect(md).toContain("Rp 5.900");
    expect(md).toContain("Area Beli");
    expect(md).toContain("Cicil beli bertahap");
    expect(md).toContain("P/E Ratio (TTM): 12,2x");
    expect(md).toContain("Nilai Intrinsik Graham: Rp 6.200");
    expect(md).toContain("ROE: 21,8%");
  });

  it("handles custom stocks without P/E bands or optional metrics cleanly", () => {
    const md = buildStockResearchMarkdown({
      ticker: "ACES",
      name: "Aspirasi Hidup Indonesia Tbk",
      sector: "Consumer Cyclical",
      price: 520,
      changePercent: -1.0,
      sourceLabel: "Yahoo Finance",
      valuationLabel: "P/E Live 10,5x",
      valuationVerdict: "Emiten kustom bursa.",
      peRatio: 10.5,
      pbvRatio: 1.4,
      dividendYield: 0,
      roe: undefined,
      der: undefined,
      marketCapTrillion: 8.9,
      bands: null,
    });

    expect(md).toContain("# ACES — Aspirasi Hidup Indonesia Tbk (Consumer Cyclical)");
    expect(md).toContain("ROE: -");
    expect(md).toContain("DER (Utang): -");
    expect(md).toContain("Kapitalisasi Pasar: Rp 8,9 T");
    expect(md).not.toContain("## Target Beli & Catatan Watchlist");
  });

  it("formats multi-stock comparison Markdown table with metric winners and target statuses", () => {
    const metrics: ComparableStockMetrics[] = [
      {
        ticker: "BBCA",
        name: "Bank Central Asia Tbk",
        sector: "Financials",
        price: 5900,
        changePercent: 1.3,
        peRatio: 12.2,
        pbvRatio: 2.56,
        dividendYield: 6.5,
        roe: 21.5,
        der: 0.4,
        marketCapTrillion: 727.4,
        targetBuyPrice: 6000,
        isLive: true,
      },
      {
        ticker: "BBRI",
        name: "Bank Rakyat Indonesia Tbk",
        sector: "Financials",
        price: 3080,
        changePercent: 0.3,
        peRatio: 7.3,
        pbvRatio: 1.37,
        dividendYield: 13.6,
        roe: 19.2,
        der: 0.7,
        marketCapTrillion: 466.8,
        targetBuyPrice: 3000,
        isLive: true,
      },
    ];

    const winners = computeComparisonWinners(metrics);
    const md = buildComparisonResearchMarkdown({
      metrics,
      winners,
      compareRange: "6Bl",
      normalizedSeries: [
        { ticker: "BBCA", points: [], totalReturnPct: 8.4 },
        { ticker: "BBRI", points: [], totalReturnPct: -2.1 },
      ],
      providerLabel: "Yahoo Finance",
    });

    expect(md).toContain("# Perbandingan Saham: BBCA vs BBRI");
    expect(md).toContain("BBCA: +8,4% | BBRI: -2,1%");
    expect(md).toContain("| Metrik | BBCA | BBRI |");
    expect(md).toContain("7,3x (Terendah)");
    expect(md).toContain("13,6% (Tertinggi)");
    expect(md).toContain("21,5% (Tertinggi)");
    expect(md).toContain("Rp 6.000 (Area Beli)");
    expect(md).toContain("Rp 3.000 (Dekat)");
  });

  it("formats Watchlist portfolio allocation plan Markdown cleanly", () => {
    const summary = simulatePortfolioAllocation({
      totalCapitalRp: 10_000_000,
      candidates: [
        {
          ticker: "BBCA",
          name: "Bank Central Asia Tbk",
          sector: "Financials",
          price: 6000,
          peRatio: 12,
          pbvRatio: 2.5,
          dividendYield: 6.0,
          targetStatus: "hit",
        },
        {
          ticker: "TLKM",
          name: "Telkom Indonesia Tbk",
          sector: "Infrastructures",
          price: 2500,
          peRatio: 10,
          pbvRatio: 1.8,
          dividendYield: 8.0,
          targetStatus: "above",
        },
      ],
      weightsByTicker: { BBCA: 60, TLKM: 40 },
    });

    const md = buildAllocationPlanMarkdown({
      summary,
      presetLabel: "Bobot Kustom",
      providerLabel: "Yahoo Finance",
    });

    expect(md).toContain("# Rencana Alokasi Modal Watchlist");
    expect(md).toContain("Rp 10.000.000");
    expect(md).toContain("10 lot");
    expect(md).toContain("16 lot");
    expect(md).toContain("Komposisi Sektor:");
    expect(md).toContain("Financials (60,0%)");
  });
});
