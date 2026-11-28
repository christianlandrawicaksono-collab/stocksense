import { describe, expect, it } from "vitest";
import {
  computePositionTargetSimulation,
  computeValuationGaugePosition,
  evaluateStockHealthPillars,
} from "@/lib/stock-health";

describe("stock-health & valuation gauge helpers", () => {
  it("evaluates 5 health pillars accurately for an undervalued high-ROE non-bank stock", () => {
    const pillars = evaluateStockHealthPillars({
      sector: "Energi",
      price: 2500,
      peRatio: 6.2,
      historicalPeMean: 9.0,
      peSd1Minus: 7.0,
      peSd2Minus: 5.5,
      peSd1Plus: 11.0,
      roe: 24.5,
      der: 0.42,
      dividendYield: 7.2,
      targetBuyPrice: 2600,
    });

    expect(pillars).toHaveLength(5);
    expect(pillars[0]).toMatchObject({ id: "valuation", statusLabel: "Undervalued", tone: "emerald" });
    expect(pillars[1]).toMatchObject({ id: "profitability", statusLabel: "Kuat", tone: "emerald" });
    expect(pillars[2]).toMatchObject({ id: "health", statusLabel: "Konservatif", tone: "emerald" });
    expect(pillars[3]).toMatchObject({ id: "dividend", statusLabel: "Tinggi", tone: "emerald" });
    expect(pillars[4]).toMatchObject({ id: "target", statusLabel: "Area Beli", tone: "emerald" });
  });

  it("treats banking sector DER structurally as Normal Bank rather than red-flagging leverage", () => {
    const pillars = evaluateStockHealthPillars({
      sector: "Perbankan",
      price: 9200,
      peRatio: 18.5,
      historicalPeMean: 21.0,
      peSd1Minus: 17.5,
      peSd2Minus: 15.0,
      peSd1Plus: 24.5,
      roe: 20.1,
      der: 5.4,
      dividendYield: 3.1,
    });

    expect(pillars[2]).toMatchObject({
      id: "health",
      statusLabel: "Normal Bank",
      tone: "teal",
    });
    expect(pillars[4]).toMatchObject({
      id: "target",
      statusLabel: "Atur",
      tone: "muted",
    });
  });

  it("maps active P/E precisely onto the Valuation Gauge Arc stops and implied prices", () => {
    const atMean = computeValuationGaugePosition({
      activePe: 15,
      activePrice: 3000,
      historicalPeMean: 15,
      peSd1Minus: 12,
      peSd2Minus: 9,
      peSd1Plus: 18,
      peSd2Plus: 21,
    });
    expect(atMean).not.toBeNull();
    expect(atMean!.normalizedPct).toBeCloseTo(50, 2);
    expect(atMean!.angleDeg).toBeCloseTo(0, 2);
    expect(atMean!.zoneLabel).toBe("Valuasi Wajar");
    expect(atMean!.stops).toHaveLength(5);
    expect(atMean!.stops[2].impliedPrice).toBe(3000);

    const deepDiscount = computeValuationGaugePosition({
      activePe: 7.5,
      activePrice: 1500,
      historicalPeMean: 15,
      peSd1Minus: 12,
      peSd2Minus: 9,
      peSd1Plus: 18,
      peSd2Plus: 21,
    });
    expect(deepDiscount!.normalizedPct).toBeLessThan(10);
    expect(deepDiscount!.zoneLabel).toBe("Diskon Ekstrim");
    expect(deepDiscount!.stops[2].upsidePct).toBeCloseTo(100, 1);

    const invalid = computeValuationGaugePosition({
      activePe: 0,
      activePrice: 1500,
      historicalPeMean: 15,
      peSd1Minus: 12,
      peSd2Minus: 9,
      peSd1Plus: 18,
      peSd2Plus: 21,
    });
    expect(invalid).toBeNull();
  });

  it("computes lot position target simulation cleanly", () => {
    const sim = computePositionTargetSimulation(5000, 6250, 10, 100);
    expect(sim).toEqual({
      allocatedRp: 5_000_000,
      projectedValueRp: 6_250_000,
      profitLossRp: 1_250_000,
      returnPct: 25,
    });
    expect(computePositionTargetSimulation(5000, 0, 10)).toBeNull();
    expect(computePositionTargetSimulation(5000, 6250, 0)).toBeNull();
  });
});
