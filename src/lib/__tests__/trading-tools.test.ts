import { describe, expect, it } from "vitest";
import {
  computeClassicPivotPoints,
  computeIdxAraArbBounds,
  computeRiskRewardPlan,
  evaluateTechnicalSignals,
  getIdxTickSize,
  snapToIdxTick,
  stepIdxTicks,
} from "../trading-tools";

describe("trading-tools IDX helpers", () => {
  it("computes official IDX price tick sizes across all 5 brackets", () => {
    expect(getIdxTickSize(120)).toBe(1);
    expect(getIdxTickSize(350)).toBe(2);
    expect(getIdxTickSize(1200)).toBe(5);
    expect(getIdxTickSize(3800)).toBe(10);
    expect(getIdxTickSize(6000)).toBe(25);
    expect(snapToIdxTick(6012, "nearest")).toBe(6000);
    expect(stepIdxTicks(5000, -1)).toBe(4990);
    expect(stepIdxTicks(4990, 1)).toBe(5000);
  });

  it("computes IDX ARA/ARB bounds cleanly across price tiers", () => {
    const bbca = computeIdxAraArbBounds(6000, 6000)!;
    expect(bbca.araPercent).toBe(20);
    expect(bbca.arbPercent).toBe(15);
    expect(bbca.araPrice).toBe(7200);
    expect(bbca.arbPrice).toBe(5100);
    expect(bbca.upTicks).toEqual([6025, 6050, 6075]);
    expect(bbca.downTicks).toEqual([5975, 5950, 5925]);

    const midTier = computeIdxAraArbBounds(1000, 1000)!;
    expect(midTier.araPercent).toBe(25);
    expect(midTier.araPrice).toBe(1250);
    expect(midTier.arbPrice).toBe(850);
  });

  it("calculates classic pivot points snapped to IDX ticks", () => {
    const pivots = computeClassicPivotPoints(6100, 5850, 6000)!;
    expect(pivots.pivot).toBe(5975);
    expect(pivots.r1).toBeGreaterThan(pivots.pivot);
    expect(pivots.r2).toBeGreaterThan(pivots.r1);
    expect(pivots.s1).toBeLessThan(pivots.pivot);
    expect(pivots.s2).toBeLessThan(pivots.s1);
  });

  it("evaluates bullish vs bearish technical signals from OHLCV history", () => {
    const uptrend = Array.from({ length: 60 }, (_, idx) => ({
      time: `2026-01-${String((idx % 28) + 1).padStart(2, "0")}`,
      close: 5000 + idx * 25,
    }));
    const bull = evaluateTechnicalSignals({
      currentPrice: 6500,
      historyPoints: uptrend,
      fiftyTwoWeekLow: 4800,
      fiftyTwoWeekHigh: 7200,
    });
    expect(bull.score).toBeGreaterThan(0);
    expect(bull.buyCount).toBeGreaterThan(bull.sellCount);
  });

  it("sizes IDX lots safely according to risk percentage and capital cap", () => {
    const plan = computeRiskRewardPlan({
      capitalRp: 50_000_000,
      riskPercent: 2, // Max risk Rp 1.000.000
      entryPrice: 6000,
      stopLossPrice: 5700, // Risk Rp 300/lbr = Rp 30.000/lot -> 33 lots by risk
      takeProfitPrice: 6750, // Reward Rp 750/lbr -> R:R = 2.5
    });
    expect(plan.isValid).toBe(true);
    expect(plan.rrRatio).toBeCloseTo(2.5, 2);
    expect(plan.recommendedLots).toBe(33);
    expect(plan.actualRiskRp).toBe(990_000);
    expect(plan.potentialProfitRp).toBe(2_475_000);
    expect(plan.qualityLabel).toBe("Ideal");
  });
});
