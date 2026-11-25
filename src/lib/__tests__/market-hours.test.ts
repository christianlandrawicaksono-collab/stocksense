import { describe, expect, it } from "vitest";
import { getIdxMarketStatus } from "@/lib/market-hours";

describe("getIdxMarketStatus (WIB / Asia/Jakarta)", () => {
  it("reports market open during weekday Session I and Session II", () => {
    // Rabu, 25 Nov 2026 pukul 10:00 WIB (03:00 UTC)
    const sesi1 = getIdxMarketStatus(new Date("2026-11-25T03:00:00Z"));
    expect(sesi1.isOpen).toBe(true);
    expect(sesi1.statusText).toBe("Buka");
    expect(sesi1.sessionText).toContain("Sesi I");

    // Rabu, 25 Nov 2026 pukul 12:30 WIB (05:30 UTC) -> Istirahat siang
    const istirahat = getIdxMarketStatus(new Date("2026-11-25T05:30:00Z"));
    expect(istirahat.isOpen).toBe(false);
    expect(istirahat.sessionText).toContain("Istirahat Siang");
  });

  it("handles Friday lunch prayer break (11:30 - 14:00 WIB)", () => {
    // Jumat, 27 Nov 2026 pukul 12:00 WIB (05:00 UTC)
    const friBreak = getIdxMarketStatus(new Date("2026-11-27T05:00:00Z"));
    expect(friBreak.isOpen).toBe(false);
    expect(friBreak.sessionText).toContain("Istirahat Jumat");
  });

  it("uses 00:xx format (never 24:xx) at midnight WIB", () => {
    // Kamis, 26 Nov 2026 pukul 00:05 WIB (25 Nov 17:05 UTC)
    const midnight = getIdxMarketStatus(new Date("2026-11-25T17:05:00Z"));
    expect(midnight.timeWib).toBe("00:05 WIB");
    expect(midnight.isOpen).toBe(false);
  });

  it("recognizes weekends and official IDX holidays", () => {
    // Sabtu, 28 Nov 2026 pukul 10:00 WIB (03:00 UTC)
    const saturday = getIdxMarketStatus(new Date("2026-11-28T03:00:00Z"));
    expect(saturday.isOpen).toBe(false);
    expect(saturday.sessionText).toContain("Akhir Pekan");

    // Jumat, 25 Des 2026 (Hari Raya Natal) pukul 10:00 WIB
    const christmas = getIdxMarketStatus(new Date("2026-12-25T03:00:00Z"));
    expect(christmas.isOpen).toBe(false);
    expect(christmas.sessionText).toContain("Libur Bursa");
  });
});
