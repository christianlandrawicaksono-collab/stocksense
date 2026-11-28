"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  Clock,
  Flame,
  Globe,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { formatPersen } from "@/lib/format";
import {
  GlobalMarketHubSnapshot,
  GlobalMarketId,
  GlobalMarketRegion,
  formatGlobalCurrency,
  formatGlobalIndexValue,
  summarizeGlobalSentiment,
} from "@/lib/global-markets";
import type { MarketProvider, MarketQuote } from "@/lib/market-data";
import type { WatchlistEntryMeta } from "@/lib/watchlist";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";
import { MarketOverviewPane } from "./MarketOverviewPane";
import { EASE_TERMINAL, SPRING_SNAP, TerminalSpotlightCard } from "./terminalMotion";

const WorldGlobe3D = dynamic(
  () => import("./WorldGlobe3D").then((m) => m.WorldGlobe3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[340px] sm:min-h-[410px] rounded-lg bg-[#080B12] border border-white/[0.06] flex flex-col items-center justify-center gap-2 text-xs text-slate-400 font-sans">
        <Globe className="w-6 h-6 text-[#2DD4BF] animate-spin" style={{ animationDuration: "5s" }} />
        <span>Menyiapkan 3D World Globe...</span>
      </div>
    ),
  }
);

interface UnifiedGlobalCommandDeckProps {
  hubs: GlobalMarketHubSnapshot[];
  isGlobalFallback: boolean;
  isGlobalLoading: boolean;
  onRefreshGlobal: () => void;
  provider: MarketProvider;
  quotes: Record<string, MarketQuote>;
  macroTickers: MarketTickerItem[];
  customWatchlist: string[];
  watchlistNotes: Record<string, WatchlistEntryMeta>;
  liveNewsItems: LiveMarketNewsItem[];
  onSelectBeiStock: (ticker: string) => void;
  onAskAiGlobalHub: (hub: GlobalMarketHubSnapshot) => void;
  onJumpToResearch: () => void;
  onSwitchToNews?: () => void;
  defaultRightTab?: "country" | "bei";
}

type RegionFilter = "ALL" | GlobalMarketRegion;

const REGION_OPTIONS: { id: RegionFilter; label: string }[] = [
  { id: "ALL", label: "Semua" },
  { id: "Asia-Pasifik", label: "Asia-Pasifik" },
  { id: "Amerika", label: "Amerika" },
  { id: "Eropa", label: "Eropa" },
];

/**
 * Unified Global & Market Command Deck (Top Half of Single-Page Terminal):
 * - Kiri: 3D Interactive World Globe (Three.js, lazy-loaded) + Quick-Jump 10 negara
 * - Kanan: Inspector Negara Terpilih (Indeks + 4 Saham Blue Chip + AI) & Ikhtisar BEI Compact
 * - Dilengkapi Scroll-Linked Parallax Mapping (useScroll + useTransform + scroll-coupled 3D pitch)
 */
export const UnifiedGlobalCommandDeck: React.FC<UnifiedGlobalCommandDeckProps> = ({
  hubs,
  isGlobalFallback,
  isGlobalLoading,
  onRefreshGlobal,
  provider,
  quotes,
  macroTickers,
  customWatchlist,
  watchlistNotes,
  liveNewsItems,
  onSelectBeiStock,
  onAskAiGlobalHub,
  onJumpToResearch,
  onSwitchToNews,
  defaultRightTab = "country",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const deckOuterRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<number>(0);

  const [selectedHubId, setSelectedHubId] = useState<GlobalMarketId>("ID");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("ALL");
  const [rightTab, setRightTab] = useState<"country" | "bei">(defaultRightTab);

  // Scroll-Linked Parallax Mapping (0 React re-render per scroll frame)
  const { scrollYProgress } = useScroll({
    target: deckOuterRef,
    offset: ["start start", "end start"],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      scrollProgressRef.current = latest;
    });
    return unsubscribe;
  }, [scrollYProgress]);

  const deckY = useTransform(scrollYProgress, [0, 1], [0, 56]);
  const deckScale = useTransform(scrollYProgress, [0, 1], [1, 0.965]);
  const deckOpacity = useTransform(scrollYProgress, [0, 0.85, 1], [1, 0.82, 0.52]);
  const ambientGlowY = useTransform(scrollYProgress, [0, 1], [0, 96]);

  const sentiment = useMemo(() => summarizeGlobalSentiment(hubs), [hubs]);

  const filteredHubs = useMemo(
    () => (regionFilter === "ALL" ? hubs : hubs.filter((h) => h.region === regionFilter)),
    [hubs, regionFilter]
  );

  const selectedHub = useMemo(
    () => hubs.find((h) => h.id === selectedHubId) ?? hubs[0],
    [hubs, selectedHubId]
  );

  const handleSelectHub = (id: GlobalMarketId) => {
    setSelectedHubId(id);
    setRightTab("country");
  };

  const handleSelectRegion = (region: RegionFilter) => {
    setRegionFilter(region);
    if (region !== "ALL") {
      const firstInRegion = hubs.find((h) => h.region === region);
      if (firstInRegion && firstInRegion.id !== selectedHubId) {
        setSelectedHubId(firstInRegion.id);
      }
    }
  };

  const moodPillClass =
    sentiment.moodTone === "emerald"
      ? "bg-[#22C55E]/12 border-[#22C55E]/35 text-[#22C55E]"
      : sentiment.moodTone === "coral"
      ? "bg-[#EF4444]/12 border-[#EF4444]/35 text-[#EF4444]"
      : "bg-amber-500/12 border-amber-500/35 text-amber-300";

  return (
    <section
      id="terminal-global-deck"
      ref={deckOuterRef}
      aria-label="Global 3D Command Deck dan Ikhtisar Pasar"
      className="relative scroll-mt-16"
    >
      {/* Layer Parallax Belakang: Ambient Teal Orbital Glow */}
      <motion.div
        aria-hidden="true"
        style={shouldReduceMotion ? undefined : { y: ambientGlowY }}
        className="pointer-events-none absolute -top-6 inset-x-10 h-44 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.14)_0%,transparent_70%)] blur-2xl -z-10"
      />

      {/* Layer Parallax Utama: 3D Globe + Intelligence Panel */}
      <motion.div
        style={
          shouldReduceMotion
            ? undefined
            : {
                y: deckY,
                scale: deckScale,
                opacity: deckOpacity,
                transformOrigin: "center top",
              }
        }
        className="will-change-transform"
      >
        <TerminalSpotlightCard className="rounded-xl overflow-hidden">
          <div className="relative z-10 p-3 sm:p-3.5 space-y-2.5">
            {/* Bar Header Command Deck */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/[0.06]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-md bg-[#1E7B85]/20 border border-[#2DD4BF]/35 flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-[#2DD4BF]" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-semibold text-white leading-tight">
                      Radar Pasar Global 3D &amp; Ikhtisar BEI
                    </h2>
                    <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
                      {isGlobalFallback
                        ? "Data acuan global (ilustrasi) • Klik negara untuk inspeksi blue-chip"
                        : "Live Yahoo Finance • Garis arc terhubung ke Jakarta (IDX)"}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md border text-[10.5px] font-mono tnum font-semibold ${moodPillClass}`}
                >
                  {sentiment.moodLabel} &bull; {sentiment.advancingCount}/{sentiment.totalCount} Naik
                </span>

                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0B0E15] border border-white/[0.06] text-[10.5px] font-mono text-slate-300 tnum">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  <span>{sentiment.openCount} Bursa Buka</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Filter Region */}
                <div className="hidden sm:inline-flex bg-[#080A0F] p-0.5 rounded-md border border-white/[0.06] text-[10.5px]">
                  {REGION_OPTIONS.map((reg) => (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => handleSelectRegion(reg.id)}
                      className={`px-2 py-1 rounded transition ${
                        regionFilter === reg.id
                          ? "bg-[#161C29] text-[#2DD4BF] font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {reg.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onRefreshGlobal}
                  disabled={isGlobalLoading}
                  title="Segarkan harga pasar global"
                  aria-label="Segarkan harga pasar global"
                  className="p-1.5 rounded-md bg-[#0B0E15] hover:bg-[#161C29] border border-white/[0.07] text-slate-300 hover:text-[#2DD4BF] transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGlobalLoading ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={onJumpToResearch}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#161C29] hover:bg-[#1E7B85] border border-white/[0.08] hover:border-[#2DD4BF]/50 text-[11px] font-medium text-slate-200 hover:text-white transition"
                >
                  <span>Ke Riset BEI</span>
                  <ArrowDown className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Grid 2 Kolom: 3D Globe (Kiri) + Negara / Ikhtisar BEI (Kanan) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              {/* KIRI: 3D World Globe + Quick-Jump Strip */}
              <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-2">
                <div className="relative h-[340px] sm:h-[405px] rounded-lg border border-white/[0.07] overflow-hidden">
                  <WorldGlobe3D
                    hubs={hubs}
                    selectedHubId={selectedHubId}
                    onSelectHub={handleSelectHub}
                    scrollProgressRef={scrollProgressRef}
                    reducedMotion={Boolean(shouldReduceMotion)}
                  />
                </div>

                {/* Strip Quick-Jump 10 Negara */}
                <div className="relative">
                  <div className="flex items-center gap-1 overflow-x-auto terminal-scroll pb-0.5 pr-6">
                    {filteredHubs.map((hub) => {
                      const isActive = hub.id === selectedHubId;
                      const isUp = hub.primaryIndex.changePercent >= 0;
                      return (
                        <button
                          key={hub.id}
                          type="button"
                          onClick={() => handleSelectHub(hub.id)}
                          className={`relative z-10 shrink-0 px-2 py-1 rounded-md border text-[10.5px] font-mono tnum transition-colors flex items-center gap-1 ${
                            isActive
                              ? "border-[#2DD4BF]/60 text-white font-semibold"
                              : "bg-[#0B0E15] border-white/[0.06] text-slate-300 hover:border-white/[0.16] hover:text-white"
                          }`}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="globe-hub-pill"
                              transition={SPRING_SNAP}
                              aria-hidden="true"
                              className="absolute inset-0 rounded-md bg-[#1E7B85]/28 -z-10"
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className={`w-1.5 h-1.5 rounded-full ${
                              hub.session.isOpen ? "bg-[#22C55E]" : "bg-slate-600"
                            }`}
                          />
                          <span>{hub.id}</span>
                          <span className={isUp ? "text-[#22C55E]" : "text-[#EF4444]"}>
                            {formatPersen(hub.primaryIndex.changePercent, 1, true)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-[#0F131C] to-transparent"
                  />
                </div>
              </div>

              {/* KANAN: Unified Intelligence Panel (Negara Terpilih | Ikhtisar BEI) */}
              <div className="lg:col-span-6 xl:col-span-5 flex flex-col rounded-lg bg-[#0B0E15]/85 border border-white/[0.07] p-3">
                {/* Switcher Lensa Panel Kanan */}
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/[0.06]">
                  <div className="inline-flex bg-[#080A0F] p-0.5 rounded-md border border-white/[0.06] text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRightTab("country")}
                      className={`relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                        rightTab === "country"
                          ? "text-white font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {rightTab === "country" && (
                        <motion.span
                          layoutId="command-deck-right-tab"
                          transition={SPRING_SNAP}
                          aria-hidden="true"
                          className="absolute inset-0 rounded bg-[#1E7B85] -z-10"
                        />
                      )}
                      <Globe className="w-3 h-3" aria-hidden="true" />
                      <span>Pasar {selectedHub?.id}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightTab("bei")}
                      className={`relative z-10 inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                        rightTab === "bei"
                          ? "text-white font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {rightTab === "bei" && (
                        <motion.span
                          layoutId="command-deck-right-tab"
                          transition={SPRING_SNAP}
                          aria-hidden="true"
                          className="absolute inset-0 rounded bg-[#1E7B85] -z-10"
                        />
                      )}
                      <Flame className="w-3 h-3" aria-hidden="true" />
                      <span>Ikhtisar BEI</span>
                    </button>
                  </div>

                  {rightTab === "country" && selectedHub && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-slate-400 tnum">
                      <Clock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      <span>{selectedHub.session.localTime}</span>
                    </span>
                  )}
                </div>

                {/* Konten Tab Kanan */}
                <AnimatePresence mode="wait" initial={false}>
                  {rightTab === "country" && selectedHub ? (
                    <motion.div
                      key={`hub-${selectedHub.id}`}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: EASE_TERMINAL }}
                      className="flex-1 flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-2.5">
                        {/* Header Negara & Status Sesi */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">
                                {selectedHub.countryName}
                              </h3>
                              <span className="px-1.5 py-0.5 rounded bg-[#161C29] border border-white/[0.08] font-mono text-[10px] text-[#2DD4BF]">
                                {selectedHub.exchange}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {selectedHub.city} &bull; {selectedHub.region} &bull;{" "}
                              {selectedHub.session.detailLabel}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${
                              selectedHub.session.isOpen
                                ? "bg-[#22C55E]/15 border-[#22C55E]/35 text-[#22C55E]"
                                : "bg-[#161C29] border-white/[0.08] text-slate-400"
                            }`}
                          >
                            {selectedHub.session.statusLabel}
                          </span>
                        </div>

                        {/* Indeks Utama (+ Indeks Sekunder jika ada misal Nasdaq) */}
                        <div
                          className={`grid gap-2 font-mono tnum ${
                            selectedHub.secondaryIndex ? "grid-cols-2" : "grid-cols-1"
                          }`}
                        >
                          <div className="p-2.5 rounded-lg bg-[#0F131C] border border-white/[0.07]">
                            <span className="text-[10px] font-sans text-slate-400 block">
                              {selectedHub.primaryIndex.name} ({selectedHub.primaryIndex.symbol})
                            </span>
                            <div className="flex items-baseline justify-between gap-2 mt-0.5">
                              <span className="text-base font-bold text-white">
                                {formatGlobalIndexValue(selectedHub.primaryIndex.value)}
                              </span>
                              <span
                                className={`text-xs font-semibold ${
                                  selectedHub.primaryIndex.changePercent >= 0
                                    ? "text-[#22C55E]"
                                    : "text-[#EF4444]"
                                }`}
                              >
                                {formatPersen(selectedHub.primaryIndex.changePercent, 2, true)}
                              </span>
                            </div>
                          </div>

                          {selectedHub.secondaryIndex && (
                            <div className="p-2.5 rounded-lg bg-[#0F131C] border border-white/[0.07]">
                              <span className="text-[10px] font-sans text-slate-400 block">
                                {selectedHub.secondaryIndex.name} (
                                {selectedHub.secondaryIndex.symbol})
                              </span>
                              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                                <span className="text-base font-bold text-white">
                                  {formatGlobalIndexValue(selectedHub.secondaryIndex.value)}
                                </span>
                                <span
                                  className={`text-xs font-semibold ${
                                    selectedHub.secondaryIndex.changePercent >= 0
                                      ? "text-[#22C55E]"
                                      : "text-[#EF4444]"
                                  }`}
                                >
                                  {formatPersen(
                                    selectedHub.secondaryIndex.changePercent,
                                    2,
                                    true
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Daftar 4 Saham Blue-Chip Negara Ini */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500 px-1">
                            <span>Saham Unggulan ({selectedHub.currency})</span>
                            <span>
                              {selectedHub.id === "ID"
                                ? "Klik untuk bedah di bawah"
                                : "Harga & 1H"}
                            </span>
                          </div>

                          <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.07] bg-[#0F131C] overflow-hidden">
                            {selectedHub.stocks.map((stock) => {
                              const isUp = stock.changePercent >= 0;
                              const isBeiClickable = Boolean(stock.idxTicker);
                              const rowContent = (
                                <>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-xs text-white">
                                        {stock.displayTicker}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.04] text-slate-400 truncate">
                                        {stock.sector}
                                      </span>
                                      {isBeiClickable && (
                                        <ArrowUpRight
                                          className="w-3 h-3 text-[#2DD4BF] shrink-0"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </div>
                                    <span className="text-[10.5px] text-slate-400 truncate block">
                                      {stock.name}
                                    </span>
                                  </div>
                                  <div className="text-right font-mono tnum shrink-0">
                                    <div className="text-xs font-semibold text-slate-100 whitespace-nowrap">
                                      {formatGlobalCurrency(stock.price, stock.currency)}
                                    </div>
                                    <div
                                      className={`text-[10.5px] font-semibold ${
                                        isUp ? "text-[#22C55E]" : "text-[#EF4444]"
                                      }`}
                                    >
                                      {formatPersen(stock.changePercent, 2, true)}
                                    </div>
                                  </div>
                                </>
                              );

                              if (isBeiClickable && stock.idxTicker) {
                                return (
                                  <button
                                    key={stock.symbol}
                                    type="button"
                                    onClick={() => {
                                      onSelectBeiStock(stock.idxTicker!);
                                      onJumpToResearch();
                                    }}
                                    className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#161C29] text-left transition"
                                  >
                                    {rowContent}
                                  </button>
                                );
                              }

                              return (
                                <div
                                  key={stock.symbol}
                                  className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-white/[0.02] transition"
                                >
                                  {rowContent}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Aksi AI: Bedah Dampak Negara Ini ke IHSG */}
                      <button
                        type="button"
                        onClick={() => onAskAiGlobalHub(selectedHub)}
                        className="w-full py-2 px-3 rounded-lg bg-[#1E7B85]/20 hover:bg-[#1E7B85] border border-[#2DD4BF]/35 text-[#2DD4BF] hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {selectedHub.id === "ID"
                            ? "Bedah Sentimen IHSG & Blue Chip BEI (AI)"
                            : `Bedah Dampak Pasar ${selectedHub.countryName} ke IHSG (AI)`}
                        </span>
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="bei-overview"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: EASE_TERMINAL }}
                      className="flex-1 min-h-0"
                    >
                      <MarketOverviewPane
                        compact
                        provider={provider}
                        quotes={quotes}
                        macroTickers={macroTickers}
                        customWatchlist={customWatchlist}
                        watchlistNotes={watchlistNotes}
                        liveNewsItems={liveNewsItems}
                        onSelectStock={(t) => {
                          onSelectBeiStock(t);
                          onJumpToResearch();
                        }}
                        onSwitchToNews={onSwitchToNews}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </TerminalSpotlightCard>
      </motion.div>
    </section>
  );
};
