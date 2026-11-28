import { formatDesimal, formatMultiple, formatPersen, formatRupiah } from "@/lib/format";
import { evaluateTargetBuyStatus } from "@/lib/watchlist";

export type HealthTone = "emerald" | "teal" | "amber" | "coral" | "muted";

export type HealthPillarId = "valuation" | "profitability" | "health" | "dividend" | "target";

export interface StockHealthPillar {
  id: HealthPillarId;
  label: string;
  valueLabel: string;
  statusLabel: string;
  detailText: string;
  score: number; // 0..100 for micro bar visual
  tone: HealthTone;
  targetAction: "valuation" | "fundamental" | "target";
}

export interface StockHealthInput {
  sector?: string;
  price: number;
  peRatio: number;
  pbvRatio?: number;
  historicalPeMean?: number;
  peSd1Minus?: number;
  peSd2Minus?: number;
  peSd1Plus?: number;
  peSd2Plus?: number;
  roe?: number;
  der?: number;
  dividendYield?: number;
  targetBuyPrice?: number;
}

export function evaluateStockHealthPillars(input: StockHealthInput): StockHealthPillar[] {
  const {
    sector = "",
    price,
    peRatio,
    historicalPeMean,
    peSd1Minus,
    peSd2Minus,
    peSd1Plus,
    roe,
    der,
    dividendYield = 0,
    targetBuyPrice,
  } = input;

  // 1. Valuasi (P/E vs Mean & SD Bands)
  let valuationPillar: StockHealthPillar;
  if (peRatio > 0 && historicalPeMean && historicalPeMean > 0) {
    const diffPct = ((peRatio - historicalPeMean) / historicalPeMean) * 100;
    const isDeepDiscount = peSd2Minus !== undefined && peRatio <= peSd2Minus;
    const isUndervalued = peSd1Minus !== undefined ? peRatio <= peSd1Minus : diffPct <= -10;
    const isFair = peRatio <= historicalPeMean;
    const isPremium = peSd1Plus !== undefined ? peRatio <= peSd1Plus : diffPct <= 15;

    if (isDeepDiscount || isUndervalued) {
      valuationPillar = {
        id: "valuation",
        label: "Valuasi P/E",
        valueLabel: formatMultiple(peRatio, 1),
        statusLabel: isDeepDiscount ? "Diskon Ekstrim" : "Undervalued",
        detailText: `${formatPersen(diffPct, 1, true)} vs Mean ${formatMultiple(historicalPeMean, 1)}`,
        score: isDeepDiscount ? 96 : 84,
        tone: "emerald",
        targetAction: "valuation",
      };
    } else if (isFair) {
      valuationPillar = {
        id: "valuation",
        label: "Valuasi P/E",
        valueLabel: formatMultiple(peRatio, 1),
        statusLabel: "Wajar",
        detailText: `${formatPersen(diffPct, 1, true)} vs Mean ${formatMultiple(historicalPeMean, 1)}`,
        score: 68,
        tone: "teal",
        targetAction: "valuation",
      };
    } else if (isPremium) {
      valuationPillar = {
        id: "valuation",
        label: "Valuasi P/E",
        valueLabel: formatMultiple(peRatio, 1),
        statusLabel: "Premium",
        detailText: `${formatPersen(diffPct, 1, true)} di atas Mean`,
        score: 42,
        tone: "amber",
        targetAction: "valuation",
      };
    } else {
      valuationPillar = {
        id: "valuation",
        label: "Valuasi P/E",
        valueLabel: formatMultiple(peRatio, 1),
        statusLabel: "Overvalued",
        detailText: `${formatPersen(diffPct, 1, true)} di atas Mean`,
        score: 22,
        tone: "coral",
        targetAction: "valuation",
      };
    }
  } else if (peRatio > 0) {
    valuationPillar = {
      id: "valuation",
      label: "Valuasi P/E",
      valueLabel: formatMultiple(peRatio, 1),
      statusLabel: peRatio <= 12 ? "Atraktif" : peRatio <= 20 ? "Moderat" : "Tinggi",
      detailText: "P/E TTM tanpa pita historis",
      score: peRatio <= 12 ? 78 : peRatio <= 20 ? 58 : 34,
      tone: peRatio <= 12 ? "emerald" : peRatio <= 20 ? "teal" : "amber",
      targetAction: "valuation",
    };
  } else {
    valuationPillar = {
      id: "valuation",
      label: "Valuasi P/E",
      valueLabel: "-",
      statusLabel: "N/A",
      detailText: "P/E TTM tidak tersedia",
      score: 12,
      tone: "muted",
      targetAction: "valuation",
    };
  }

  // 2. Profitabilitas (ROE)
  let roePillar: StockHealthPillar;
  if (roe !== undefined && Number.isFinite(roe) && roe !== 0) {
    if (roe >= 18) {
      roePillar = {
        id: "profitability",
        label: "Profitabilitas",
        valueLabel: `ROE ${formatPersen(roe, 1)}`,
        statusLabel: "Kuat",
        detailText: "Efisiensi ekuitas tinggi",
        score: Math.min(98, Math.round(60 + roe * 1.4)),
        tone: "emerald",
        targetAction: "fundamental",
      };
    } else if (roe >= 12) {
      roePillar = {
        id: "profitability",
        label: "Profitabilitas",
        valueLabel: `ROE ${formatPersen(roe, 1)}`,
        statusLabel: "Solid",
        detailText: "Di atas rerata bursa",
        score: Math.round(45 + roe * 1.8),
        tone: "teal",
        targetAction: "fundamental",
      };
    } else if (roe >= 6) {
      roePillar = {
        id: "profitability",
        label: "Profitabilitas",
        valueLabel: `ROE ${formatPersen(roe, 1)}`,
        statusLabel: "Moderat",
        detailText: "Cukup stabil",
        score: 44,
        tone: "amber",
        targetAction: "fundamental",
      };
    } else {
      roePillar = {
        id: "profitability",
        label: "Profitabilitas",
        valueLabel: `ROE ${formatPersen(roe, 1)}`,
        statusLabel: "Tertekan",
        detailText: "Imbal hasil ekuitas rendah",
        score: 20,
        tone: "coral",
        targetAction: "fundamental",
      };
    }
  } else {
    roePillar = {
      id: "profitability",
      label: "Profitabilitas",
      valueLabel: "ROE -",
      statusLabel: "Data Terbatas",
      detailText: "Belum tersedia dari sumber",
      score: 14,
      tone: "muted",
      targetAction: "fundamental",
    };
  }

  // 3. Kesehatan Neraca (DER — disesuaikan agar sektor perbankan tidak disalahartikan)
  const isBankingSector = /bank|keuangan|finansial|financial/i.test(sector);
  let healthPillar: StockHealthPillar;
  if (der !== undefined && Number.isFinite(der) && der >= 0) {
    if (isBankingSector) {
      const bankHealthy = der <= 8.5;
      healthPillar = {
        id: "health",
        label: "Struktur DER",
        valueLabel: `${formatDesimal(der, 2)}x`,
        statusLabel: bankHealthy ? "Normal Bank" : "Leverage Tinggi",
        detailText: "Struktur liabilitas DPK bank",
        score: bankHealthy ? 72 : 42,
        tone: bankHealthy ? "teal" : "amber",
        targetAction: "fundamental",
      };
    } else if (der <= 0.6) {
      healthPillar = {
        id: "health",
        label: "Struktur DER",
        valueLabel: `${formatDesimal(der, 2)}x`,
        statusLabel: "Konservatif",
        detailText: "Utang rendah & neraca kuat",
        score: 92,
        tone: "emerald",
        targetAction: "fundamental",
      };
    } else if (der <= 1.2) {
      healthPillar = {
        id: "health",
        label: "Struktur DER",
        valueLabel: `${formatDesimal(der, 2)}x`,
        statusLabel: "Sehat",
        detailText: "Rasio utang terkendali",
        score: 72,
        tone: "teal",
        targetAction: "fundamental",
      };
    } else if (der <= 2.0) {
      healthPillar = {
        id: "health",
        label: "Struktur DER",
        valueLabel: `${formatDesimal(der, 2)}x`,
        statusLabel: "Moderat",
        detailText: "Perlu pantau biaya bunga",
        score: 46,
        tone: "amber",
        targetAction: "fundamental",
      };
    } else {
      healthPillar = {
        id: "health",
        label: "Struktur DER",
        valueLabel: `${formatDesimal(der, 2)}x`,
        statusLabel: "Tinggi",
        detailText: "Leverage relatif besar",
        score: 22,
        tone: "coral",
        targetAction: "fundamental",
      };
    }
  } else {
    healthPillar = {
      id: "health",
      label: "Struktur DER",
      valueLabel: "-",
      statusLabel: "N/A",
      detailText: "Rasio DER belum tersedia",
      score: 14,
      tone: "muted",
      targetAction: "fundamental",
    };
  }

  // 4. Dividen Yield
  let divPillar: StockHealthPillar;
  if (dividendYield >= 5) {
    divPillar = {
      id: "dividend",
      label: "Dividen Yield",
      valueLabel: formatPersen(dividendYield, 1),
      statusLabel: "Tinggi",
      detailText: "Atraktif untuk income",
      score: Math.min(96, Math.round(62 + dividendYield * 4.5)),
      tone: "emerald",
      targetAction: "fundamental",
    };
  } else if (dividendYield >= 2.5) {
    divPillar = {
      id: "dividend",
      label: "Dividen Yield",
      valueLabel: formatPersen(dividendYield, 1),
      statusLabel: "Menarik",
      detailText: "Arus kas dividen rutin",
      score: 68,
      tone: "teal",
      targetAction: "fundamental",
    };
  } else if (dividendYield > 0) {
    divPillar = {
      id: "dividend",
      label: "Dividen Yield",
      valueLabel: formatPersen(dividendYield, 1),
      statusLabel: "Moderat",
      detailText: "Fokus pertumbuhan / kecil",
      score: 42,
      tone: "amber",
      targetAction: "fundamental",
    };
  } else {
    divPillar = {
      id: "dividend",
      label: "Dividen Yield",
      valueLabel: "0%",
      statusLabel: "Nihil",
      detailText: "Tidak rutin bagi dividen",
      score: 16,
      tone: "muted",
      targetAction: "fundamental",
    };
  }

  // 5. Jarak Target Beli
  const targetEval = evaluateTargetBuyStatus(price, targetBuyPrice);
  let targetPillar: StockHealthPillar;
  if (targetEval.status === "hit" && targetBuyPrice) {
    targetPillar = {
      id: "target",
      label: "Target Beli",
      valueLabel: formatRupiah(targetBuyPrice),
      statusLabel: "Area Beli",
      detailText: `${formatPersen(targetEval.diffPercent, 1, true)} dari target`,
      score: 95,
      tone: "emerald",
      targetAction: "target",
    };
  } else if (targetEval.status === "near" && targetBuyPrice) {
    targetPillar = {
      id: "target",
      label: "Target Beli",
      valueLabel: formatRupiah(targetBuyPrice),
      statusLabel: "Dekat Target",
      detailText: `${formatPersen(targetEval.diffPercent, 1, true)} di atas target`,
      score: 74,
      tone: "amber",
      targetAction: "target",
    };
  } else if (targetEval.status === "above" && targetBuyPrice) {
    targetPillar = {
      id: "target",
      label: "Target Beli",
      valueLabel: formatRupiah(targetBuyPrice),
      statusLabel: "Menunggu",
      detailText: `${formatPersen(targetEval.diffPercent, 1, true)} di atas target`,
      score: 40,
      tone: "teal",
      targetAction: "target",
    };
  } else {
    targetPillar = {
      id: "target",
      label: "Target Beli",
      valueLabel: "Belum Ada",
      statusLabel: "Atur",
      detailText: "Pasang alert harga masuk",
      score: 20,
      tone: "muted",
      targetAction: "target",
    };
  }

  return [valuationPillar, roePillar, healthPillar, divPillar, targetPillar];
}

export interface ValuationGaugeBandStop {
  id: "sd2Minus" | "sd1Minus" | "mean" | "sd1Plus" | "sd2Plus";
  label: string;
  pe: number;
  impliedPrice: number;
  upsidePct: number;
  pctOnArc: number; // 10, 30, 50, 70, 90
  tone: HealthTone;
}

export interface ValuationGaugeResult {
  normalizedPct: number; // 4..96 along semicircle
  angleDeg: number; // -90..+90
  zoneLabel: string;
  tone: HealthTone;
  diffFromMeanPct: number;
  stops: ValuationGaugeBandStop[];
}

export interface ValuationGaugeInput {
  activePe: number;
  activePrice: number;
  historicalPeMean: number;
  peSd1Minus: number;
  peSd2Minus: number;
  peSd1Plus: number;
  peSd2Plus: number;
}

/**
 * Memetakan P/E aktif secara piecewise-linear pada busur setengah lingkaran (-2 SD .. +2 SD)
 * sehingga posisi jarum selalu sejajar presisi dengan penanda pita deviasi.
 */
export function computeValuationGaugePosition(input: ValuationGaugeInput): ValuationGaugeResult | null {
  const { activePe, activePrice, historicalPeMean, peSd1Minus, peSd2Minus, peSd1Plus, peSd2Plus } =
    input;
  if (
    !Number.isFinite(activePe) ||
    activePe <= 0 ||
    !Number.isFinite(historicalPeMean) ||
    historicalPeMean <= 0
  ) {
    return null;
  }

  const anchors: { pe: number; pct: number }[] = [
    { pe: Math.max(0.1, peSd2Minus), pct: 10 },
    { pe: Math.max(0.2, peSd1Minus), pct: 30 },
    { pe: historicalPeMean, pct: 50 },
    { pe: Math.max(historicalPeMean + 0.1, peSd1Plus), pct: 70 },
    { pe: Math.max(peSd1Plus + 0.1, peSd2Plus), pct: 90 },
  ];

  let pct = 50;
  if (activePe <= anchors[0].pe) {
    const span = Math.max(0.5, anchors[1].pe - anchors[0].pe);
    pct = 10 - ((anchors[0].pe - activePe) / span) * 10;
  } else if (activePe >= anchors[4].pe) {
    const span = Math.max(0.5, anchors[4].pe - anchors[3].pe);
    pct = 90 + ((activePe - anchors[4].pe) / span) * 10;
  } else {
    for (let i = 0; i < anchors.length - 1; i++) {
      const low = anchors[i];
      const high = anchors[i + 1];
      if (activePe >= low.pe && activePe <= high.pe) {
        const ratio = (activePe - low.pe) / Math.max(0.01, high.pe - low.pe);
        pct = low.pct + ratio * (high.pct - low.pct);
        break;
      }
    }
  }

  const normalizedPct = Math.max(4, Math.min(96, pct));
  const angleDeg = (normalizedPct / 100) * 180 - 90;
  const diffFromMeanPct = ((activePe - historicalPeMean) / historicalPeMean) * 100;

  let zoneLabel = "Valuasi Wajar";
  let tone: HealthTone = "teal";
  if (activePe <= peSd2Minus) {
    zoneLabel = "Diskon Ekstrim";
    tone = "emerald";
  } else if (activePe <= peSd1Minus) {
    zoneLabel = "Undervalued";
    tone = "emerald";
  } else if (activePe <= historicalPeMean) {
    zoneLabel = "Valuasi Wajar";
    tone = "teal";
  } else if (activePe <= peSd1Plus) {
    zoneLabel = "Cukup Premium";
    tone = "amber";
  } else {
    zoneLabel = "Overvalued";
    tone = "coral";
  }

  const impliedEps = activePrice > 0 ? activePrice / activePe : 0;
  const makeStop = (
    id: ValuationGaugeBandStop["id"],
    label: string,
    pe: number,
    pctOnArc: number,
    stopTone: HealthTone
  ): ValuationGaugeBandStop => {
    const impliedPrice = impliedEps > 0 ? Math.round(impliedEps * pe) : 0;
    const upsidePct =
      activePrice > 0 && impliedPrice > 0 ? ((impliedPrice - activePrice) / activePrice) * 100 : 0;
    return { id, label, pe, impliedPrice, upsidePct, pctOnArc, tone: stopTone };
  };

  const stops: ValuationGaugeBandStop[] = [
    makeStop("sd2Minus", "-2 SD", peSd2Minus, 10, "emerald"),
    makeStop("sd1Minus", "-1 SD", peSd1Minus, 30, "emerald"),
    makeStop("mean", "Mean", historicalPeMean, 50, "teal"),
    makeStop("sd1Plus", "+1 SD", peSd1Plus, 70, "amber"),
    makeStop("sd2Plus", "+2 SD", peSd2Plus, 90, "coral"),
  ];

  return {
    normalizedPct,
    angleDeg,
    zoneLabel,
    tone,
    diffFromMeanPct,
    stops,
  };
}

export interface PositionTargetSimulation {
  allocatedRp: number;
  projectedValueRp: number;
  profitLossRp: number;
  returnPct: number;
}

export function computePositionTargetSimulation(
  currentPrice: number,
  referencePrice: number | undefined,
  lots: number,
  lotSize: number = 100
): PositionTargetSimulation | null {
  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    !referencePrice ||
    !Number.isFinite(referencePrice) ||
    referencePrice <= 0 ||
    lots <= 0
  ) {
    return null;
  }
  const shares = lots * lotSize;
  const allocatedRp = shares * currentPrice;
  const projectedValueRp = shares * referencePrice;
  const profitLossRp = projectedValueRp - allocatedRp;
  const returnPct = ((referencePrice - currentPrice) / currentPrice) * 100;
  return { allocatedRp, projectedValueRp, profitLossRp, returnPct };
}
