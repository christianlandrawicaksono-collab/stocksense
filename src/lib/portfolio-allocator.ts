import type { TargetBuyStatusKind } from "./watchlist";

export const IDX_LOT_SIZE = 100;
export const SECTOR_CONCENTRATION_THRESHOLD_PCT = 60;

export type AllocationWeightPreset = "equal" | "buy_zone" | "dividend" | "custom";

export interface AllocationCandidateInput {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  peRatio: number;
  pbvRatio: number;
  dividendYield: number;
  targetBuyPrice?: number;
  targetStatus: TargetBuyStatusKind;
}

export interface AllocationRowResult {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  inputWeightPct: number;
  effectiveTargetPct: number;
  targetBudgetRp: number;
  costPerLotRp: number;
  lots: number;
  shares: number;
  allocatedRp: number;
  actualWeightPct: number;
  estimatedAnnualDividendRp: number;
  peRatio: number;
  pbvRatio: number;
  dividendYield: number;
  targetBuyPrice?: number;
  targetStatus: TargetBuyStatusKind;
  insufficientForOneLot: boolean;
}

export interface AllocationSectorSummary {
  sector: string;
  allocatedRp: number;
  sharePct: number;
  tickers: string[];
}

export interface PortfolioAllocationSummary {
  totalCapitalRp: number;
  totalInputWeightPct: number;
  totalAllocatedRp: number;
  remainingCashRp: number;
  utilizationPct: number;
  totalLots: number;
  totalShares: number;
  estimatedAnnualDividendRp: number;
  estimatedMonthlyDividendRp: number;
  weightedDividendYieldPct: number;
  weightedPeRatio: number;
  weightedPbvRatio: number;
  topSector: AllocationSectorSummary | null;
  concentratedSector: AllocationSectorSummary | null;
  rows: AllocationRowResult[];
  sectorBreakdown: AllocationSectorSummary[];
}

/**
 * Distributes non-negative raw scores into integer percentages summing to 100
 * using the largest-remainder method. Falls back to uniform scores if sum <= 0.
 */
export function distributeIntegerPercentages(rawScores: number[]): number[] {
  const n = rawScores.length;
  if (n === 0) return [];

  const sanitized = rawScores.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = sanitized.reduce((acc, v) => acc + v, 0);
  const scores = total > 0 ? sanitized : Array.from({ length: n }, () => 1);
  const scoreSum = scores.reduce((acc, v) => acc + v, 0);

  const exact = scores.map((s) => (s / scoreSum) * 100);
  const floored = exact.map((e) => Math.floor(e));
  let remainder = 100 - floored.reduce((acc, f) => acc + f, 0);

  const rankedIndices = exact
    .map((e, idx) => ({ idx, frac: e - floored[idx] }))
    .sort((a, b) => (b.frac !== a.frac ? b.frac - a.frac : a.idx - b.idx));

  let cursor = 0;
  while (remainder > 0 && rankedIndices.length > 0) {
    const targetIdx = rankedIndices[cursor % rankedIndices.length].idx;
    floored[targetIdx] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return floored;
}

export function computePresetWeights(
  candidates: AllocationCandidateInput[],
  preset: Exclude<AllocationWeightPreset, "custom">
): Record<string, number> {
  if (candidates.length === 0) return {};

  const scores = candidates.map((c) => {
    if (preset === "buy_zone") {
      if (c.targetStatus === "hit") return 3;
      if (c.targetStatus === "near") return 2;
      return 1;
    }
    if (preset === "dividend") {
      return c.dividendYield > 0 ? c.dividendYield : 0;
    }
    return 1;
  });

  const pcts = distributeIntegerPercentages(scores);
  const map: Record<string, number> = {};
  candidates.forEach((c, idx) => {
    map[c.ticker] = pcts[idx];
  });
  return map;
}

export function normalizeWeightsTo100(
  tickers: string[],
  currentWeights: Record<string, number>
): Record<string, number> {
  if (tickers.length === 0) return {};
  const rawScores = tickers.map((t) => Math.max(0, currentWeights[t] ?? 0));
  const pcts = distributeIntegerPercentages(rawScores);
  const next: Record<string, number> = { ...currentWeights };
  tickers.forEach((t, idx) => {
    next[t] = pcts[idx];
  });
  return next;
}

export function simulatePortfolioAllocation(params: {
  totalCapitalRp: number;
  candidates: AllocationCandidateInput[];
  weightsByTicker: Record<string, number>;
}): PortfolioAllocationSummary {
  const cleanCapital =
    Number.isFinite(params.totalCapitalRp) && params.totalCapitalRp > 0
      ? Math.round(params.totalCapitalRp)
      : 0;

  const validCandidates = params.candidates.filter(
    (c) => Number.isFinite(c.price) && c.price > 0
  );

  const sanitizedInputs = validCandidates.map((c) => {
    const raw = params.weightsByTicker[c.ticker];
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  });

  const totalInputWeightPct = sanitizedInputs.reduce((acc, w) => acc + w, 0);
  // If user total weight exceeds 100%, scale down proportionally so allocated capital never exceeds totalCapitalRp
  const weightDivisor = totalInputWeightPct > 100 ? totalInputWeightPct : 100;

  const rows: AllocationRowResult[] = validCandidates.map((c, idx) => {
    const inputWeightPct = sanitizedInputs[idx];
    const effectiveTargetPct = weightDivisor > 0 ? (inputWeightPct / weightDivisor) * 100 : 0;
    const targetBudgetRp = cleanCapital * (effectiveTargetPct / 100);
    const costPerLotRp = c.price * IDX_LOT_SIZE;
    const lots = costPerLotRp > 0 ? Math.floor(targetBudgetRp / costPerLotRp) : 0;
    const shares = lots * IDX_LOT_SIZE;
    const allocatedRp = lots * costPerLotRp;
    const estimatedAnnualDividendRp =
      c.dividendYield > 0 ? allocatedRp * (c.dividendYield / 100) : 0;

    return {
      ticker: c.ticker,
      name: c.name,
      sector: c.sector || "Saham BEI",
      price: c.price,
      inputWeightPct,
      effectiveTargetPct,
      targetBudgetRp,
      costPerLotRp,
      lots,
      shares,
      allocatedRp,
      actualWeightPct: 0,
      estimatedAnnualDividendRp,
      peRatio: c.peRatio,
      pbvRatio: c.pbvRatio,
      dividendYield: c.dividendYield,
      targetBuyPrice: c.targetBuyPrice,
      targetStatus: c.targetStatus,
      insufficientForOneLot: cleanCapital > 0 && targetBudgetRp > 0 && lots === 0,
    };
  });

  const totalAllocatedRp = rows.reduce((acc, r) => acc + r.allocatedRp, 0);
  const remainingCashRp = Math.max(0, cleanCapital - totalAllocatedRp);
  const utilizationPct = cleanCapital > 0 ? (totalAllocatedRp / cleanCapital) * 100 : 0;
  const totalLots = rows.reduce((acc, r) => acc + r.lots, 0);
  const totalShares = rows.reduce((acc, r) => acc + r.shares, 0);
  const estimatedAnnualDividendRp = rows.reduce((acc, r) => acc + r.estimatedAnnualDividendRp, 0);
  const estimatedMonthlyDividendRp = estimatedAnnualDividendRp / 12;
  const weightedDividendYieldPct =
    totalAllocatedRp > 0 ? (estimatedAnnualDividendRp / totalAllocatedRp) * 100 : 0;

  for (const row of rows) {
    row.actualWeightPct = cleanCapital > 0 ? (row.allocatedRp / cleanCapital) * 100 : 0;
  }

  // Harmonic weighted mean for P/E and PBV across allocated capital with valid multiples
  let peCapSum = 0;
  let peInverseWeighted = 0;
  let pbvCapSum = 0;
  let pbvInverseWeighted = 0;

  const sectorMap = new Map<string, { allocatedRp: number; tickers: string[] }>();

  for (const row of rows) {
    if (row.allocatedRp > 0 && row.peRatio > 0) {
      peCapSum += row.allocatedRp;
      peInverseWeighted += row.allocatedRp / row.peRatio;
    }
    if (row.allocatedRp > 0 && row.pbvRatio > 0) {
      pbvCapSum += row.allocatedRp;
      pbvInverseWeighted += row.allocatedRp / row.pbvRatio;
    }
    if (row.allocatedRp > 0) {
      const sec = row.sector || "Saham BEI";
      const existing = sectorMap.get(sec) ?? { allocatedRp: 0, tickers: [] };
      existing.allocatedRp += row.allocatedRp;
      existing.tickers.push(row.ticker);
      sectorMap.set(sec, existing);
    }
  }

  const weightedPeRatio = peInverseWeighted > 0 ? peCapSum / peInverseWeighted : 0;
  const weightedPbvRatio = pbvInverseWeighted > 0 ? pbvCapSum / pbvInverseWeighted : 0;

  const sectorBreakdown: AllocationSectorSummary[] = Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      allocatedRp: data.allocatedRp,
      sharePct: totalAllocatedRp > 0 ? (data.allocatedRp / totalAllocatedRp) * 100 : 0,
      tickers: data.tickers,
    }))
    .sort((a, b) => b.allocatedRp - a.allocatedRp);

  const topSector = sectorBreakdown[0] ?? null;
  const concentratedSector =
    topSector && topSector.sharePct >= SECTOR_CONCENTRATION_THRESHOLD_PCT ? topSector : null;

  return {
    totalCapitalRp: cleanCapital,
    totalInputWeightPct,
    totalAllocatedRp,
    remainingCashRp,
    utilizationPct,
    totalLots,
    totalShares,
    estimatedAnnualDividendRp,
    estimatedMonthlyDividendRp,
    weightedDividendYieldPct,
    weightedPeRatio,
    weightedPbvRatio,
    topSector,
    concentratedSector,
    rows,
    sectorBreakdown,
  };
}
