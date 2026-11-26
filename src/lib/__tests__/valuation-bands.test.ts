import { describe, expect, it } from "vitest";
import { computeHistoricalPeBands } from "@/lib/valuation-bands";

describe("valuation-bands helper", () => {
  it("computes strictly positive ordered log-normal bands and multiples for valid history and EPS", () => {
    // 40 alternating prices around ~1000
    const points = Array.from({ length: 40 }, (_, idx) => ({
      close: idx % 2 === 0 ? 850 : 1180,
    }));

    const bands = computeHistoricalPeBands(points, 100);
    expect(bands).not.toBeNull();
    expect(bands!.sampleCount).toBe(40);
    expect(bands!.targetSd2MinusPrice).toBeGreaterThan(0);
    expect(bands!.targetSd2MinusPrice).toBeLessThan(bands!.targetSd1MinusPrice);
    expect(bands!.targetSd1MinusPrice).toBeLessThan(bands!.targetMeanPrice);
    expect(bands!.targetMeanPrice).toBeLessThan(bands!.targetSd1PlusPrice);
    expect(bands!.targetSd1PlusPrice).toBeLessThan(bands!.targetSd2PlusPrice);
    expect(bands!.historicalPeMean).toBeCloseTo(bands!.targetMeanPrice / 100, 4);
  });

  it("returns null when sample size, EPS, price variance, or implied multiple is invalid", () => {
    const shortHistory = Array.from({ length: 15 }, () => ({ close: 1000 }));
    expect(computeHistoricalPeBands(shortHistory, 100)).toBeNull();

    const validLength = Array.from({ length: 30 }, (_, idx) => ({ close: 900 + idx * 10 }));
    expect(computeHistoricalPeBands(validLength, 0)).toBeNull();
    expect(computeHistoricalPeBands(validLength, -12)).toBeNull();

    const flatHistory = Array.from({ length: 30 }, () => ({ close: 1000 }));
    expect(computeHistoricalPeBands(flatHistory, 100)).toBeNull();

    // Implied P/E mean > 200x should be rejected cleanly
    expect(computeHistoricalPeBands(validLength, 1)).toBeNull();
  });
});
