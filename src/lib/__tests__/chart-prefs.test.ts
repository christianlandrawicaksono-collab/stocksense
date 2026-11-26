import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHART_PREFS,
  parseChartPreferencesJson,
  resolveEffectiveTimeframe,
  sanitizeChartPreferences,
} from "@/lib/chart-prefs";
import { normalizeHistoryRange, sliceIllustrativeSeries } from "@/lib/market-data";

describe("chart-prefs & history range helpers", () => {
  it("normalizes HistoryRange values safely with fallback", () => {
    expect(normalizeHistoryRange("1Bl")).toBe("1Bl");
    expect(normalizeHistoryRange("3Bl")).toBe("3Bl");
    expect(normalizeHistoryRange("6Bl")).toBe("6Bl");
    expect(normalizeHistoryRange("Semua")).toBe("Semua");
    expect(normalizeHistoryRange("INVALID", "3Bl")).toBe("3Bl");
    expect(normalizeHistoryRange(null, "Semua")).toBe("Semua");
  });

  it("slices illustrative quarterly data sensibly for short and long timeframes", () => {
    const data = Array.from({ length: 28 }, (_, i) => i + 1);
    expect(sliceIllustrativeSeries(data, "1Bl")).toHaveLength(4);
    expect(sliceIllustrativeSeries(data, "3Bl")).toHaveLength(4);
    expect(sliceIllustrativeSeries(data, "6Bl")).toHaveLength(4);
    expect(sliceIllustrativeSeries(data, "1Th")).toHaveLength(5);
    expect(sliceIllustrativeSeries(data, "3Th")).toHaveLength(13);
    expect(sliceIllustrativeSeries(data, "5Th")).toHaveLength(21);
    expect(sliceIllustrativeSeries(data, "Semua")).toHaveLength(28);
  });

  it("parses and sanitizes persisted chart preferences safely", () => {
    expect(parseChartPreferencesJson("")).toEqual(DEFAULT_CHART_PREFS);
    expect(parseChartPreferencesJson("not-json")).toEqual(DEFAULT_CHART_PREFS);

    const parsed = sanitizeChartPreferences({
      chartType: "line",
      showVolume: false,
      showMa20: true,
      showMa50: "bad",
      showFairValue: true,
      showTargetBuy: false,
      timeframe: "6Bl",
    });

    expect(parsed).toEqual({
      chartType: "line",
      showVolume: false,
      showMa20: true,
      showMa50: false,
      showFairValue: true,
      showTargetBuy: false,
      timeframe: "6Bl",
    });

    const invalidTf = sanitizeChartPreferences({ timeframe: "99Y" });
    expect(invalidTf.timeframe).toBeNull();
  });

  it("resolves default timeframe per provider when user has not overridden it", () => {
    expect(resolveEffectiveTimeframe(DEFAULT_CHART_PREFS, "yahoo")).toBe("3Bl");
    expect(resolveEffectiveTimeframe(DEFAULT_CHART_PREFS, "illustrative")).toBe("Semua");
    expect(
      resolveEffectiveTimeframe({ ...DEFAULT_CHART_PREFS, timeframe: "1Th" }, "yahoo")
    ).toBe("1Th");
  });
});
