"use client";

import React, { useState } from "react";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane } from "@/components/terminal/TerminalMainPane";
import { NewsView } from "@/components/news/NewsView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";

export default function Home() {
  const [currentMode, setCurrentMode] = useState<AppMode>("terminal");
  const [selectedTicker, setSelectedTicker] = useState<string>("BBCA");
  const [originNewsTitle, setOriginNewsTitle] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  const handleSelectStockFromNews = (ticker: string, newsTitle: string) => {
    setSelectedTicker(ticker);
    setOriginNewsTitle(newsTitle);
    setCurrentMode("terminal");
  };

  const handleBackToNews = () => {
    setCurrentMode("berita");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0C1017] text-slate-100 font-sans selection:bg-[#1E7B85]/30">
      {/* 1. Benchmark Snapshot Ticker Bar */}
      <MarketTicker />

      {/* 2. Top Header & Mode Switcher */}
      <Navbar
        currentMode={currentMode}
        onModeChange={(mode) => setCurrentMode(mode)}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* 3. Permanent Small Banner: Data ilustrasi, bukan harga pasar */}
      <div className="bg-[#0A0D14] border-b border-[#1E2736] px-4 py-1 text-center text-xs text-slate-400 font-sans flex items-center justify-center space-x-2 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1E7B85]"></span>
        <span>Data ilustrasi, bukan harga pasar</span>
      </div>

      {/* 4. Main Workspace Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 lg:px-6 py-4">
        {currentMode === "terminal" ? (
          /* DENSE 2-COLUMN TERMINAL WORKSPACE */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Column: Combined Watchlist & Screener (4 of 12 cols on xl, 5 on lg) */}
            <div className="lg:col-span-5 xl:col-span-4 h-[750px]">
              <TerminalWatchlist
                selectedTicker={selectedTicker}
                onSelectTicker={(ticker) => {
                  setSelectedTicker(ticker);
                  // Clear origin news title if user manually changes ticker in watchlist
                  setOriginNewsTitle(null);
                }}
              />
            </div>

            {/* Right Column: Top Line Chart + Tabbed Analysis below (8 of 12 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 min-h-[750px]">
              <TerminalMainPane
                selectedTicker={selectedTicker}
                originNewsTitle={originNewsTitle}
                onBackToNews={handleBackToNews}
              />
            </div>
          </div>
        ) : (
          /* MODE BERITA: EDITORIAL BROADSHEET TRANSMISI KEBIJAKAN */
          <div className="w-full">
            <NewsView
              onSelectStockFromNews={handleSelectStockFromNews}
            />
          </div>
        )}
      </main>

      {/* 5. Terminal & News Footer */}
      <footer className="border-t border-[#1A2230] bg-[#0A0D14] py-3 text-[11px] font-sans text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300 font-mono">StocksSense</span>
            <span>•</span>
            <span>Platform Riset Transmisi Makro & Analisis Saham IDX</span>
          </div>

          <div className="text-slate-400 text-center sm:text-right">
            <span>Data ilustrasi untuk riset antarmuka & simulasi strategi kuartalan.</span>
          </div>
        </div>
      </footer>

      {/* 6. Gemini AI Modal (unpretentious, accessible via Navbar button) */}
      <GeminiAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
}
