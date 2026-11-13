"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane } from "@/components/terminal/TerminalMainPane";
import { NewsView } from "@/components/news/NewsView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read state directly from URL query parameters (single source of truth for SSR and Client)
  const rawMode = searchParams.get("mode");
  const rawSaham = searchParams.get("saham");
  const currentMode: AppMode =
    rawMode === "terminal" || (!rawMode && !!rawSaham) ? "terminal" : "berita";
  const selectedTicker = rawSaham || "BBCA";
  const originNewsId = searchParams.get("berita") || null;
  const activeArticleId = searchParams.get("artikel") || null;

  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Helper to update URL params via Next.js router without full reload
  const updateUrlParams = (updates: {
    mode?: AppMode;
    saham?: string | null;
    berita?: string | null;
    artikel?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.mode !== undefined) {
      params.set("mode", updates.mode);
    }
    if (updates.saham !== undefined) {
      if (updates.saham) {
        params.set("saham", updates.saham);
      } else {
        params.delete("saham");
      }
    }
    if (updates.berita !== undefined) {
      if (updates.berita) {
        params.set("berita", updates.berita);
      } else {
        params.delete("berita");
      }
    }
    if (updates.artikel !== undefined) {
      if (updates.artikel) {
        params.set("artikel", updates.artikel);
      } else {
        params.delete("artikel");
      }
    }

    const query = params.toString();
    const targetUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(targetUrl, { scroll: false });
  };

  const handleModeChange = (mode: AppMode) => {
    if (mode === "terminal") {
      updateUrlParams({
        mode: "terminal",
        saham: selectedTicker,
        artikel: null,
      });
    } else {
      updateUrlParams({
        mode: "berita",
        berita: null,
      });
    }
  };

  // Navigate from News ticker link to Terminal
  const handleSelectStockFromNews = (ticker: string, newsId: string) => {
    updateUrlParams({
      mode: "terminal",
      saham: ticker,
      berita: newsId,
      artikel: null,
    });
    setTimeout(() => {
      document.getElementById("terminal-chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Select stock with auto-scroll to chart on mobile layout
  const handleSelectTicker = (ticker: string) => {
    updateUrlParams({
      mode: "terminal",
      saham: ticker,
    });
    setTimeout(() => {
      document.getElementById("terminal-chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  // Back from Terminal to the exact same News article
  const handleBackToArticle = (newsId: string) => {
    updateUrlParams({
      mode: "berita",
      artikel: newsId,
      berita: null,
    });
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
        onModeChange={handleModeChange}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* 4. Area Konten Utama */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {currentMode === "terminal" ? (
          /* TAMPILAN TERMINAL GELAP */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Kolom Kiri: Watchlist & Penyaring */}
            <div id="terminal-watchlist-section" className="lg:col-span-5 xl:col-span-4 h-[550px] lg:h-[750px]">
              <TerminalWatchlist
                selectedTicker={selectedTicker}
                onSelectTicker={handleSelectTicker}
              />
            </div>

            {/* Kolom Kanan: Grafik + Panel Tab Analisis */}
            <div id="terminal-chart-section" className="lg:col-span-7 xl:col-span-8 min-h-[750px]">
              {/* Tombol navigasi kembali ke watchlist di HP */}
              <div className="lg:hidden mb-3">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("terminal-watchlist-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#111622] hover:bg-[#161D2B] active:bg-[#1E2736] border border-[#1E2736] rounded-xl text-xs font-sans text-slate-300 hover:text-white flex items-center justify-between transition shadow-sm"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400">Saham aktif:</span>
                    <span className="font-mono text-white font-bold text-sm">{selectedTicker}</span>
                  </div>
                  <span className="text-[#2DD4BF] font-medium flex items-center space-x-1.5">
                    <span>↑ Ganti saham (ke daftar)</span>
                  </span>
                </button>
              </div>

              <TerminalMainPane
                selectedTicker={selectedTicker}
                originNewsId={originNewsId}
                onSelectTicker={handleSelectTicker}
                onBackToArticle={handleBackToArticle}
                onCloseOriginPanel={() => updateUrlParams({ berita: null })}
              />
            </div>
          </div>
        ) : (
          /* TAMPILAN BERITA TERANG PENUH (tanpa bingkai/tepi gelap) */
          <div className="w-full">
            <NewsView
              onSelectStockFromNews={handleSelectStockFromNews}
              activeArticleId={activeArticleId}
              onOpenArticle={(id) => updateUrlParams({ mode: "berita", artikel: id })}
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
