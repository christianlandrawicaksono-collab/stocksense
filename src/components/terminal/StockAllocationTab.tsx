"use client";

import React, { useMemo, useState } from "react";
import { STOCKS_DATA } from "@/data/stocksData";
import {
  formatMultiple,
  formatNumber,
  formatPersen,
  formatRupiah,
  parseFormattedNumber,
} from "@/lib/format";
import {
  computePresetWeights,
  IDX_LOT_SIZE,
  normalizeWeightsTo100,
  simulatePortfolioAllocation,
  type AllocationCandidateInput,
  type AllocationWeightPreset,
} from "@/lib/portfolio-allocator";
import { buildAllocationPlanMarkdown } from "@/lib/research-export";
import { evaluateTargetBuyStatus, type WatchlistEntryMeta } from "@/lib/watchlist";
import type { MarketProvider, MarketQuote } from "@/lib/market-data";
import {
  AlertTriangle,
  Check,
  Copy,
  PieChart,
  Scale,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";

interface StockAllocationTabProps {
  quotes?: Record<string, MarketQuote>;
  provider: MarketProvider;
  customWatchlist: string[];
  watchlistNotes: Record<string, WatchlistEntryMeta>;
  onSelectTicker?: (ticker: string) => void;
  onAskAiAllocation?: (allocationSummary: string) => void;
}

const CURATED_BY_TICKER = new Map(STOCKS_DATA.map((s) => [s.ticker, s]));
const SAMPLE_TICKERS = ["BBCA", "BBRI", "TLKM", "ASII"];
const CAPITAL_PRESETS = [
  { label: "5 Jt", value: 5_000_000 },
  { label: "10 Jt", value: 10_000_000 },
  { label: "25 Jt", value: 25_000_000 },
  { label: "50 Jt", value: 50_000_000 },
];
const PRESET_LABELS: Record<AllocationWeightPreset, string> = {
  equal: "Bobot Setara",
  buy_zone: "Prioritas Area Beli",
  dividend: "Fokus Dividen",
  custom: "Bobot Kustom",
};
const SECTOR_COLORS = [
  "#1E7B85",
  "#2EB886",
  "#F59E0B",
  "#A855F7",
  "#3B82F6",
  "#EC4899",
];

export const StockAllocationTab: React.FC<StockAllocationTabProps> = ({
  quotes,
  provider,
  customWatchlist,
  watchlistNotes,
  onSelectTicker,
  onAskAiAllocation,
}) => {
  const [capitalInputStr, setCapitalInputStr] = useState<string>("10.000.000");
  const [presetMode, setPresetMode] = useState<AllocationWeightPreset>("equal");
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [onlyBuyZone, setOnlyBuyZone] = useState<boolean>(false);
  const [excludedTickers, setExcludedTickers] = useState<Set<string>>(() => new Set());
  const [sandboxTickers, setSandboxTickers] = useState<string[]>(SAMPLE_TICKERS);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);

  const totalCapitalRp = useMemo(
    () => Math.max(0, parseFormattedNumber(capitalInputStr)),
    [capitalInputStr]
  );

  const usingWatchlistSource = customWatchlist.length > 0;
  const sourceTickers = usingWatchlistSource ? customWatchlist : sandboxTickers;

  const candidatePool: AllocationCandidateInput[] = useMemo(() => {
    const res: AllocationCandidateInput[] = [];
    for (const ticker of sourceTickers) {
      const curated = CURATED_BY_TICKER.get(ticker);
      const q = quotes?.[ticker];
      const isLive = Boolean(provider === "yahoo" && q && !q.isFallback);
      const price = q && q.price > 0 ? q.price : provider !== "yahoo" ? curated?.currentPrice ?? 0 : 0;
      if (price <= 0) continue;

      const peRatio = isLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : curated?.peRatio ?? 0;
      const pbvRatio = isLive && q?.pbvRatio && q.pbvRatio > 0 ? q.pbvRatio : curated?.pbvRatio ?? 0;
      const dividendYield =
        isLive && q?.dividendYield !== undefined && q.dividendYield >= 0
          ? q.dividendYield
          : curated?.dividendYield ?? 0;
      const sector = curated?.sector || q?.sector || "Saham BEI";
      const name = curated?.name || q?.name || ticker;
      const targetBuyPrice = watchlistNotes[ticker]?.targetBuyPrice;
      const targetEval = evaluateTargetBuyStatus(price, targetBuyPrice);

      res.push({
        ticker,
        name,
        sector,
        price,
        peRatio,
        pbvRatio,
        dividendYield,
        targetBuyPrice,
        targetStatus: targetEval.status,
      });
    }
    return res;
  }, [sourceTickers, quotes, provider, watchlistNotes]);

  const buyZonePoolCount = useMemo(
    () => candidatePool.filter((c) => c.targetStatus === "hit" || c.targetStatus === "near").length,
    [candidatePool]
  );

  const visibleCandidates = useMemo(() => {
    if (!onlyBuyZone) return candidatePool;
    return candidatePool.filter((c) => c.targetStatus === "hit" || c.targetStatus === "near");
  }, [candidatePool, onlyBuyZone]);

  const activeParticipants = useMemo(
    () => visibleCandidates.filter((c) => !excludedTickers.has(c.ticker)),
    [visibleCandidates, excludedTickers]
  );

  const effectiveWeights = useMemo(() => {
    if (presetMode !== "custom") {
      return computePresetWeights(activeParticipants, presetMode);
    }
    const basePreset = computePresetWeights(activeParticipants, "equal");
    const merged: Record<string, number> = {};
    for (const c of activeParticipants) {
      merged[c.ticker] = customWeights[c.ticker] ?? basePreset[c.ticker] ?? 0;
    }
    return merged;
  }, [presetMode, activeParticipants, customWeights]);

  const summary = useMemo(
    () =>
      simulatePortfolioAllocation({
        totalCapitalRp,
        candidates: activeParticipants,
        weightsByTicker: effectiveWeights,
      }),
    [totalCapitalRp, activeParticipants, effectiveWeights]
  );

  const rowsByTicker = useMemo(
    () => new Map(summary.rows.map((r) => [r.ticker, r])),
    [summary.rows]
  );

  const handleCapitalChange = (raw: string) => {
    const cleanNum = parseFormattedNumber(raw);
    setCapitalInputStr(cleanNum > 0 ? formatNumber(cleanNum) : raw.trim() === "" ? "" : "0");
  };

  const handleSelectPreset = (nextPreset: AllocationWeightPreset) => {
    if (nextPreset === "custom") {
      setCustomWeights({ ...effectiveWeights });
    }
    setPresetMode(nextPreset);
  };

  const handleWeightInputChange = (ticker: string, raw: string) => {
    const digitsOnly = raw.replace(/[^\d]/g, "");
    const parsed = digitsOnly === "" ? 0 : Math.min(100, parseInt(digitsOnly, 10));
    const seed = presetMode === "custom" ? customWeights : effectiveWeights;
    const next: Record<string, number> = {};
    for (const c of activeParticipants) {
      next[c.ticker] = seed[c.ticker] ?? 0;
    }
    next[ticker] = parsed;
    setCustomWeights(next);
    setPresetMode("custom");
  };

  const handleNormalizeWeights = () => {
    const tickers = activeParticipants.map((c) => c.ticker);
    const normalized = normalizeWeightsTo100(tickers, effectiveWeights);
    setCustomWeights(normalized);
    setPresetMode("custom");
  };

  const handleToggleParticipant = (ticker: string) => {
    setExcludedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const handleToggleSandboxTicker = (ticker: string) => {
    setSandboxTickers((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  };

  const providerLabel = provider === "yahoo" ? "Yahoo Finance" : "Data Ilustrasi";
  const roundedWeightSum = Math.round(summary.totalInputWeightPct);

  const handleCopyPlan = async () => {
    try {
      const md = buildAllocationPlanMarkdown({
        summary,
        presetLabel: PRESET_LABELS[presetMode],
        providerLabel,
      });
      await navigator.clipboard.writeText(md);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      // Abaikan bila Clipboard API tidak tersedia
    }
  };

  const handleAskAi = () => {
    if (!onAskAiAllocation) return;
    const allocLines = summary.rows
      .filter((r) => r.inputWeightPct > 0 || r.lots > 0)
      .map(
        (r) =>
          `- ${r.ticker} (${r.sector}): ${r.lots} lot (${formatRupiah(r.allocatedRp)}, bobot aktual ${formatPersen(
            r.actualWeightPct,
            1
          )}, P/E ${r.peRatio > 0 ? formatMultiple(r.peRatio, 1) : "-"}, Div ${formatPersen(
            r.dividendYield,
            1
          )})`
      )
      .join("\n");
    const sectorStr = summary.sectorBreakdown
      .map((s) => `${s.sector} (${formatPersen(s.sharePct, 1)})`)
      .join(", ");
    const concStr = summary.concentratedSector
      ? ` Peringatan: Konsentrasi tinggi di ${summary.concentratedSector.sector} (${formatPersen(
          summary.concentratedSector.sharePct,
          1
        )}).`
      : "";
    const text = `Modal ${formatRupiah(summary.totalCapitalRp)}, teralokasi ${formatRupiah(
      summary.totalAllocatedRp
    )} (${formatPersen(summary.utilizationPct, 1)}), sisa kas ${formatRupiah(
      summary.remainingCashRp
    )}. Strategi: ${PRESET_LABELS[presetMode]}. Est. dividen tahunan ${formatRupiah(
      summary.estimatedAnnualDividendRp
    )} (yield ${formatPersen(summary.weightedDividendYieldPct, 1)}), P/E gabungan ${
      summary.weightedPeRatio > 0 ? formatMultiple(summary.weightedPeRatio, 1) : "-"
    }, PBV gabungan ${
      summary.weightedPbvRatio > 0 ? formatMultiple(summary.weightedPbvRatio, 2) : "-"
    }. Sektor: ${sectorStr || "-"}.${concStr}\nRincian:\n${allocLines}`;
    onAskAiAllocation(text);
  };

  return (
    <div className="p-4 md:p-5 space-y-5 text-xs">
      {/* Header Sumber Kandidat & Toolbar Aksi */}
      <div className="bg-[#0C1017] border border-[#1E2736] rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-[#2DD4BF]" />
              <span>Simulator Alokasi Modal Watchlist (Lot BEI {IDX_LOT_SIZE} lbr)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {usingWatchlistSource
                ? `Menggunakan ${candidatePool.length} saham berharga valid dari Watchlist Saya.`
                : "Watchlist Saya kosong — mode simulasi contoh dari Saham Kurasi aktif."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={summary.rows.length === 0}
              onClick={() => void handleCopyPlan()}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap transition ${
                copiedMarkdown
                  ? "bg-[#2EB886]/20 border-[#2EB886]/50 text-[#2EB886]"
                  : "bg-[#111622] hover:bg-[#171F2C] text-slate-200 border-[#232F42] disabled:opacity-45"
              }`}
              title="Salin rencana alokasi lot & metrik ke clipboard (Markdown)"
            >
              {copiedMarkdown ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Rencana</span>
                </>
              )}
            </button>

            {onAskAiAllocation && (
              <button
                type="button"
                disabled={summary.totalAllocatedRp <= 0}
                onClick={handleAskAi}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#1E7B85]/20 hover:bg-[#1E7B85]/35 disabled:opacity-45 text-[#2DD4BF] border border-[#1E7B85]/40 text-[11px] font-medium whitespace-nowrap transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bedah Alokasi AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Kontrol Modal & Strategi Bobot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2.5 border-t border-[#1A2230]">
          <div className="lg:col-span-5 space-y-1.5">
            <label htmlFor="allocation-capital-input" className="text-[11px] text-slate-400 block">
              Total Modal Alokasi (Rp)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                  Rp
                </span>
                <input
                  id="allocation-capital-input"
                  name="allocationCapital"
                  type="text"
                  value={capitalInputStr}
                  onChange={(e) => handleCapitalChange(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-[#111622] border border-[#20293A] rounded-lg text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                />
              </div>
              <div className="flex items-center gap-1">
                {CAPITAL_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setCapitalInputStr(formatNumber(p.value))}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition border ${
                      totalCapitalRp === p.value
                        ? "bg-[#1E7B85] border-[#1E7B85] text-white"
                        : "bg-[#111622] hover:bg-[#171F2C] text-slate-300 border-[#232F42]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Strategi Pembobotan</span>
              {buyZonePoolCount > 0 && (
                <label
                  htmlFor="allocation-only-buy-zone"
                  className="inline-flex items-center space-x-1.5 text-[11px] text-[#2EB886] cursor-pointer select-none"
                >
                  <input
                    id="allocation-only-buy-zone"
                    name="allocationOnlyBuyZone"
                    type="checkbox"
                    checked={onlyBuyZone}
                    onChange={(e) => setOnlyBuyZone(e.target.checked)}
                    className="rounded border-[#232F42] bg-[#111622] accent-[#2EB886]"
                  />
                  <span>Hanya Area Beli / Dekat ({buyZonePoolCount})</span>
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(["equal", "buy_zone", "dividend", "custom"] as AllocationWeightPreset[]).map(
                (preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] transition border ${
                      presetMode === preset
                        ? "bg-[#1E7B85] border-[#1E7B85] text-white font-medium shadow-sm"
                        : "bg-[#111622] hover:bg-[#171F2C] text-slate-300 border-[#232F42]"
                    }`}
                  >
                    {PRESET_LABELS[preset]}
                  </button>
                )
              )}

              {presetMode === "custom" && roundedWeightSum !== 100 && activeParticipants.length > 0 && (
                <button
                  type="button"
                  onClick={handleNormalizeWeights}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-medium transition"
                  title="Sesuaikan seluruh bobot agar totalnya tepat 100%"
                >
                  <Scale className="w-3 h-3" />
                  <span>Normalisasi 100% (Saat ini {roundedWeightSum}%)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pilihan Saham Contoh (bila Watchlist Saya kosong) */}
        {!usingWatchlistSource && (
          <div className="pt-2 border-t border-[#1A2230] flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Saham simulasi:</span>
            {STOCKS_DATA.map((s) => {
              const active = sandboxTickers.includes(s.ticker);
              return (
                <button
                  key={s.ticker}
                  type="button"
                  onClick={() => handleToggleSandboxTicker(s.ticker)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] border transition ${
                    active
                      ? "bg-[#1E7B85]/20 border-[#1E7B85]/50 text-[#2DD4BF]"
                      : "bg-[#111622] border-[#232F42] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {s.ticker}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4 Kartu KPI Portofolio Gabungan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 bg-[#0C1017] border border-[#1E2736] rounded-xl space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <Wallet className="w-3 h-3 text-[#2DD4BF]" />
            <span>Teralokasi &amp; Sisa Kas</span>
          </span>
          <div className="text-sm font-mono font-bold text-slate-100 tnum">
            {formatRupiah(summary.totalAllocatedRp)}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tnum">
            {formatPersen(summary.utilizationPct, 1)} • Sisa {formatRupiah(summary.remainingCashRp)}
          </div>
        </div>

        <div className="p-3 bg-[#0C1017] border border-[#1E2736] rounded-xl space-y-1">
          <span className="text-[11px] text-slate-400 block">Est. Dividen Tahunan</span>
          <div className="text-sm font-mono font-bold text-[#2EB886] tnum">
            {summary.estimatedAnnualDividendRp > 0
              ? formatRupiah(summary.estimatedAnnualDividendRp)
              : "-"}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tnum">
            Yield {summary.weightedDividendYieldPct > 0 ? formatPersen(summary.weightedDividendYieldPct, 1) : "-"}
            {summary.estimatedMonthlyDividendRp > 0
              ? ` • ${formatRupiah(summary.estimatedMonthlyDividendRp)}/bln`
              : ""}
          </div>
        </div>

        <div className="p-3 bg-[#0C1017] border border-[#1E2736] rounded-xl space-y-1">
          <span className="text-[11px] text-slate-400 block">Valuasi Gabungan (Harmonic)</span>
          <div className="text-sm font-mono font-bold text-slate-100 tnum">
            P/E {summary.weightedPeRatio > 0 ? formatMultiple(summary.weightedPeRatio, 1) : "-"}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tnum">
            PBV {summary.weightedPbvRatio > 0 ? formatMultiple(summary.weightedPbvRatio, 2) : "-"} •{" "}
            {summary.totalLots} lot
          </div>
        </div>

        <div className="p-3 bg-[#0C1017] border border-[#1E2736] rounded-xl space-y-1">
          <span className="text-[11px] text-slate-400 block">Sektor Dominan</span>
          <div
            className={`text-sm font-semibold truncate ${
              summary.concentratedSector ? "text-amber-300" : "text-slate-100"
            }`}
          >
            {summary.topSector ? summary.topSector.sector : "-"}
          </div>
          <div className="text-[11px] text-slate-400 font-mono tnum">
            {summary.topSector
              ? `${formatPersen(summary.topSector.sharePct, 1)} dari modal teralokasi`
              : "Belum ada lot teralokasi"}
          </div>
        </div>
      </div>

      {/* Peringatan Konsentrasi Sektor (>= 60%) */}
      {summary.concentratedSector && (
        <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-amber-200 flex items-start space-x-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Konsentrasi sektor tinggi:</strong>{" "}
            {summary.concentratedSector.sector} menyumbang{" "}
            <span className="font-mono font-semibold tnum">
              {formatPersen(summary.concentratedSector.sharePct, 1)}
            </span>{" "}
            ({summary.concentratedSector.tickers.join(", ")}). Pertimbangkan diversifikasi lintas
            sektor bila ingin menekan risiko sektoral.
          </span>
        </div>
      )}

      {/* Tabel Alokasi Lot & Bobot per Emiten */}
      {visibleCandidates.length === 0 ? (
        <div className="p-6 rounded-xl bg-[#0C1017] border border-[#1E2736] text-center text-slate-400">
          {onlyBuyZone
            ? "Belum ada saham Watchlist yang masuk Area Beli atau mendekati Target (+5%). Matikan filter di atas untuk menampilkan semua saham."
            : "Belum ada emiten dengan harga valid yang dipilih untuk disimulasikan."}
        </div>
      ) : (
        <div className="bg-[#0C1017] border border-[#1E2736] rounded-xl overflow-hidden">
          <div className="overflow-x-auto terminal-scroll">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E2736] bg-[#0A0D14] text-[11px] text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Ikut</th>
                  <th className="py-2.5 px-3 font-medium">Emiten</th>
                  <th className="py-2.5 px-3 font-medium text-right">Harga (1 Lot)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Bobot (%)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Lot BEI</th>
                  <th className="py-2.5 px-3 font-medium text-right">Alokasi (Aktual)</th>
                  <th className="py-2.5 px-3 font-medium text-right">Est. Div/Th</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2230]/80">
                {visibleCandidates.map((c) => {
                  const included = !excludedTickers.has(c.ticker);
                  const row = rowsByTicker.get(c.ticker);
                  const costPerLot = c.price * IDX_LOT_SIZE;

                  return (
                    <tr
                      key={c.ticker}
                      className={included ? "hover:bg-[#111622]/70" : "opacity-45 bg-[#080B10]"}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          id={`alloc-include-${c.ticker}`}
                          name={`allocInclude_${c.ticker}`}
                          type="checkbox"
                          checked={included}
                          onChange={() => handleToggleParticipant(c.ticker)}
                          aria-label={`Sertakan ${c.ticker} dalam simulasi alokasi`}
                          className="rounded border-[#232F42] bg-[#111622] accent-[#1E7B85] cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 min-w-[155px]">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectTicker?.(c.ticker)}
                            className="font-mono font-bold text-slate-100 hover:text-[#2DD4BF] transition"
                          >
                            {c.ticker}
                          </button>
                          {c.targetStatus === "hit" && (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-[#2EB886]/20 text-[#2EB886] border border-[#2EB886]/35 font-mono text-[10px]">
                              <Target className="w-2.5 h-2.5" />
                              <span>Area Beli</span>
                            </span>
                          )}
                          {c.targetStatus === "near" && (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
                              <Target className="w-2.5 h-2.5" />
                              <span>Dekat</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[190px]">
                          {c.sector}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tnum whitespace-nowrap">
                        <div className="text-slate-200">{formatRupiah(c.price)}</div>
                        <div className="text-[10px] text-slate-500">
                          {formatRupiah(costPerLot)}/lot
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center space-x-1">
                          <input
                            id={`alloc-weight-${c.ticker}`}
                            name={`allocWeight_${c.ticker}`}
                            type="number"
                            min={0}
                            max={100}
                            disabled={!included}
                            aria-label={`Bobot persentase untuk ${c.ticker}`}
                            value={included ? effectiveWeights[c.ticker] ?? 0 : 0}
                            onChange={(e) => handleWeightInputChange(c.ticker, e.target.value)}
                            className="w-14 px-2 py-1 bg-[#111622] border border-[#20293A] rounded text-right text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85] disabled:opacity-40"
                          />
                          <span className="text-slate-500 font-mono">%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tnum whitespace-nowrap">
                        {!included || !row ? (
                          <span className="text-slate-500">-</span>
                        ) : row.insufficientForOneLot ? (
                          <span
                            className="text-[11px] text-amber-300"
                            title={`Butuh min. ${formatRupiah(row.costPerLotRp)} untuk 1 lot`}
                          >
                            0 lot (&lt;1 lot)
                          </span>
                        ) : (
                          <div>
                            <span className="font-semibold text-[#2DD4BF]">{row.lots} lot</span>
                            <span className="text-[10px] text-slate-500 block">
                              {formatNumber(row.shares)} lbr
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tnum whitespace-nowrap">
                        {!included || !row ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          <div>
                            <span className="text-slate-100 font-semibold">
                              {formatRupiah(row.allocatedRp)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {formatPersen(row.actualWeightPct, 1)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tnum whitespace-nowrap">
                        {!included || !row || row.estimatedAnnualDividendRp <= 0 ? (
                          <span className="text-slate-500">-</span>
                        ) : (
                          <div>
                            <span className="text-[#2EB886]">
                              {formatRupiah(row.estimatedAnnualDividendRp)}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {formatPersen(row.dividendYield, 1)}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#20293A] bg-[#0A0D14] font-mono tnum text-slate-200 font-semibold">
                  <td colSpan={3} className="py-2.5 px-3 font-sans text-slate-400 font-normal">
                    Total Portofolio ({activeParticipants.length} emiten aktif)
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {formatPersen(summary.totalInputWeightPct, 0)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#2DD4BF]">{summary.totalLots} lot</td>
                  <td className="py-2.5 px-3 text-right">{formatRupiah(summary.totalAllocatedRp)}</td>
                  <td className="py-2.5 px-3 text-right text-[#2EB886]">
                    {summary.estimatedAnnualDividendRp > 0
                      ? formatRupiah(summary.estimatedAnnualDividendRp)
                      : "-"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Visual Distribusi Sektor */}
      {summary.sectorBreakdown.length > 0 && (
        <div className="bg-[#0C1017] border border-[#1E2736] rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-medium text-slate-200">Komposisi Sektor Modal Teralokasi</span>
            <span>Batas peringatan konsentrasi: ≥ 60%</span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#171F2C]">
            {summary.sectorBreakdown.map((sec, idx) => (
              <div
                key={sec.sector}
                style={{
                  width: `${Math.max(2, sec.sharePct)}%`,
                  backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length],
                }}
                title={`${sec.sector}: ${formatPersen(sec.sharePct, 1)}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-[11px]">
            {summary.sectorBreakdown.map((sec, idx) => (
              <div key={sec.sector} className="inline-flex items-center space-x-1.5 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }}
                />
                <span>{sec.sector}:</span>
                <span className="font-mono font-semibold tnum">
                  {formatPersen(sec.sharePct, 1)}
                </span>
                <span className="text-slate-500 font-mono tnum">
                  ({formatRupiah(sec.allocatedRp)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
