"use client";

import React, { useState, useMemo, useSyncExternalStore, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane, type CustomStockAiMetrics } from "@/components/terminal/TerminalMainPane";
import { NewsView } from "@/components/news/NewsView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";
import { useMarketData } from "@/hooks/useMarketData";
import { useLiveNews } from "@/hooks/useLiveNews";
import { useAiChat } from "@/hooks/useAiChat";
import { STOCKS_DATA } from "@/data/stocksData";
import {
  MAX_CUSTOM_WATCHLIST,
  addTickerToWatchlist,
  getWatchlistNotesServerSnapshot,
  getWatchlistServerSnapshot,
  parseWatchlistJson,
  parseWatchlistNotesJson,
  readWatchlistNotesStorageSnapshot,
  readWatchlistStorageSnapshot,
  saveWatchlistEntryMetaStorage,
  subscribeWatchlistNotesStorage,
  subscribeWatchlistStorage,
  summarizeWatchlistBuySignals,
  toggleTickerInWatchlist,
  writeCustomWatchlistStorage,
  type WatchlistEntryMeta,
} from "@/lib/watchlist";
import type { AiArticleContext, AiMarketContext } from "@/app/api/ai/analyze/route";
import type { LiveMarketNewsItem } from "@/types/market";
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

const emptySubscribe = () => () => {};

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

  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [activeLiveNewsForAi, setActiveLiveNewsForAi] = useState<LiveMarketNewsItem | null>(null);
  const [originLiveNews, setOriginLiveNews] = useState<LiveMarketNewsItem | null>(null);
  const [customAiMetrics, setCustomAiMetrics] = useState<CustomStockAiMetrics | null>(null);

  const watchlistJson = useSyncExternalStore(
    subscribeWatchlistStorage,
    readWatchlistStorageSnapshot,
    getWatchlistServerSnapshot
  );
  const watchlistNotesJson = useSyncExternalStore(
    subscribeWatchlistNotesStorage,
    readWatchlistNotesStorageSnapshot,
    getWatchlistNotesServerSnapshot
  );
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const customWatchlist = useMemo(() => parseWatchlistJson(watchlistJson), [watchlistJson]);
  const watchlistNotes = useMemo(
    () => parseWatchlistNotesJson(watchlistNotesJson),
    [watchlistNotesJson]
  );
  const isWatchlistFull = customWatchlist.length >= MAX_CUSTOM_WATCHLIST;

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
    () => [selectedTicker, ...customWatchlist],
    [selectedTicker, customWatchlist]
  );

  const { quotes, macroTickers, isMacroFallback, isLoading, provider, marketStatus } =
    useMarketData(trackedTickers);

  const liveNews = useLiveNews(provider, customWatchlist, isHydrated);

  const handleAddToWatchlist = (ticker: string) => {
    const updated = addTickerToWatchlist(customWatchlist, ticker);
    if (updated !== customWatchlist) {
      writeCustomWatchlistStorage(updated);
    }
  };

  const handleToggleWatchlist = (ticker: string) => {
    const updated = toggleTickerInWatchlist(customWatchlist, ticker);
    if (updated !== customWatchlist) {
      writeCustomWatchlistStorage(updated);
    }
  };

  const handleSaveWatchlistMeta = (ticker: string, meta: WatchlistEntryMeta | null) => {
    saveWatchlistEntryMetaStorage(ticker, meta);
    if (meta && (meta.targetBuyPrice || meta.note) && !customWatchlist.includes(ticker)) {
      const updated = addTickerToWatchlist(customWatchlist, ticker);
      if (updated !== customWatchlist) {
        writeCustomWatchlistStorage(updated);
      }
    }
  };

  const activeAiContext: AiMarketContext = useMemo(() => {
    const curatedMeta = STOCKS_DATA.find((s) => s.ticker === selectedTicker) || null;
    const customMetrics =
      !curatedMeta && customAiMetrics?.ticker === selectedTicker ? customAiMetrics : null;
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
      curatedMeta && activeEps > 0
        ? Math.round(activeEps * curatedMeta.historicalPeMean)
        : customMetrics?.targetMeanPrice;
    const historicalPeMean =
      curatedMeta?.historicalPeMean ?? customMetrics?.historicalPeMean ?? 0;
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

    const curatedByTicker = new Map(STOCKS_DATA.map((s) => [s.ticker, s]));
    const customSet = new Set(customWatchlist);
    const peerTickers = Array.from(
      new Set([...customWatchlist, ...STOCKS_DATA.map((s) => s.ticker)])
    );

    const watchlistPeers = peerTickers
      .map((ticker) => {
        const s = curatedByTicker.get(ticker);
        const q = quotes[ticker];
        const peerLive = Boolean(provider === "yahoo" && q && !q.isFallback);
        const price = q?.price ?? s?.currentPrice ?? 0;
        if (price <= 0) return null;
        return {
          ticker,
          sector:
            s?.sector ||
            q?.sector ||
            (customAiMetrics?.ticker === ticker && customAiMetrics.sector) ||
            "Saham BEI",
          price,
          changePercent: q?.changePercent ?? s?.change1D ?? 0,
          peRatio: peerLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : s?.peRatio ?? 0,
          pbvRatio: peerLive && q?.pbvRatio && q.pbvRatio > 0 ? q.pbvRatio : s?.pbvRatio ?? 0,
          dividendYield:
            peerLive && q?.dividendYield !== undefined && q.dividendYield >= 0
              ? q.dividendYield
              : s?.dividendYield ?? 0,
          isLive: peerLive,
          isInCustomWatchlist: customSet.has(ticker),
          targetBuyPrice: watchlistNotes[ticker]?.targetBuyPrice,
          watchlistNote: watchlistNotes[ticker]?.note,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const articleContext =
      currentMode === "berita" && activeLiveNewsForAi
        ? buildLiveNewsArticleContext(activeLiveNewsForAi)
        : currentMode === "terminal" && originLiveNews
        ? buildLiveNewsArticleContext(originLiveNews)
        : undefined;

    const activeEntryMeta = watchlistNotes[selectedTicker];

    return {
      mode: currentMode,
      provider,
      customWatchlist,
      stock:
        currentMode === "terminal" && activePrice > 0
          ? {
              ticker: curatedMeta?.ticker || selectedTicker,
              name: curatedMeta?.name || activeQuote?.name || selectedTicker,
              sector:
                curatedMeta?.sector ||
                activeQuote?.sector ||
                customMetrics?.sector ||
                "Bursa Efek Indonesia",
              price: activePrice,
              changePercent: activeQuote?.changePercent ?? curatedMeta?.change1D ?? 0,
              peRatio: activePe,
              historicalPeMean,
              targetMeanPrice,
              pbvRatio: activePbv,
              dividendYield: activeDiv,
              roe: curatedMeta?.roe ?? activeQuote?.roe ?? customMetrics?.roe,
              der: curatedMeta?.der ?? activeQuote?.der ?? customMetrics?.der,
              isLive,
              isCurated: Boolean(curatedMeta),
              isInWatchlist: customSet.has(selectedTicker),
              targetBuyPrice: activeEntryMeta?.targetBuyPrice,
              watchlistNote: activeEntryMeta?.note,
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
    customWatchlist,
    watchlistNotes,
    customAiMetrics,
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
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("berita");
    params.delete("artikel");

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

    const query = params.toString();
    const targetUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(targetUrl, { scroll: false });
  };

  const handleModeChange = (mode: AppMode) => {
    if (mode === "terminal") {
      updateUrlParams({
        mode: "terminal",
        saham: selectedTicker,
      });
    } else {
      setOriginLiveNews(null);
      updateUrlParams({
        mode: "berita",
      });
    }
  };

  // Navigate from News ticker link to Terminal without altering custom watchlist unexpectedly
  const handleSelectStockFromNews = (
    ticker: string,
    _newsId: string,
    _newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => {
    setOriginLiveNews(liveItem || null);
    updateUrlParams({
      mode: "terminal",
      saham: ticker,
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

  const handleBackToLiveNews = () => {
    setOriginLiveNews(null);
    updateUrlParams({
      mode: "berita",
    });
  };

  const isLight = currentMode === "berita";

  const watchlistBuySummary = useMemo(() => {
    const curatedPrices = new Map(STOCKS_DATA.map((s) => [s.ticker, s.currentPrice]));
    const priceByTicker: Record<string, number> = {};
    for (const ticker of customWatchlist) {
      const q = quotes[ticker];
      if (q && q.price > 0) {
        priceByTicker[ticker] = q.price;
      } else if (provider !== "yahoo") {
        const curatedPrice = curatedPrices.get(ticker);
        if (curatedPrice && curatedPrice > 0) {
          priceByTicker[ticker] = curatedPrice;
        }
      }
    }
    return summarizeWatchlistBuySignals(customWatchlist, watchlistNotes, priceByTicker);
  }, [customWatchlist, watchlistNotes, quotes, provider]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-[colors,padding] duration-200 ${
        isLight
          ? "bg-[#FBFBFA] text-[#1D1F23]"
          : "bg-[#0C1017] text-slate-100"
      } ${isAiModalOpen ? "xl:pr-[440px]" : ""}`}
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
            <span className="w-1.5 h-1.5 rounded-full bg-[#2EB886] shrink-0"></span>
            <span className="truncate">
              Data Live Yahoo Finance &bull; Riset Pasar Modal BEI
            </span>
          </div>
        ) : (
          <span>Mode data ilustrasi (bukan harga pasar)</span>
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
        watchlistBuySummary={watchlistBuySummary}
        onSelectBuySignalTicker={handleSelectTicker}
      />

      {/* 4. Area Konten Utama */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {currentMode === "terminal" ? (
          /* TAMPILAN TERMINAL GELAP */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Kolom Kiri: Watchlist Terpisah & Penyaring */}
            <div id="terminal-watchlist-section" className="lg:col-span-5 xl:col-span-4 h-[550px] lg:h-[750px]">
              <TerminalWatchlist
                selectedTicker={selectedTicker}
                onSelectTicker={handleSelectTicker}
                quotes={quotes}
                provider={provider}
                customWatchlist={customWatchlist}
                watchlistNotes={watchlistNotes}
                onToggleWatchlist={handleToggleWatchlist}
                onAddToWatchlist={handleAddToWatchlist}
                maxWatchlistSize={MAX_CUSTOM_WATCHLIST}
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
                originLiveNews={originLiveNews}
                liveNewsItems={liveNews.items}
                onSelectTicker={handleSelectTicker}
                onBackToLiveNews={handleBackToLiveNews}
                onCloseOriginPanel={() => setOriginLiveNews(null)}
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
                onAskAiCompare={(tickers) => {
                  setActiveLiveNewsForAi(null);
                  runAiAnalysis(
                    `Bandingkan saham ${tickers.join(" vs ")} dari sisi valuasi P/E, PBV, Dividend Yield, ROE, DER, dan prospek risikonya.`
                  );
                }}
                onCustomAiMetrics={setCustomAiMetrics}
                isInWatchlist={customWatchlist.includes(selectedTicker)}
                isWatchlistFull={isWatchlistFull}
                onToggleWatchlist={handleToggleWatchlist}
                quote={quotes[selectedTicker]}
                allQuotes={quotes}
                customWatchlist={customWatchlist}
                watchlistNotes={watchlistNotes}
                onSaveWatchlistMeta={handleSaveWatchlistMeta}
                provider={provider}
                marketStatus={marketStatus}
              />
            </div>
          </div>
        ) : (
          /* TAMPILAN BERITA TERANG PENUH */
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
              watchlistTickers={customWatchlist}
              onOpenTerminalWatchlist={() => handleModeChange("terminal")}
              aiMarketBrief={liveNews.aiBrief}
              aiBriefNotice={liveNews.aiBriefNotice}
              isAiBriefLoading={liveNews.isAiBriefLoading}
              onRequestAiBrief={(items, tickers) => {
                void liveNews.requestAiBrief(items, tickers, aiCustomApiKey);
              }}
              onSelectStockFromNews={handleSelectStockFromNews}
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
            <span>Riset pasar modal dan simulasi emiten saham</span>
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
