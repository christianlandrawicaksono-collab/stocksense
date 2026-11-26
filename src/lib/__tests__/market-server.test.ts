import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/yahoo-cache", () => ({
  fetchYahooQuotesCached: vi.fn(),
  fetchYahooProfileCached: vi.fn(),
  fetchYahooChartCached: vi.fn(),
  fetchYahooSearchCached: vi.fn(),
}));

import { localizeYahooSector } from "@/lib/market-data";
import { getBatchQuotesServer } from "@/lib/market-server";
import { fetchYahooProfileCached, fetchYahooQuotesCached } from "@/lib/yahoo-cache";

describe("market-server sector localization & custom quote enrichment", () => {
  it("localizes standard Yahoo Finance sectors into Indonesian labels", () => {
    expect(localizeYahooSector("Financial Services")).toBe("Keuangan");
    expect(localizeYahooSector("Consumer Cyclical")).toBe("Konsumer Siklikal");
    expect(localizeYahooSector("Basic Materials")).toBe("Bahan Baku & Tambang");
    expect(localizeYahooSector("Custom Niche Sector")).toBe("Custom Niche Sector");
    expect(localizeYahooSector("")).toBeUndefined();
  });

  it("enriches custom BEI tickers with localized sector, ROE, and DER from Yahoo profile cache", async () => {
    vi.mocked(fetchYahooQuotesCached).mockResolvedValueOnce([
      {
        symbol: "SIDO.JK",
        shortName: "Industri Jamu Dan Farmasi Sido Muncul",
        regularMarketPrice: 615,
        regularMarketChange: 10,
        regularMarketChangePercent: 1.65,
        regularMarketPreviousClose: 605,
        trailingPE: 16.4,
        priceToBook: 4.8,
        dividendYield: 5.2,
      },
      {
        symbol: "MAPI.JK",
        shortName: "Mitra Adiperkasa Tbk",
        regularMarketPrice: 1420,
        regularMarketChange: -15,
        regularMarketChangePercent: -1.04,
        regularMarketPreviousClose: 1435,
        trailingPE: 11.2,
        priceToBook: 2.1,
      },
    ]);

    vi.mocked(fetchYahooProfileCached).mockImplementation(async (symbol: string) => {
      if (symbol === "SIDO.JK") {
        return { sector: "Healthcare", roe: 29.4, der: 0.14 };
      }
      throw new Error("Profile temporarily unavailable");
    });

    const quotes = await getBatchQuotesServer(["SIDO", "MAPI"]);

    expect(quotes.SIDO).toBeDefined();
    expect(quotes.SIDO.sector).toBe("Kesehatan");
    expect(quotes.SIDO.roe).toBe(29.4);
    expect(quotes.SIDO.der).toBe(0.14);

    // Resilience: failed profile lookup should not drop price quotes
    expect(quotes.MAPI).toBeDefined();
    expect(quotes.MAPI.price).toBe(1420);
    expect(quotes.MAPI.roe).toBeUndefined();
    expect(quotes.MAPI.der).toBeUndefined();
  });
});
