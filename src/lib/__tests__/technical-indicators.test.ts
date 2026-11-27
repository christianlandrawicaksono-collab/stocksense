import { describe, expect, it } from "vitest";
import { computeRSI } from "@/lib/technical-indicators";

describe("technical-indicators (computeRSI)", () => {
  it("returns empty array when insufficient points exist for period + 1", () => {
    const pts = Array.from({ length: 14 }, (_, idx) => ({
      time: `2026-01-${String(idx + 1).padStart(2, "0")}`,
      close: 5000 + idx * 10,
    }));
    expect(computeRSI(pts, 14)).toEqual([]);
  });

  it("returns 100 on monotonic gains, 0 on monotonic losses, and 50 on flat series", () => {
    const up = Array.from({ length: 18 }, (_, idx) => ({
      time: `2026-01-${String(idx + 1).padStart(2, "0")}`,
      close: 1000 + idx * 50,
    }));
    const upRsi = computeRSI(up, 14);
    expect(upRsi).toHaveLength(4);
    expect(upRsi.every((p) => p.value === 100)).toBe(true);

    const down = Array.from({ length: 18 }, (_, idx) => ({
      time: `2026-01-${String(idx + 1).padStart(2, "0")}`,
      close: 5000 - idx * 50,
    }));
    const downRsi = computeRSI(down, 14);
    expect(downRsi.every((p) => p.value === 0)).toBe(true);

    const flat = Array.from({ length: 16 }, (_, idx) => ({
      time: `2026-01-${String(idx + 1).padStart(2, "0")}`,
      close: 4200,
    }));
    const flatRsi = computeRSI(flat, 14);
    expect(flatRsi.every((p) => p.value === 50)).toBe(true);
  });

  it("computes standard Wilder RSI bounded inside [0, 100] on mixed price swings", () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
    ];
    const pts = closes.map((close, idx) => ({
      time: `2026-02-${String(idx + 1).padStart(2, "0")}`,
      close,
    }));

    const rsi = computeRSI(pts, 14);
    expect(rsi).toHaveLength(closes.length - 14);
    expect(rsi[0].value).toBeCloseTo(70.46, 1);
    expect(rsi.every((p) => p.value >= 0 && p.value <= 100)).toBe(true);
  });
});
