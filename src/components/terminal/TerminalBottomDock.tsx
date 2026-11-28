"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  Globe,
  PanelLeft,
  Sparkles,
  Target,
} from "lucide-react";
import { formatPersen, formatRupiah } from "@/lib/format";
import type { MarketProvider } from "@/lib/market-data";

interface TerminalBottomDockProps {
  selectedTicker: string;
  activePrice: number;
  changePercent: number;
  provider: MarketProvider;
  isGlobalDeckOpen: boolean;
  isWatchlistVisible: boolean;
  isQuickRailVisible: boolean;
  isAiModalOpen: boolean;
  watchlistCount: number;
  actionableSignalCount: number;
  onToggleGlobalDeck: () => void;
  onToggleWatchlistPane: () => void;
  onToggleQuickRail: () => void;
  onToggleAiModal: () => void;
  onOpenCommandSearch: () => void;
}

/**
 * Persistent Ultra-Slim Bottom Utility Dock (~36px) ala Rax Trade untuk Unified Terminal:
 * Mengontrol Radar Globe 3D (G), Watchlist ([), Kalkulator Lot (]), dan AI Analis secara instan.
 */
export const TerminalBottomDock: React.FC<TerminalBottomDockProps> = ({
  selectedTicker,
  activePrice,
  changePercent,
  provider,
  isGlobalDeckOpen,
  isWatchlistVisible,
  isQuickRailVisible,
  isAiModalOpen,
  watchlistCount,
  actionableSignalCount,
  onToggleGlobalDeck,
  onToggleWatchlistPane,
  onToggleQuickRail,
  onToggleAiModal,
  onOpenCommandSearch,
}) => {
  const isUp = changePercent >= 0;

  return (
    <div
      role="region"
      aria-label="Dock Utilitas Terminal"
      className={`fixed bottom-0 left-0 right-0 z-30 h-9 bg-[#0B0E15]/95 backdrop-blur-md border-t border-white/[0.08] px-3 sm:px-5 flex items-center justify-between gap-2 text-[11px] font-sans text-slate-300 transition-[right] duration-200 ${
        isAiModalOpen ? "xl:right-[440px]" : ""
      }`}
    >
      {/* Kiri: Widget Quick Toggles */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          aria-pressed={isGlobalDeckOpen}
          onClick={onToggleGlobalDeck}
          title="Tampilkan / sembunyikan Radar Globe 3D & Ikhtisar (pintasan G)"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition whitespace-nowrap ${
            isGlobalDeckOpen
              ? "bg-[#161C29] border-[#1E7B85]/60 text-white"
              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${
              isGlobalDeckOpen ? "bg-[#2DD4BF]" : "bg-slate-600"
            }`}
          />
          <Globe className="w-3 h-3" aria-hidden="true" />
          <span>Globe 3D</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          aria-pressed={isWatchlistVisible}
          onClick={onToggleWatchlistPane}
          title="Tampilkan / sembunyikan Watchlist (pintasan [)"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition whitespace-nowrap ${
            isWatchlistVisible
              ? "bg-[#161C29] border-[#1E7B85]/60 text-white"
              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${
              isWatchlistVisible ? "bg-[#2DD4BF]" : "bg-slate-600"
            }`}
          />
          <PanelLeft className="w-3 h-3" aria-hidden="true" />
          <span>Watchlist</span>
          <span className="font-mono text-[10px] text-slate-400 tnum">({watchlistCount})</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          aria-pressed={isQuickRailVisible}
          onClick={onToggleQuickRail}
          title="Tampilkan / sembunyikan Panel Lot & Target (pintasan ])"
          className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition whitespace-nowrap ${
            isQuickRailVisible
              ? "bg-[#161C29] border-[#1E7B85]/60 text-white"
              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${
              isQuickRailVisible ? "bg-[#2DD4BF]" : "bg-slate-600"
            }`}
          />
          <Calculator className="w-3 h-3" aria-hidden="true" />
          <span>Lot &amp; Target</span>
          {actionableSignalCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-[#22C55E]/20 text-[#22C55E] font-mono text-[9.5px] font-bold tnum">
              <Target className="w-2.5 h-2.5" aria-hidden="true" />
              {actionableSignalCount}
            </span>
          )}
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          aria-pressed={isAiModalOpen}
          onClick={onToggleAiModal}
          title="Buka / tutup Panel Konsultasi AI"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition whitespace-nowrap ${
            isAiModalOpen
              ? "bg-[#22C55E]/15 border-[#22C55E]/50 text-[#22C55E] font-semibold"
              : "bg-transparent border-transparent text-slate-400 hover:text-[#2DD4BF] hover:bg-white/[0.04]"
          }`}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          <span>AI Analis</span>
        </motion.button>
      </div>

      {/* Kanan: Telemetri Saham Aktif & Pintasan Keyboard */}
      <div className="flex items-center gap-3 shrink-0 font-mono tnum">
        <button
          type="button"
          onClick={onOpenCommandSearch}
          title="Ganti emiten cepat (S / ⌘K)"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#161C29] border border-white/[0.07] hover:border-[#1E7B85]/60 transition"
        >
          <span className="font-bold text-white">{selectedTicker}</span>
          {activePrice > 0 && (
            <>
              <span className="text-slate-300">{formatRupiah(activePrice)}</span>
              <span className={isUp ? "text-[#22C55E]" : "text-[#EF4444]"}>
                {formatPersen(changePercent, 1, true)}
              </span>
            </>
          )}
        </button>

        <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] text-slate-400 font-sans">
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${
              provider === "yahoo" ? "bg-[#22C55E]" : "bg-amber-400"
            }`}
          />
          <span>{provider === "yahoo" ? "Yahoo Live" : "Ilustrasi"}</span>
        </span>

        <span className="hidden xl:inline-flex items-center gap-1.5 text-[10px] text-slate-500">
          <kbd className="px-1 bg-[#161C29] border border-white/[0.07] rounded text-slate-300">S</kbd>
          <span className="font-sans">Cari</span>
          <span>&bull;</span>
          <kbd className="px-1 bg-[#161C29] border border-white/[0.07] rounded text-slate-300">G</kbd>
          <span className="font-sans">Globe</span>
          <span>&bull;</span>
          <kbd className="px-1 bg-[#161C29] border border-white/[0.07] rounded text-slate-300">[</kbd>
          <kbd className="px-1 bg-[#161C29] border border-white/[0.07] rounded text-slate-300">]</kbd>
          <span className="font-sans">Panel</span>
          <span>&bull;</span>
          <kbd className="px-1 bg-[#161C29] border border-white/[0.07] rounded text-slate-300">F</kbd>
          <span className="font-sans">Fokus</span>
        </span>
      </div>
    </div>
  );
};
