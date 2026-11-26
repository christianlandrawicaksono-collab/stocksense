import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_WATCHLIST,
  addTickerToWatchlist,
  evaluateTargetBuyStatus,
  matchesWatchlistFilterPreset,
  normalizeIdxTicker,
  parseWatchlistJson,
  parseWatchlistNotesJson,
  removeTickerFromWatchlist,
  sanitizeWatchlistNotes,
  sanitizeWatchlistTickers,
  toggleTickerInWatchlist,
} from "@/lib/watchlist";

describe("watchlist helpers", () => {
  it("normalizes and validates 4-letter IDX tickers", () => {
    expect(normalizeIdxTicker(" bbca ")).toBe("BBCA");
    expect(normalizeIdxTicker("aces")).toBe("ACES");
    expect(normalizeIdxTicker("IHSG1")).toBeNull();
    expect(normalizeIdxTicker("ABC")).toBeNull();
    expect(normalizeIdxTicker("ABCDE")).toBeNull();
  });

  it("sanitizes, deduplicates, and caps ticker arrays safely", () => {
    expect(parseWatchlistJson("invalid-json")).toEqual([]);
    expect(parseWatchlistJson(null)).toEqual([]);
    expect(
      sanitizeWatchlistTickers([" bbca ", "BBCA", "bad", 123, "sido", "aces"], 2)
    ).toEqual(["BBCA", "SIDO"]);
  });

  it("adds, removes, toggles, and enforces MAX_CUSTOM_WATCHLIST limit", () => {
    let list = addTickerToWatchlist([], "aces");
    expect(list).toEqual(["ACES"]);

    list = addTickerToWatchlist(list, "bbca");
    expect(list).toEqual(["BBCA", "ACES"]);

    // Ignore duplicates
    expect(addTickerToWatchlist(list, "ACES")).toBe(list);

    list = removeTickerFromWatchlist(list, "aces");
    expect(list).toEqual(["BBCA"]);

    list = toggleTickerInWatchlist(list, "sido");
    expect(list).toEqual(["SIDO", "BBCA"]);

    list = toggleTickerInWatchlist(list, "bbca");
    expect(list).toEqual(["SIDO"]);

    const full = Array.from(
      { length: MAX_CUSTOM_WATCHLIST },
      (_, i) => `AAA${String.fromCharCode(65 + i)}`
    );
    expect(addTickerToWatchlist(full, "BBCA")).toBe(full);
  });

  it("evaluates screener filter presets accurately including custom ROE and DER values", () => {
    const customStrong = { dividendYield: 5.5, peRatio: 10.2, roe: 21.4, der: 0.45 };
    const customMissingFundamentals = {
      dividendYield: 2.0,
      peRatio: 18.0,
      roe: undefined,
      der: undefined,
    };

    expect(matchesWatchlistFilterPreset(customStrong, "ALL")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "DIVIDEND")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "UNDERVALUED")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "PROFITABLE")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "LOW_DEBT")).toBe(true);

    expect(matchesWatchlistFilterPreset(customMissingFundamentals, "PROFITABLE")).toBe(false);
    expect(matchesWatchlistFilterPreset(customMissingFundamentals, "LOW_DEBT")).toBe(false);
  });

  it("evaluates target buy price status and sanitizes notes metadata cleanly", () => {
    expect(evaluateTargetBuyStatus(8500, 8500).status).toBe("hit");
    expect(evaluateTargetBuyStatus(8200, 8500).status).toBe("hit");
    expect(evaluateTargetBuyStatus(8800, 8500).status).toBe("near");
    expect(evaluateTargetBuyStatus(9600, 8500).status).toBe("above");
    expect(evaluateTargetBuyStatus(0, 8500).status).toBe("none");

    expect(parseWatchlistNotesJson("bad-json")).toEqual({});
    const cleanNotes = sanitizeWatchlistNotes({
      " bbca ": { targetBuyPrice: 8500.4, note: "  Tunggu koreksi Q1  " },
      INVALID: { targetBuyPrice: 1000 },
      aces: { targetBuyPrice: -10, note: "" },
    });
    expect(cleanNotes).toEqual({
      BBCA: { targetBuyPrice: 8500, note: "Tunggu koreksi Q1" },
    });
  });
});
