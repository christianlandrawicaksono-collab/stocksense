import { describe, expect, it } from "vitest";
import {
  aggregateHistoryToQuarterly,
  mapIllustrativeToDcaPoints,
  runQuarterlyDcaSimulation,
} from "@/lib/dca-simulator";
import { MarketHistoryPoint } from "@/lib/market-data";

describe("aggregateHistoryToQuarterly", () => {
  it("groups weekly points into YYYY-Q1..Q4 and sums quarterly dividends", () => {
    const weekly: MarketHistoryPoint[] = [
      { time: "2024-01-08", open: 9000, high: 9100, low: 8950, close: 9050, volume: 100 },
      { time: "2024-03-25", open: 9200, high: 9300, low: 9150, close: 9250, volume: 120, dividend: 100 },
      { time: "2024-04-15", open: 9300, high: 9400, low: 9200, close: 9350, volume: 110, dividend: 50 },
      { time: "2024-06-24", open: 9400, high: 9550, low: 9350, close: 9500, volume: 130, dividend: 25 },
    ];

    const q = aggregateHistoryToQuarterly(weekly);
    expect(q).toHaveLength(2);
    expect(q[0]).toEqual({ key: "2024-Q1", year: 2024, price: 9250, dividend: 100 });
    expect(q[1]).toEqual({ key: "2024-Q2", year: 2024, price: 9500, dividend: 75 });
  });
});

describe("runQuarterlyDcaSimulation", () => {
  const stockQ = [
    { key: "2022-Q1", year: 2022, price: 1000, dividend: 0 },
    { key: "2022-Q2", year: 2022, price: 1000, dividend: 100 },
    { key: "2022-Q3", year: 2022, price: 1000, dividend: 0 },
    { key: "2022-Q4", year: 2022, price: 1200, dividend: 0 },
  ];
  const ihsgQ = [
    { key: "2022-Q1", year: 2022, price: 7000, dividend: 0 },
    { key: "2022-Q2", year: 2022, price: 7000, dividend: 0 },
    { key: "2022-Q3", year: 2022, price: 7000, dividend: 0 },
    { key: "2022-Q4", year: 2022, price: 7000, dividend: 0 },
  ];

  it("accumulates shares, DRIP dividends, and computes Alpha vs IHSG", () => {
    const resDripOn = runQuarterlyDcaSimulation({
      stockSeries: stockQ,
      ihsgSeries: ihsgQ,
      startYear: 2022,
      quarterlyDCA: 1000000,
      initialCapital: 1000000,
      reinvestDividends: true,
    });

    expect(resDripOn).not.toBeNull();
    // Initial 1.000 lbr + Q2 1.000 lbr = 2.000 lbr -> div 200.000 -> DRIP +200 lbr -> Q3 +1.000 -> Q4 +833 lbr = 4.033 lbr * 1200
    expect(resDripOn!.totalInvested).toBe(4000000);
    expect(resDripOn!.totalDividendsReceived).toBe(200000);
    expect(resDripOn!.finalValue).toBe(4033 * 1200);
    expect(resDripOn!.alphaVsIhsg).toBeGreaterThan(20);
  });

  it("keeps cash dividends separate when DRIP is turned off", () => {
    const resDripOff = runQuarterlyDcaSimulation({
      stockSeries: stockQ,
      ihsgSeries: ihsgQ,
      startYear: 2022,
      quarterlyDCA: 1000000,
      initialCapital: 1000000,
      reinvestDividends: false,
    });

    expect(resDripOff).not.toBeNull();
    // 1000 + 1000 + 1000 + 833 = 3833 lbr * 1200 + 200.000 cash dividend
    expect(resDripOff!.finalValue).toBe(3833 * 1200 + 200000);
  });

  it("maps illustrative points cleanly", () => {
    const mapped = mapIllustrativeToDcaPoints([{ date: "2023-03", price: 8750, dividend: 205 }]);
    expect(mapped).toEqual([{ key: "2023-03", year: 2023, price: 8750, dividend: 205 }]);
  });
});
