/**
 * Pure financial simulation helpers for Quarterly DCA & Lump-Sum Backtesting.
 * Shared between Illustrative quarterly series and Yahoo Finance weekly→quarterly series.
 */

import { MarketHistoryPoint } from "@/lib/market-data";
import { HistoricalDataPoint } from "@/types/market";
import { calculateAnnualizedIRR } from "@/lib/format";

export interface DcaSimulationInputPoint {
  key: string; // "YYYY-MM" or "YYYY-Q1"
  year: number;
  price: number;
  dividend: number;
}

export interface DcaSimulationResult {
  totalQuarters: number;
  years: number;
  startLabel: string;
  endLabel: string;
  totalInvested: number;
  finalValue: number;
  netProfit: number;
  totalReturnPercent: number;
  irr: number | null;
  simpleAnnualReturn: number | null;
  maxDrawdown: number;
  totalDividendsReceived: number;
  alphaVsIhsg: number;
}

/**
 * Mengelompokkan data mingguan/harian (format time "YYYY-MM-DD") menjadi seri penutupan kuartalan
 * ("YYYY-Q1" .. "YYYY-Q4") beserta akumulasi dividen yang jatuh pada kuartal tersebut.
 */
export function aggregateHistoryToQuarterly(
  points: MarketHistoryPoint[]
): DcaSimulationInputPoint[] {
  if (!points || points.length === 0) return [];

  const sorted = [...points].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const quarterOrder: string[] = [];
  const quarterMap = new Map<string, DcaSimulationInputPoint>();

  for (const p of sorted) {
    if (!p.close || p.close <= 0) continue;
    const match = p.time.match(/^(\d{4})-(\d{2})-/);
    if (!match) continue;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const quarter = Math.floor((month - 1) / 3) + 1;
    const key = `${year}-Q${quarter}`;

    const existing = quarterMap.get(key);
    if (!existing) {
      quarterOrder.push(key);
      quarterMap.set(key, {
        key,
        year,
        price: p.close,
        dividend: p.dividend && p.dividend > 0 ? p.dividend : 0,
      });
    } else {
      // Penutupan kuartal selalu mengambil bar terakhir di kuartal tersebut; dividen diakumulasi
      existing.price = p.close;
      if (p.dividend && p.dividend > 0) {
        existing.dividend += p.dividend;
      }
    }
  }

  return quarterOrder.map((k) => quarterMap.get(k)!);
}

/**
 * Mengonversi seri kuartalan ilustrasi (format date "YYYY-MM") menjadi DcaSimulationInputPoint.
 */
export function mapIllustrativeToDcaPoints(
  series: HistoricalDataPoint[]
): DcaSimulationInputPoint[] {
  return series
    .filter((item) => item.price > 0)
    .map((item) => {
      const year = parseInt(item.date.slice(0, 4), 10) || 2020;
      return {
        key: item.date,
        year,
        price: item.price,
        dividend: item.dividend && item.dividend > 0 ? item.dividend : 0,
      };
    });
}

/**
 * Menjalankan simulasi DCA kuartalan + Lump-Sum awal, dengan/tanpa reinvestasi dividen (DRIP),
 * dan membandingkan imbal hasil total terhadap acuan IHSG pada periode yang sama.
 */
export function runQuarterlyDcaSimulation(params: {
  stockSeries: DcaSimulationInputPoint[];
  ihsgSeries: DcaSimulationInputPoint[];
  startYear: number;
  quarterlyDCA: number;
  initialCapital: number;
  reinvestDividends: boolean;
}): DcaSimulationResult | null {
  const {
    stockSeries,
    ihsgSeries,
    startYear,
    quarterlyDCA,
    initialCapital,
    reinvestDividends,
  } = params;

  const series = stockSeries.filter((d) => d.year >= startYear);
  if (series.length < 2) return null;

  const ihsgMap = new Map<string, number>();
  for (const idx of ihsgSeries) {
    ihsgMap.set(idx.key, idx.price);
  }

  // Temukan harga IHSG awal yang tersedia (sama kunci, atau fallback terdekat)
  let lastKnownIhsg =
    ihsgMap.get(series[0].key) ??
    ihsgSeries.find((i) => i.year >= startYear)?.price ??
    6000;

  let currentInvested = initialCapital;
  let currentShares = 0;
  let currentDividends = 0;
  let currentIhsgUnits = 0;

  const firstPrice = series[0].price;
  if (initialCapital > 0) {
    currentShares += Math.floor(initialCapital / firstPrice);
    currentIhsgUnits += initialCapital / lastKnownIhsg;
  }

  let peakValue = 0;
  let maxDrawdown = 0;
  let finalPortfolioValue = 0;
  let finalIhsgValue = 0;

  for (let index = 0; index < series.length; index++) {
    const point = series[index];
    const matchedIhsg = ihsgMap.get(point.key);
    if (matchedIhsg && matchedIhsg > 0) {
      lastKnownIhsg = matchedIhsg;
    }

    // Index 0 hanya modal awal (lump-sum); mulai index 1 baru setor DCA kuartalan
    if (index > 0 && quarterlyDCA > 0) {
      currentInvested += quarterlyDCA;
      currentShares += Math.floor(quarterlyDCA / point.price);
      currentIhsgUnits += quarterlyDCA / lastKnownIhsg;
    }

    if (point.dividend > 0 && currentShares > 0) {
      const currentDivAmount = currentShares * point.dividend;
      currentDividends += currentDivAmount;
      if (reinvestDividends) {
        currentShares += Math.floor(currentDivAmount / point.price);
      }
    }

    const portfolioValue =
      currentShares * point.price + (!reinvestDividends ? currentDividends : 0);
    const ihsgValue = currentIhsgUnits * lastKnownIhsg;

    if (portfolioValue > peakValue) {
      peakValue = portfolioValue;
    } else if (peakValue > 0) {
      const drawdown = ((peakValue - portfolioValue) / peakValue) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    finalPortfolioValue = portfolioValue;
    finalIhsgValue = ihsgValue;
  }

  const totalQuarters = series.length - 1;
  const years = totalQuarters / 4;
  const netProfit = finalPortfolioValue - currentInvested;
  const totalReturnPercent =
    currentInvested > 0
      ? ((finalPortfolioValue - currentInvested) / currentInvested) * 100
      : 0;

  // Arus kas Money-Weighted IRR per kuartal
  const cashFlows: number[] = [];
  for (let i = 0; i < series.length; i++) {
    let cf = 0;
    if (i === 0) {
      if (initialCapital > 0) cf -= initialCapital;
    } else if (quarterlyDCA > 0) {
      cf -= quarterlyDCA;
    }
    if (i === series.length - 1) {
      cf += finalPortfolioValue;
    }
    cashFlows.push(cf);
  }
  const firstNonZero = cashFlows.findIndex((c) => c !== 0);
  const validCashFlows = firstNonZero >= 0 ? cashFlows.slice(firstNonZero) : [];
  const irr = calculateAnnualizedIRR(validCashFlows);
  const simpleAnnualReturn = years > 0 ? totalReturnPercent / years : null;

  const ihsgFinalReturn =
    currentInvested > 0 ? ((finalIhsgValue - currentInvested) / currentInvested) * 100 : 0;
  const alphaVsIhsg = totalReturnPercent - ihsgFinalReturn;

  return {
    totalQuarters,
    years,
    startLabel: series[0].key,
    endLabel: series[series.length - 1].key,
    totalInvested: currentInvested,
    finalValue: finalPortfolioValue,
    netProfit,
    totalReturnPercent,
    irr,
    simpleAnnualReturn,
    maxDrawdown,
    totalDividendsReceived: currentDividends,
    alphaVsIhsg,
  };
}
