import { describe, expect, it } from "vitest";
import { buildBuiltinSynthesis, buildContextSummary } from "@/lib/ai-context";

describe("ai-context helpers", () => {
  it("places live RSS news under DATA PASAR LIVE instead of illustrative section", () => {
    const summary = buildContextSummary({
      mode: "berita",
      provider: "yahoo",
      article: {
        title: "BBCA Catat Laba Bersih Naik 12% YoY",
        category: "CORPORATE",
        catalyst: "Sumber berita: CNBC Indonesia (25 Nov 2026, 10.00 WIB)",
        summary: "Pertumbuhan kredit menopang kinerja bank swasta terbesar.",
        overallImpact: "Emiten disebut: BBCA",
        isLive: true,
        publisher: "CNBC Indonesia",
        publishedWib: "25 Nov 2026, 10.00 WIB",
        tickers: ["BBCA"],
      },
    });

    expect(summary).toContain("DATA PASAR LIVE (Yahoo Finance & Berita RSS):");
    expect(summary).toContain("Berita Pasar Terkini (RSS Live):");
    expect(summary).not.toContain("DATA PROFIL & ACUAN RISET (Ilustrasi):");
    expect(summary).not.toContain("Artikel Skenario Terbuka");
  });

  it("places scenario articles under DATA PROFIL & ACUAN RISET and formats builtin response cleanly", () => {
    const context = {
      mode: "berita" as const,
      provider: "illustrative" as const,
      article: {
        title: "Skenario Kenaikan PPN",
        category: "DOMESTIC_POLITICS",
        catalyst: "Penyesuaian tarif fiskal",
        summary: "Dampak terhadap belanja ritel menengah.",
        overallImpact: "Ritel menahan belanja sekunder.",
        isLive: false,
      },
    };

    const summary = buildContextSummary(context);
    expect(summary).toContain("DATA PROFIL & ACUAN RISET (Ilustrasi):");
    expect(summary).toContain("Artikel Skenario Terbuka (Contoh):");

    const reply = buildBuiltinSynthesis("Jelaskan dampak skenario ini", context);
    expect(reply).toContain("### Analisis Transmisi: Skenario Kenaikan PPN");
  });

  it("formats builtin synthesis specifically for live RSS news", () => {
    const reply = buildBuiltinSynthesis("Bedah dampak berita ini", {
      mode: "berita",
      provider: "yahoo",
      article: {
        title: "ANTM dan MDKA Menguat Seiring Reli Emas",
        category: "COMMODITIES",
        catalyst: "Sumber berita: Kontan",
        summary: "",
        overallImpact: "Emiten disebut: ANTM, MDKA",
        isLive: true,
        publisher: "Kontan",
        publishedWib: "25 Nov 2026, 11.15 WIB",
        tickers: ["ANTM", "MDKA"],
      },
    });

    expect(reply).toContain("### Bedah Berita Pasar: ANTM dan MDKA Menguat Seiring Reli Emas");
    expect(reply).toContain("**ANTM, MDKA**");
    expect(reply).toContain("Kontan");
  });
});
