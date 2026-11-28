import { describe, expect, it } from "vitest";
import {
  buildFallbackGlobalNewsItems,
  buildGlobalNewsChaptersAndPins,
  classifyGlobalNewsRegion,
  detectGlobalNewsSentiment,
  mapMacroSymbolToNewsChapter,
} from "../global-news";

describe("global-news geo-tagging & scrollytelling helpers", () => {
  it("classifies global macro headlines into accurate regions and chapters", () => {
    expect(classifyGlobalNewsRegion("Federal Reserve signals rate cut as S&P 500 rallies")).toEqual({
      regionId: "US",
      chapterId: "US",
    });
    expect(classifyGlobalNewsRegion("OPEC+ trims crude oil output amid Middle East tension")).toEqual({
      regionId: "ME",
      chapterId: "ME",
    });
    expect(classifyGlobalNewsRegion("China unveils new stimulus lifting Shanghai and nickel")).toEqual({
      regionId: "CN",
      chapterId: "ASIA",
    });
    expect(classifyGlobalNewsRegion("Bank of Japan lifts rates as Nikkei surges")).toEqual({
      regionId: "JP",
      chapterId: "ASIA",
    });
    expect(classifyGlobalNewsRegion("FTSE 100 and ECB monitor Eurozone inflation")).toEqual({
      regionId: "EU",
      chapterId: "EU",
    });
    expect(classifyGlobalNewsRegion("IHSG menguat dipimpin BBCA dan kebijakan BI-Rate")).toEqual({
      regionId: "ID",
      chapterId: "ID",
    });
  });

  it("detects bullish vs bearish sentiment across English and Indonesian headlines", () => {
    expect(detectGlobalNewsSentiment("Wall Street surges to record high on rate cut optimism")).toBe("BULLISH");
    expect(detectGlobalNewsSentiment("Oil prices plunge on recession fears and tariff selloff")).toBe("BEARISH");
    expect(detectGlobalNewsSentiment("IHSG melonjak naik ditopang laba perbankan")).toBe("BULLISH");
  });

  it("maps macro ticker symbols cleanly to matching 3D Globe news chapters", () => {
    expect(mapMacroSymbolToNewsChapter("S&P 500")).toBe("US");
    expect(mapMacroSymbolToNewsChapter("BRENT")).toBe("ME");
    expect(mapMacroSymbolToNewsChapter("COAL")).toBe("ASIA");
    expect(mapMacroSymbolToNewsChapter("GOLD")).toBe("ASIA");
    expect(mapMacroSymbolToNewsChapter("IHSG")).toBe("ID");
    expect(mapMacroSymbolToNewsChapter("USD/IDR")).toBe("ID");
  });

  it("builds all 5 scrollytelling chapters and 3D globe pins even when domestic list is empty", () => {
    const fallbacks = buildFallbackGlobalNewsItems();
    const { chapters, pins } = buildGlobalNewsChaptersAndPins(fallbacks, []);
    expect(chapters).toHaveLength(5);
    expect(chapters.map((c) => c.id)).toEqual(["US", "EU", "ME", "ASIA", "ID"]);
    expect(pins.length).toBeGreaterThanOrEqual(5);
    for (const ch of chapters) {
      expect(ch.items.length).toBeGreaterThan(0);
      expect(ch.sensitiveBeiTickers.length).toBeGreaterThan(0);
    }
  });
});
