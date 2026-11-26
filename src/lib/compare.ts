import type { MarketHistoryPoint } from "./market-data";

export interface ComparableStockMetrics {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  peRatio: number;
  pbvRatio: number;
  dividendYield: number;
  roe?: number;
  der?: number;
  marketCapTrillion?: number;
  targetBuyPrice?: number;
  isLive: boolean;
}

export interface ComparisonWinners {
  lowestPeTicker: string | null;
  lowestPbvTicker: string | null;
  highestDividendTicker: string | null;
  highestRoeTicker: string | null;
  lowestDerTicker: string | null;
}

function findExtremeTicker(
  items: ComparableStockMetrics[],
  readVal: (item: ComparableStockMetrics) => number | undefined,
  mode: "min" | "max",
  allowZero: boolean = false
): string | null {
  let bestTicker: string | null = null;
  let bestVal: number | null = null;

  for (const item of items) {
    const v = readVal(item);
    if (v === undefined || !Number.isFinite(v)) continue;
    if (allowZero ? v < 0 : v <= 0) continue;

    if (
      bestVal === null ||
      (mode === "min" ? v < bestVal : v > bestVal)
    ) {
      bestVal = v;
      bestTicker = item.ticker;
    }
  }

  return bestTicker;
}

/**
 * Identifies best-in-class tickers per fundamental/valuation metric when >= 2 stocks are compared.
 */
export function computeComparisonWinners(items: ComparableStockMetrics[]): ComparisonWinners {
  if (items.length < 2) {
    return {
      lowestPeTicker: null,
      lowestPbvTicker: null,
      highestDividendTicker: null,
      highestRoeTicker: null,
      lowestDerTicker: null,
    };
  }

  return {
    lowestPeTicker: findExtremeTicker(items, (i) => i.peRatio, "min"),
    lowestPbvTicker: findExtremeTicker(items, (i) => i.pbvRatio, "min"),
    highestDividendTicker: findExtremeTicker(items, (i) => i.dividendYield, "max"),
    highestRoeTicker: findExtremeTicker(items, (i) => i.roe, "max"),
    lowestDerTicker: findExtremeTicker(items, (i) => i.der, "min", true),
  };
}

export interface NormalizedReturnPoint {
  time: string;
  value: number; // % return relative to baseline date (e.g. +12.4)
}

export interface NormalizedComparisonSeries {
  ticker: string;
  points: NormalizedReturnPoint[];
  totalReturnPct: number;
}

/**
 * Aligns multiple stocks' price histories to a common earliest overlapping date
 * (or each series' start if non-overlapping) and normalizes closing prices to % cumulative return.
 */
export function normalizeComparisonHistories(
  seriesInput: Record<string, MarketHistoryPoint[]>,
  tickers: string[]
): NormalizedComparisonSeries[] {
  const cleanedByTicker = new Map<string, MarketHistoryPoint[]>();

  for (const ticker of tickers) {
    const raw = seriesInput[ticker] || [];
    const sorted = [...raw]
      .filter((p) => p.close > 0 && p.time)
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

    const deduped: MarketHistoryPoint[] = [];
    const seen = new Set<string>();
    for (const p of sorted) {
      if (!seen.has(p.time)) {
        seen.add(p.time);
        deduped.push(p);
      }
    }
    if (deduped.length >= 2) {
      cleanedByTicker.set(ticker, deduped);
    }
  }

  if (cleanedByTicker.size === 0) return [];

  // Determine common start date so multi-stock curves start from a fair comparable baseline
  const firstDates = Array.from(cleanedByTicker.values()).map((pts) => pts[0].time);
  const commonStartDate = firstDates.reduce((max, d) => (d > max ? d : max), firstDates[0]);

  const results: NormalizedComparisonSeries[] = [];
  for (const ticker of tickers) {
    const pts = cleanedByTicker.get(ticker);
    if (!pts) continue;

    let sliced = pts.filter((p) => p.time >= commonStartDate);
    if (sliced.length < 2) {
      sliced = pts;
    }

    const baseClose = sliced[0].close;
    if (baseClose <= 0) continue;

    const normalizedPoints: NormalizedReturnPoint[] = sliced.map((p) => ({
      time: p.time,
      value: ((p.close - baseClose) / baseClose) * 100,
    }));

    const totalReturnPct = normalizedPoints[normalizedPoints.length - 1]?.value ?? 0;
    results.push({
      ticker,
      points: normalizedPoints,
      totalReturnPct,
    });
  }

  return results;
}

