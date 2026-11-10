"use client";

import React, { useState, useEffect } from "react";
import { Navbar, ActiveTab } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { MacroRadarView } from "@/components/macro/MacroRadarView";
import { StrategySimulator } from "@/components/simulator/StrategySimulator";
import { ValuationBandView } from "@/components/valuation/ValuationBandView";
import { StockScreenerView } from "@/components/screener/StockScreenerView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";
import { Globe2, BarChart3, Layers, Search, Sparkles, Terminal, Heart } from "lucide-react";

export default function Home() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("macro");
  const [selectedTicker, setSelectedTicker] = useState<string>("BBCA");
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiPresetQuery, setAiPresetQuery] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#070b13] text-slate-400 font-mono text-xs">
        <div className="flex items-center space-x-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-200 tracking-wider">
            INITIALIZING STOCKSSENSE TERMINAL...
          </span>
        </div>
      </div>
    );
  }

  const handleSelectTickerFromMacro = (ticker: string) => {
    setSelectedTicker(ticker);
    setActiveTab("valuation");
  };

  const handleGoToSimulator = (ticker: string) => {
    setSelectedTicker(ticker);
    setActiveTab("simulator");
  };

  const handleGoToValuation = (ticker: string) => {
    setSelectedTicker(ticker);
    setActiveTab("valuation");
  };

  const handleOpenAiModal = (query?: string) => {
    if (query) {
      setAiPresetQuery(query);
    }
    setIsAiModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070b13] text-slate-100">
      {/* Real-time Ticker Strip */}
      <MarketTicker />

      {/* Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAiModal={() => handleOpenAiModal()}
        selectedTicker={selectedTicker}
      />

      {/* Main App Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {activeTab === "macro" && (
          <section className="animate-fade-in">
            <MacroRadarView
              onSelectTicker={handleSelectTickerFromMacro}
              onOpenAiAssistant={(query) => handleOpenAiModal(query)}
            />
          </section>
        )}

        {activeTab === "simulator" && (
          <section className="animate-fade-in">
            <StrategySimulator
              initialTicker={selectedTicker}
              onGoToValuation={handleGoToValuation}
            />
          </section>
        )}

        {activeTab === "valuation" && (
          <section className="animate-fade-in">
            <ValuationBandView
              initialTicker={selectedTicker}
              onGoToSimulator={handleGoToSimulator}
            />
          </section>
        )}

        {activeTab === "screener" && (
          <section className="animate-fade-in">
            <StockScreenerView
              onSelectTickerForSimulator={handleGoToSimulator}
              onSelectTickerForValuation={handleGoToValuation}
            />
          </section>
        )}
      </main>

      {/* Terminal Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090D16] py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-bold text-slate-200">StocksSense</span>
            <span>—</span>
            <span className="text-slate-500">
              Indonesian Market & Macro Intelligence Terminal
            </span>
          </div>

          <div className="text-[11px] text-slate-500 text-center md:text-right">
            <span>Data untuk simulasi dan tujuan edukasi / portfolio analisis. Bukan rekomendasi investasi resmi.</span>
          </div>
        </div>
      </footer>

      {/* Gemini AI Assistant Modal */}
      <GeminiAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialQuery={aiPresetQuery}
      />
    </div>
  );
}
