import { computeRSI } from "./technical-indicators";

export const IDX_LOT_SIZE = 100;

/**
 * Mengembalikan fraksi harga (tick size) resmi papan reguler Bursa Efek Indonesia (BEI).
 */
export function getIdxTickSize(price: number): number {
  if (!Number.isFinite(price) || price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/**
 * Membulatkan harga ke fraksi tick BEI yang valid.
 */
export function snapToIdxTick(
  price: number,
  mode: "nearest" | "floor" | "ceil" = "nearest"
): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const clamped = Math.max(50, price);
  const tick = getIdxTickSize(clamped);
  if (mode === "floor") return Math.max(50, Math.floor(clamped / tick) * tick);
  if (mode === "ceil") return Math.max(50, Math.ceil(clamped / tick) * tick);
  return Math.max(50, Math.round(clamped / tick) * tick);
}

/**
 * Melangkahkan harga naik/turun sejumlah tick resmi BEI (menangani transisi antar batas fraksi).
 */
export function stepIdxTicks(basePrice: number, deltaTicks: number): number {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  let current = snapToIdxTick(basePrice, "nearest");
  const steps = Math.abs(Math.trunc(deltaTicks));
  const dir = deltaTicks >= 0 ? 1 : -1;

  for (let i = 0; i < steps; i += 1) {
    if (dir > 0) {
      const tick = getIdxTickSize(current);
      current += tick;
    } else {
      const probe = Math.max(50, current - 1);
      const tick = getIdxTickSize(probe);
      current = Math.max(50, current - tick);
    }
  }
  return current;
}

export interface IdxAraArbBounds {
  referencePrice: number;
  currentPrice: number;
  tickSize: number;
  araPercent: number;
  arbPercent: number;
  araPrice: number;
  arbPrice: number;
  /** Posisi 0..100 dari lantai ARB (0) menuju atap ARA (100) */
  positionPct: number;
  distanceToAraPct: number;
  distanceToArbPct: number;
  upTicks: number[];
  downTicks: number[];
}

/**
 * Menghitung batas Auto Rejection Atas (ARA) dan Bawah (ARB) harian BEI
 * beserta langkah ±1..±3 tick resmi.
 */
export function computeIdxAraArbBounds(
  referencePrice: number,
  currentPrice: number = referencePrice
): IdxAraArbBounds | null {
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) return null;
  const ref = Math.max(50, referencePrice);
  const active = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : ref;

  const araPercent = ref <= 200 ? 35 : ref <= 5000 ? 25 : 20;
  const arbPercent = 15;

  const rawAra = ref * (1 + araPercent / 100);
  const rawArb = Math.max(50, ref * (1 - arbPercent / 100));

  const araPrice = snapToIdxTick(rawAra, "floor");
  const arbPrice = snapToIdxTick(rawArb, "ceil");
  const span = Math.max(1, araPrice - arbPrice);
  const positionPct = Math.max(0, Math.min(100, ((active - arbPrice) / span) * 100));

  const distanceToAraPct = ((araPrice - active) / active) * 100;
  const distanceToArbPct = ((arbPrice - active) / active) * 100;

  return {
    referencePrice: ref,
    currentPrice: active,
    tickSize: getIdxTickSize(active),
    araPercent,
    arbPercent,
    araPrice,
    arbPrice,
    positionPct,
    distanceToAraPct,
    distanceToArbPct,
    upTicks: [1, 2, 3].map((k) => stepIdxTicks(active, k)),
    downTicks: [1, 2, 3].map((k) => stepIdxTicks(active, -k)),
  };
}

export interface ClassicPivotLevels {
  r2: number;
  r1: number;
  pivot: number;
  s1: number;
  s2: number;
}

/**
 * Menghitung level Classic Pivot Points (R2, R1, P, S1, S2) dari OHLC terakhir
 * dan membulatkannya ke fraksi tick BEI.
 */
export function computeClassicPivotPoints(
  high: number,
  low: number,
  close: number
): ClassicPivotLevels | null {
  if (
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    high <= 0 ||
    low <= 0 ||
    close <= 0
  ) {
    return null;
  }
  const hi = Math.max(high, low, close);
  const lo = Math.min(high, low, close);
  const p = (hi + lo + close) / 3;
  const range = hi - lo;

  return {
    r2: snapToIdxTick(p + range),
    r1: snapToIdxTick(2 * p - lo),
    pivot: snapToIdxTick(p),
    s1: snapToIdxTick(2 * p - hi),
    s2: snapToIdxTick(Math.max(50, p - range)),
  };
}

export type TechnicalSignalVote = "buy" | "neutral" | "sell";

export interface TechnicalIndicatorRow {
  id: string;
  label: string;
  valueLabel: string;
  vote: TechnicalSignalVote;
  detail: string;
}

export interface TechnicalSignalSummary {
  score: number; // -100 .. +100
  verdict: "Jual Kuat" | "Jual" | "Netral" | "Beli" | "Beli Kuat";
  tone: "emerald" | "teal" | "amber" | "coral";
  buyCount: number;
  neutralCount: number;
  sellCount: number;
  /** Sudut jarum speedometer: -90° (kiri/Jual Kuat) .. +90° (kanan/Beli Kuat) */
  needleAngleDeg: number;
  indicators: TechnicalIndicatorRow[];
}

function computeSma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    sum += values[i];
  }
  return sum / period;
}

/**
 * Menghitung sinyal teknikal objektif (MA20, MA50, Cross, RSI-14, 52W Range)
 * dari data OHLCV live untuk Technical Signals Speedometer ala TradingView.
 */
export function evaluateTechnicalSignals(input: {
  currentPrice: number;
  historyPoints: { time: string; close: number; high?: number; low?: number }[];
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
}): TechnicalSignalSummary {
  const { currentPrice, historyPoints, fiftyTwoWeekLow, fiftyTwoWeekHigh } = input;
  const closes = historyPoints
    .map((p) => p.close)
    .filter((v) => Number.isFinite(v) && v > 0);

  const activePrice =
    Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : closes[closes.length - 1] ?? 0;

  const indicators: TechnicalIndicatorRow[] = [];

  // 1. Harga vs MA20
  const ma20 = computeSma(closes, 20);
  if (ma20 && activePrice > 0) {
    const diffPct = ((activePrice - ma20) / ma20) * 100;
    const vote: TechnicalSignalVote =
      diffPct > 0.5 ? "buy" : diffPct < -0.5 ? "sell" : "neutral";
    indicators.push({
      id: "ma20",
      label: "Harga vs MA20",
      valueLabel: `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`,
      vote,
      detail: vote === "buy" ? "Di atas rata-rata 20 bar" : vote === "sell" ? "Di bawah MA20" : "Tepat di garis MA20",
    });
  } else {
    indicators.push({
      id: "ma20",
      label: "Harga vs MA20",
      valueLabel: "-",
      vote: "neutral",
      detail: "Data historis belum cukup",
    });
  }

  // 2. Harga vs MA50
  const ma50 = computeSma(closes, 50);
  if (ma50 && activePrice > 0) {
    const diffPct = ((activePrice - ma50) / ma50) * 100;
    const vote: TechnicalSignalVote =
      diffPct > 0.8 ? "buy" : diffPct < -0.8 ? "sell" : "neutral";
    indicators.push({
      id: "ma50",
      label: "Harga vs MA50",
      valueLabel: `${diffPct >= 0 ? "+" : ""}${diffPct.toFixed(1)}%`,
      vote,
      detail: vote === "buy" ? "Tren menengah bullish" : vote === "sell" ? "Di bawah MA50" : "Konsolidasi dekat MA50",
    });
  } else {
    indicators.push({
      id: "ma50",
      label: "Harga vs MA50",
      valueLabel: "-",
      vote: "neutral",
      detail: "Butuh ≥ 50 bar historis",
    });
  }

  // 3. Struktur MA20 / MA50
  if (ma20 && ma50) {
    const spreadPct = ((ma20 - ma50) / ma50) * 100;
    const vote: TechnicalSignalVote =
      spreadPct > 0.4 ? "buy" : spreadPct < -0.4 ? "sell" : "neutral";
    indicators.push({
      id: "cross",
      label: "Tren MA20/50",
      valueLabel: spreadPct >= 0 ? "Bullish" : "Bearish",
      vote,
      detail: vote === "buy" ? "MA20 di atas MA50" : vote === "sell" ? "MA20 di bawah MA50" : "Mendekati persilangan",
    });
  }

  // 4. RSI (14)
  const rsiSeries = computeRSI(historyPoints, 14);
  const latestRsi = rsiSeries[rsiSeries.length - 1]?.value;
  if (latestRsi !== undefined) {
    let vote: TechnicalSignalVote = "neutral";
    let detail = "Momentum seimbang";
    if (latestRsi <= 32) {
      vote = "buy";
      detail = "Area jenuh jual (oversold)";
    } else if (latestRsi < 46) {
      vote = "sell";
      detail = "Momentum melemah";
    } else if (latestRsi >= 54 && latestRsi <= 70) {
      vote = "buy";
      detail = "Momentum naik sehat";
    } else if (latestRsi > 70) {
      vote = "sell";
      detail = "Area jenuh beli (overbought)";
    }
    indicators.push({
      id: "rsi14",
      label: "RSI (14)",
      valueLabel: latestRsi.toFixed(1),
      vote,
      detail,
    });
  }

  // 5. Posisi 52-Week Range
  const hi52 =
    fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0
      ? fiftyTwoWeekHigh
      : closes.length > 0
      ? Math.max(...closes)
      : 0;
  const lo52 =
    fiftyTwoWeekLow && fiftyTwoWeekLow > 0
      ? fiftyTwoWeekLow
      : closes.length > 0
      ? Math.min(...closes)
      : 0;

  if (hi52 > lo52 && activePrice > 0) {
    const posPct = Math.max(0, Math.min(100, ((activePrice - lo52) / (hi52 - lo52)) * 100));
    const vote: TechnicalSignalVote =
      posPct >= 45 && posPct <= 82 ? "buy" : posPct < 22 ? "sell" : "neutral";
    indicators.push({
      id: "range52w",
      label: "Posisi 52W",
      valueLabel: `${Math.round(posPct)}%`,
      vote,
      detail:
        posPct >= 82
          ? "Dekat resistance 52W"
          : posPct < 22
          ? "Dekat lantai 52W"
          : "Rentang gerak sehat",
    });
  }

  let buyCount = 0;
  let neutralCount = 0;
  let sellCount = 0;
  for (const ind of indicators) {
    if (ind.vote === "buy") buyCount += 1;
    else if (ind.vote === "sell") sellCount += 1;
    else neutralCount += 1;
  }

  const total = Math.max(1, indicators.length);
  const score = Math.round(((buyCount - sellCount) / total) * 100);
  const needleAngleDeg = Math.max(-86, Math.min(86, (score / 100) * 84));

  let verdict: TechnicalSignalSummary["verdict"] = "Netral";
  let tone: TechnicalSignalSummary["tone"] = "amber";
  if (score >= 55) {
    verdict = "Beli Kuat";
    tone = "emerald";
  } else if (score >= 20) {
    verdict = "Beli";
    tone = "teal";
  } else if (score <= -55) {
    verdict = "Jual Kuat";
    tone = "coral";
  } else if (score <= -20) {
    verdict = "Jual";
    tone = "coral";
  }

  return {
    score,
    verdict,
    tone,
    buyCount,
    neutralCount,
    sellCount,
    needleAngleDeg,
    indicators,
  };
}

export interface RiskRewardPlanResult {
  isValid: boolean;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskPerShare: number;
  rewardPerShare: number;
  riskPctFromEntry: number;
  rewardPctFromEntry: number;
  rrRatio: number;
  maxRiskBudgetRp: number;
  recommendedLots: number;
  positionCostRp: number;
  actualRiskRp: number;
  potentialProfitRp: number;
  qualityLabel: "Ideal" | "Cukup" | "Risiko Tinggi" | "Tidak Valid";
  qualityTone: "emerald" | "teal" | "amber" | "coral";
  riskBarSharePct: number;
  rewardBarSharePct: number;
}

/**
 * Menghitung ukuran lot BEI ideal & rasio Risk/Reward untuk skenario beli (Long).
 */
export function computeRiskRewardPlan(input: {
  capitalRp: number;
  riskPercent: number;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}): RiskRewardPlanResult {
  const { capitalRp, riskPercent, entryPrice, stopLossPrice, takeProfitPrice } = input;
  const maxRiskBudgetRp = Math.max(0, capitalRp * (Math.max(0.1, riskPercent) / 100));
  const riskPerShare = entryPrice - stopLossPrice;
  const rewardPerShare = takeProfitPrice - entryPrice;

  if (
    !Number.isFinite(capitalRp) ||
    capitalRp <= 0 ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0 ||
    riskPerShare <= 0 ||
    rewardPerShare <= 0
  ) {
    return {
      isValid: false,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      riskPerShare: Math.max(0, riskPerShare),
      rewardPerShare: Math.max(0, rewardPerShare),
      riskPctFromEntry: 0,
      rewardPctFromEntry: 0,
      rrRatio: 0,
      maxRiskBudgetRp,
      recommendedLots: 0,
      positionCostRp: 0,
      actualRiskRp: 0,
      potentialProfitRp: 0,
      qualityLabel: "Tidak Valid",
      qualityTone: "coral",
      riskBarSharePct: 50,
      rewardBarSharePct: 50,
    };
  }

  const rrRatio = rewardPerShare / riskPerShare;
  const riskPerLot = riskPerShare * IDX_LOT_SIZE;
  const costPerLot = entryPrice * IDX_LOT_SIZE;

  const lotsByRisk = Math.floor(maxRiskBudgetRp / riskPerLot);
  const lotsByCapital = Math.floor(capitalRp / costPerLot);
  const recommendedLots = Math.max(0, Math.min(lotsByRisk, lotsByCapital));

  const positionCostRp = recommendedLots * costPerLot;
  const actualRiskRp = recommendedLots * riskPerLot;
  const potentialProfitRp = recommendedLots * rewardPerShare * IDX_LOT_SIZE;

  const riskPctFromEntry = (riskPerShare / entryPrice) * 100;
  const rewardPctFromEntry = (rewardPerShare / entryPrice) * 100;

  const totalDist = riskPerShare + rewardPerShare;
  const riskBarSharePct = Math.max(12, Math.min(88, (riskPerShare / totalDist) * 100));
  const rewardBarSharePct = 100 - riskBarSharePct;

  let qualityLabel: RiskRewardPlanResult["qualityLabel"] = "Risiko Tinggi";
  let qualityTone: RiskRewardPlanResult["qualityTone"] = "coral";
  if (rrRatio >= 2.0) {
    qualityLabel = "Ideal";
    qualityTone = "emerald";
  } else if (rrRatio >= 1.5) {
    qualityLabel = "Cukup";
    qualityTone = "teal";
  } else if (rrRatio >= 1.0) {
    qualityLabel = "Risiko Tinggi";
    qualityTone = "amber";
  }

  return {
    isValid: true,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    riskPerShare,
    rewardPerShare,
    riskPctFromEntry,
    rewardPctFromEntry,
    rrRatio,
    maxRiskBudgetRp,
    recommendedLots,
    positionCostRp,
    actualRiskRp,
    potentialProfitRp,
    qualityLabel,
    qualityTone,
    riskBarSharePct,
    rewardBarSharePct,
  };
}
