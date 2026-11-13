"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane } from "@/components/terminal/TerminalMainPane";
import { NewsView } from "@/components/news/NewsView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";

function HomeContent() {
  const searchParams = useSearchParams();

  // Read initial states from URL query parameters (supports bookmarking & refresh)
  const initialMode = (searchParams.get("mode") as AppMode) || "berita";
  const initialSaham = searchParams.get("saham") || "BBCA";
  const initialBerita = searchParams.get("berita") || null;
  const initialArtikel = searchParams.get("artikel") || null;

  const [currentMode, setCurrentMode] = useState<AppMode>(initialMode);
  const [selectedTicker, setSelectedTicker] = useState<string>(initialSaham);
  const [originNewsId, setOriginNewsId] = useState<string | null>(initialBerita);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(initialArtikel);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Sync state to URL without reloading the page
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("mode", currentMode);

    if (currentMode === "terminal") {
      params.set("saham", selectedTicker);
      if (originNewsId) {
        params.set("berita", originNewsId);
      }
    } else {
      if (activeArticleId) {
        params.set("artikel", activeArticleId);
      }
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  }, [currentMode, selectedTicker, originNewsId, activeArticleId]);

  // Navigate from News ticker link to Terminal
  const handleSelectStockFromNews = (ticker: string, newsId: string) => {
    setSelectedTicker(ticker);
    setOriginNewsId(newsId);
    setCurrentMode("terminal");
  };

  // Back from Terminal to the exact same News article
  const handleBackToArticle = (newsId: string) => {
    setActiveArticleId(newsId);
    setCurrentMode("berita");
  };

  const isLight = currentMode === "berita";

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors ${
        isLight
          ? "bg-[#FBFBFA] text-[#1A1C1E]"
          : "bg-[#0C1017] text-slate-100"
      }`}
    >
      {/* 1. Satu strip tipis disclaimer di bagian paling atas */}
      <div
        className={`px-4 py-1 text-center text-xs font-sans border-b select-none ${
          isLight
            ? "bg-[#F3F3ED] border-[#E5E5DC] text-[#6A7078]"
            : "bg-[#0A0D14] border-[#1E2736] text-slate-400"
        }`}
      >
        <span>Data ilustrasi, bukan harga pasar</span>
      </div>

      {/* 2. Ticker bar: HANYA TAMPIL DI TERMINAL (tidak di mode Berita) */}
      {currentMode === "terminal" && <MarketTicker />}

      {/* 3. Header navigasi permanen dengan toggle Berita/Terminal */}
      <Navbar
        currentMode={currentMode}
        onModeChange={(mode) => setCurrentMode(mode)}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* 4. Area Konten Utama */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {currentMode === "terminal" ? (
          /* TAMPILAN TERMINAL GELAP */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Kolom Kiri: Watchlist & Penyaring */}
            <div className="lg:col-span-5 xl:col-span-4 h-[750px]">
              <TerminalWatchlist
                selectedTicker={selectedTicker}
                onSelectTicker={(ticker) => setSelectedTicker(ticker)}
              />
            </div>

            {/* Kolom Kanan: Grafik + Panel Tab Analisis */}
            <div className="lg:col-span-7 xl:col-span-8 min-h-[750px]">
              <TerminalMainPane
                selectedTicker={selectedTicker}
                originNewsId={originNewsId}
                onSelectTicker={(ticker) => setSelectedTicker(ticker)}
                onBackToArticle={handleBackToArticle}
                onCloseOriginPanel={() => setOriginNewsId(null)}
              />
            </div>
          </div>
        ) : (
          /* TAMPILAN BERITA TERANG PENUH (tanpa bingkai/tepi gelap) */
          <div className="w-full">
            <NewsView
              onSelectStockFromNews={handleSelectStockFromNews}
              activeArticleId={activeArticleId}
              onOpenArticle={(id) => setActiveArticleId(id)}
            />
          </div>
        )}
      </main>

      {/* 5. Footer Bersih yang Menyesuaikan Tema */}
      <footer
        className={`border-t py-4 text-xs font-sans transition-colors ${
          isLight
            ? "border-[#E5E5DC] bg-[#F3F3ED] text-[#6A7078]"
            : "border-[#1A2230] bg-[#0A0D14] text-slate-400"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className={`font-mono font-semibold ${isLight ? "text-[#1A1C1E]" : "text-slate-200"}`}>
              StocksSense
            </span>
            <span>|</span>
            <span>Riset transmisi makro dan simulasi emiten saham</span>
          </div>

          <div className="text-center sm:text-right">
            <span>Data ilustrasi untuk riset antarmuka dan simulasi strategi kuartalan.</span>
          </div>
        </div>
      </footer>

      {/* 6. Modal Konsultasi AI Gemini */}
      <GeminiAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0C1017] text-slate-400 text-xs">
          Memuat StocksSense...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
