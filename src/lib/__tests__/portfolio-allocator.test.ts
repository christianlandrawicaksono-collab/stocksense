import { describe, expect, it } from "vitest";
import {
  computePresetWeights,
  distributeIntegerPercentages,
  normalizeWeightsTo100,
  simulatePortfolioAllocation,
  type AllocationCandidateInput,
} from "@/lib/portfolio-allocator";

const SAMPLE_CANDIDATES: AllocationCandidateInput[] = [
  {
    ticker: "BBCA",
    name: "Bank Central Asia Tbk",
    sector: "Financials",
    price: 6000,
    peRatio: 12,
    pbvRatio: 2.5,
    dividendYield: 6.0,
    targetBuyPrice: 6200,
    targetStatus: "hit",
  },
  {
    ticker: "BBRI",
    name: "Bank Rakyat Indonesia Tbk",
    sector: "Financials",
    price: 3000,
    peRatio: 8,
    pbvRatio: 1.4,
    dividendYield: 12.0,
    targetBuyPrice: 2900,
    targetStatus: "near",
  },
  {
    ticker: "TLKM",
    name: "Telkom Indonesia Tbk",
    sector: "Infrastructures",
    price: 2500,
    peRatio: 10,
    pbvRatio: 1.8,
    dividendYield: 8.0,
    targetBuyPrice: 2000,
    targetStatus: "above",
  },
];

describe("portfolio-allocator helpers", () => {
  it("distributes percentages summing exactly to 100 across presets and normalizes custom inputs", () => {
    expect(distributeIntegerPercentages([1, 1, 1])).toEqual([34, 33, 33]);

    const equal = computePresetWeights(SAMPLE_CANDIDATES, "equal");
    expect(Object.values(equal).reduce((a, b) => a + b, 0)).toBe(100);

    const buyZone = computePresetWeights(SAMPLE_CANDIDATES, "buy_zone");
    expect(buyZone.BBCA).toBeGreaterThan(buyZone.BBRI);
    expect(buyZone.BBRI).toBeGreaterThan(buyZone.TLKM);
    expect(Object.values(buyZone).reduce((a, b) => a + b, 0)).toBe(100);

    const divWeights = computePresetWeights(SAMPLE_CANDIDATES, "dividend");
    expect(divWeights.BBRI).toBeGreaterThan(divWeights.TLKM);
    expect(divWeights.TLKM).toBeGreaterThan(divWeights.BBCA);
    expect(Object.values(divWeights).reduce((a, b) => a + b, 0)).toBe(100);

    const normalized = normalizeWeightsTo100(["BBCA", "BBRI"], { BBCA: 20, BBRI: 60 });
    expect(normalized).toEqual({ BBCA: 25, BBRI: 75 });
  });

  it("calculates IDX 100-share lots, remaining cash, weighted dividend, harmonic P/E, and sector concentration", () => {
    const result = simulatePortfolioAllocation({
      totalCapitalRp: 10_000_000,
      candidates: SAMPLE_CANDIDATES,
      weightsByTicker: {
        BBCA: 40, // target 4.000.000 -> cost/lot 600.000 -> 6 lots = 3.600.000
        BBRI: 40, // target 4.000.000 -> cost/lot 300.000 -> 13 lots = 3.900.000
        TLKM: 20, // target 2.000.000 -> cost/lot 250.000 -> 8 lots = 2.000.000
      },
    });

    expect(result.rows[0].lots).toBe(6);
    expect(result.rows[0].allocatedRp).toBe(3_600_000);
    expect(result.rows[1].lots).toBe(13);
    expect(result.rows[1].allocatedRp).toBe(3_900_000);
    expect(result.rows[2].lots).toBe(8);
    expect(result.rows[2].allocatedRp).toBe(2_000_000);

    expect(result.totalAllocatedRp).toBe(9_500_000);
    expect(result.remainingCashRp).toBe(500_000);
    expect(result.totalLots).toBe(27);
    expect(result.totalShares).toBe(2700);

    // Annual dividends: 3.6M*6% (216k) + 3.9M*12% (468k) + 2.0M*8% (160k) = 844.000
    expect(result.estimatedAnnualDividendRp).toBeCloseTo(844_000, 1);
    expect(result.weightedDividendYieldPct).toBeCloseTo((844_000 / 9_500_000) * 100, 4);

    // Harmonic P/E: 9.5M / (3.6M/12 + 3.9M/8 + 2.0M/10) = 9.5M / (300k + 487.5k + 200k) = 9.5 / 0.9875 = 9.62x
    expect(result.weightedPeRatio).toBeCloseTo(9_500_000 / 987_500, 3);

    // Financials = 3.6M + 3.9M = 7.5M / 9.5M = 78.95% (>= 60% concentration warning)
    expect(result.concentratedSector).not.toBeNull();
    expect(result.concentratedSector?.sector).toBe("Financials");
    expect(result.concentratedSector?.sharePct).toBeCloseTo((7_500_000 / 9_500_000) * 100, 2);
  });

  it("flags stocks where target budget is too small for 1 IDX lot and prevents over-allocation", () => {
    const result = simulatePortfolioAllocation({
      totalCapitalRp: 1_000_000,
      candidates: SAMPLE_CANDIDATES,
      weightsByTicker: {
        BBCA: 50, // scaled down if >100%; here total is 150 -> effective 33.3% = 333.333 < 600.000/lot -> 0 lot!
        BBRI: 100, // effective 66.7% = 666.666 -> 2 lots = 600.000
        TLKM: 0,
      },
    });

    expect(result.rows[0].lots).toBe(0);
    expect(result.rows[0].insufficientForOneLot).toBe(true);
    expect(result.rows[1].lots).toBe(2);
    expect(result.totalAllocatedRp).toBe(600_000);
    expect(result.remainingCashRp).toBe(400_000);
  });
});
