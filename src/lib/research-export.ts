import type { ComparableStockMetrics, ComparisonWinners, NormalizedComparisonSeries } from "./compare";
import { formatDesimal, formatMultiple, formatPersen, formatRupiah } from "./format";
import { evaluateTargetBuyStatus } from "./watchlist";

export interface StockResearchExportInput {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  sourceLabel: string;
  updatedAt?: string;
  valuationLabel: string;
  valuationVerdict: string;
  peRatio: number;
  pbvRatio: number;
  dividendYield: number;
  roe?: number;
  der?: number;
  marketCapTrillion?: number;
  payoutRatio?: number;
  grahamNumber?: number;
  grahamUpsidePct?: number;
  bands?: {
    kind: "curated" | "dynamic";
    historicalPeMean: number;
    peSd1Minus: number;
    peSd2Minus: number;
    targetMeanPrice: number;
    targetSd1MinusPrice: number;
    targetSd2MinusPrice: number;
    meanUpsidePct: number;
  } | null;
  targetBuyPrice?: number;
  note?: string;
}

/**
 * Formats a concise Indonesian Markdown research summary for a single IDX stock.
 */
export function buildStockResearchMarkdown(input: StockResearchExportInput): string {
  const lines: string[] = [];
  const priceStr = input.price > 0 ? formatRupiah(input.price) : "-";
  const changeStr = input.price > 0 ? ` (${formatPersen(input.changePercent, 1, true)})` : "";
  const metaSuffix = input.updatedAt ? ` • ${input.updatedAt}` : "";

  lines.push(`# ${input.ticker} — ${input.name} (${input.sector})`);
  lines.push(`Harga Terkini: **${priceStr}**${changeStr} • Sumber: ${input.sourceLabel}${metaSuffix}`);

  if (input.targetBuyPrice || input.note) {
    lines.push("");
    lines.push("## Target Beli & Catatan Watchlist");
    if (input.targetBuyPrice && input.targetBuyPrice > 0) {
      const targetEval = evaluateTargetBuyStatus(input.price, input.targetBuyPrice);
      const statusLabel =
        targetEval.status === "hit"
          ? `Area Beli (${formatPersen(targetEval.diffPercent, 1, true)} dari target)`
          : targetEval.status === "near"
          ? `Mendekati Target (${formatPersen(targetEval.diffPercent, 1, true)} dari target)`
          : targetEval.status === "above"
          ? `Di Atas Target (${formatPersen(targetEval.diffPercent, 1, true)} dari target)`
          : "Menunggu harga";
      lines.push(`- Target Harga Beli: ${formatRupiah(input.targetBuyPrice)} — ${statusLabel}`);
    }
    if (input.note) {
      lines.push(`- Catatan Pribadi: ${input.note}`);
    }
  }

  lines.push("");
  lines.push("## Ringkasan Valuasi");
  lines.push(`- Status Valuasi: ${input.valuationLabel}`);
  if (input.valuationVerdict) {
    lines.push(`- Diagnosis: ${input.valuationVerdict}`);
  }
  lines.push(`- P/E Ratio (TTM): ${input.peRatio > 0 ? formatMultiple(input.peRatio, 1) : "-"}`);
  if (input.bands && input.bands.targetMeanPrice > 0) {
    const bandLabel = input.bands.kind === "dynamic" ? "Mean 5Th" : "Mean Historis";
    lines.push(
      `- Harga Wajar (${bandLabel} ${formatMultiple(input.bands.historicalPeMean, 1)}): ${formatRupiah(
        input.bands.targetMeanPrice
      )} (${formatPersen(input.bands.meanUpsidePct, 1, true)})`
    );
    lines.push(
      `- Area Diskon (-1 SD / -2 SD): ${formatRupiah(input.bands.targetSd1MinusPrice)} (${formatMultiple(
        input.bands.peSd1Minus,
        1
      )}) / ${formatRupiah(input.bands.targetSd2MinusPrice)} (${formatMultiple(
        input.bands.peSd2Minus,
        1
      )})`
    );
  }
  if (input.grahamNumber && input.grahamNumber > 0) {
    const grahamUpsideStr =
      input.grahamUpsidePct !== undefined
        ? ` (${formatPersen(input.grahamUpsidePct, 1, true)})`
        : "";
    lines.push(`- Nilai Intrinsik Graham: ${formatRupiah(input.grahamNumber)}${grahamUpsideStr}`);
  }

  lines.push("");
  lines.push("## Rasio Fundamental Utama");
  lines.push(`- PBV Ratio: ${input.pbvRatio > 0 ? formatMultiple(input.pbvRatio, 2) : "-"}`);
  lines.push(
    `- Dividend Yield: ${input.dividendYield > 0 ? formatPersen(input.dividendYield, 1) : "-"}`
  );
  lines.push(`- ROE: ${input.roe !== undefined ? formatPersen(input.roe, 1) : "-"}`);
  lines.push(`- DER (Utang): ${input.der !== undefined ? formatMultiple(input.der, 2) : "-"}`);
  if (input.payoutRatio !== undefined) {
    lines.push(`- Payout Ratio: ${formatPersen(input.payoutRatio, 1)}`);
  } else if (input.marketCapTrillion && input.marketCapTrillion > 0) {
    lines.push(`- Kapitalisasi Pasar: Rp ${formatDesimal(input.marketCapTrillion, 1)} T`);
  }

  lines.push("");
  lines.push("_Disalin dari StocksSense — bukan rekomendasi investasi._");

  return lines.join("\n");
}

export interface ComparisonResearchExportInput {
  metrics: ComparableStockMetrics[];
  winners: ComparisonWinners;
  compareRange: string;
  normalizedSeries: NormalizedComparisonSeries[];
  providerLabel: string;
}

/**
 * Formats a comparative Markdown table and winner highlights for 2-3 IDX stocks.
 */
export function buildComparisonResearchMarkdown(input: ComparisonResearchExportInput): string {
  const { metrics, winners, compareRange, normalizedSeries, providerLabel } = input;
  if (metrics.length === 0) return "";

  const tickersHeader = metrics.map((m) => m.ticker);
  const lines: string[] = [];

  lines.push(`# Perbandingan Saham: ${tickersHeader.join(" vs ")}`);
  lines.push(`Sumber: ${providerLabel} • Periode Performa Relatif: ${compareRange}`);

  if (normalizedSeries.length > 0) {
    const perfLine = normalizedSeries
      .map((s) => `${s.ticker}: ${formatPersen(s.totalReturnPct, 1, true)}`)
      .join(" | ");
    lines.push(`Performa Harga (${compareRange}): ${perfLine}`);
  }

  lines.push("");
  lines.push(`| Metrik | ${tickersHeader.join(" | ")} |`);
  lines.push(`| --- | ${tickersHeader.map(() => "---").join(" | ")} |`);

  const addRow = (label: string, values: string[]) => {
    lines.push(`| ${label} | ${values.join(" | ")} |`);
  };

  addRow(
    "Harga Terkini",
    metrics.map((m) =>
      m.price > 0
        ? `${formatRupiah(m.price)} (${formatPersen(m.changePercent, 1, true)})`
        : "-"
    )
  );
  addRow(
    "Sektor",
    metrics.map((m) => m.sector)
  );
  addRow(
    "P/E Ratio (TTM)",
    metrics.map((m) => {
      const val = m.peRatio > 0 ? formatMultiple(m.peRatio, 1) : "-";
      return winners.lowestPeTicker === m.ticker ? `${val} (Terendah)` : val;
    })
  );
  addRow(
    "PBV Ratio",
    metrics.map((m) => {
      const val = m.pbvRatio > 0 ? formatMultiple(m.pbvRatio, 2) : "-";
      return winners.lowestPbvTicker === m.ticker ? `${val} (Terendah)` : val;
    })
  );
  addRow(
    "Dividend Yield",
    metrics.map((m) => {
      const val = m.dividendYield > 0 ? formatPersen(m.dividendYield, 1) : "-";
      return winners.highestDividendTicker === m.ticker ? `${val} (Tertinggi)` : val;
    })
  );
  addRow(
    "ROE",
    metrics.map((m) => {
      const val = m.roe !== undefined ? formatPersen(m.roe, 1) : "-";
      return winners.highestRoeTicker === m.ticker ? `${val} (Tertinggi)` : val;
    })
  );
  addRow(
    "DER (Utang)",
    metrics.map((m) => {
      const val = m.der !== undefined ? formatMultiple(m.der, 2) : "-";
      return winners.lowestDerTicker === m.ticker ? `${val} (Teraman)` : val;
    })
  );
  addRow(
    "Kapitalisasi Pasar",
    metrics.map((m) =>
      m.marketCapTrillion && m.marketCapTrillion > 0
        ? `Rp ${formatDesimal(m.marketCapTrillion, 1)} T`
        : "-"
    )
  );
  addRow(
    "Target Beli Watchlist",
    metrics.map((m) => {
      if (!m.targetBuyPrice) return "-";
      const evalRes = evaluateTargetBuyStatus(m.price, m.targetBuyPrice);
      const base = formatRupiah(m.targetBuyPrice);
      return evalRes.status === "hit"
        ? `${base} (Area Beli)`
        : evalRes.status === "near"
        ? `${base} (Dekat)`
        : base;
    })
  );

  lines.push("");
  lines.push("_Disalin dari StocksSense — bukan rekomendasi investasi._");

  return lines.join("\n");
}
