"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  formatNumber,
  formatPersen,
  formatRupiah,
  parseFormattedNumber,
} from "@/lib/format";
import { IDX_LOT_SIZE } from "@/lib/portfolio-allocator";
import { filterNewsByTicker } from "@/lib/news-brief";
import { computePositionTargetSimulation } from "@/lib/stock-health";
import {
  evaluateTargetBuyStatus,
  MAX_WATCHLIST_NOTE_LENGTH,
  type WatchlistEntryMeta,
  type WatchlistTargetSummary,
} from "@/lib/watchlist";
import type { LiveMarketNewsItem } from "@/types/market";
import {
  Calculator,
  ExternalLink,
  Newspaper,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import {
  EASE_TERMINAL,
  SPRING_SNAP,
  TerminalSpotlightCard,
} from "./terminalMotion";

interface QuickResearchRailProps {
  ticker: string;
  companyName: string;
  currentPrice: number;
  dividendYield: number;
  fairValuePrice?: number;
  targetBuyPrice?: number;
  note?: string;
  isInWatchlist: boolean;
  isWatchlistFull: boolean;
  watchlistBuySummary?: WatchlistTargetSummary;
  liveNewsItems?: LiveMarketNewsItem[];
  onToggleWatchlist?: (ticker: string) => void;
  onSaveWatchlistMeta?: (ticker: string, meta: WatchlistEntryMeta | null) => void;
  onSelectTicker?: (ticker: string) => void;
  onAskAiStock?: (ticker: string) => void;
  onClose?: () => void;
}

const QUICK_BUDGET_PRESETS = [
  { label: "2 Jt", value: 2_000_000 },
  { label: "5 Jt", value: 5_000_000 },
  { label: "10 Jt", value: 10_000_000 },
  { label: "25 Jt", value: 25_000_000 },
];

const SLIDER_MIN_RP = 1_000_000;
const SLIDER_MAX_RP = 100_000_000;
const SLIDER_STEP_RP = 500_000;

export const QuickResearchRail: React.FC<QuickResearchRailProps> = ({
  ticker,
  companyName,
  currentPrice,
  dividendYield,
  fairValuePrice,
  targetBuyPrice,
  note,
  isInWatchlist,
  isWatchlistFull,
  watchlistBuySummary,
  liveNewsItems = [],
  onToggleWatchlist,
  onSaveWatchlistMeta,
  onSelectTicker,
  onAskAiStock,
  onClose,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [topTab, setTopTab] = useState<"lot" | "target">("lot");
  const [bottomTab, setBottomTab] = useState<"signals" | "news">("signals");
  const [budgetStr, setBudgetStr] = useState<string>("5.000.000");

  // Key drafts by ticker so switching stocks resets cleanly without effect-driven setState
  const [targetDraft, setTargetDraft] = useState<{
    ticker: string;
    priceStr: string;
    noteStr: string;
  }>({
    ticker,
    priceStr: targetBuyPrice ? formatNumber(targetBuyPrice) : "",
    noteStr: note || "",
  });

  const activePriceStr =
    targetDraft.ticker === ticker
      ? targetDraft.priceStr
      : targetBuyPrice
      ? formatNumber(targetBuyPrice)
      : "";
  const activeNoteStr =
    targetDraft.ticker === ticker ? targetDraft.noteStr : note || "";

  const budgetRp = useMemo(() => Math.max(0, parseFormattedNumber(budgetStr)), [budgetStr]);
  const sliderValue = Math.max(SLIDER_MIN_RP, Math.min(SLIDER_MAX_RP, budgetRp));
  const costPerLot = currentPrice > 0 ? currentPrice * IDX_LOT_SIZE : 0;
  const lots = costPerLot > 0 ? Math.floor(budgetRp / costPerLot) : 0;
  const allocatedRp = lots * costPerLot;
  const remainingCash = Math.max(0, budgetRp - allocatedRp);
  const estAnnualDiv = dividendYield > 0 ? allocatedRp * (dividendYield / 100) : 0;

  // Simulasi cepat potensi nilai posisi terhadap Harga Wajar P/E Mean atau Target Beli
  const simReferencePrice =
    fairValuePrice && fairValuePrice > 0
      ? fairValuePrice
      : targetBuyPrice && targetBuyPrice > 0
      ? targetBuyPrice
      : undefined;
  const simReferenceLabel =
    fairValuePrice && fairValuePrice > 0 ? "Harga Wajar P/E Mean" : "Target Beli";

  const targetSimulation = useMemo(
    () => computePositionTargetSimulation(currentPrice, simReferencePrice, lots, IDX_LOT_SIZE),
    [currentPrice, simReferencePrice, lots]
  );

  const targetEval = evaluateTargetBuyStatus(currentPrice, targetBuyPrice);

  const actionableSignals = useMemo(() => {
    if (!watchlistBuySummary) return [];
    return [...watchlistBuySummary.hitItems, ...watchlistBuySummary.nearItems].slice(0, 6);
  }, [watchlistBuySummary]);

  const relatedNews = useMemo(() => {
    const matched = filterNewsByTicker(liveNewsItems, ticker, companyName);
    return (matched.length > 0 ? matched : liveNewsItems).slice(0, 5);
  }, [liveNewsItems, ticker, companyName]);

  const handleBudgetChange = (raw: string) => {
    const num = parseFormattedNumber(raw);
    setBudgetStr(num > 0 ? formatNumber(num) : raw.trim() === "" ? "" : "0");
  };

  const handleTargetPriceInput = (raw: string) => {
    const num = parseFormattedNumber(raw);
    setTargetDraft({
      ticker,
      priceStr: num > 0 ? formatNumber(num) : raw.trim() === "" ? "" : "0",
      noteStr: activeNoteStr,
    });
  };

  const handleSaveTarget = () => {
    if (!onSaveWatchlistMeta) return;
    const parsedPrice = parseFormattedNumber(activePriceStr);
    const cleanedNote = activeNoteStr.trim();
    if (parsedPrice <= 0 && cleanedNote.length === 0) {
      onSaveWatchlistMeta(ticker, null);
    } else {
      onSaveWatchlistMeta(ticker, {
        ...(parsedPrice > 0 ? { targetBuyPrice: parsedPrice } : {}),
        ...(cleanedNote.length > 0 ? { note: cleanedNote } : {}),
      });
    }
  };

  return (
    <div className="space-y-1.5 font-sans text-xs">
      {/* Kartu Atas: Rax Trade Action Panel (Kalkulator Lot + Interactive Slider + Target Beli) */}
      <TerminalSpotlightCard className="rounded-lg overflow-hidden">
        <div className="relative z-10">
          <div className="px-3 py-2 border-b border-white/[0.07] bg-[#0B0E15] flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
              <Calculator className="w-3.5 h-3.5 text-[#2DD4BF]" aria-hidden="true" />
              <span className="text-[11px] uppercase tracking-wider font-mono text-slate-300">
                Aksi &amp; Lot
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Sembunyikan panel kanan"
                title="Sembunyikan panel kanan (])"
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Switcher Hitung Lot vs Target Beli dengan layoutId */}
          <div className="p-1.5 border-b border-white/[0.07] bg-[#0B0E15]">
            <div className="grid grid-cols-2 gap-1 bg-[#080A0F] p-0.5 rounded-md border border-white/[0.06]">
              {[
                { id: "lot" as const, label: `Hitung Lot (${ticker})` },
                { id: "target" as const, label: "Target Beli" },
              ].map((tab) => {
                const isActive = topTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTopTab(tab.id)}
                    className={`relative z-10 py-1.5 rounded text-center text-[11px] font-medium transition-colors ${
                      isActive ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="quick-rail-top-tab"
                        transition={SPRING_SNAP}
                        aria-hidden="true"
                        className={`absolute inset-0 rounded -z-10 ${
                          tab.id === "lot"
                            ? "bg-[#1E7B85] border border-[#2DD4BF]/35"
                            : "bg-[#161C29] border border-[#2DD4BF]/40"
                        }`}
                      />
                    )}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 space-y-3">
            <AnimatePresence mode="wait">
              {topTab === "lot" ? (
                <motion.div
                  key="quick-rail-lot"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: EASE_TERMINAL }}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="quick-rail-budget" className="text-[11px] text-slate-400">
                        Anggaran Dana (Rp)
                      </label>
                      <span className="font-mono text-[10px] text-[#2DD4BF] tnum">
                        {costPerLot > 0 ? `${formatRupiah(costPerLot)} / lot` : "-"}
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                        Rp
                      </span>
                      <input
                        id="quick-rail-budget"
                        name="quickRailBudget"
                        type="text"
                        value={budgetStr}
                        onChange={(e) => handleBudgetChange(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 bg-[#080A0F] border border-white/[0.08] rounded-md text-slate-100 font-mono tnum focus:outline-none focus:border-[#2DD4BF]"
                      />
                    </div>

                    {/* Interactive Budget Slider */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        aria-label="Geser anggaran dana investasi"
                        min={SLIDER_MIN_RP}
                        max={SLIDER_MAX_RP}
                        step={SLIDER_STEP_RP}
                        value={sliderValue}
                        onChange={(e) =>
                          setBudgetStr(formatNumber(parseInt(e.target.value, 10) || SLIDER_MIN_RP))
                        }
                        className="w-full h-1.5 rounded-full appearance-none bg-[#161C29] accent-[#2DD4BF] cursor-pointer"
                      />
                      <div className="flex justify-between text-[9.5px] font-mono text-slate-500 tnum">
                        <span>1 Jt</span>
                        <span>25 Jt</span>
                        <span>50 Jt</span>
                        <span>100 Jt</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {QUICK_BUDGET_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setBudgetStr(formatNumber(p.value))}
                          className={`py-1 rounded text-[10.5px] font-mono border transition ${
                            budgetRp === p.value
                              ? "bg-[#1E7B85] border-[#2DD4BF]/50 text-white font-semibold"
                              : "bg-[#080A0F] border-white/[0.07] text-slate-300 hover:text-white hover:border-white/[0.15]"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compact 4-KPI Summary Grid ala Rax Trade Footer */}
                  <div className="grid grid-cols-2 gap-1.5 font-mono tnum">
                    <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06]">
                      <span className="block text-[9.5px] text-slate-500 font-sans">Dapat Dibeli</span>
                      <span className="text-sm font-bold text-[#2DD4BF] block mt-0.5">
                        {lots} lot
                      </span>
                      <span className="text-[9.5px] text-slate-500">
                        {formatNumber(lots * IDX_LOT_SIZE)} lbr
                      </span>
                    </div>

                    <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06]">
                      <span className="block text-[9.5px] text-slate-500 font-sans">Total Alokasi</span>
                      <span className="text-xs font-semibold text-slate-100 block mt-0.5 truncate">
                        {formatRupiah(allocatedRp)}
                      </span>
                      <span className="text-[9.5px] text-slate-500 truncate block">
                        Sisa {formatRupiah(remainingCash)}
                      </span>
                    </div>

                    <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06]">
                      <span className="block text-[9.5px] text-slate-500 font-sans">Est. Dividen/Th</span>
                      <span className="text-xs font-semibold text-[#22C55E] block mt-0.5 truncate">
                        {estAnnualDiv > 0 ? formatRupiah(estAnnualDiv) : "-"}
                      </span>
                    </div>

                    <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06]">
                      <span className="block text-[9.5px] text-slate-500 font-sans">Div. Yield</span>
                      <span className="text-xs font-semibold text-slate-200 block mt-0.5">
                        {dividendYield > 0 ? formatPersen(dividendYield, 1) : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Simulasi Potensi ke Harga Wajar / Target Beli */}
                  {targetSimulation && simReferencePrice && (
                    <div className="px-2.5 py-2 rounded-md bg-[#0B0E15] border border-white/[0.07] space-y-1 font-mono tnum">
                      <div className="flex items-center justify-between text-[10px] font-sans text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-[#2DD4BF]" aria-hidden="true" />
                          <span>Proyeksi {simReferenceLabel}</span>
                        </span>
                        <span className="font-mono text-slate-300">
                          {formatRupiah(simReferencePrice)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        <span className="text-slate-100 font-semibold whitespace-nowrap">
                          {formatRupiah(targetSimulation.projectedValueRp)}
                        </span>
                        <span
                          className={`text-[10.5px] font-semibold whitespace-nowrap ${
                            targetSimulation.returnPct >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {formatPersen(targetSimulation.returnPct, 1, true)} (
                          {targetSimulation.profitLossRp >= 0 ? "+" : "-"}
                          {formatRupiah(Math.abs(targetSimulation.profitLossRp))})
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-0.5">
                    {onAskAiStock && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onAskAiStock(ticker)}
                        className="w-full py-2 px-3 rounded-full bg-[#1E7B85] hover:bg-[#196770] text-white font-semibold transition flex items-center justify-center space-x-1.5 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#5EEAD4]" aria-hidden="true" />
                        <span>Bedah {ticker} dengan AI</span>
                      </motion.button>
                    )}
                    {onToggleWatchlist && (
                      <button
                        type="button"
                        disabled={!isInWatchlist && isWatchlistFull}
                        onClick={() => onToggleWatchlist(ticker)}
                        className={`w-full py-1.5 px-3 rounded-full border text-[11px] font-medium transition flex items-center justify-center space-x-1.5 disabled:opacity-45 ${
                          isInWatchlist
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                            : "bg-[#161C29] border-white/[0.08] text-slate-200 hover:text-white hover:border-[#2DD4BF]/40"
                        }`}
                      >
                        <Star
                          className={`w-3 h-3 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`}
                          aria-hidden="true"
                        />
                        <span>
                          {isInWatchlist ? "Tersimpan di Watchlist" : "+ Simpan ke Watchlist"}
                        </span>
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="quick-rail-target"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: EASE_TERMINAL }}
                  className="space-y-2.5"
                >
                  {targetBuyPrice && currentPrice > 0 && (
                    <div
                      className={`px-2.5 py-1.5 rounded-md border text-[11px] flex items-center justify-between ${
                        targetEval.status === "hit"
                          ? "bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]"
                          : targetEval.status === "near"
                          ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                          : "bg-[#0B0E15] border-white/[0.07] text-slate-300"
                      }`}
                    >
                      <span className="inline-flex items-center space-x-1">
                        <Target className="w-3 h-3" aria-hidden="true" />
                        <span>
                          {targetEval.status === "hit"
                            ? "Area Beli"
                            : targetEval.status === "near"
                            ? "Mendekati Target"
                            : "Di atas Target"}
                        </span>
                      </span>
                      <span className="font-mono tnum font-semibold">
                        {formatPersen(targetEval.diffPercent, 1, true)}
                      </span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="quick-rail-target"
                      className="text-[11px] text-slate-400 block mb-1"
                    >
                      Target Harga Beli (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                        Rp
                      </span>
                      <input
                        id="quick-rail-target"
                        name="quickRailTarget"
                        type="text"
                        value={activePriceStr}
                        onChange={(e) => handleTargetPriceInput(e.target.value)}
                        placeholder="cth. 8.500"
                        className="w-full pl-8 pr-2.5 py-1.5 bg-[#080A0F] border border-white/[0.08] rounded-md text-slate-100 font-mono tnum focus:outline-none focus:border-[#2DD4BF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="quick-rail-note"
                      className="text-[11px] text-slate-400 block mb-1"
                    >
                      Catatan Riset
                    </label>
                    <input
                      id="quick-rail-note"
                      name="quickRailNote"
                      type="text"
                      maxLength={MAX_WATCHLIST_NOTE_LENGTH}
                      value={activeNoteStr}
                      onChange={(e) =>
                        setTargetDraft({
                          ticker,
                          priceStr: activePriceStr,
                          noteStr: e.target.value,
                        })
                      }
                      placeholder="Tesis akumulasi..."
                      className="w-full px-2.5 py-1.5 bg-[#080A0F] border border-white/[0.08] rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2DD4BF]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleSaveTarget}
                      className="flex-1 py-1.5 px-3 rounded-full bg-[#1E7B85] hover:bg-[#196770] text-white font-semibold transition"
                    >
                      Simpan Target
                    </button>
                    {(targetBuyPrice || note) && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveWatchlistMeta?.(ticker, null);
                          setTargetDraft({ ticker, priceStr: "", noteStr: "" });
                        }}
                        className="py-1.5 px-2.5 rounded-full bg-[#161C29] hover:bg-red-950/50 text-slate-300 hover:text-red-300 border border-white/[0.08] transition"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </TerminalSpotlightCard>

      {/* Kartu Bawah: Sinyal Watchlist & Berita Terkait */}
      <TerminalSpotlightCard className="rounded-lg overflow-hidden">
        <div className="relative z-10">
          <div className="grid grid-cols-2 border-b border-white/[0.07] bg-[#0B0E15]">
            {[
              {
                id: "signals" as const,
                label: `Sinyal (${actionableSignals.length})`,
                icon: <Target className="w-3 h-3 text-[#22C55E]" aria-hidden="true" />,
              },
              {
                id: "news" as const,
                label: `Berita (${relatedNews.length})`,
                icon: <Newspaper className="w-3 h-3 text-[#2DD4BF]" aria-hidden="true" />,
              },
            ].map((tab) => {
              const isActive = bottomTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBottomTab(tab.id)}
                  className={`relative py-2 px-2 text-[11px] font-medium flex items-center justify-center space-x-1 transition ${
                    isActive ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="quick-rail-bottom-tab"
                      transition={SPRING_SNAP}
                      aria-hidden="true"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2DD4BF]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-white/[0.05] max-h-[280px] overflow-y-auto terminal-scroll">
            {bottomTab === "signals" ? (
              actionableSignals.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-slate-400 leading-relaxed">
                  Belum ada saham Watchlist yang masuk{" "}
                  <span className="text-slate-200">Area Beli</span> atau dalam +5% target.
                </div>
              ) : (
                actionableSignals.map((sig) => (
                  <button
                    key={sig.ticker}
                    type="button"
                    onClick={() => onSelectTicker?.(sig.ticker)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#161C29] text-left transition"
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-slate-100">{sig.ticker}</span>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                            sig.status === "hit"
                              ? "bg-[#22C55E]/20 text-[#22C55E]"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {sig.status === "hit" ? "Area Beli" : "Dekat"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono tnum block">
                        Target {formatRupiah(sig.targetBuyPrice)}
                      </span>
                    </div>
                    <div className="text-right font-mono tnum">
                      <span className="text-slate-100 font-semibold block">
                        {formatRupiah(sig.price)}
                      </span>
                      <span
                        className={`text-[10px] ${
                          sig.status === "hit" ? "text-[#22C55E]" : "text-amber-300"
                        }`}
                      >
                        {formatPersen(sig.diffPercent, 1, true)}
                      </span>
                    </div>
                  </button>
                ))
              )
            ) : relatedNews.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400">
                Belum ada berita RSS terbaru saat ini.
              </div>
            ) : (
              relatedNews.map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2.5 hover:bg-[#161C29] transition space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="text-[#2DD4BF] font-medium truncate">{item.publisher}</span>
                    <span className="shrink-0 ml-2 font-mono">{item.publishedWib}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 line-clamp-2 leading-snug font-medium">
                    {item.title}
                  </p>
                  <span className="inline-flex items-center space-x-1 text-[10px] text-slate-500">
                    <span>Buka sumber</span>
                    <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </TerminalSpotlightCard>
    </div>
  );
};
