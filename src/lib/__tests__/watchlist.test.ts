import { describe, expect, it } from "vitest";
import {
  MAX_CUSTOM_WATCHLIST,
  addTickerToWatchlist,
  normalizeIdxTicker,
  parseWatchlistJson,
  removeTickerFromWatchlist,
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
});
