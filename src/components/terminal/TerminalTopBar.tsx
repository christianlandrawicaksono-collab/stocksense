"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  Columns2,
  Columns3,
  Globe,
  Maximize2,
  Search,
} from "lucide-react";
import type { MarketStatus } from "@/lib/market-hours";
import { SPRING_SNAP } from "./terminalMotion";

export type TerminalWorkspacePreset = "focus" | "standard" | "full";

interface TerminalTopBarProps {
  isGlobalDeckOpen: boolean;
  onToggleGlobalDeck: () => void;
  onJumpToResearch: () => void;
  workspacePreset: TerminalWorkspacePreset;
  onSelectWorkspacePreset: (preset: TerminalWorkspacePreset) => void;
  onOpenCommandSearch: () => void;
  selectedTicker: string;
  marketStatus?: MarketStatus;
}

const PRESET_OPTIONS: {
  id: TerminalWorkspacePreset;
  label: string;
  title: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "focus",
    label: "Fokus",
    title: "Fokus Chart penuh (pintasan F)",
    icon: <Maximize2 className="w-3 h-3" aria-hidden="true" />,
  },
  {
    id: "standard",
    label: "Standar",
    title: "Watchlist + Chart Utama",
    icon: <Columns2 className="w-3 h-3" aria-hidden="true" />,
  },
  {
    id: "full",
    label: "Penuh",
    title: "Watchlist + Chart + Panel Lot & Sinyal",
    icon: <Columns3 className="w-3 h-3" aria-hidden="true" />,
  },
];

/**
 * Top Sub-Bar horizontal padat (~44px) untuk Unified Terminal:
 * Toggle Radar Global 3D & Ikhtisar (G) • Command Search (⌘K / S) • Workspace Presets • Status BEI
 */
export const TerminalTopBar: React.FC<TerminalTopBarProps> = ({
  isGlobalDeckOpen,
  onToggleGlobalDeck,
  onJumpToResearch,
  workspacePreset,
  onSelectWorkspacePreset,
  onOpenCommandSearch,
  selectedTicker,
  marketStatus,
}) => {
  return (
    <div className="relative z-10 w-full bg-[#0F131C]/95 backdrop-blur-md border border-white/[0.07] rounded-lg px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
      {/* Kiri: Toggle Radar Global 3D & Ikhtisar + Jump Cepat Riset + Status BEI */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleGlobalDeck}
          aria-pressed={isGlobalDeckOpen}
          title="Tampilkan / sembunyikan Radar Global 3D & Ikhtisar BEI (pintasan G)"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition whitespace-nowrap ${
            isGlobalDeckOpen
              ? "bg-[#1E7B85] border-[#2DD4BF]/45 text-white font-semibold shadow-sm"
              : "bg-[#080A0F] border-white/[0.08] text-slate-300 hover:text-white hover:border-[#1E7B85]/60"
          }`}
        >
          <Globe className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Global 3D &amp; Ikhtisar</span>
          <kbd
            className={`hidden sm:inline px-1 py-0.2 rounded font-mono text-[9.5px] ${
              isGlobalDeckOpen
                ? "bg-black/25 text-[#CCFBF1]"
                : "bg-[#161C29] text-slate-400 border border-white/[0.07]"
            }`}
          >
            G
          </kbd>
        </button>

        {isGlobalDeckOpen && (
          <button
            type="button"
            onClick={onJumpToResearch}
            title="Lompat langsung ke bagian Riset Saham BEI"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-[#080A0F] hover:bg-[#161C29] border border-white/[0.07] text-[11px] text-slate-300 hover:text-[#2DD4BF] transition whitespace-nowrap"
          >
            <span>Riset {selectedTicker}</span>
            <ArrowDown className="w-3 h-3" aria-hidden="true" />
          </button>
        )}

        {/* Status Bursa Ringkas */}
        <div
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono tnum ${
            marketStatus?.isOpen
              ? "bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]"
              : "bg-[#161C29]/80 border-white/[0.06] text-slate-400"
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full ${
              marketStatus?.isOpen ? "bg-[#22C55E] animate-pulse" : "bg-slate-500"
            }`}
          />
          <span className="font-sans font-medium">
            {marketStatus?.isOpen ? "BEI Buka" : "BEI Tutup"}
          </span>
          {marketStatus?.formattedTime && (
            <span className="text-slate-500 hidden xl:inline">&bull; {marketStatus.formattedTime}</span>
          )}
        </div>
      </div>

      {/* Tengah: Command-Palette Stock Search Trigger */}
      <button
        type="button"
        onClick={onOpenCommandSearch}
        aria-label="Buka pencarian cepat emiten BEI"
        className="flex-1 min-w-[160px] max-w-md h-8 px-3 rounded-md bg-[#080A0F] hover:bg-[#0B0F17] border border-white/[0.08] hover:border-[#1E7B85]/70 flex items-center justify-between gap-2 text-slate-400 hover:text-slate-200 transition group"
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Search
            className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0 group-hover:scale-105 transition-transform"
            aria-hidden="true"
          />
          <span className="truncate text-[11px]">
            Cari emiten BEI...{" "}
            <span className="text-slate-500 hidden sm:inline">({selectedTicker})</span>
          </span>
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 shrink-0 font-mono text-[10px]">
          <kbd className="px-1.5 py-0.5 rounded bg-[#161C29] border border-white/[0.08] text-slate-300">
            S
          </kbd>
          <span className="text-slate-600">/</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#161C29] border border-white/[0.08] text-slate-300">
            ⌘K
          </kbd>
        </span>
      </button>

      {/* Kanan: Workspace Layout Presets (Desktop lg+) */}
      <div className="hidden lg:flex items-center gap-2">
        <div
          role="group"
          aria-label="Preset tata letak ruang kerja"
          className="inline-flex items-center bg-[#080A0F] p-0.5 rounded-md border border-white/[0.06]"
        >
          {PRESET_OPTIONS.map((preset) => {
            const isActive = workspacePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.title}
                aria-pressed={isActive}
                onClick={() => onSelectWorkspacePreset(preset.id)}
                className={`relative z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  isActive ? "text-[#2DD4BF] font-semibold" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="terminal-preset-pill"
                    transition={SPRING_SNAP}
                    aria-hidden="true"
                    className="absolute inset-0 rounded bg-[#161C29] border border-[#1E7B85]/50 -z-10"
                  />
                )}
                {preset.icon}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
