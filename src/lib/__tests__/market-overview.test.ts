import { describe, expect, it } from "vitest";
import {
  buildMarketPulseSummary,
  buildOverviewStockPool,
  buildSectorHeatmap,
  buildTopMovers,
} from "@/lib/market-overview";
import type { MarketQuote } from "@/lib/market-data";

const MOCK_QUOTES: Record<string, MarketQuote> = {
  BBCA: {
    ticker: "BBCA",
    name: "Bank Central Asia Tbk",
    price: 5900,
    change: 150,
    changePercent: 2.6,
    previousClose: 5750,
    lastUpdated: "11.00 WIB",
    marketState: "OPEN",
    isFallback: false,
    marketCapTrillion: 727,
    peRatio: 12.2,
    sector: "Keuangan",
  },
  BBRI: {
    ticker: "BBRI",
    name: "Bank Rakyat Indonesia Tbk",
    price: 3080,
    change: -40,
    changePercent: -1.3,
    previousClose: 3120,
    lastUpdated: "11.00 WIB",
    marketState: "OPEN",
    isFallback: false,
    marketCapTrillion: 467,
    peRatio: 7.3,
    sector: "Keuangan",
  },
  TLKM: {
    ticker: "TLKM",
    name: "Telkom Indonesia Tbk",
    price: 2500,
    change: 100,
    changePercent: 4.1,
    previousClose: 2400,
    lastUpdated: "11.00 WIB",
    marketState: "OPEN",
    isFallback: false,
    marketCapTrillion: 247,
    peRatio: 10.5,
    sector: "Telekomunikasi",
  },
  ACES: {
    ticker: "ACES",
    name: "Aspirasi Hidup Indonesia Tbk",
    price: 520,
    change: 15,
    changePercent: 3.0,
    previousClose: 505,
    lastUpdated: "11.00 WIB",
    marketState: "OPEN",
    isFallback: false,
    sector: "Konsumer Siklikal",
    peRatio: 9.8,
  },
};

describe("market-overview helpers", () => {
  it("combines curated and custom watchlist stocks, builds sector heatmap, and ranks movers", () => {
    const pool = buildOverviewStockPool({
      customWatchlist: ["BBCA", "ACES"],
      quotes: MOCK_QUOTES,
      provider: "yahoo",
      watchlistNotes: {
        BBCA: { targetBuyPrice: 6000 },
        ACES: { targetBuyPrice: 400 },
      },
    });

    expect(pool.some((p) => p.ticker === "ACES")).toBe(true);

    const heatmap = buildSectorHeatmap(pool);
    expect(heatmap[0].sector).toBe("Financials");
    expect(heatmap[0].tiles.length).toBeGreaterThanOrEqual(2);

    const gainers = buildTopMovers(pool, "gainers", 3);
    expect(gainers[0].ticker).toBe("TLKM");
    expect(gainers[1].ticker).toBe("ACES");

    const losers = buildTopMovers(pool, "losers", 2);
    expect(losers[0].ticker).toBe("BBRI");

    const buyZone = buildTopMovers(pool, "buy_zone", 5);
    expect(buyZone.map((x) => x.ticker)).toEqual(["BBCA"]);

    const pulse = buildMarketPulseSummary(pool);
    expect(pulse.buyZoneCount).toBe(1);
    expect(pulse.strongestSector?.sector).toBe("Communication Services");
  });
});
