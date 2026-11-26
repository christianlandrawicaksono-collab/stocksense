import { describe, expect, it } from "vitest";
import {
  computeComparisonWinners,
  normalizeComparisonHistories,
  type ComparableStockMetrics,
} from "@/lib/compare";

describe("compare helpers", () => {
  it("identifies winners cleanly across P/E, PBV, Dividend Yield, ROE, and DER", () => {
    const items: ComparableStockMetrics[] = [
      {
        ticker: "BBCA",
        name: "Bank Central Asia",
        sector: "Keuangan",
        price: 9800,
        changePercent: 0.5,
        peRatio: 22.4,
        pbvRatio: 4.5,
        dividendYield: 2.8,
        roe: 21.5,
        der: 0.9,
        isLive: true,
      },
      {
        ticker: "BBRI",
        name: "Bank Rakyat Indonesia",
        sector: "Keuangan",
        price: 4700,
        changePercent: -0.4,
        peRatio: 11.2,
        pbvRatio: 2.1,
        dividendYield: 6.4,
        roe: 19.2,
        der: 1.4,
        isLive: true,
      },
      {
        ticker: "SIDO",
        name: "Sido Muncul",
        sector: "Kesehatan",
        price: 615,
        changePercent: 1.2,
        peRatio: 16.0,
        pbvRatio: 4.8,
        dividendYield: 5.1,
        roe: 28.4,
        der: 0.14,
        isLive: true,
      },
    ];

    expect(computeComparisonWinners(items)).toEqual({
      lowestPeTicker: "BBRI",
      lowestPbvTicker: "BBRI",
      highestDividendTicker: "BBRI",
      highestRoeTicker: "SIDO",
      lowestDerTicker: "SIDO",
    });

    expect(computeComparisonWinners([items[0]])).toEqual({
      lowestPeTicker: null,
      lowestPbvTicker: null,
      highestDividendTicker: null,
      highestRoeTicker: null,
      lowestDerTicker: null,
    });
  });

  it("aligns comparison histories to overlapping baseline and computes cumulative % returns", () => {
    const normalized = normalizeComparisonHistories(
      {
        BBCA: [
          { time: "2026-01-01", open: 9000, high: 9000, low: 9000, close: 9000, volume: 10 },
          { time: "2026-02-01", open: 10000, high: 10000, low: 10000, close: 10000, volume: 10 },
          { time: "2026-03-01", open: 11000, high: 11000, low: 11000, close: 11000, volume: 10 },
        ],
        ACES: [
          { time: "2026-02-01", open: 800, high: 800, low: 800, close: 800, volume: 10 },
          { time: "2026-03-01", open: 920, high: 920, low: 920, close: 920, volume: 10 },
        ],
      },
      ["BBCA", "ACES"]
    );

    expect(normalized).toHaveLength(2);
    // Common baseline date is 2026-02-01 -> BBCA starts at 10000 -> +10% at 2026-03-01
    expect(normalized[0].points.map((p) => p.time)).toEqual(["2026-02-01", "2026-03-01"]);
    expect(normalized[0].totalReturnPct).toBeCloseTo(10, 4);
    expect(normalized[1].totalReturnPct).toBeCloseTo(15, 4);
  });
});
