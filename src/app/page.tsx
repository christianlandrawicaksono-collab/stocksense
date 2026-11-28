"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  Suspense,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Navbar, AppMode } from "@/components/layout/Navbar";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { TerminalWatchlist } from "@/components/terminal/TerminalWatchlist";
import { TerminalMainPane, type CustomStockAiMetrics } from "@/components/terminal/TerminalMainPane";
import { QuickResearchRail } from "@/components/terminal/QuickResearchRail";
import { LeftIntelligenceDock } from "@/components/terminal/LeftIntelligenceDock";
import { RightTradingDeskDock } from "@/components/terminal/RightTradingDeskDock";
import { UnifiedGlobalCommandDeck } from "@/components/terminal/UnifiedGlobalCommandDeck";
import { TerminalTopBar, type TerminalWorkspacePreset } from "@/components/terminal/TerminalTopBar";
import { TerminalBottomDock } from "@/components/terminal/TerminalBottomDock";
import { TerminalCommandSearch } from "@/components/terminal/TerminalCommandSearch";
import {
  EASE_TERMINAL,
  TerminalAmbientBackdrop,
  TerminalCursorField,
} from "@/components/terminal/terminalMotion";
import type { MarketHistoryPoint } from "@/lib/market-data";
import { NewsView } from "@/components/news/NewsView";
import { GeminiAiModal } from "@/components/ai/GeminiAiModal";
import { ArrowUp, Search } from "lucide-react";
import { useMarketData } from "@/hooks/useMarketData";
import { useGlobalMarkets } from "@/hooks/useGlobalMarkets";
import { useLiveNews } from "@/hooks/useLiveNews";
import { useAiChat } from "@/hooks/useAiChat";
import {
  GlobalMarketHubSnapshot,
  formatGlobalCurrency,
  formatGlobalIndexValue,
} from "@/lib/global-markets";
import { formatPersen, formatRupiah } from "@/lib/format";
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
  const rawView = searchParams.get("view");
  const currentMode: AppMode =
    rawMode === "terminal" || (!rawMode && !!rawSaham) ? "terminal" : "berita";
  const preferBeiOverviewTab = rawView === "pasar";
  const selectedTicker = rawSaham || "BBCA";

  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isGlobalDeckOpen, setIsGlobalDeckOpen] = useState<boolean>(true);
  const [isWatchlistCollapsed, setIsWatchlistCollapsed] = useState<boolean>(false);
  const [isQuickRailOpen, setIsQuickRailOpen] = useState<boolean>(true);
  const [isCommandSearchOpen, setIsCommandSearchOpen] = useState<boolean>(false);
  const [activeLiveNewsForAi, setActiveLiveNewsForAi] = useState<LiveMarketNewsItem | null>(null);
  const [allocationAiSummary, setAllocationAiSummary] = useState<string | null>(null);
  const [originLiveNews, setOriginLiveNews] = useState<LiveMarketNewsItem | null>(null);
  const [customAiMetrics, setCustomAiMetrics] = useState<CustomStockAiMetrics | null>(null);
  const [activeHistoryState, setActiveHistoryState] = useState<{
    ticker: string;
    points: MarketHistoryPoint[];
  }>({ ticker: "", points: [] });

  const handleActiveHistoryChange = useCallback(
    (ticker: string, points: MarketHistoryPoint[]) => {
      setActiveHistoryState({ ticker, points });
    },
    []
  );

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

  const globalMarkets = useGlobalMarkets(
    provider,
    currentMode === "terminal" && isGlobalDeckOpen
  );

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
      ...(allocationAiSummary ? { allocationSummary: allocationAiSummary } : {}),
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
    allocationAiSummary,
    customAiMetrics,
    originLiveNews,
    macroTickers,
    activeLiveNewsForAi,
  ]);

  const runAiAnalysis = (
    prompt: string,
    overrideArticle?: AiArticleContext,
    overrideAllocationSummary?: string
  ) => {
    setIsAiModalOpen(true);
    const ctx: AiMarketContext = {
      ...activeAiContext,
      ...(overrideArticle ? { article: overrideArticle } : {}),
      ...(overrideAllocationSummary ? { allocationSummary: overrideAllocationSummary } : {}),
    };
    void sendAiMessage(prompt, ctx);
  };

  // Helper to update URL params via Next.js router without full reload
  const updateUrlParams = (updates: {
    mode?: AppMode;
    saham?: string | null;
    view?: "riset" | "pasar" | null;
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
    if (updates.view !== undefined) {
      if (updates.view === "pasar") {
        params.set("view", "pasar");
      } else {
        params.delete("view");
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
        view: null,
      });
    }
  };

  const scrollToResearchWorkstation = useCallback(() => {
    document
      .getElementById("terminal-research-workstation")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToGlobalDeck = useCallback(() => {
    if (!isGlobalDeckOpen) {
      setIsGlobalDeckOpen(true);
      setTimeout(() => {
        document
          .getElementById("terminal-global-deck")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    } else {
      document
        .getElementById("terminal-global-deck")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isGlobalDeckOpen]);

  const handleAskAiGlobalHub = (hub: GlobalMarketHubSnapshot) => {
    setActiveLiveNewsForAi(null);
    setAllocationAiSummary(null);
    const stockSummary = hub.stocks
      .map(
        (s) =>
          `${s.displayTicker} (${s.name}) ${formatGlobalCurrency(s.price, s.currency)} (${formatPersen(
            s.changePercent,
            1,
            true
          )})`
      )
      .join(", ");
    const idxText = `${hub.primaryIndex.name} di ${formatGlobalIndexValue(
      hub.primaryIndex.value
    )} (${formatPersen(hub.primaryIndex.changePercent, 2, true)})`;
    const prompt =
      hub.id === "ID"
        ? `Analisis sentimen IHSG saat ini (${idxText}) dan saham penggerak utamanya (${stockSummary}). Apa strategi selektif yang masuk akal untuk investor BEI?`
        : `Pasar ${hub.countryName} (${hub.exchange}, status ${hub.session.statusLabel}) mencatat ${idxText} dengan saham unggulan: ${stockSummary}. Bedah dampak sentimen dan aliran dana asing (foreign flow) dari pergerakan ini terhadap IHSG dan sektor-sektor utama di BEI.`;
    runAiAnalysis(prompt);
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
      view: null,
    });
    setTimeout(() => {
      document
        .getElementById("terminal-research-workstation")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // Select stock with auto-scroll to chart on mobile layout
  const handleSelectTicker = (ticker: string) => {
    updateUrlParams({
      mode: "terminal",
      saham: ticker,
      view: null,
    });
    setTimeout(() => {
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        document.getElementById("terminal-chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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

  const quickRailStockMeta = useMemo(() => {
    const curated = STOCKS_DATA.find((s) => s.ticker === selectedTicker);
    const q = quotes[selectedTicker];
    const isLive = Boolean(provider === "yahoo" && q && !q.isFallback);
    const price = q && q.price > 0 ? q.price : provider !== "yahoo" ? curated?.currentPrice ?? 0 : 0;
    const changePercent = q?.changePercent ?? curated?.change1D ?? 0;
    const dividendYield =
      isLive && q?.dividendYield !== undefined && q.dividendYield >= 0
        ? q.dividendYield
        : curated?.dividendYield ?? 0;
    const companyName = q?.name || curated?.name || selectedTicker;
    const activeEps =
      isLive && q?.eps && q.eps > 0
        ? q.eps
        : curated
        ? curated.currentPrice / curated.peRatio
        : 0;
    const targetMeanPrice =
      curated && activeEps > 0
        ? Math.round(activeEps * curated.historicalPeMean)
        : customAiMetrics?.ticker === selectedTicker
        ? customAiMetrics.targetMeanPrice
        : undefined;
    return { price, changePercent, dividendYield, companyName, targetMeanPrice };
  }, [selectedTicker, quotes, provider, customAiMetrics]);

  const workspacePreset: TerminalWorkspacePreset = useMemo(() => {
    const isQuickVisible = isQuickRailOpen && !isAiModalOpen;
    if (isWatchlistCollapsed && !isQuickVisible) return "focus";
    if (!isWatchlistCollapsed && isQuickVisible) return "full";
    return "standard";
  }, [isWatchlistCollapsed, isQuickRailOpen, isAiModalOpen]);

  const handleSelectWorkspacePreset = useCallback((preset: TerminalWorkspacePreset) => {
    if (preset === "focus") {
      setIsWatchlistCollapsed(true);
      setIsQuickRailOpen(false);
    } else if (preset === "standard") {
      setIsWatchlistCollapsed(false);
      setIsQuickRailOpen(false);
    } else {
      setIsWatchlistCollapsed(false);
      setIsQuickRailOpen(true);
      setIsAiModalOpen(false);
    }
  }, []);

  // Pintasan keyboard Terminal Workstation (⌘K/Ctrl+K, S, G, [, ], F)
  useEffect(() => {
    if (currentMode !== "terminal") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setIsCommandSearchOpen((prev) => !prev);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || isCommandSearchOpen) return;

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase();
      if (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (key === "s") {
        event.preventDefault();
        setIsCommandSearchOpen(true);
      } else if (key === "g") {
        event.preventDefault();
        setIsGlobalDeckOpen((prev) => !prev);
      } else if (key === "[") {
        event.preventDefault();
        setIsWatchlistCollapsed((prev) => !prev);
      } else if (key === "]") {
        event.preventDefault();
        setIsQuickRailOpen((prev) => !prev);
      } else if (key === "f") {
        event.preventDefault();
        if (isWatchlistCollapsed && !isQuickRailOpen) {
          setIsWatchlistCollapsed(false);
          setIsQuickRailOpen(true);
        } else {
          setIsWatchlistCollapsed(true);
          setIsQuickRailOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMode, isCommandSearchOpen, isWatchlistCollapsed, isQuickRailOpen]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-[colors,padding] duration-200 ${
        isLight
          ? "bg-[#FBFBFA] text-[#1D1F23]"
          : "bg-[#080A0F] text-slate-100"
      } ${isAiModalOpen ? "xl:pr-[440px]" : ""}`}
    >
      {/* 1. Satu strip tipis disclaimer di bagian paling atas */}
      <div
        className={`relative z-10 px-4 py-1 text-center text-xs font-sans border-b select-none ${
          isLight
            ? "bg-[#F3F3ED] border-[#E5E5DC] text-[#6A7078]"
            : "bg-[#080A0F] border-white/[0.06] text-slate-400"
        }`}
      >
        {provider === "yahoo" ? (
          <div className="flex items-center justify-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0"></span>
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
        <div className="relative z-10">
          <MarketTicker
            provider={provider}
            tickers={macroTickers}
            isMacroFallback={isMacroFallback}
            isLoading={isLoading}
          />
        </div>
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
      <main
        className={`flex-1 w-full mx-auto ${
          currentMode === "terminal"
            ? "max-w-[1520px] px-2.5 sm:px-4 py-2.5"
            : "max-w-7xl px-4 sm:px-6 lg:px-8 py-4"
        }`}
      >
        {currentMode === "terminal" ? (
          /* TAMPILAN UNIFIED WORKSTATION TERMINAL (3D GLOBE + IKHTISAR + RISET SAHAM) */
          <MotionConfig reducedMotion="user">
            <TerminalAmbientBackdrop />
            <TerminalCursorField />
            <div className="relative z-10 flex flex-col gap-2">
              {/* Top Sub-Bar: Toggle Radar Global 3D (G) + Command Search (⌘K / S) + Workspace Layout Presets */}
              <TerminalTopBar
                isGlobalDeckOpen={isGlobalDeckOpen}
                onToggleGlobalDeck={() => setIsGlobalDeckOpen((prev) => !prev)}
                onJumpToResearch={scrollToResearchWorkstation}
                workspacePreset={workspacePreset}
                onSelectWorkspacePreset={handleSelectWorkspacePreset}
                onOpenCommandSearch={() => setIsCommandSearchOpen(true)}
                selectedTicker={selectedTicker}
                marketStatus={marketStatus}
              />

              {/* LAYER ATAS (COLLAPSIBLE): 3D WORLD GLOBE + IKHTISAR PASAR DENGAN SCROLL-LINKED PARALLAX */}
              <AnimatePresence initial={false}>
                {isGlobalDeckOpen && (
                  <motion.div
                    key="unified-global-deck"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25, ease: EASE_TERMINAL }}
                    className="relative z-10"
                  >
                    <UnifiedGlobalCommandDeck
                      hubs={globalMarkets.hubs}
                      isGlobalFallback={globalMarkets.isFallback}
                      isGlobalLoading={globalMarkets.isLoading}
                      onRefreshGlobal={globalMarkets.refresh}
                      provider={provider}
                      quotes={quotes}
                      macroTickers={macroTickers}
                      customWatchlist={customWatchlist}
                      watchlistNotes={watchlistNotes}
                      liveNewsItems={liveNews.items}
                      onSelectBeiStock={handleSelectTicker}
                      onAskAiGlobalHub={handleAskAiGlobalHub}
                      onJumpToResearch={scrollToResearchWorkstation}
                      onSwitchToNews={() => handleModeChange("berita")}
                      defaultRightTab={preferBeiOverviewTab ? "bei" : "country"}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* LAYER BAWAH (ELEVATED PARALLAX CURTAIN): CORE RESEARCH WORKSTATION BEI */}
              <section
                id="terminal-research-workstation"
                aria-label="Workstation Riset Saham BEI"
                className={`relative z-20 scroll-mt-14 transition-all ${
                  isGlobalDeckOpen
                    ? "-mt-1 pt-2.5 px-1.5 sm:px-2 pb-1 rounded-t-2xl bg-[#080A0F]/95 border-t border-[#2DD4BF]/25 shadow-[0_-22px_52px_rgba(0,0,0,0.75)]"
                    : ""
                }`}
              >
                {isGlobalDeckOpen && (
                  <div className="flex items-center justify-between gap-2 px-1 pb-2 text-[11px] font-sans">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                      <span className="font-semibold text-slate-200">
                        Workstation Riset Saham BEI
                      </span>
                      <span className="hidden sm:inline text-slate-500">
                        &bull; Watchlist, Grafik Interaktif, Valuasi P/E &amp; Kalkulator Lot
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={scrollToGlobalDeck}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0F131C] hover:bg-[#161C29] border border-white/[0.08] text-slate-300 hover:text-[#2DD4BF] transition text-[10.5px]"
                    >
                      <ArrowUp className="w-3 h-3" aria-hidden="true" />
                      <span>Ke Globe 3D</span>
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0 w-full flex flex-col lg:flex-row gap-1.5 items-start">
                  {/* Kolom Kiri: Watchlist + LeftIntelligenceDock (Snowflake, Teknikal, Pivot, ARA/ARB) */}
                  <div
                    id="terminal-watchlist-section"
                    className={`w-full shrink-0 flex flex-col gap-1.5 ${
                      isWatchlistCollapsed ? "lg:hidden" : "lg:w-[276px]"
                    }`}
                  >
                    <div className="w-full h-[480px] lg:h-[510px]">
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
                    <LeftIntelligenceDock
                      ticker={selectedTicker}
                      quote={quotes[selectedTicker]}
                      historyPoints={
                        activeHistoryState.ticker === selectedTicker
                          ? activeHistoryState.points
                          : []
                      }
                      targetBuyPrice={watchlistNotes[selectedTicker]?.targetBuyPrice}
                      onSetTargetBuyPrice={(t, price) => {
                        const existing = watchlistNotes[t];
                        handleSaveWatchlistMeta(t, {
                          ...(existing || {}),
                          targetBuyPrice: price,
                        });
                      }}
                    />
                  </div>

                  {/* Kolom Utama: Grafik + Health Ribbon + Panel Tab Analisis */}
                  <div id="terminal-chart-section" className="scroll-mt-16 flex-1 min-w-0 w-full min-h-[760px]">
                    {/* Tombol cepat ganti emiten di HP (langsung buka Command Search) */}
                    <div className="lg:hidden mb-1.5">
                      <button
                        type="button"
                        onClick={() => setIsCommandSearchOpen(true)}
                        className="w-full min-h-[42px] px-3 py-2 bg-[#0F131C] hover:bg-[#161C29] border border-white/[0.07] rounded-lg text-xs font-sans text-slate-300 hover:text-white flex items-center justify-between transition"
                      >
                        <div className="flex items-center space-x-2">
                          <Search className="w-3.5 h-3.5 text-[#2DD4BF]" />
                          <span className="text-slate-400">Saham aktif:</span>
                          <span className="font-mono text-white font-bold text-sm">{selectedTicker}</span>
                        </div>
                        <span className="text-[#2DD4BF] font-medium text-[11px]">
                          Cari &amp; ganti saham →
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
                        setAllocationAiSummary(null);
                        const p = quotes[t]?.price ?? STOCKS_DATA.find((s) => s.ticker === t)?.currentPrice ?? 0;
                        runAiAnalysis(`Evaluasi valuasi, kekuatan, dan risiko saham ${t} pada harga ${formatRupiah(p)}.`);
                      }}
                      onAskAiTerminalNews={(item) => {
                        setActiveLiveNewsForAi(null);
                        setAllocationAiSummary(null);
                        runAiAnalysis(
                          `Bedah dampak berita "${item.title}" terhadap prospek & valuasi saham ${selectedTicker}.`,
                          buildLiveNewsArticleContext(item)
                        );
                      }}
                      onAskAiCompare={(tickers) => {
                        setActiveLiveNewsForAi(null);
                        setAllocationAiSummary(null);
                        runAiAnalysis(
                          `Bandingkan saham ${tickers.join(" vs ")} dari sisi valuasi P/E, PBV, Dividend Yield, ROE, DER, dan prospek risikonya.`
                        );
                      }}
                      onAskAiAllocation={(summaryText) => {
                        setActiveLiveNewsForAi(null);
                        setAllocationAiSummary(summaryText);
                        runAiAnalysis(
                          "Evaluasi rencana alokasi portofolio Watchlist ini dari sisi keseimbangan sektor, valuasi P/E-PBV, potensi dividen, dan risiko konsentrasinya.",
                          undefined,
                          summaryText
                        );
                      }}
                      onCustomAiMetrics={setCustomAiMetrics}
                      onActiveHistoryChange={handleActiveHistoryChange}
                      isInWatchlist={customWatchlist.includes(selectedTicker)}
                      isWatchlistFull={isWatchlistFull}
                      onToggleWatchlist={handleToggleWatchlist}
                      quote={quotes[selectedTicker]}
                      allQuotes={quotes}
                      customWatchlist={customWatchlist}
                      watchlistNotes={watchlistNotes}
                      onSaveWatchlistMeta={handleSaveWatchlistMeta}
                      isQuickRailOpen={isQuickRailOpen && !isAiModalOpen}
                      onToggleQuickRail={() => setIsQuickRailOpen((o) => !o)}
                      provider={provider}
                      marketStatus={marketStatus}
                    />
                  </div>

                  {/* Kolom Kanan: Quick Research Rail + RightTradingDeskDock (Risk/Reward & Paper Trading) */}
                  {isQuickRailOpen && !isAiModalOpen && (
                    <div className="hidden xl:flex flex-col gap-1.5 w-[264px] shrink-0">
                      <QuickResearchRail
                        ticker={selectedTicker}
                        companyName={quickRailStockMeta.companyName}
                        currentPrice={quickRailStockMeta.price}
                        dividendYield={quickRailStockMeta.dividendYield}
                        fairValuePrice={quickRailStockMeta.targetMeanPrice}
                        targetBuyPrice={watchlistNotes[selectedTicker]?.targetBuyPrice}
                        note={watchlistNotes[selectedTicker]?.note}
                        isInWatchlist={customWatchlist.includes(selectedTicker)}
                        isWatchlistFull={isWatchlistFull}
                        watchlistBuySummary={watchlistBuySummary}
                        liveNewsItems={liveNews.items}
                        onToggleWatchlist={handleToggleWatchlist}
                        onSaveWatchlistMeta={handleSaveWatchlistMeta}
                        onSelectTicker={handleSelectTicker}
                        onAskAiStock={(t) => {
                          setActiveLiveNewsForAi(null);
                          setAllocationAiSummary(null);
                          const p =
                            quotes[t]?.price ?? STOCKS_DATA.find((s) => s.ticker === t)?.currentPrice ?? 0;
                          runAiAnalysis(
                            `Evaluasi valuasi, kekuatan, dan risiko saham ${t} pada harga ${formatRupiah(p)}.`
                          );
                        }}
                        onClose={() => setIsQuickRailOpen(false)}
                      />
                      <RightTradingDeskDock
                        ticker={selectedTicker}
                        currentPrice={quickRailStockMeta.price}
                        fairValuePrice={quickRailStockMeta.targetMeanPrice}
                        quotes={quotes}
                        onSelectTicker={handleSelectTicker}
                      />
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Persistent Bottom Utility Dock ala Rax Trade */}
            <TerminalBottomDock
              selectedTicker={selectedTicker}
              activePrice={quickRailStockMeta.price}
              changePercent={quickRailStockMeta.changePercent}
              provider={provider}
              isGlobalDeckOpen={isGlobalDeckOpen}
              isWatchlistVisible={!isWatchlistCollapsed}
              isQuickRailVisible={isQuickRailOpen && !isAiModalOpen}
              isAiModalOpen={isAiModalOpen}
              watchlistCount={customWatchlist.length}
              actionableSignalCount={watchlistBuySummary.totalActionable}
              onToggleGlobalDeck={() => setIsGlobalDeckOpen((prev) => !prev)}
              onToggleWatchlistPane={() => setIsWatchlistCollapsed((prev) => !prev)}
              onToggleQuickRail={() => {
                if (isAiModalOpen) {
                  setIsAiModalOpen(false);
                  setIsQuickRailOpen(true);
                } else {
                  setIsQuickRailOpen((prev) => !prev);
                }
              }}
              onToggleAiModal={() => setIsAiModalOpen((prev) => !prev)}
              onOpenCommandSearch={() => setIsCommandSearchOpen(true)}
            />

            {/* Global Command-Palette Stock Search (⌘K / S) */}
            <TerminalCommandSearch
              isOpen={isCommandSearchOpen}
              onClose={() => setIsCommandSearchOpen(false)}
              selectedTicker={selectedTicker}
              onSelectTicker={handleSelectTicker}
              quotes={quotes}
              provider={provider}
              customWatchlist={customWatchlist}
              isWatchlistFull={isWatchlistFull}
              onToggleWatchlist={handleToggleWatchlist}
            />
          </MotionConfig>
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
                setAllocationAiSummary(null);
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
        className={`relative z-10 border-t py-4 text-xs font-sans transition-colors ${
          isLight
            ? "border-[#E5E5DC] bg-[#F3F3ED] text-[#6A7078]"
            : "border-white/[0.07] bg-[#080A0F] text-slate-400 pb-14"
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
        <div className="min-h-screen flex items-center justify-center bg-[#080A0F] text-slate-400 text-xs">
          Memuat StocksSense...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
