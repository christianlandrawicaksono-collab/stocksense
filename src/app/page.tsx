"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane } from "@/components/terminal/TerminalMainPane";
import { NewsView } from "@/components/news/NewsView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";
import { useMarketData } from "@/hooks/useMarketData";
import { useLiveNews } from "@/hooks/useLiveNews";
import { useAiChat } from "@/hooks/useAiChat";
import { STOCKS_DATA } from "@/data/stocksData";
import { MACRO_NEWS_DATA } from "@/data/macroData";
import type { AiArticleContext, AiMarketContext } from "@/app/api/ai/analyze/route";
import type { LiveMarketNewsItem, MacroNewsItem } from "@/types/market";
import { formatRupiah } from "@/lib/format";

function buildLiveNewsArticleContext(item: LiveMarketNewsItem): AiArticleContext {
  return {
    title: item.title,
    category: item.category,
    catalyst: `Sumber berita: ${item.publisher} (${item.publishedWib})`,
    summary: item.summary,
    overallImpact:
      item.tickers.length > 0
        ? `Emiten disebut: ${item.tickers.join(", ")}`
        : "Berita pasar modal terkini.",
    isLive: true,
    publisher: item.publisher,
    publishedWib: item.publishedWib,
    link: item.link,
    tickers: item.tickers,
  };
}

function buildScenarioArticleContext(article: MacroNewsItem): AiArticleContext {
  return {
    title: article.title,
    category: article.category,
    catalyst: article.catalyst,
    summary: article.summary,
    overallImpact: article.overallImpact,
    isLive: false,
  };
}

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
  const [customTickers, setCustomTickers] = useState<string[]>([]);
  const [activeLiveNewsForAi, setActiveLiveNewsForAi] = useState<LiveMarketNewsItem | null>(null);
  const [originLiveNews, setOriginLiveNews] = useState<LiveMarketNewsItem | null>(null);

  const {
    messages: aiMessages,
    customApiKey: aiCustomApiKey,
    setCustomApiKey: setAiCustomApiKey,
    warningMsg: aiWarningMsg,
    isLoading: isAiLoading,
    sendMessage: sendAiMessage,
    clearMessages: clearAiMessages,
  } = useAiChat();

  const trackedTickers = useMemo(
    () => [selectedTicker, ...customTickers],
    [selectedTicker, customTickers]
  );

  const { quotes, macroTickers, isMacroFallback, isLoading, provider, marketStatus } =
    useMarketData(trackedTickers);

  const liveNews = useLiveNews(provider);

  const watchlistTickers = useMemo(
    () =>
      Array.from(
        new Set([...STOCKS_DATA.map((s) => s.ticker), ...customTickers, selectedTicker])
      ),
    [customTickers, selectedTicker]
  );

  const handleAddCustomTicker = (ticker: string) => {
    const clean = ticker.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(clean)) return;
    setCustomTickers((prev) => (prev.includes(clean) ? prev : [clean, ...prev]));
  };

  const activeAiContext: AiMarketContext = useMemo(() => {
    const curatedMeta = STOCKS_DATA.find((s) => s.ticker === selectedTicker) || null;
    const activeQuote = quotes[selectedTicker];
    const isLive = Boolean(provider === "yahoo" && activeQuote && !activeQuote.isFallback);
    const activePrice = activeQuote?.price ?? curatedMeta?.currentPrice ?? 0;

    const activeEps =
      isLive && activeQuote?.eps && activeQuote.eps > 0
        ? activeQuote.eps
        : curatedMeta
        ? curatedMeta.currentPrice / curatedMeta.peRatio
        : 0;
    const targetMeanPrice =
      curatedMeta && activeEps > 0 ? Math.round(activeEps * curatedMeta.historicalPeMean) : undefined;
    const activePe =
      isLive && activeQuote?.peRatio && activeQuote.peRatio > 0
        ? activeQuote.peRatio
        : curatedMeta?.peRatio ?? 0;
    const activePbv =
      isLive && activeQuote?.pbvRatio && activeQuote.pbvRatio > 0
        ? activeQuote.pbvRatio
        : curatedMeta?.pbvRatio ?? 0;
    const activeDiv =
      isLive && activeQuote?.dividendYield !== undefined && activeQuote.dividendYield >= 0
        ? activeQuote.dividendYield
        : curatedMeta?.dividendYield ?? 0;

    const watchlistPeers = STOCKS_DATA.map((s) => {
      const q = quotes[s.ticker];
      const peerLive = Boolean(provider === "yahoo" && q && !q.isFallback);
      return {
        ticker: s.ticker,
        sector: s.sector,
        price: q?.price ?? s.currentPrice,
        changePercent: q?.changePercent ?? s.change1D,
        peRatio: peerLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : s.peRatio,
        pbvRatio: peerLive && q?.pbvRatio && q.pbvRatio > 0 ? q.pbvRatio : s.pbvRatio,
        dividendYield:
          peerLive && q?.dividendYield !== undefined && q.dividendYield >= 0
            ? q.dividendYield
            : s.dividendYield,
        isLive: peerLive,
      };
    });

    const targetNewsId = currentMode === "berita" ? activeArticleId : originNewsId;
    const matchedScenarioArticle = targetNewsId
      ? MACRO_NEWS_DATA.find((n) => n.id === targetNewsId)
      : undefined;

    const articleContext =
      currentMode === "berita" && activeLiveNewsForAi
        ? buildLiveNewsArticleContext(activeLiveNewsForAi)
        : matchedScenarioArticle
        ? buildScenarioArticleContext(matchedScenarioArticle)
        : currentMode === "terminal" && originLiveNews
        ? buildLiveNewsArticleContext(originLiveNews)
        : undefined;

    return {
      mode: currentMode,
      provider,
      stock:
        currentMode === "terminal" && activePrice > 0
          ? {
              ticker: curatedMeta?.ticker || selectedTicker,
              name: curatedMeta?.name || activeQuote?.name || selectedTicker,
              sector: curatedMeta?.sector || "Bursa Efek Indonesia",
              price: activePrice,
              changePercent: activeQuote?.changePercent ?? curatedMeta?.change1D ?? 0,
              peRatio: activePe,
              historicalPeMean: curatedMeta?.historicalPeMean ?? 0,
              targetMeanPrice,
              pbvRatio: activePbv,
              dividendYield: activeDiv,
              roe: curatedMeta?.roe ?? 0,
              der: curatedMeta?.der ?? 0,
              isLive,
              strengths: curatedMeta?.strengths ?? [],
              risks: curatedMeta?.risks ?? [],
            }
          : undefined,
      watchlistPeers,
      article: articleContext,
      macroTickers: macroTickers.map((t) => ({
        symbol: t.symbol,
        value: t.value,
        change: t.change,
      })),
    };
  }, [
    currentMode,
    provider,
    selectedTicker,
    quotes,
    activeArticleId,
    originNewsId,
    originLiveNews,
    macroTickers,
    activeLiveNewsForAi,
  ]);

  const runAiAnalysis = (prompt: string, overrideArticle?: AiArticleContext) => {
    setIsAiModalOpen(true);
    const ctx: AiMarketContext = overrideArticle
      ? { ...activeAiContext, article: overrideArticle }
      : activeAiContext;
    void sendAiMessage(prompt, ctx);
  };

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
      setOriginLiveNews(null);
      updateUrlParams({
        mode: "berita",
        berita: null,
      });
    }
  };

  // Navigate from News ticker link to Terminal
  const handleSelectStockFromNews = (
    ticker: string,
    newsId: string,
    _newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => {
    handleAddCustomTicker(ticker);
    if (liveItem) {
      setOriginLiveNews(liveItem);
      updateUrlParams({
        mode: "terminal",
        saham: ticker,
        berita: null,
        artikel: null,
      });
    } else {
      setOriginLiveNews(null);
      updateUrlParams({
        mode: "terminal",
        saham: ticker,
        berita: newsId || null,
        artikel: null,
      });
    }
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
    setOriginLiveNews(null);
    updateUrlParams({
      mode: "berita",
      artikel: newsId,
      berita: null,
    });
  };

  const handleBackToLiveNews = () => {
    setOriginLiveNews(null);
    updateUrlParams({
      mode: "berita",
      artikel: null,
      berita: null,
    });
  };

  const isLight = currentMode === "berita";

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-[colors,padding] duration-200 ${
        isLight
          ? "bg-[#FBFBFA] text-[#1A1C1E]"
          : "bg-[#0C1017] text-slate-100"
      } ${isAiModalOpen ? "lg:pr-[400px] xl:pr-[440px]" : ""}`}
    >
      {/* 1. Satu strip tipis disclaimer di bagian paling atas */}
      <div
        className={`px-4 py-1 text-center text-xs font-sans border-b select-none ${
          isLight
            ? "bg-[#F3F3ED] border-[#E5E5DC] text-[#6A7078]"
            : "bg-[#0A0D14] border-[#1E2736] text-slate-400"
        }`}
      >
        {provider === "yahoo" ? (
          <div className="flex items-center justify-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2EB886]"></span>
            <span>
              Sumber: Yahoo Finance (tidak resmi). Tertunda sekitar 10 menit.
            </span>
          </div>
        ) : (
          <span>Data ilustrasi, bukan harga pasar</span>
        )}
      </div>

      {/* 2. Ticker bar: HANYA TAMPIL DI TERMINAL (tidak di mode Berita) */}
      {currentMode === "terminal" && (
        <MarketTicker
          provider={provider}
          tickers={macroTickers}
          isMacroFallback={isMacroFallback}
          isLoading={isLoading}
        />
      )}

      {/* 3. Header navigasi permanen dengan toggle Berita/Terminal */}
      <Navbar
        currentMode={currentMode}
        onModeChange={handleModeChange}
        onOpenAiModal={() => setIsAiModalOpen((prev) => !prev)}
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
                quotes={quotes}
                provider={provider}
                customTickers={customTickers}
                onAddCustomTicker={handleAddCustomTicker}
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
                originLiveNews={originLiveNews}
                liveNewsItems={liveNews.items}
                onSelectTicker={handleSelectTicker}
                onBackToArticle={handleBackToArticle}
                onBackToLiveNews={handleBackToLiveNews}
                onCloseOriginPanel={() => {
                  setOriginLiveNews(null);
                  updateUrlParams({ berita: null });
                }}
                onAskAiStock={(t) => {
                  setActiveLiveNewsForAi(null);
                  const p = quotes[t]?.price ?? STOCKS_DATA.find((s) => s.ticker === t)?.currentPrice ?? 0;
                  runAiAnalysis(`Evaluasi valuasi, kekuatan, dan risiko saham ${t} pada harga ${formatRupiah(p)}.`);
                }}
                onAskAiTerminalNews={(item) => {
                  setActiveLiveNewsForAi(null);
                  runAiAnalysis(
                    `Bedah dampak berita "${item.title}" terhadap prospek & valuasi saham ${selectedTicker}.`,
                    buildLiveNewsArticleContext(item)
                  );
                }}
                quote={quotes[selectedTicker]}
                provider={provider}
                marketStatus={marketStatus}
              />
            </div>
          </div>
        ) : (
          /* TAMPILAN BERITA TERANG PENUH (tanpa bingkai/tepi gelap) */
          <div className="w-full">
            <NewsView
              provider={provider}
              macroTickers={macroTickers}
              isMacroFallback={isMacroFallback}
              isMacroLoading={isLoading}
              liveNewsItems={liveNews.items}
              isLiveNewsLoading={liveNews.isLoading}
              liveNewsUpdatedAtWib={liveNews.updatedAtWib}
              onRefreshLiveNews={liveNews.refresh}
              watchlistTickers={watchlistTickers}
              aiMarketBrief={liveNews.aiBrief}
              aiBriefNotice={liveNews.aiBriefNotice}
              isAiBriefLoading={liveNews.isAiBriefLoading}
              onRequestAiBrief={(items, tickers) => {
                void liveNews.requestAiBrief(items, tickers, aiCustomApiKey);
              }}
              onSelectStockFromNews={handleSelectStockFromNews}
              activeArticleId={activeArticleId}
              onOpenArticle={(id) => {
                setActiveLiveNewsForAi(null);
                updateUrlParams({ mode: "berita", artikel: id });
              }}
              onAskAiArticle={(article) => {
                setActiveLiveNewsForAi(null);
                runAiAnalysis(
                  `Jelaskan transmisi ekonomi dan dampak saham dari skenario: "${article.title}"`,
                  buildScenarioArticleContext(article)
                );
              }}
              onAskAiLiveNews={(item) => {
                setActiveLiveNewsForAi(item);
                runAiAnalysis(
                  `Bedah dampak pasar & saham terkait dari berita: "${item.title}"`,
                  buildLiveNewsArticleContext(item)
                );
              }}
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
            <span>
              {provider === "yahoo"
                ? "Harga & riwayat: Yahoo Finance (~10 menit tertunda); simulasi DCA & rasio profil memakai data acuan."
                : "Data ilustrasi untuk riset antarmuka dan simulasi strategi kuartalan."}
            </span>
          </div>
        </div>
      </footer>

      {/* 6. Side Panel Konsultasi AI Gemini */}
      {isAiModalOpen && (
        <GeminiAiModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          context={activeAiContext}
          messages={aiMessages}
          isLoading={isAiLoading}
          warningMsg={aiWarningMsg}
          customApiKey={aiCustomApiKey}
          onCustomApiKeyChange={setAiCustomApiKey}
          onSendMessage={(prompt) => {
            void sendAiMessage(prompt, activeAiContext);
          }}
          onClearMessages={clearAiMessages}
        />
      )}
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
