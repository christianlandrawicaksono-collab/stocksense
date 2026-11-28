import { describe, expect, it } from "vitest";
import {
  GLOBAL_MARKET_HUBS,
  buildFallbackGlobalMarkets,
  evaluateGlobalMarketSession,
  formatGlobalCurrency,
  summarizeGlobalSentiment,
} from "../global-markets";

describe("global-markets helpers", () => {
  it("contains 10 global financial hubs with 4 stocks each", () => {
    expect(GLOBAL_MARKET_HUBS).toHaveLength(10);
    for (const hub of GLOBAL_MARKET_HUBS) {
      expect(hub.stocks).toHaveLength(4);
      expect(hub.isoNumeric).toMatch(/^\d{3}$/);
    }
  });

  it("evaluates NYSE open vs Tokyo closed accurately across timezones", () => {
    const usHub = GLOBAL_MARKET_HUBS.find((h) => h.id === "US")!;
    const jpHub = GLOBAL_MARKET_HUBS.find((h) => h.id === "JP")!;

    // Wednesday 2026-10-14 15:00 UTC => 11:00 EDT (NYSE open) & 00:00 JST Thu (TSE closed)
    const sampleDate = new Date("2026-10-14T15:00:00Z");
    const usSession = evaluateGlobalMarketSession(usHub, sampleDate);
    const jpSession = evaluateGlobalMarketSession(jpHub, sampleDate);

    expect(usSession.isOpen).toBe(true);
    expect(usSession.statusLabel).toBe("Buka");
    expect(jpSession.isOpen).toBe(false);
    expect(jpSession.statusLabel).toBe("Tutup");
  });

  it("treats weekends as closed across non-ID hubs", () => {
    const ukHub = GLOBAL_MARKET_HUBS.find((h) => h.id === "UK")!;
    // Saturday 2026-10-17 11:00 UTC
    const sat = new Date("2026-10-17T11:00:00Z");
    const ukSession = evaluateGlobalMarketSession(ukHub, sat);
    expect(ukSession.isOpen).toBe(false);
    expect(ukSession.detailLabel).toBe("Akhir Pekan");
  });

  it("formats global currencies cleanly in Indonesian number style", () => {
    expect(formatGlobalCurrency(141.8, "USD")).toBe("$141,80");
    expect(formatGlobalCurrency(2745, "JPY")).toBe("¥2.745");
    expect(formatGlobalCurrency(9850, "IDR")).toBe("Rp 9.850");
    expect(formatGlobalCurrency(42.35, "SGD")).toBe("S$42,35");
  });

  it("summarizes Risk-On vs Risk-Off sentiment accurately", () => {
    const hubs = buildFallbackGlobalMarkets(new Date("2026-10-14T15:00:00Z"));
    const summary = summarizeGlobalSentiment(hubs);
    expect(summary.totalCount).toBe(10);
    expect(summary.moodLabel).toBe("Risk-On");
    expect(summary.moodTone).toBe("emerald");

    const bearishHubs = hubs.map((h) => ({
      ...h,
      primaryIndex: { ...h.primaryIndex, changePercent: -1.4 },
    }));
    const bearishSummary = summarizeGlobalSentiment(bearishHubs);
    expect(bearishSummary.moodLabel).toBe("Risk-Off");
    expect(bearishSummary.moodTone).toBe("coral");
  });
});
