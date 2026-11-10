"use client";

import React, { useState } from "react";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane } from "@/components/terminal/TerminalMainPane";

export default function Home() {
  const [currentMode, setCurrentMode] = useState<AppMode>("terminal");
  const [selectedTicker, setSelectedTicker] = useState<string>("BBCA");

  return (
    <div className="min-h-screen flex flex-col bg-[#0C1017] text-slate-100 font-sans selection:bg-[#1E7B85]/30">
      {/* 1. Benchmark Snapshot Ticker Bar */}
      <MarketTicker />

      {/* 2. Top Header & Mode Switcher */}
      <Navbar
        currentMode={currentMode}
        onModeChange={(mode) => setCurrentMode(mode)}
      />

      {/* 3. Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 py-4">
        {currentMode === "terminal" ? (
          /* DENSE 2-COLUMN TERMINAL WORKSPACE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Combined Watchlist & Screener (4 of 12 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 h-[750px]">
              <TerminalWatchlist
                selectedTicker={selectedTicker}
                onSelectTicker={(ticker) => setSelectedTicker(ticker)}
              />
            </div>

            {/* Right Column: Chart on Top + Tabbed Valuation/Simulator/Fundamental below (8 of 12 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 min-h-[750px]">
              <TerminalMainPane selectedTicker={selectedTicker} />
            </div>
          </div>
        ) : (
          /* MODE BERITA PLACEHOLDER (WILL BE BUILT AFTER TERMINAL REVIEW) */
          <div className="p-12 text-center rounded-xl bg-[#111622] border border-[#1E2736] max-w-2xl mx-auto space-y-3 font-mono">
            <span className="text-xs text-[#5CE1E6] uppercase tracking-wider block">
              Fase Pengerjaan Terjadwal
            </span>
            <h2 className="text-lg font-bold text-white">
              Mode Berita (Struktur Editorial & Transmisi Makro)
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Sesuai urutan pengerjaan yang disepakati, Mode Berita akan dibangun pada fase berikutnya setelah Anda mereview dan menyetujui implementasi Mode Terminal ini.
            </p>
            <button
              onClick={() => setCurrentMode("terminal")}
              className="mt-2 px-4 py-2 bg-[#1E7B85] text-white text-xs rounded-lg font-semibold hover:bg-[#1E7B85]/90 transition"
            >
              Kembali ke Mode Terminal
            </button>
          </div>
        )}
      </main>

      {/* 4. Terminal Footer */}
      <footer className="border-t border-[#1A2230] bg-[#0A0D14] py-3 text-[11px] font-mono text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">StocksSense</span>
            <span>•</span>
            <span>Terminal Analisis Saham IDX (9 Bluechips Terdaftar)</span>
          </div>

          <div className="text-slate-400 text-center sm:text-right">
            <span>Data ilustrasi penutupan kuartalan 2020–2026. Untuk riset antarmuka & simulasi strategi.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
