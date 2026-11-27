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
  summarizeWatchlistBuySignals,
  toggleTickerInWatchlist,
  buildWatchlistBackupJson,
  parseWatchlistBackupInput,
  applyWatchlistImport,
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
    const customStrong = {
      dividendYield: 5.5,
      peRatio: 10.2,
      roe: 21.4,
      der: 0.45,
      targetStatus: "hit" as const,
    };
    const customMissingFundamentals = {
      dividendYield: 2.0,
      peRatio: 18.0,
      roe: undefined,
      der: undefined,
      targetStatus: "above" as const,
    };

    expect(matchesWatchlistFilterPreset(customStrong, "ALL")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "TARGET_BUY")).toBe(true);
    expect(matchesWatchlistFilterPreset({ ...customStrong, targetStatus: "near" }, "TARGET_BUY")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "DIVIDEND")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "UNDERVALUED")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "PROFITABLE")).toBe(true);
    expect(matchesWatchlistFilterPreset(customStrong, "LOW_DEBT")).toBe(true);

    expect(matchesWatchlistFilterPreset(customMissingFundamentals, "TARGET_BUY")).toBe(false);
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

  it("summarizes watchlist buy signals for hit and near items while ignoring non-watchlist notes", () => {
    const summary = summarizeWatchlistBuySignals(
      ["BBCA", "ACES", "TLKM", "BBRI"],
      {
        BBCA: { targetBuyPrice: 6000 },
        ACES: { targetBuyPrice: 500 },
        TLKM: { targetBuyPrice: 2000 },
        BBRI: { targetBuyPrice: 3000 },
        ASII: { targetBuyPrice: 6000 }, // stale note outside active watchlist
      },
      {
        BBCA: 5700, // hit (-5%)
        ACES: 520,  // near (+4%)
        TLKM: 2000, // hit (0%)
        BBRI: 3500, // above (+16.7%)
        ASII: 5000,
      }
    );

    expect(summary.hitItems.map((i) => i.ticker)).toEqual(["BBCA", "TLKM"]);
    expect(summary.nearItems.map((i) => i.ticker)).toEqual(["ACES"]);
    expect(summary.totalActionable).toBe(3);
  });

  it("exports watchlist JSON scoped to active tickers and parses valid/invalid imports safely", () => {
    const json = buildWatchlistBackupJson(
      ["BBCA", "ACES"],
      {
        BBCA: { targetBuyPrice: 6500, note: "Area -2 SD" },
        ASII: { targetBuyPrice: 5000, note: "Stale deleted ticker" },
      },
      "2026-11-27T02:00:00.000Z"
    );

    const parsed = parseWatchlistBackupInput(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.tickers).toEqual(["BBCA", "ACES"]);
      expect(parsed.notes).toEqual({
        BBCA: { targetBuyPrice: 6500, note: "Area -2 SD" },
      });
    }

    const arrayImport = parseWatchlistBackupInput('["bbri", "TLKM", "INVALID", "BBRI"]');
    expect(arrayImport.ok).toBe(true);
    if (arrayImport.ok) {
      expect(arrayImport.tickers).toEqual(["BBRI", "TLKM"]);
      expect(arrayImport.ignoredCount).toBe(2);
    }

    expect(parseWatchlistBackupInput("{bad").ok).toBe(false);
    expect(parseWatchlistBackupInput('{"tickers": ["1234"]}').ok).toBe(false);
  });

  it("applies watchlist imports in both merge (respecting cap) and replace modes", () => {
    const mergeResult = applyWatchlistImport({
      currentTickers: ["BBCA", "BBRI"],
      currentNotes: { BBCA: { targetBuyPrice: 7000 } },
      importedTickers: ["BBRI", "TLKM", "ASII"],
      importedNotes: {
        BBRI: { targetBuyPrice: 3100, note: "Dividen tinggi" },
        TLKM: { targetBuyPrice: 2700 },
      },
      mode: "merge",
    });

    expect(mergeResult.tickers).toEqual(["BBCA", "BBRI", "TLKM", "ASII"]);
    expect(mergeResult.addedCount).toBe(2);
    expect(mergeResult.updatedCount).toBe(1);
    expect(mergeResult.notes).toEqual({
      BBCA: { targetBuyPrice: 7000 },
      BBRI: { targetBuyPrice: 3100, note: "Dividen tinggi" },
      TLKM: { targetBuyPrice: 2700 },
    });

    const replaceResult = applyWatchlistImport({
      currentTickers: ["BBCA", "BBRI"],
      currentNotes: { BBCA: { targetBuyPrice: 7000 } },
      importedTickers: ["TLKM"],
      importedNotes: { TLKM: { targetBuyPrice: 2700 } },
      mode: "replace",
    });

    expect(replaceResult.tickers).toEqual(["TLKM"]);
    expect(replaceResult.notes).toEqual({ TLKM: { targetBuyPrice: 2700 } });
  });
});
