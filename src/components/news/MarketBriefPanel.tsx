"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Quote, Sparkles } from "lucide-react";
import type { LiveMarketNewsItem, LiveNewsCategory, MarketTickerItem } from "@/types/market";
import type { LiveMarketBrief } from "@/lib/news-brief";
import { formatNewsCategoryLabel, formatNewsTimestamp } from "@/lib/format";
import {
  CountUpNumber,
  EASE_PREMIUM,
  MagneticButton,
  SPRING_INDICATOR,
  SpotlightSurface,
} from "./newsMotion";

type BriefLensId = "ALL" | Extract<LiveNewsCategory, "CORPORATE" | "MONETARY_CURRENCY" | "COMMODITIES">;

const BRIEF_LENSES: readonly { id: BriefLensId; label: string }[] = [
  { id: "ALL", label: "Semua" },
  { id: "CORPORATE", label: "Korporasi" },
  { id: "MONETARY_CURRENCY", label: "Moneter" },
  { id: "COMMODITIES", label: "Komoditas" },
];

interface MarketBriefPanelProps {
  activeBrief: LiveMarketBrief;
  liveNewsItems: LiveMarketNewsItem[];
  macroTickers: MarketTickerItem[];
  todayNewsCount: number;
  todayWibKey?: string;
  selectedTickerFilter: string | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleBriefTicker: (ticker: string) => void;
  onRequestAiBrief?: (items: LiveMarketNewsItem[], macroTickers: MarketTickerItem[]) => void;
  isAiBriefLoading?: boolean;
  aiBriefNotice?: string | null;
  onOpenStoryPreview: (story: LiveMarketNewsItem) => void;
  onSelectStockFromNews?: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
}

export const MarketBriefPanel: React.FC<MarketBriefPanelProps> = ({
  activeBrief,
  liveNewsItems,
  macroTickers,
  todayNewsCount,
  todayWibKey,
  selectedTickerFilter,
  isExpanded,
  onToggleExpanded,
  onToggleBriefTicker,
  onRequestAiBrief,
  isAiBriefLoading = false,
  aiBriefNotice = null,
  onOpenStoryPreview,
  onSelectStockFromNews,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeLens, setActiveLens] = useState<BriefLensId>("ALL");
  const [activeSignalIdx, setActiveSignalIdx] = useState<number>(0);

  const totalSentiment =
    activeBrief.sentimentCounts.bullish +
    activeBrief.sentimentCounts.bearish +
    activeBrief.sentimentCounts.neutral;
  const posPct =
    totalSentiment > 0 ? Math.round((activeBrief.sentimentCounts.bullish / totalSentiment) * 100) : 0;
  const negPct =
    totalSentiment > 0 ? Math.round((activeBrief.sentimentCounts.bearish / totalSentiment) * 100) : 0;
  const neuPct = Math.max(0, 100 - posPct - negPct);

  const lensCounts = useMemo(() => {
    const counts: Record<BriefLensId, number> = {
      ALL: liveNewsItems.length,
      CORPORATE: 0,
      MONETARY_CURRENCY: 0,
      COMMODITIES: 0,
    };
    for (const item of liveNewsItems) {
      if (item.category === "CORPORATE") counts.CORPORATE += 1;
      else if (item.category === "MONETARY_CURRENCY") counts.MONETARY_CURRENCY += 1;
      else if (item.category === "COMMODITIES") counts.COMMODITIES += 1;
    }
    return counts;
  }, [liveNewsItems]);

  const effectiveLens: BriefLensId =
    activeLens === "ALL" || lensCounts[activeLens] > 0 ? activeLens : "ALL";

  const lensSignals = useMemo(() => {
    const pool =
      effectiveLens === "ALL"
        ? liveNewsItems
        : liveNewsItems.filter((item) => item.category === effectiveLens);
    return pool.slice(0, 3);
  }, [liveNewsItems, effectiveLens]);

  const safeSignalIdx =
    lensSignals.length > 0 ? Math.min(activeSignalIdx, lensSignals.length - 1) : 0;
  const activeSignal = lensSignals[safeSignalIdx] ?? null;

  const handleSelectLens = (lens: BriefLensId) => {
    setActiveLens(lens);
    setActiveSignalIdx(0);
  };

  return (
    <SpotlightSurface className="bg-[#F4F3EE]/90 backdrop-blur-[2px] border border-[#E5E5DC] border-l-[3px] border-l-[#1E7B85] text-xs overflow-hidden">
      <section aria-label="Ringkasan pasar hari ini" className="relative z-10">
        {/* Header Bar */}
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <span
              className="w-5 h-5 rounded-full bg-[#1E7B85] text-white inline-flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Quote className="w-2.5 h-2.5" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#848B99] hidden sm:inline">
              00 /
            </span>
            <h2 className="font-serif font-bold text-sm sm:text-[15px] text-[#1D1F23]">
              Ringkasan pasar hari ini
            </h2>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                activeBrief.source === "gemini"
                  ? "bg-[#1E7B85]/12 text-[#1E7B85] border-[#1E7B85]/30"
                  : "bg-[#FBFBFA] text-[#676E7E] border-[#D5D7DC]"
              }`}
            >
              {activeBrief.source === "gemini"
                ? `AI (${activeBrief.model || "flash"})`
                : "Sintesis otomatis"}
            </span>

            {/* Count-up Metrik Sentimen */}
            <div className="flex items-center gap-2 text-[11px] font-mono tnum text-[#676E7E]">
              <span className="text-[#0D6343] font-semibold">
                <CountUpNumber value={activeBrief.sentimentCounts.bullish} /> positif
              </span>
              <span className="text-[#C5C7CE]">&bull;</span>
              <span className="text-[#B91C1C] font-semibold">
                <CountUpNumber value={activeBrief.sentimentCounts.bearish} /> negatif
              </span>
              <span className="text-[#C5C7CE]">&bull;</span>
              <span>
                <CountUpNumber value={activeBrief.sentimentCounts.neutral} /> netral
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isExpanded && activeBrief.topTickers.length > 0 && (
              <div className="hidden md:flex items-center gap-1 font-mono tnum">
                <span className="text-[11px] text-[#676E7E] font-sans mr-0.5">Disorot:</span>
                {activeBrief.topTickers.slice(0, 4).map((t) => {
                  const isActive = selectedTickerFilter === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onToggleBriefTicker(t)}
                      aria-pressed={isActive}
                      className={`px-1.5 py-0.5 border text-[11px] font-semibold transition ${
                        isActive
                          ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                          : "bg-[#FBFBFA] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border-[#D5D7DC]"
                      }`}
                      title={isActive ? `Hapus filter berita ${t}` : `Saring berita terkait ${t}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}

            {onRequestAiBrief && activeBrief.source !== "gemini" && (
              <MagneticButton
                onClick={() => {
                  if (!isExpanded) onToggleExpanded();
                  onRequestAiBrief(liveNewsItems, macroTickers);
                }}
                disabled={isAiBriefLoading}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-[#FBFBFA] hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border border-[#D5D7DC] hover:border-[#1E7B85] font-semibold text-[11px] transition disabled:opacity-60"
              >
                <Sparkles
                  className={`w-3 h-3 ${isAiBriefLoading ? "animate-pulse" : ""}`}
                  aria-hidden="true"
                />
                <span>{isAiBriefLoading ? "Meringkas..." : "Ringkas AI"}</span>
              </MagneticButton>
            )}

            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={isExpanded}
              className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-[#1D1F23] hover:text-[#1E7B85] transition"
            >
              <span>{isExpanded ? "Tutup ringkasan" : "Lihat ringkasan"}</span>
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.24, ease: EASE_PREMIUM }}
                className="inline-flex"
                aria-hidden="true"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </motion.span>
            </button>
          </div>
        </div>

        {/* Expandable Dual-Axis Split-Stage Briefing (Default Terbuka) */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="market-brief-body"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.34, ease: EASE_PREMIUM }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-3 border-t border-[#D5D7DC] grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Kiri (6 kolom): Kutipan Sintesis + Distribusi Sentimen + Emiten Disorot */}
                <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5">
                    <p className="text-sm sm:text-[15px] italic text-[#1D1F23] leading-[1.7] font-serif">
                      &ldquo;{activeBrief.summary}&rdquo;
                    </p>

                    {/* Bar Rasio Sentimen Visual */}
                    {totalSentiment > 0 && (
                      <div className="space-y-1">
                        <div
                          className="h-1.5 w-full bg-[#E5E5DC] flex overflow-hidden"
                          aria-hidden="true"
                        >
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.5, ease: EASE_PREMIUM }}
                            style={{ width: `${posPct}%` }}
                            className="h-full bg-[#2EB886] origin-left"
                          />
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.5, delay: 0.08, ease: EASE_PREMIUM }}
                            style={{ width: `${neuPct}%` }}
                            className="h-full bg-[#B9BDC7] origin-left"
                          />
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.5, delay: 0.14, ease: EASE_PREMIUM }}
                            style={{ width: `${negPct}%` }}
                            className="h-full bg-[#B91C1C] origin-left"
                          />
                        </div>
                        <div className="flex items-center justify-between font-mono text-[10px] text-[#676E7E] tnum">
                          <span>Positif {posPct}%</span>
                          <span>
                            Dominan:{" "}
                            <strong className="text-[#1D1F23]">{activeBrief.dominantCategory}</strong>
                          </span>
                          <span>Negatif {negPct}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Emiten Disorot (klik untuk saring) */}
                  <div className="space-y-2 pt-2 border-t border-[#E5E5DC]">
                    {activeBrief.topTickers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#676E7E]">
                        <span>Banyak disorot (klik untuk saring):</span>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono tnum">
                          {activeBrief.topTickers.map((t) => {
                            const isActive = selectedTickerFilter === t;
                            return (
                              <motion.button
                                key={t}
                                type="button"
                                onClick={() => onToggleBriefTicker(t)}
                                aria-pressed={isActive}
                                whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                                whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                                className={`px-2 py-0.5 border font-semibold transition ${
                                  isActive
                                    ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                                    : "bg-[#FBFBFA] hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border-[#D5D7DC] hover:border-[#1E7B85]"
                                }`}
                                title={
                                  isActive ? `Hapus filter berita ${t}` : `Saring berita terkait ${t}`
                                }
                              >
                                {t}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {aiBriefNotice && (
                      <p className="text-[11px] text-[#848B99]">{aiBriefNotice}</p>
                    )}
                  </div>
                </div>

                {/* Kanan (6 kolom): Interactive Dual-Axis Lens Switcher + Vertical Connected Stepper (ala Northstar Capital NewMinds) */}
                {lensSignals.length > 0 && (
                  <div className="lg:col-span-6 bg-[#FBFBFA] border border-[#E5E5DC] flex flex-col justify-between">
                    {/* Bar Lensa Topik + Step Fraction 01 / 03 */}
                    <div className="px-3 py-2 border-b border-[#E5E5DC] bg-[#F4F3EE]/60 flex flex-wrap items-center justify-between gap-2">
                      <div
                        role="tablist"
                        aria-label="Lensa sinyal pasar"
                        className="flex flex-wrap items-center gap-1"
                      >
                        {BRIEF_LENSES.filter((l) => l.id === "ALL" || lensCounts[l.id] > 0).map(
                          (lens) => {
                            const isActive = effectiveLens === lens.id;
                            return (
                              <button
                                key={lens.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => handleSelectLens(lens.id)}
                                className={`relative px-2 py-1 text-[10px] font-mono uppercase tracking-wider font-semibold transition-colors z-10 ${
                                  isActive
                                    ? "text-white"
                                    : "text-[#676E7E] hover:text-[#1D1F23]"
                                }`}
                              >
                                {isActive && (
                                  <motion.span
                                    layoutId="brief-lens-pill"
                                    transition={SPRING_INDICATOR}
                                    aria-hidden="true"
                                    className="absolute inset-0 bg-[#1E7B85] -z-10"
                                  />
                                )}
                                <span>{lens.label}</span>
                              </button>
                            );
                          }
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[10px] tnum text-[#676E7E]">
                        <span className="hidden sm:inline text-[#848B99]">
                          {todayNewsCount} hari ini
                        </span>
                        <span className="font-bold text-[#1D1F23]">
                          {String(safeSignalIdx + 1).padStart(2, "0")} /{" "}
                          {String(lensSignals.length).padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    {/* Vertical Connected Stepper 01 -> 02 -> 03 */}
                    <div className="relative px-3 py-2">
                      {/* Garis vertikal penghubung antar node stepper */}
                      {lensSignals.length > 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[22px] top-6 bottom-6 w-px bg-[#D5D7DC]"
                        />
                      )}

                      <div className="space-y-1">
                        {lensSignals.map((sig, idx) => {
                          const isCurrent = idx === safeSignalIdx;
                          return (
                            <div
                              key={sig.id}
                              className={`relative flex items-start gap-2.5 px-1.5 py-1.5 transition-colors ${
                                isCurrent ? "bg-[#F4F3EE]" : "hover:bg-[#F4F3EE]/60"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCurrent) {
                                    onOpenStoryPreview(sig);
                                  } else {
                                    setActiveSignalIdx(idx);
                                  }
                                }}
                                aria-current={isCurrent ? "step" : undefined}
                                className="flex items-start gap-2.5 flex-1 min-w-0 text-left group"
                              >
                                <span
                                  className={`relative z-10 w-[20px] h-[20px] rounded-full border font-mono text-[9.5px] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 transition-colors tnum ${
                                    isCurrent
                                      ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                                      : "bg-[#FBFBFA] text-[#676E7E] border-[#C5C7CE] group-hover:border-[#1E7B85] group-hover:text-[#1E7B85]"
                                  }`}
                                >
                                  0{idx + 1}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-[12px] leading-snug line-clamp-1 transition-colors ${
                                      isCurrent
                                        ? "font-semibold text-[#1D1F23]"
                                        : "font-medium text-[#4E5563] group-hover:text-[#1D1F23]"
                                    }`}
                                  >
                                    {sig.title}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#848B99] tnum">
                                    <span className="truncate">{sig.publisher}</span>
                                    <span>&bull;</span>
                                    <span className="shrink-0">
                                      {formatNewsTimestamp(
                                        sig.publishedAt,
                                        sig.publishedWib,
                                        todayWibKey,
                                        true
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenStoryPreview(sig)}
                                aria-label={`Buka pratinjau: ${sig.title}`}
                                title="Buka pratinjau cepat"
                                className={`p-1 shrink-0 transition ${
                                  isCurrent
                                    ? "text-[#1E7B85] hover:translate-x-0.5 hover:-translate-y-0.5"
                                    : "text-[#848B99]/70 hover:text-[#1E7B85]"
                                }`}
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Panel Sorotan Dinamis di Bawah Stepper (aria-live) */}
                    {activeSignal && (
                      <div
                        aria-live="polite"
                        className="px-3.5 py-2.5 border-t border-[#E5E5DC] bg-[#F4F3EE]/45"
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={`${effectiveLens}-${activeSignal.id}`}
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                            transition={{ duration: 0.2, ease: EASE_PREMIUM }}
                            className="space-y-2"
                          >
                            <p className="text-[11.5px] text-[#4E5563] leading-relaxed line-clamp-2">
                              {activeSignal.summary ||
                                `Sorotan ${formatNewsCategoryLabel(activeSignal.category).toLowerCase()} dari ${activeSignal.publisher}. Klik pratinjau penuh untuk membaca konteks dan sinyal emiten.`}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] tnum">
                                <span
                                  className={`px-1.5 py-0.5 border font-semibold ${
                                    activeSignal.sentiment === "BULLISH"
                                      ? "text-[#0D6343] border-[#2EB886]/40 bg-[#2EB886]/10"
                                      : activeSignal.sentiment === "BEARISH"
                                      ? "text-[#B91C1C] border-[#B91C1C]/35 bg-[#B91C1C]/8"
                                      : "text-[#676E7E] border-[#D5D7DC] bg-[#FBFBFA]"
                                  }`}
                                >
                                  {activeSignal.sentiment === "BULLISH"
                                    ? "Positif"
                                    : activeSignal.sentiment === "BEARISH"
                                    ? "Negatif"
                                    : "Netral"}
                                </span>
                                {activeSignal.tickers.slice(0, 3).map((ticker) => (
                                  <button
                                    key={ticker}
                                    type="button"
                                    onClick={() =>
                                      onSelectStockFromNews
                                        ? onSelectStockFromNews(
                                            ticker,
                                            "",
                                            activeSignal.title,
                                            activeSignal
                                          )
                                        : onToggleBriefTicker(ticker)
                                    }
                                    className="px-1.5 py-0.5 border border-[#D5D7DC] bg-[#FBFBFA] hover:bg-[#1E7B85] hover:text-white hover:border-[#1E7B85] text-[#1D1F23] font-semibold transition"
                                    title={`Buka ${ticker} di Terminal`}
                                  >
                                    {ticker}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => onOpenStoryPreview(activeSignal)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E7B85] hover:underline"
                              >
                                <span>Pratinjau penuh</span>
                                <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </SpotlightSurface>
  );
};
