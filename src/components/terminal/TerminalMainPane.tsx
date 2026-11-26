"use client";

import React, { useState, useMemo, useEffect, useCallback, useSyncExternalStore } from "react";
import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import {
  getChartPrefsServerSnapshot,
  parseChartPreferencesJson,
  readChartPrefsStorageSnapshot,
  resolveEffectiveTimeframe,
  subscribeChartPrefsStorage,
  updateChartPreferencesStorage,
} from "@/lib/chart-prefs";
import {
  formatNumber,
  formatDesimal,
  formatMultiple,
  formatNewsCategoryLabel,
  formatPersen,
  formatRupiah,
  parseFormattedNumber,
} from "@/lib/format";
import {
  aggregateHistoryToQuarterly,
  mapIllustrativeToDcaPoints,
  runQuarterlyDcaSimulation,
} from "@/lib/dca-simulator";
import { filterNewsByTicker } from "@/lib/news-brief";
import { computeHistoricalPeBands } from "@/lib/valuation-bands";
import {
  Layers,
  Calculator,
  Info,
  ArrowLeft,
  X,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Newspaper,
  Loader2,
  Star,
  Target,
  GitCompareArrows,
  StickyNote,
} from "lucide-react";
import { LightweightPriceChart } from "./LightweightPriceChart";
import { StockCompareTab } from "./StockCompareTab";
import {
  evaluateTargetBuyStatus,
  MAX_WATCHLIST_NOTE_LENGTH,
  type WatchlistEntryMeta,
} from "@/lib/watchlist";
import type { ComparableStockMetrics } from "@/lib/compare";
import {
  getHistory,
  getIllustrativeHistoryPoints,
  getLiveMarketNews,
  getStockProfile,
  MarketHistoryPoint,
  MarketQuote,
  MarketProvider,
  StockProfileData,
} from "@/lib/market-data";
import { MarketStatus } from "@/lib/market-hours";
import type { LiveMarketNewsItem, SentimentType } from "@/types/market";

export interface CustomStockAiMetrics {
  ticker: string;
  sector?: string;
  roe?: number;
  der?: number;
  historicalPeMean?: number;
  targetMeanPrice?: number;
}

interface TerminalMainPaneProps {
  selectedTicker: string;
  originLiveNews?: LiveMarketNewsItem | null;
  liveNewsItems?: LiveMarketNewsItem[];
  onSelectTicker?: (ticker: string) => void;
  onBackToLiveNews?: () => void;
  onCloseOriginPanel?: () => void;
  onAskAiStock?: (ticker: string) => void;
  onAskAiTerminalNews?: (item: LiveMarketNewsItem) => void;
  onAskAiCompare?: (tickers: string[]) => void;
  onCustomAiMetrics?: (metrics: CustomStockAiMetrics | null) => void;
  isInWatchlist?: boolean;
  isWatchlistFull?: boolean;
  onToggleWatchlist?: (ticker: string) => void;
  quote?: MarketQuote;
  allQuotes?: Record<string, MarketQuote>;
  customWatchlist?: string[];
  watchlistNotes?: Record<string, WatchlistEntryMeta>;
  onSaveWatchlistMeta?: (ticker: string, meta: WatchlistEntryMeta | null) => void;
  provider?: MarketProvider;
  marketStatus?: MarketStatus;
}

type TerminalTab = "valuation" | "simulator" | "fundamental" | "news" | "compare";

function renderDarkSentimentBadge(sentiment: SentimentType) {
  switch (sentiment) {
    case "BULLISH":
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#2EB886]/15 text-[#2EB886] border border-[#2EB886]/30 text-[10px] font-medium">
          Positif
        </span>
      );
    case "BEARISH":
      return (
        <span className="px-1.5 py-0.5 rounded bg-[#DC525F]/15 text-[#DC525F] border border-[#DC525F]/30 text-[10px] font-medium">
          Negatif
        </span>
      );
    case "NEUTRAL":
    default:
      return (
        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-medium">
          Netral
        </span>
      );
  }
}

export const TerminalMainPane: React.FC<TerminalMainPaneProps> = ({
  selectedTicker,
  originLiveNews = null,
  liveNewsItems = [],
  onSelectTicker,
  onBackToLiveNews,
  onCloseOriginPanel,
  onAskAiStock,
  onAskAiTerminalNews,
  onAskAiCompare,
  onCustomAiMetrics,
  isInWatchlist = false,
  isWatchlistFull = false,
  onToggleWatchlist,
  quote,
  allQuotes,
  customWatchlist = [],
  watchlistNotes = {},
  onSaveWatchlistMeta,
  provider = "illustrative",
  marketStatus,
}) => {
  const [activeTab, setActiveTab] = useState<TerminalTab>("valuation");
  const chartPrefsJson = useSyncExternalStore(
    subscribeChartPrefsStorage,
    readChartPrefsStorageSnapshot,
    getChartPrefsServerSnapshot
  );
  const chartPrefs = useMemo(
    () => parseChartPreferencesJson(chartPrefsJson),
    [chartPrefsJson]
  );
  const chartTf = resolveEffectiveTimeframe(chartPrefs, provider);

  const [historyPoints, setHistoryPoints] = useState<MarketHistoryPoint[]>(() =>
    provider === "yahoo" ? [] : getIllustrativeHistoryPoints(selectedTicker, chartTf)
  );
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(provider === "yahoo");
  const [isHistoryFallback, setIsHistoryFallback] = useState<boolean>(provider === "illustrative");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  const handleRetry = useCallback(() => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    setRetryTrigger((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getHistory(selectedTicker, chartTf)
      .then((res) => {
        if (!cancelled) {
          if (provider === "yahoo") {
            // Jika mode Yahoo aktif: JANGAN PERNAH mencampur data ilustrasi di bawah harga live!
            if (res.points.length === 0 || res.isFallback) {
              setHistoryPoints([]);
              setHistoryError("Riwayat harga tidak tersedia saat ini dari penyedia data.");
            } else {
              setHistoryPoints(res.points);
              setHistoryError(null);
            }
          } else {
            // Mode illustrative
            setHistoryPoints(res.points.length > 0 ? res.points : getIllustrativeHistoryPoints(selectedTicker, chartTf));
            setHistoryError(null);
          }
          setIsHistoryFallback(res.isFallback);
          setIsHistoryLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[TerminalMainPane] getHistory failed:", err);
          if (provider === "yahoo") {
            setHistoryPoints([]);
            setHistoryError("Koneksi ke penyedia data gagal. Silakan coba lagi.");
          } else {
            setHistoryPoints(getIllustrativeHistoryPoints(selectedTicker, chartTf));
          }
          setIsHistoryFallback(true);
          setIsHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker, chartTf, provider, retryTrigger]);

  const activeLiveOrigin = originLiveNews;

  const otherSupportedTickers = useMemo(() => {
    const supported = new Set(["ADRO", "ANTM", "ASII", "BBCA", "BBRI", "BMRI", "ICBP", "MEDC", "TLKM"]);
    const rawTickers = activeLiveOrigin ? activeLiveOrigin.tickers : [];
    const tickers = rawTickers.filter((t) => {
      if (t === selectedTicker) return false;
      return provider === "yahoo" ? /^[A-Z]{4}$/.test(t) : supported.has(t);
    });
    return Array.from(new Set(tickers));
  }, [activeLiveOrigin, selectedTicker, provider]);

  // DCA Simulator inputs (Quarterly frequency)
  const [quarterlyDCA, setQuarterlyDCA] = useState<number>(3000000); // Rp 3.000.000/kuartal (~1jt/bln)
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [simStartYear, setSimStartYear] = useState<string>("2020");
  const [reinvestDividends, setReinvestDividends] = useState<boolean>(true);
  const [simSourcePref, setSimSourcePref] = useState<"auto" | "illustrative">("auto");
  const [simRetryCount, setSimRetryCount] = useState<number>(0);
  const [simYahooData, setSimYahooData] = useState<{
    ticker: string;
    stockPoints: MarketHistoryPoint[];
    ihsgPoints: MarketHistoryPoint[];
    error: string | null;
  }>({
    ticker: "",
    stockPoints: [],
    ihsgPoints: [],
    error: null,
  });

  // Raw string states for inputs with thousand separators
  const [dcaInputStr, setDcaInputStr] = useState<string>("3.000.000");
  const [lumpSumInputStr, setLumpSumInputStr] = useState<string>("0");

  const useYahooSimulator = provider === "yahoo" && simSourcePref === "auto";
  const isSimLoading =
    useYahooSimulator &&
    activeTab === "simulator" &&
    simYahooData.ticker !== selectedTicker &&
    simYahooData.error === null;

  const handleSimRetry = useCallback(() => {
    setSimYahooData({
      ticker: "",
      stockPoints: [],
      ihsgPoints: [],
      error: null,
    });
    setSimRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!useYahooSimulator || activeTab !== "simulator") return;
    if (simYahooData.ticker === selectedTicker && !simYahooData.error) return;

    let cancelled = false;
    const stockFullPromise: Promise<{ points: MarketHistoryPoint[]; isFallback: boolean }> =
      chartTf === "Semua" && historyPoints.length > 0 && !isHistoryFallback && !historyError
        ? Promise.resolve({
            points: historyPoints,
            isFallback: false,
          })
        : getHistory(selectedTicker, "Semua");

    Promise.all([stockFullPromise, getHistory("IHSG", "Semua")])
      .then(([stockRes, ihsgRes]) => {
        if (cancelled) return;
        if (
          stockRes.points.length === 0 ||
          stockRes.isFallback ||
          ihsgRes.points.length === 0 ||
          ihsgRes.isFallback
        ) {
          setSimYahooData({
            ticker: selectedTicker,
            stockPoints: [],
            ihsgPoints: [],
            error: "Riwayat historis saham atau acuan IHSG tidak tersedia saat ini dari Yahoo Finance.",
          });
        } else {
          setSimYahooData({
            ticker: selectedTicker,
            stockPoints: stockRes.points,
            ihsgPoints: ihsgRes.points,
            error: null,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[TerminalMainPane] Simulator history fetch failed:", err);
        setSimYahooData({
          ticker: selectedTicker,
          stockPoints: [],
          ihsgPoints: [],
          error: "Gagal memuat data historis simulasi dari penyedia data.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    useYahooSimulator,
    activeTab,
    selectedTicker,
    simRetryCount,
    chartTf,
    historyPoints,
    isHistoryFallback,
    historyError,
    simYahooData.ticker,
    simYahooData.error,
  ]);

  const curatedStock = useMemo(() => {
    return STOCKS_DATA.find((s) => s.ticker === selectedTicker) || null;
  }, [selectedTicker]);

  const [customAnalysisState, setCustomAnalysisState] = useState<{
    ticker: string;
    profile: StockProfileData | null;
    bandPoints: MarketHistoryPoint[];
  }>({ ticker: "", profile: null, bandPoints: [] });

  useEffect(() => {
    if (curatedStock || provider !== "yahoo") return;
    let cancelled = false;

    Promise.allSettled([
      getStockProfile(selectedTicker),
      getHistory(selectedTicker, "5Th"),
    ]).then(([profileRes, histRes]) => {
      if (cancelled) return;
      const profile = profileRes.status === "fulfilled" ? profileRes.value : null;
      const bandPoints =
        histRes.status === "fulfilled" && !histRes.value.isFallback
          ? histRes.value.points
          : [];

      setCustomAnalysisState({
        ticker: selectedTicker,
        profile,
        bandPoints,
      });

      const resolvedEps =
        (quote?.eps && quote.eps > 0 ? quote.eps : undefined) ??
        (profile?.eps && profile.eps > 0 ? profile.eps : undefined) ??
        0;
      const bands = computeHistoricalPeBands(bandPoints, resolvedEps);

      onCustomAiMetrics?.({
        ticker: selectedTicker,
        sector: profile?.sector,
        roe: profile?.roe,
        der: profile?.der,
        historicalPeMean: bands?.historicalPeMean,
        targetMeanPrice: bands?.targetMeanPrice,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [curatedStock, provider, selectedTicker, quote?.eps, onCustomAiMetrics]);

  const customProfile =
    !curatedStock && customAnalysisState.ticker === selectedTicker
      ? customAnalysisState.profile
      : null;

  const customBandPoints = useMemo(
    () =>
      !curatedStock && customAnalysisState.ticker === selectedTicker
        ? customAnalysisState.bandPoints
        : [],
    [curatedStock, customAnalysisState, selectedTicker]
  );

  const hasCuratedBands = Boolean(curatedStock);

  const stock = useMemo(() => {
    if (curatedStock) {
      return curatedStock;
    }
    return {
      ticker: selectedTicker,
      name: customProfile?.name || quote?.name || `${selectedTicker} Tbk`,
      sector: customProfile?.sector || "Bursa Efek Indonesia",
      subsector: customProfile?.subsector || "Saham Tercatat BEI",
      currentPrice: customProfile?.currentPrice ?? quote?.price ?? 0,
      change1D: customProfile?.changePercent ?? quote?.changePercent ?? 0,
      marketCapTrillion: customProfile?.marketCapTrillion ?? quote?.marketCapTrillion ?? 0,
      peRatio: customProfile?.peRatio ?? quote?.peRatio ?? 0,
      historicalPeMean: 0,
      peSd1Plus: 0,
      peSd1Minus: 0,
      peSd2Plus: 0,
      peSd2Minus: 0,
      pbvRatio: customProfile?.pbvRatio ?? quote?.pbvRatio ?? 0,
      historicalPbvMean: 0,
      roe: customProfile?.roe,
      der: customProfile?.der,
      dividendYield: customProfile?.dividendYield ?? quote?.dividendYield ?? 0,
      payoutRatio: undefined as number | undefined,
      description:
        customProfile?.description ||
        `Emiten ${selectedTicker}.JK yang diperdagangkan di Bursa Efek Indonesia melalui Yahoo Finance.`,
      strengths: [] as string[],
      risks: [] as string[],
    };
  }, [curatedStock, customProfile, quote, selectedTicker]);

  // P/E Band and Fair Value Calculations (Live Yahoo apabila tersedia, fallback ke acuan ilustrasi)
  const isLiveValuation = Boolean(
    provider === "yahoo" && ((quote && !quote.isFallback) || customProfile?.isLive)
  );
  const activePrice =
    (quote?.price && quote.price > 0 ? quote.price : undefined) ??
    (customProfile?.currentPrice && customProfile.currentPrice > 0
      ? customProfile.currentPrice
      : undefined) ??
    stock.currentPrice;

  const fallbackEps =
    curatedStock && curatedStock.peRatio > 0
      ? curatedStock.currentPrice / curatedStock.peRatio
      : 0;
  const activeEps =
    (isLiveValuation && quote?.eps && quote.eps > 0 ? quote.eps : undefined) ??
    (customProfile?.eps && customProfile.eps > 0 ? customProfile.eps : undefined) ??
    fallbackEps;

  const fallbackBvps =
    curatedStock && curatedStock.pbvRatio > 0
      ? curatedStock.currentPrice / curatedStock.pbvRatio
      : 0;
  const activeBvps =
    (isLiveValuation && quote?.bvps && quote.bvps > 0 ? quote.bvps : undefined) ??
    (customProfile?.bvps && customProfile.bvps > 0 ? customProfile.bvps : undefined) ??
    fallbackBvps;

  const activePe =
    (isLiveValuation && quote?.peRatio && quote.peRatio > 0 ? quote.peRatio : undefined) ??
    (customProfile?.peRatio && customProfile.peRatio > 0 ? customProfile.peRatio : undefined) ??
    (activeEps > 0 && activePrice > 0 ? activePrice / activeEps : stock.peRatio);

  const activePbv =
    (isLiveValuation && quote?.pbvRatio && quote.pbvRatio > 0 ? quote.pbvRatio : undefined) ??
    (customProfile?.pbvRatio && customProfile.pbvRatio > 0 ? customProfile.pbvRatio : undefined) ??
    (activeBvps > 0 && activePrice > 0 ? activePrice / activeBvps : stock.pbvRatio);

  const activeDivYield =
    (isLiveValuation && quote?.dividendYield !== undefined && quote.dividendYield >= 0
      ? quote.dividendYield
      : undefined) ??
    (customProfile?.dividendYield !== undefined ? customProfile.dividendYield : undefined) ??
    stock.dividendYield;

  const dynamicPeBands = useMemo(() => {
    if (curatedStock) return null;
    return computeHistoricalPeBands(customBandPoints, activeEps);
  }, [curatedStock, customBandPoints, activeEps]);

  const effectiveBands = useMemo(() => {
    if (curatedStock && curatedStock.historicalPeMean > 0 && activeEps > 0) {
      return {
        kind: "curated" as const,
        historicalPeMean: curatedStock.historicalPeMean,
        peSd1Plus: curatedStock.peSd1Plus,
        peSd1Minus: curatedStock.peSd1Minus,
        peSd2Plus: curatedStock.peSd2Plus,
        peSd2Minus: curatedStock.peSd2Minus,
        targetMeanPrice: Math.round(activeEps * curatedStock.historicalPeMean),
        targetSd1PlusPrice: Math.round(activeEps * curatedStock.peSd1Plus),
        targetSd1MinusPrice: Math.round(activeEps * curatedStock.peSd1Minus),
        targetSd2PlusPrice: Math.round(activeEps * curatedStock.peSd2Plus),
        targetSd2MinusPrice: Math.round(activeEps * curatedStock.peSd2Minus),
        sampleCount: 0,
      };
    }
    if (!curatedStock && dynamicPeBands) {
      return {
        kind: "dynamic" as const,
        ...dynamicPeBands,
      };
    }
    return null;
  }, [curatedStock, activeEps, dynamicPeBands]);

  const targetMeanPrice = effectiveBands?.targetMeanPrice ?? 0;
  const targetSd1MinusPrice = effectiveBands?.targetSd1MinusPrice ?? 0;
  const targetSd2MinusPrice = effectiveBands?.targetSd2MinusPrice ?? 0;
  const targetSd1PlusPrice = effectiveBands?.targetSd1PlusPrice ?? 0;
  const targetSd2PlusPrice = effectiveBands?.targetSd2PlusPrice ?? 0;

  const grahamNumber =
    activeEps > 0 && activeBvps > 0
      ? Math.round(Math.sqrt(22.5 * activeEps * activeBvps))
      : 0;
  const grahamUpside =
    grahamNumber > 0 && activePrice > 0
      ? ((grahamNumber - activePrice) / activePrice) * 100
      : 0;
  const meanUpside =
    effectiveBands && targetMeanPrice > 0 && activePrice > 0
      ? ((targetMeanPrice - activePrice) / activePrice) * 100
      : 0;

  const activeEntryMeta = watchlistNotes[selectedTicker];
  const targetBuyEval = evaluateTargetBuyStatus(activePrice, activeEntryMeta?.targetBuyPrice);

  const [targetEditorState, setTargetEditorState] = useState<{
    isOpen: boolean;
    ticker: string;
    priceStr: string;
    noteStr: string;
  }>({ isOpen: false, ticker: "", priceStr: "", noteStr: "" });

  const isTargetEditorOpen =
    targetEditorState.isOpen && targetEditorState.ticker === selectedTicker;

  const handleToggleTargetEditor = () => {
    if (isTargetEditorOpen) {
      setTargetEditorState((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    setTargetEditorState({
      isOpen: true,
      ticker: selectedTicker,
      priceStr: activeEntryMeta?.targetBuyPrice
        ? formatNumber(activeEntryMeta.targetBuyPrice)
        : "",
      noteStr: activeEntryMeta?.note || "",
    });
  };

  const handleTargetPriceInput = (rawVal: string) => {
    const parsed = parseFormattedNumber(rawVal);
    setTargetEditorState((prev) => ({
      ...prev,
      priceStr: parsed > 0 ? formatNumber(parsed) : "",
    }));
  };

  const handleSaveTargetEditor = () => {
    const parsedPrice = parseFormattedNumber(targetEditorState.priceStr);
    const cleanedNote = targetEditorState.noteStr.trim().slice(0, MAX_WATCHLIST_NOTE_LENGTH);
    if (parsedPrice <= 0 && !cleanedNote) {
      onSaveWatchlistMeta?.(selectedTicker, null);
    } else {
      onSaveWatchlistMeta?.(selectedTicker, {
        ...(parsedPrice > 0 ? { targetBuyPrice: parsedPrice } : {}),
        ...(cleanedNote ? { note: cleanedNote } : {}),
      });
    }
    setTargetEditorState((prev) => ({ ...prev, isOpen: false }));
  };

  const primaryComparableMetrics: ComparableStockMetrics = useMemo(
    () => ({
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      price: activePrice,
      changePercent: quote?.changePercent ?? stock.change1D,
      peRatio: activePe,
      pbvRatio: activePbv,
      dividendYield: activeDivYield,
      roe: stock.roe,
      der: stock.der,
      marketCapTrillion: quote?.marketCapTrillion ?? stock.marketCapTrillion,
      targetBuyPrice: activeEntryMeta?.targetBuyPrice,
      isLive: isLiveValuation,
    }),
    [
      stock,
      activePrice,
      quote,
      activePe,
      activePbv,
      activeDivYield,
      activeEntryMeta?.targetBuyPrice,
      isLiveValuation,
    ]
  );

  // Valuation Diagnosis: Computed dynamically from active P/E position vs curated or 5Y estimated bands
  const valuationDiagnosis = useMemo(() => {
    if (!effectiveBands || activePe <= 0) {
      return {
        label: activePe > 0 ? `P/E Live ${formatMultiple(activePe, 1)}` : "Emiten Kustom BEI",
        color: "text-[#2DD4BF] bg-[#115E59]/40 border-[#14B8A6]/60 font-medium",
        verdict: activePe > 0
          ? `Emiten kustom ${stock.ticker} diperdagangkan pada rasio P/E TTM ${formatMultiple(activePe, 1)} dan PBV ${activePbv > 0 ? formatMultiple(activePbv, 2) : "-"} (Yahoo Finance). Data riwayat 5 tahun atau EPS belum cukup untuk membentuk pita deviasi.`
          : `Data rasio P/E untuk emiten kustom ${stock.ticker} tidak tersedia atau negatif pada periode TTM terakhir.`,
      };
    }

    const pe = activePe;
    const mean = effectiveBands.historicalPeMean;
    const sd1Minus = effectiveBands.peSd1Minus;
    const sd2Minus = effectiveBands.peSd2Minus;
    const sd1Plus = effectiveBands.peSd1Plus;
    const priceSourceLabel = isLiveValuation ? "harga Yahoo Finance" : "harga acuan ilustrasi";
    const bandLabel =
      effectiveBands.kind === "dynamic" ? "estimasi rerata 5Th" : "rerata historis";

    const diffPercent = ((pe - mean) / mean) * 100;
    const absDiff = Math.abs(diffPercent);

    if (pe <= sd2Minus) {
      return {
        label: "Diskon ekstrim (di bawah -2 SD)",
        color: "text-[#34D399] bg-[#064E3B] border-[#059669] font-medium",
        verdict: `Rasio P/E pada ${priceSourceLabel} (${formatMultiple(pe, 1)} pada ${formatRupiah(activePrice)}) berada di bawah batas -2 SD (${formatMultiple(sd2Minus, 1)}), ${formatPersen(absDiff, 1)} di bawah ${bandLabel} (${formatMultiple(mean, 1)}). Area deviasi terendah secara komparatif.`
      };
    } else if (pe <= sd1Minus) {
      return {
        label: "Undervalued (antara -2 SD dan -1 SD)",
        color: "text-[#34D399] bg-[#064E3B] border-[#059669] font-medium",
        verdict: `Rasio P/E pada ${priceSourceLabel} (${formatMultiple(pe, 1)} pada ${formatRupiah(activePrice)}) berada pada rentang deviasi rendah (${formatMultiple(sd2Minus, 1)} – ${formatMultiple(sd1Minus, 1)}), ${formatPersen(absDiff, 1)} di bawah ${bandLabel} (${formatMultiple(mean, 1)}).`
      };
    } else if (pe <= mean) {
      return {
        label: "Valuasi wajar (antara -1 SD dan rerata)",
        color: "text-[#2DD4BF] bg-[#115E59]/50 border-[#14B8A6] font-medium",
        verdict: `Rasio P/E pada ${priceSourceLabel} (${formatMultiple(pe, 1)} pada ${formatRupiah(activePrice)}) berada mendekati ${bandLabel} (${formatMultiple(mean, 1)}), ${formatPersen(absDiff, 1)} di bawah titik tengah.`
      };
    } else if (pe <= sd1Plus) {
      return {
        label: "Cukup premium (antara rerata dan +1 SD)",
        color: "text-[#FDE047] bg-[#78350F] border-[#D97706] font-medium",
        verdict: `Rasio P/E pada ${priceSourceLabel} (${formatMultiple(pe, 1)} pada ${formatRupiah(activePrice)}) berada ${formatPersen(absDiff, 1)} di atas ${bandLabel} (${formatMultiple(mean, 1)}), berada di bawah batas atas +1 SD (${formatMultiple(sd1Plus, 1)}).`
      };
    } else {
      return {
        label: "Overvalued (di atas +1 SD)",
        color: "text-[#F87171] bg-[#7F1D1D] border-[#DC2626] font-medium",
        verdict: `Rasio P/E pada ${priceSourceLabel} (${formatMultiple(pe, 1)} pada ${formatRupiah(activePrice)}) melampaui batas deviasi atas +1 SD (${formatMultiple(sd1Plus, 1)}), ${formatPersen(absDiff, 1)} di atas ${bandLabel} (${formatMultiple(mean, 1)}).`
      };
    }
  }, [effectiveBands, stock.ticker, activePe, activePbv, activePrice, isLiveValuation]);

  // Handle Money Inputs with Thousand Separator
  const handleDcaChange = (valStr: string) => {
    const num = parseFormattedNumber(valStr);
    setQuarterlyDCA(num);
    setDcaInputStr(formatNumber(num));
  };

  const handleLumpSumChange = (valStr: string) => {
    const num = parseFormattedNumber(valStr);
    setInitialCapital(num);
    setLumpSumInputStr(formatNumber(num));
  };

  // DCA Simulation Logic based on active source (Yahoo Finance weekly→quarterly or Illustrative 29-point quarterly)
  const yahooAvailableStartYears = useMemo(() => {
    if (!useYahooSimulator || simYahooData.stockPoints.length === 0) return [];
    const firstYear = parseInt(simYahooData.stockPoints[0].time.slice(0, 4), 10) || 2020;
    const candidates = [2015, 2018, 2020, 2021, 2022, 2023, 2024, 2025];
    return candidates.filter((y) => y >= firstYear).map(String);
  }, [useYahooSimulator, simYahooData.stockPoints]);

  const simYearOptions =
    useYahooSimulator && yahooAvailableStartYears.length > 0
      ? yahooAvailableStartYears
      : ["2020", "2021", "2022", "2023", "2024", "2025"];
  const effectiveSimStartYear = simYearOptions.includes(simStartYear)
    ? simStartYear
    : simYearOptions.includes("2020")
    ? "2020"
    : simYearOptions[0] || "2020";

  const simulationResults = useMemo(() => {
    if (useYahooSimulator) {
      if (simYahooData.ticker !== selectedTicker || simYahooData.error || simYahooData.stockPoints.length === 0) {
        return null;
      }
      const stockQ = aggregateHistoryToQuarterly(simYahooData.stockPoints);
      const ihsgQ = aggregateHistoryToQuarterly(simYahooData.ihsgPoints);
      return runQuarterlyDcaSimulation({
        stockSeries: stockQ,
        ihsgSeries: ihsgQ,
        startYear: parseInt(effectiveSimStartYear, 10) || 2020,
        quarterlyDCA,
        initialCapital,
        reinvestDividends,
      });
    }

    const stockQ = mapIllustrativeToDcaPoints(HISTORICAL_SERIES[selectedTicker] || []);
    const ihsgQ = mapIllustrativeToDcaPoints(IHSG_HISTORICAL);
    return runQuarterlyDcaSimulation({
      stockSeries: stockQ,
      ihsgSeries: ihsgQ,
      startYear: parseInt(effectiveSimStartYear, 10) || 2020,
      quarterlyDCA,
      initialCapital,
      reinvestDividends,
    });
  }, [
    useYahooSimulator,
    simYahooData,
    selectedTicker,
    quarterlyDCA,
    initialCapital,
    effectiveSimStartYear,
    reinvestDividends,
  ]);

  const activeOriginBanner = activeLiveOrigin
    ? {
        label: "Berita pasar asal:",
        title: activeLiveOrigin.title,
        meta: `${activeLiveOrigin.publisher}${activeLiveOrigin.publishedWib ? ` • ${activeLiveOrigin.publishedWib}` : ""}`,
        externalLink: activeLiveOrigin.link,
        onBack: onBackToLiveNews,
      }
    : null;

  // Tab Berita Terkait Emiten (menggunakan feed live bersama + fallback query per ticker)
  const stockCompanyName = useMemo(() => {
    const curated = STOCKS_DATA.find((s) => s.ticker === selectedTicker);
    return curated?.name || quote?.name || "";
  }, [selectedTicker, quote?.name]);

  const matchedGeneralLiveNews = useMemo(() => {
    if (provider !== "yahoo") return [];
    return filterNewsByTicker(liveNewsItems, selectedTicker, stockCompanyName);
  }, [provider, liveNewsItems, selectedTicker, stockCompanyName]);

  const [tickerNewsState, setTickerNewsState] = useState<{
    ticker: string;
    items: LiveMarketNewsItem[];
  }>({ ticker: "", items: [] });

  const needsTickerNewsFetch =
    provider === "yahoo" &&
    activeTab === "news" &&
    matchedGeneralLiveNews.length < 2 &&
    tickerNewsState.ticker !== selectedTicker;

  useEffect(() => {
    if (!needsTickerNewsFetch) return;
    let cancelled = false;
    getLiveMarketNews(selectedTicker)
      .then((res) => {
        if (!cancelled) {
          setTickerNewsState({ ticker: selectedTicker, items: res.items });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTickerNewsState({ ticker: selectedTicker, items: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [needsTickerNewsFetch, selectedTicker]);

  const handleRefreshTickerNews = useCallback(() => {
    setTickerNewsState({ ticker: "", items: [] });
  }, []);

  const combinedTickerLiveNews = useMemo(() => {
    if (provider !== "yahoo") return [];
    const extra = tickerNewsState.ticker === selectedTicker ? tickerNewsState.items : [];
    const merged = [...matchedGeneralLiveNews, ...extra];
    merged.sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
    const deduped: LiveMarketNewsItem[] = [];
    const seen = new Set<string>();
    for (const item of merged) {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 42);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }, [provider, matchedGeneralLiveNews, tickerNewsState, selectedTicker]);

  const relatedNewsBadgeCount =
    provider === "yahoo" ? combinedTickerLiveNews.length : 0;

  const isMissingYahooTicker = Boolean(
    provider === "yahoo" &&
      !hasCuratedBands &&
      !isHistoryLoading &&
      (!quote || quote.isFallback || quote.price <= 0) &&
      activePrice <= 0 &&
      Boolean(historyError)
  );

  const effectiveHistoryError = isMissingYahooTicker
    ? `Kode "${selectedTicker}" tidak ditemukan di Bursa Efek Indonesia / Yahoo Finance.`
    : historyError;

  return (
    <div className="flex flex-col space-y-4 font-sans">
      {/* Origin News Banner (if navigated from curated scenario or live RSS news) */}
      {activeOriginBanner && (
        <div className="bg-[#0E1622] border border-[#1E7B85]/60 rounded-xl p-3 sm:p-3.5 space-y-2.5 text-xs text-slate-200 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 space-y-0.5 overflow-hidden">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-[#2DD4BF] font-semibold whitespace-nowrap shrink-0">
                  {activeOriginBanner.label}
                </span>
                <span className="truncate italic text-slate-300 block">
                  &ldquo;{activeOriginBanner.title}&rdquo;
                </span>
              </div>
              {(activeOriginBanner.meta || activeOriginBanner.externalLink) && (
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                  {activeOriginBanner.meta && <span>{activeOriginBanner.meta}</span>}
                  {activeOriginBanner.externalLink && (
                    <a
                      href={activeOriginBanner.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-[#2DD4BF] hover:underline"
                    >
                      <span>Sumber asli</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 shrink-0 self-stretch sm:self-auto justify-end">
              {activeOriginBanner.onBack && (
                <button
                  type="button"
                  onClick={activeOriginBanner.onBack}
                  className="min-h-[44px] flex-1 sm:flex-initial px-3.5 py-2 bg-[#1E7B85] hover:bg-[#1E7B85]/80 text-white rounded-lg text-xs font-semibold transition inline-flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Kembali ke Berita</span>
                </button>
              )}
              {onCloseOriginPanel && (
                <button
                  type="button"
                  onClick={onCloseOriginPanel}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-lg transition border border-[#1E2736] sm:border-transparent"
                  title="Tutup panel berita asal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Emiten lain di berita ini */}
          {otherSupportedTickers.length > 0 && onSelectTicker && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[#1C2738] text-[11px]">
              <span className="text-slate-400">Emiten lain di berita ini:</span>
              <div className="flex flex-wrap items-center gap-1.5 font-mono tnum">
                {otherSupportedTickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSelectTicker(t)}
                    className="min-h-[36px] px-2.5 py-1 rounded bg-[#172332] hover:bg-[#1E7B85] text-slate-200 hover:text-white border border-[#25354A] hover:border-[#1E7B85] transition inline-flex items-center"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. TOP SECTION: PRICE CHART DENGAN LIGHTWEIGHT-CHARTS & STATUS PASAR */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
        {/* Header Bar: Baris 1 (Identitas & Harga) + Baris 2 (Aksi & Status Pasar) */}
        <div className="p-4 border-b border-[#1E2736] bg-[#0E131C] space-y-3">
          {/* Baris 1: Identitas Emiten (Kiri) & Harga Terkini (Kanan) */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xl font-bold text-white tnum">
                  {stock.ticker}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-sans bg-[#1E7B85]/20 text-slate-200 border border-[#1E7B85]/40">
                  {stock.sector}
                </span>
              </div>
              <span className="text-xs text-slate-400 block mt-0.5 font-sans">
                {isMissingYahooTicker
                  ? "Emiten tidak terdaftar di BEI / Yahoo Finance"
                  : stock.name}
              </span>
            </div>

            <div className="sm:text-right shrink-0">
              {activePrice > 0 ? (
                <div className="flex items-baseline sm:justify-end space-x-2">
                  <span className="text-xl sm:text-2xl font-bold text-slate-100 font-mono tnum">
                    {formatRupiah(quote?.price ?? stock.currentPrice)}
                  </span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded font-mono tnum ${
                      (quote?.changePercent ?? stock.change1D) >= 0
                        ? "text-[#2EB886] bg-[#2EB886]/10"
                        : "text-[#DC525F] bg-[#DC525F]/10"
                    }`}
                  >
                    {formatPersen(quote?.changePercent ?? stock.change1D, 1, true)}
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline sm:justify-end space-x-2">
                  <span className="text-xl font-bold text-slate-400 font-mono tnum">-</span>
                </div>
              )}
              <span className="text-[11px] text-slate-400 font-sans block mt-0.5">
                {provider === "yahoo" && quote && !quote.isFallback && quote.price > 0
                  ? "Harga terakhir Yahoo Finance"
                  : provider === "yahoo"
                  ? "Data harga tidak tersedia"
                  : "Harga acuan data ilustrasi"}
                {(provider === "yahoo" && !quote?.isFallback ? quote?.lastUpdated : null) ||
                marketStatus?.formattedTime
                  ? ` • ${(provider === "yahoo" && !quote?.isFallback ? quote?.lastUpdated : null) || marketStatus?.formattedTime}`
                  : ""}
              </span>
            </div>
          </div>

          {/* Baris 2: Tombol Aksi Saham & Status Bursa */}
          <div className="pt-2.5 border-t border-[#1A2230] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {onToggleWatchlist && (
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(selectedTicker)}
                  disabled={!isInWatchlist && isWatchlistFull}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-sans border transition disabled:opacity-50 ${
                    isInWatchlist
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                      : "bg-[#171F2C] border-[#25354A] text-slate-300 hover:text-amber-300 hover:border-amber-500/40"
                  }`}
                  title={
                    isInWatchlist
                      ? `Hapus ${selectedTicker} dari Watchlist Saya`
                      : isWatchlistFull
                      ? "Watchlist Saya penuh (maks. 15 saham)"
                      : `Simpan ${selectedTicker} ke Watchlist Saya`
                  }
                >
                  <Star className={`w-3 h-3 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`} />
                  <span>{isInWatchlist ? "Di Watchlist" : "+ Watchlist"}</span>
                </button>
              )}
              {onSaveWatchlistMeta && (
                <button
                  type="button"
                  onClick={handleToggleTargetEditor}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-sans border transition ${
                    targetBuyEval.status === "hit"
                      ? "bg-[#2EB886]/20 border-[#2EB886]/50 text-[#2EB886]"
                      : targetBuyEval.status === "near"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : activeEntryMeta?.targetBuyPrice || activeEntryMeta?.note || isTargetEditorOpen
                      ? "bg-[#1E7B85]/20 border-[#1E7B85]/50 text-[#2DD4BF]"
                      : "bg-[#171F2C] border-[#25354A] text-slate-300 hover:text-[#2DD4BF] hover:border-[#1E7B85]/50"
                  }`}
                  title="Atur target harga beli & catatan pribadi untuk saham ini"
                >
                  <Target className="w-3 h-3" />
                  <span>
                    {activeEntryMeta?.targetBuyPrice
                      ? targetBuyEval.status === "hit"
                        ? `Area Beli ≤${formatNumber(activeEntryMeta.targetBuyPrice)}`
                        : `Target ${formatNumber(activeEntryMeta.targetBuyPrice)}`
                      : activeEntryMeta?.note
                      ? "Catatan"
                      : "Target Beli"}
                  </span>
                </button>
              )}
              {onAskAiStock && (
                <button
                  type="button"
                  onClick={() => onAskAiStock(selectedTicker)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-sans bg-[#1E7B85]/15 hover:bg-[#1E7B85]/30 text-[#2DD4BF] border border-[#1E7B85]/40 transition"
                  title={`Analisis AI kontekstual untuk ${selectedTicker}`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Tanya AI</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <div
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans border ${
                  marketStatus?.isOpen
                    ? "bg-[#2EB886]/10 border-[#2EB886]/30 text-[#2EB886]"
                    : "bg-[#1E2736]/60 border-[#283548] text-slate-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    marketStatus?.isOpen ? "bg-[#2EB886] animate-pulse" : "bg-slate-500"
                  }`}
                />
                <span className="font-medium">
                  {marketStatus?.isOpen ? "Pasar Buka" : "Pasar Tutup"}
                </span>
                <span className="text-[11px] text-slate-400 hidden md:inline">
                  &bull; {marketStatus?.isOpen ? marketStatus?.sessionText : `Di luar jam bursa (${marketStatus?.dateWib || ''})`}
                </span>
              </div>

              {provider === "yahoo" && !quote?.isFallback && (
                <span className="hidden xl:inline text-[11px] text-slate-400">
                  &bull; Tertunda ~10 menit
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Inline Editor & Preview Target Harga Beli / Catatan Pribadi */}
        {isTargetEditorOpen ? (
          <div className="px-4 py-3 border-b border-[#1E2736] bg-[#0B1018] flex flex-col lg:flex-row lg:items-end gap-2.5 text-xs">
            <div className="w-full lg:w-48">
              <label className="text-[11px] text-slate-400 block mb-1">
                Target Harga Beli (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                  Rp
                </span>
                <input
                  type="text"
                  value={targetEditorState.priceStr}
                  onChange={(e) => handleTargetPriceInput(e.target.value)}
                  placeholder="cth. 8.500"
                  className="w-full pl-8 pr-2.5 py-1.5 bg-[#111622] border border-[#20293A] rounded-lg text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                />
              </div>
            </div>

            <div className="flex-1">
              <label className="text-[11px] text-slate-400 block mb-1">
                Catatan Riset Pribadi (maks. {MAX_WATCHLIST_NOTE_LENGTH} karakter)
              </label>
              <input
                type="text"
                maxLength={MAX_WATCHLIST_NOTE_LENGTH}
                value={targetEditorState.noteStr}
                onChange={(e) =>
                  setTargetEditorState((prev) => ({ ...prev, noteStr: e.target.value }))
                }
                placeholder="cth. Akumulasi bertahap jika koreksi ke area -1 SD..."
                className="w-full px-3 py-1.5 bg-[#111622] border border-[#20293A] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#1E7B85]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveTargetEditor}
                className="px-3 py-1.5 rounded-lg bg-[#1E7B85] hover:bg-[#1E7B85]/85 text-white font-medium transition"
              >
                Simpan Target
              </button>
              {(activeEntryMeta?.targetBuyPrice || activeEntryMeta?.note) && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveWatchlistMeta?.(selectedTicker, null);
                    setTargetEditorState((prev) => ({ ...prev, isOpen: false }));
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#171F2C] hover:bg-red-950/50 text-slate-300 hover:text-red-300 border border-[#232F42] transition"
                >
                  Hapus
                </button>
              )}
              <button
                type="button"
                onClick={() => setTargetEditorState((prev) => ({ ...prev, isOpen: false }))}
                className="px-2.5 py-1.5 rounded-lg bg-[#111622] hover:bg-[#171F2C] text-slate-400 hover:text-slate-200 border border-[#20293A] transition"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          activeEntryMeta?.note && (
            <div className="px-4 py-1.5 border-b border-[#1E2736] bg-[#0B1018] flex items-center justify-between gap-2 text-[11px] text-slate-300">
              <div className="flex items-center space-x-2 min-w-0">
                <StickyNote className="w-3 h-3 text-[#2DD4BF] shrink-0" />
                <span className="truncate">
                  <strong className="text-slate-400 font-normal">Catatan: </strong>
                  {activeEntryMeta.note}
                </span>
              </div>
              {onSaveWatchlistMeta && (
                <button
                  type="button"
                  onClick={handleToggleTargetEditor}
                  className="text-[#2DD4BF] hover:underline shrink-0"
                >
                  Ubah
                </button>
              )}
            </div>
          )
        )}

        {/* Kanvas Grafik Lightweight Charts */}
        <LightweightPriceChart
          ticker={selectedTicker}
          points={historyPoints}
          timeframe={chartTf}
          onTimeframeChange={(tf) => updateChartPreferencesStorage({ timeframe: tf })}
          provider={provider}
          isFallback={isHistoryFallback}
          isLoading={isHistoryLoading}
          currentPrice={quote?.price ?? stock.currentPrice}
          changePercent={quote?.changePercent ?? stock.change1D}
          lastUpdated={quote?.lastUpdated || marketStatus?.formattedTime}
          fairValuePrice={targetMeanPrice}
          targetBuyPrice={activeEntryMeta?.targetBuyPrice}
          error={effectiveHistoryError}
          onRetry={handleRetry}
        />
      </div>

      {/* 2. BOTTOM SECTION: TABBED MULTI-PANEL (VALUATION, SIMULATOR, FUNDAMENTAL) */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex-1 flex flex-col">
        {/* Navigation Tabs Header (Ringkas agar muat tanpa scroll di desktop) */}
        <div className="flex items-center overflow-x-auto terminal-scroll border-b border-[#1E2736] bg-[#0E131C] px-3">
          <button
            type="button"
            onClick={() => setActiveTab("valuation")}
            title="Valuasi dan P/E Band"
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-sans font-medium transition border-b-2 whitespace-nowrap ${
              activeTab === "valuation"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="sm:hidden">Valuasi</span>
            <span className="hidden sm:inline">Valuasi &amp; P/E</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            title="Simulasi Strategi DCA"
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-sans font-medium transition border-b-2 whitespace-nowrap ${
              activeTab === "simulator"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="sm:hidden">Simulasi</span>
            <span className="hidden sm:inline">Simulasi DCA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fundamental")}
            title="Profil Fundamental"
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-sans font-medium transition border-b-2 whitespace-nowrap ${
              activeTab === "fundamental"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            title="Berita Terkait Emiten"
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-sans font-medium transition border-b-2 whitespace-nowrap ${
              activeTab === "news"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span>Berita</span>
            {relatedNewsBadgeCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#1E7B85]/25 text-[#2DD4BF] font-mono text-[10px] tnum">
                {relatedNewsBadgeCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("compare")}
            title="Bandingkan Saham Head-to-Head"
            className={`flex items-center space-x-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-sans font-medium transition border-b-2 whitespace-nowrap ${
              activeTab === "compare"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitCompareArrows className="w-3.5 h-3.5" />
            <span>Bandingkan</span>
          </button>
        </div>

        {/* TAB 1: VALUASI & P/E BAND */}
        {activeTab === "valuation" && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Notice data valuasi */}
            <div className="bg-[#0C1017] border border-[#1E2736] rounded-lg p-2.5 flex items-start space-x-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 text-[#1E7B85] shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-300 font-medium">Catatan data valuasi: </span>
                {isLiveValuation
                  ? `Diagnosis P/E, Graham Number, dan persentase "Potensi" dihitung dari harga live Yahoo Finance (${formatRupiah(activePrice)}) serta EPS TTM (${formatRupiah(activeEps)}) terhadap pita deviasi P/E historis acuan.`
                  : `Pita deviasi P/E dan diagnosis Benjamin Graham dihitung dari harga acuan ilustrasi (${formatRupiah(activePrice)}) dan EPS acuan (${formatRupiah(activeEps)}). Seluruh persentase "Potensi" dihitung terhadap harga acuan tersebut.`}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2736]">
              <div>
                <span className="text-xs text-slate-400 block font-sans">
                  {isLiveValuation
                    ? `Diagnosis valuasi P/E pada harga live Yahoo (${formatRupiah(activePrice)})`
                    : `Diagnosis valuasi P/E pada harga acuan ilustrasi (${formatRupiah(activePrice)})`}
                </span>
                <span className="text-sm font-semibold text-slate-100 mt-0.5 block font-sans">
                  {valuationDiagnosis.verdict}
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-sans shadow-sm self-start sm:self-center ${valuationDiagnosis.color}`}>
                {valuationDiagnosis.label}
              </div>
            </div>

            {/* P/E Deviation Band Table (Kurasi atau Estimasi 5Th Otomatis) + Fair Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left */}
              {effectiveBands ? (
                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736] space-y-2 text-xs">
                  <span className="text-xs text-slate-400 block mb-1">
                    {effectiveBands.kind === "dynamic"
                      ? `Pita estimasi P/E 5Th (EPS TTM: ${formatRupiah(activeEps)}, ${effectiveBands.sampleCount} mgg)`
                      : `Pita deviasi P/E (berdasarkan EPS ${isLiveValuation ? "TTM Yahoo" : "acuan"}: ${formatRupiah(activeEps)})`}
                  </span>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>+2 SD (Mahal ekstrim - {formatMultiple(effectiveBands.peSd2Plus, 1)})</span>
                    <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd2PlusPrice)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>+1 SD (Di atas rerata - {formatMultiple(effectiveBands.peSd1Plus, 1)})</span>
                    <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd1PlusPrice)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#1E7B85]/30 bg-[#1E7B85]/10 px-1 rounded text-slate-100 font-medium">
                    <span>Mean (Harga wajar acuan - {formatMultiple(effectiveBands.historicalPeMean, 1)})</span>
                    <span className="font-mono tnum">{formatRupiah(targetMeanPrice)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>-1 SD (Area undervalued - {formatMultiple(effectiveBands.peSd1Minus, 1)})</span>
                    <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd1MinusPrice)}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-400">
                    <span>-2 SD (Diskon ekstrim - {formatMultiple(effectiveBands.peSd2Minus, 1)})</span>
                    <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd2MinusPrice)}</span>
                  </div>
                  {effectiveBands.kind === "dynamic" && (
                    <div className="pt-2 mt-1 border-t border-slate-900 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono tnum">
                      <span>BVPS: {activeBvps > 0 ? formatRupiah(activeBvps) : "-"}</span>
                      <span>PBV: {activePbv > 0 ? formatMultiple(activePbv, 2) : "-"}</span>
                      <span>Div: {activeDivYield > 0 ? formatPersen(activeDivYield, 1) : "-"}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736] space-y-2 text-xs">
                  <span className="text-xs text-slate-400 block mb-1">
                    Metrik valuasi langsung (Yahoo Finance — Emiten Kustom)
                  </span>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>EPS TTM</span>
                    <span className="text-slate-200 font-mono tnum">{activeEps > 0 ? formatRupiah(activeEps) : "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>BVPS (Nilai Buku / Saham)</span>
                    <span className="text-slate-200 font-mono tnum">{activeBvps > 0 ? formatRupiah(activeBvps) : "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>P/E Ratio (TTM)</span>
                    <span className="text-slate-200 font-mono tnum">{activePe > 0 ? formatMultiple(activePe, 1) : "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                    <span>PBV Ratio</span>
                    <span className="text-slate-200 font-mono tnum">{activePbv > 0 ? formatMultiple(activePbv, 2) : "-"}</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-400">
                    <span>Dividend Yield</span>
                    <span className="text-slate-200 font-mono tnum">{activeDivYield > 0 ? formatPersen(activeDivYield, 1) : "-"}</span>
                  </div>
                </div>
              )}

              {/* Right: Fair Value Target Cards */}
              <div className="space-y-3">
                {effectiveBands && (
                  <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                    <span className="text-xs text-slate-400 block mb-0.5">
                      {effectiveBands.kind === "dynamic"
                        ? "Target harga wajar (estimasi 5Th):"
                        : "Target harga wajar (mean acuan):"}
                    </span>
                    <span className="text-lg font-bold font-mono text-slate-100 tnum">
                      {formatRupiah(targetMeanPrice)}
                    </span>
                    <span className={`text-xs block mt-0.5 font-mono tnum ${meanUpside >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}`}>
                      Potensi: {formatPersen(meanUpside, 1, true)}{" "}
                      <span className="text-[10px] text-slate-400 font-sans block">
                        {isLiveValuation
                          ? `(vs harga live ${formatRupiah(activePrice)})`
                          : `(vs harga acuan ${formatRupiah(activePrice)}, bukan harga live)`}
                      </span>
                    </span>
                  </div>
                )}

                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs text-slate-400 block mb-0.5">
                    Nilai intrinsik Benjamin Graham:
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    {grahamNumber > 0 ? formatRupiah(grahamNumber) : "Tidak tersedia"}
                  </span>
                  {grahamNumber > 0 && (
                    <span className={`text-xs block mt-0.5 font-mono tnum ${grahamUpside >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}`}>
                      Potensi: {formatPersen(grahamUpside, 1, true)}{" "}
                      <span className="text-[10px] text-slate-400 font-sans block">
                        {isLiveValuation
                          ? `(vs harga live ${formatRupiah(activePrice)}${quote?.financialCurrency && quote.financialCurrency !== "IDR" ? `; BVPS dikonversi ${quote.financialCurrency}→IDR` : ""})`
                          : `(vs harga acuan ${formatRupiah(activePrice)}, bukan harga live)`}
                      </span>
                    </span>
                  )}
                  <span className="text-xs text-slate-400 block mt-2 font-sans leading-normal">
                    Catatan: Kurang relevan untuk perbankan dan saham pertumbuhan.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SIMULASI STRATEGI DCA */}
        {activeTab === "simulator" && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Notice & Pilihan Sumber Data Simulasi */}
            <div className="bg-[#0C1017] border border-[#1E2736] rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-start space-x-2">
                <Info className="w-3.5 h-3.5 text-[#1E7B85] shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-300 font-medium">Catatan data simulasi: </span>
                  {useYahooSimulator
                    ? "Backtest kuartalan (DCA & Lump-Sum) dihitung dari riwayat harga penutupan dan dividen Yahoo Finance (sudah disesuaikan stock split) dengan acuan IHSG (^JKSE)."
                    : "Simulasi strategi investasi kuartalan (DCA & Lump-Sum 2020–2026) dihitung dari dataset historis kuartalan ilustrasi."}
                </div>
              </div>

              {provider === "yahoo" && (
                <div className="flex items-center bg-[#080B10] p-0.5 rounded border border-[#1E2736] shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setSimSourcePref("auto")}
                    className={`px-2 py-1 rounded text-[11px] font-sans transition ${
                      simSourcePref === "auto"
                        ? "bg-[#1E7B85] text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Yahoo Nyata
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimSourcePref("illustrative")}
                    className={`px-2 py-1 rounded text-[11px] font-sans transition ${
                      simSourcePref === "illustrative"
                        ? "bg-[#1E7B85] text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Ilustrasi
                  </button>
                </div>
              )}
            </div>

            {/* Input Controls with Thousand Separators */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-[#0C1017] rounded-xl border border-[#1E2736] text-xs">
              <div>
                <label className="text-slate-400 block mb-1">
                  Investasi per kuartal (3 bulan):
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">Rp</span>
                  <input
                    type="text"
                    value={dcaInputStr}
                    onChange={(e) => handleDcaChange(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-[#111622] border border-[#20293A] rounded text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Setara {formatRupiah(Math.round(quarterlyDCA / 3))}/bulan
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Modal awal / lump-sum:
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">Rp</span>
                  <input
                    type="text"
                    value={lumpSumInputStr}
                    onChange={(e) => handleLumpSumChange(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-[#111622] border border-[#20293A] rounded text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Tahun mulai simulasi:
                </label>
                <select
                  value={effectiveSimStartYear}
                  onChange={(e) => setSimStartYear(e.target.value)}
                  className="w-full bg-[#111622] border border-[#20293A] rounded px-2.5 py-1.5 text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                >
                  {simYearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Explicit DRIP Toggle Button */}
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => setReinvestDividends(!reinvestDividends)}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-sans transition flex items-center justify-between border ${
                    reinvestDividends
                      ? "bg-[#1E7B85]/20 text-white border-[#1E7B85]"
                      : "bg-[#111622] text-slate-400 border-[#20293A]"
                  }`}
                >
                  <span className="truncate">Reinvestasi dividen:</span>
                  <span
                    className={`ml-1.5 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                      reinvestDividends
                        ? "bg-[#1E7B85] text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {reinvestDividends ? "Ya" : "Tidak"}
                  </span>
                </button>
              </div>
            </div>

            {/* SINGLE UNIFIED SUMMARY BLOCK (Key-Value List) */}
            {useYahooSimulator && isSimLoading ? (
              <div className="p-6 text-center text-xs text-slate-300 bg-[#0C1017] rounded-xl border border-[#1E2736] animate-pulse">
                Mengambil riwayat historis {selectedTicker} dan acuan IHSG (^JKSE) dari Yahoo Finance...
              </div>
            ) : useYahooSimulator && simYahooData.error ? (
              <div className="p-5 text-center text-xs bg-[#0C1017] rounded-xl border border-[#1E2736] space-y-3">
                <p className="text-amber-300 font-medium">{simYahooData.error}</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimRetry}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#1E2736] hover:bg-[#2A374A] border border-[#2E3B52] text-slate-200 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#1E7B85]" />
                    <span>Coba Lagi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimSourcePref("illustrative")}
                    className="inline-flex items-center px-3 py-1.5 rounded bg-[#0E131C] hover:bg-[#171F2C] border border-[#1E2736] text-slate-300 transition"
                  >
                    Pakai Skenario Ilustrasi
                  </button>
                </div>
              </div>
            ) : simulationResults ? (
              <div className="bg-[#0C1017] rounded-xl border border-[#1E2736] overflow-hidden">
                <div className="p-3 bg-[#0E131C] border-b border-[#1E2736] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-200">
                    Hasil kalkulasi simulasi DCA ({useYahooSimulator ? "Yahoo Finance" : "data ilustrasi"}: {simulationResults.startLabel} – {simulationResults.endLabel}, {simulationResults.totalQuarters} kuartal)
                  </span>
                  <span className="text-slate-400 font-mono tnum">
                    Durasi: {formatDesimal(simulationResults.years, 1)} tahun
                  </span>
                </div>

                <div className="divide-y divide-[#171F2C] text-xs">
                  {/* Total modal disetor */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Total modal disetor:</span>
                    <span className="text-slate-100 font-mono tnum font-medium">
                      {formatRupiah(simulationResults.totalInvested)}
                    </span>
                  </div>

                  {/* Nilai portofolio akhir */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Nilai portofolio akhir:</span>
                    <span className="text-slate-100 font-mono tnum font-semibold">
                      {formatRupiah(simulationResults.finalValue)}
                    </span>
                  </div>

                  {/* Laba / rugi bersih */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Hasil keuntungan bersih:</span>
                    <div className="text-right">
                      <span
                        className={`font-mono tnum font-semibold ${
                          simulationResults.netProfit >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                        }`}
                      >
                        {simulationResults.netProfit >= 0 ? "+" : ""}
                        {formatRupiah(simulationResults.netProfit)}
                      </span>
                      <span
                        className={`ml-2 text-[11px] font-mono tnum ${
                          simulationResults.totalReturnPercent >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                        }`}
                      >
                        ({formatPersen(simulationResults.totalReturnPercent, 1, true)})
                      </span>
                    </div>
                  </div>

                  {/* Money-Weighted Rate of Return (IRR) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 gap-1">
                    <div>
                      <span className="text-slate-400 block">Laju imbal hasil tahunan (IRR - Money-Weighted):</span>
                      <span className="text-[10px] text-slate-500 block">
                        Memperhitungkan waktu tiap setoran berkala (DCA), bukan modal awal sekaligus.
                      </span>
                    </div>
                    <span className="text-slate-200 font-mono tnum font-semibold self-end sm:self-center">
                      {simulationResults.irr !== null
                        ? `${formatPersen(simulationResults.irr, 1, true)} / tahun`
                        : simulationResults.simpleAnnualReturn !== null
                        ? `${formatPersen(simulationResults.simpleAnnualReturn, 1, true)} / tahun (sederhana)`
                        : "Periode < 1 tahun"}
                    </span>
                  </div>

                  {/* Total dividen masuk */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Akumulasi dividen yang diterima:</span>
                    <span className="text-slate-200 font-mono tnum">
                      {formatRupiah(simulationResults.totalDividendsReceived)}
                    </span>
                  </div>

                  {/* Max Drawdown */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 gap-1">
                    <div>
                      <span className="text-slate-400 block">Penurunan terbesar dari puncak (drawdown):</span>
                      <span className="text-[10px] text-slate-500 block">
                        Dihitung dari nilai portofolio yang bertambah seiring setoran modal berkala.
                      </span>
                    </div>
                    <span className="text-slate-200 font-mono tnum self-end sm:self-center">
                      -{formatDesimal(simulationResults.maxDrawdown, 2)}%
                    </span>
                  </div>

                  {/* Alpha vs IHSG */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 gap-1">
                    <div>
                      <span className="text-slate-400 block">Selisih imbal hasil vs acuan IHSG (Alpha):</span>
                      <span className="text-[10px] text-slate-500 block">
                        {reinvestDividends
                          ? "Saham memperhitungkan reinvestasi dividen (total return), sedangkan IHSG adalah indeks harga tanpa dividen."
                          : "Saham dihitung tanpa dividen vs IHSG sebagai indeks harga murni."}
                      </span>
                    </div>
                    <span
                      className={`font-mono tnum font-semibold self-end sm:self-center ${
                        simulationResults.alphaVsIhsg >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                      }`}
                    >
                      {formatDesimal(simulationResults.alphaVsIhsg, 2, true)} poin persentase{" "}
                      <span className="font-sans font-normal text-xs text-slate-400">
                        ({simulationResults.alphaVsIhsg >= 0 ? "mengungguli simulasi IHSG" : "di bawah simulasi IHSG"})
                      </span>
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0A0D14] border-t border-[#1E2736] text-[11px] text-slate-400">
                  {useYahooSimulator
                    ? `Perhitungan berbasis ${simulationResults.totalQuarters + 1} titik kuartalan yang diagregasikan dari data mingguan Yahoo Finance (sudah disesuaikan stock split) dan dibandingkan dengan IHSG (^JKSE).`
                    : "Perhitungan berbasis 29 titik kuartalan data ilustrasi. Setiap siklus mewakili penutupan 1 kuartal (3 bulan). Angka IRR dan Alpha merupakan hasil kalkulasi simulasi atas data ilustrasi ini."}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                Data tidak mencukupi untuk tahun mulai yang dipilih.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROFIL FUNDAMENTAL */}
        {activeTab === "fundamental" && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Notice data profil */}
            <div className="bg-[#0C1017] border border-[#1E2736] rounded-lg p-2.5 flex items-start space-x-2 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5 text-[#1E7B85] shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-300 font-medium">Catatan data profil: </span>
                {!hasCuratedBands
                  ? "Emiten kustom bursa: ringkasan bisnis, PBV, ROE, DER (bila tersedia), dan Dividend Yield diambil dari profil Yahoo Finance."
                  : isLiveValuation
                  ? "PBV Ratio & Dividend Yield diperbarui dari Yahoo Finance, sedangkan profil bisnis, kekuatan, risiko, ROE, DER, dan Payout Ratio menggunakan ringkasan acuan riset ilustrasi."
                  : "Profil bisnis, keunggulan kompetitif, dan rasio fundamental menggunakan data analitis ilustrasi (ringkasan contoh riset, belum diverifikasi bursa)."}
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {stock.description}
            </p>

            {/* Metrics Key-Value Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">ROE {hasCuratedBands && isLiveValuation ? "(ilus)" : !hasCuratedBands ? "(TTM)" : ""}</span>
                <span className="font-mono tnum text-slate-100 font-semibold">
                  {stock.roe !== undefined ? formatPersen(stock.roe, 1) : "-"}
                </span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">PBV Ratio {isLiveValuation && activePbv > 0 ? "(Live)" : ""}</span>
                <span className="font-mono tnum text-slate-100 font-semibold">
                  {activePbv > 0 ? formatMultiple(activePbv, 2) : "-"}
                </span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">DER {hasCuratedBands && isLiveValuation ? "(ilus)" : !hasCuratedBands ? "(Yahoo)" : "(Utang)"}</span>
                <span className="font-mono tnum text-slate-100 font-semibold">
                  {stock.der !== undefined ? formatMultiple(stock.der, 2) : "-"}
                </span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">Dividend Yield {isLiveValuation && activeDivYield > 0 ? "(Live)" : ""}</span>
                <span className="font-mono tnum text-slate-100 font-semibold">
                  {activeDivYield > 0 ? formatPersen(activeDivYield, 1) : "-"}
                </span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">
                  {hasCuratedBands ? `Payout Ratio ${isLiveValuation ? "(ilus)" : ""}` : "Market Cap"}
                </span>
                <span className="font-mono tnum text-slate-100 font-semibold">
                  {hasCuratedBands && stock.payoutRatio !== undefined
                    ? formatPersen(stock.payoutRatio, 1)
                    : !hasCuratedBands && stock.marketCapTrillion > 0
                    ? `Rp ${formatDesimal(stock.marketCapTrillion, 1)} T`
                    : "-"}
                </span>
              </div>
            </div>

            {/* Strengths & Risks (khusus emiten kurasi) */}
            {(stock.strengths.length > 0 || stock.risks.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs font-semibold text-slate-200 block mb-2">
                    Kekuatan dan keunggulan
                  </span>
                  <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                    {stock.strengths.map((s, idx) => (
                      <li key={idx} className="leading-snug">{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs font-semibold text-slate-200 block mb-2">
                    Faktor risiko & tantangan
                  </span>
                  <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                    {stock.risks.map((r, idx) => (
                      <li key={idx} className="leading-snug">{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BERITA TERKAIT EMITEN */}
        {activeTab === "news" && (
          <div className="p-4 md:p-5 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1E2736]">
              <div>
                <span className="text-slate-200 font-semibold block">
                  Warta &amp; sentimen untuk {selectedTicker}
                </span>
                <span className="text-[11px] text-slate-400">
                  {provider === "yahoo"
                    ? "Gabungan feed pasar modal terkini dan pencarian Google News emiten."
                    : "Berita pasar modal live aktif pada mode Yahoo Finance."}
                </span>
              </div>
              {provider === "yahoo" && (
                <button
                  type="button"
                  onClick={handleRefreshTickerNews}
                  disabled={needsTickerNewsFetch}
                  className="min-h-[34px] inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#171F2C] hover:bg-[#1E2736] text-slate-200 border border-[#232F42] transition disabled:opacity-50"
                >
                  <RotateCcw className={`w-3 h-3 text-[#2DD4BF] ${needsTickerNewsFetch ? "animate-spin" : ""}`} />
                  <span>Cari ulang</span>
                </button>
              )}
            </div>

            {provider === "yahoo" && (
              <>
                {needsTickerNewsFetch && combinedTickerLiveNews.length === 0 ? (
                  <div className="py-8 flex items-center justify-center space-x-2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-[#2DD4BF]" />
                    <span>Mencari berita terkini untuk {selectedTicker}...</span>
                  </div>
                ) : combinedTickerLiveNews.length === 0 ? (
                  <div className="p-5 rounded-xl bg-[#0C1017] border border-[#1E2736] text-center text-slate-400">
                    Belum ditemukan berita live terbaru yang menyinggung {selectedTicker}.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {combinedTickerLiveNews.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#0C1017] border border-[#1E2736] hover:border-[#2B384E] transition space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#2DD4BF]">{item.publisher}</span>
                            <span>&bull;</span>
                            <span>{formatNewsCategoryLabel(item.category)}</span>
                            {renderDarkSentimentBadge(item.sentiment || "NEUTRAL")}
                          </div>
                          <span>{item.publishedWib}</span>
                        </div>

                        <h4 className="text-sm font-semibold text-slate-100 leading-snug">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#2DD4BF] transition"
                          >
                            {item.title}
                          </a>
                        </h4>

                        {item.summary && (
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {item.summary}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                            {item.tickers.slice(0, 4).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => onSelectTicker?.(t)}
                                className={`px-1.5 py-0.5 rounded border transition ${
                                  t === selectedTicker
                                    ? "bg-[#1E7B85]/25 border-[#1E7B85]/50 text-[#2DD4BF]"
                                    : "bg-[#171F2C] border-[#25354A] text-slate-300 hover:text-white"
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            {onAskAiTerminalNews && (
                              <button
                                type="button"
                                onClick={() => onAskAiTerminalNews(item)}
                                className="inline-flex items-center space-x-1 text-[#2DD4BF] hover:underline font-medium"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Bedah AI</span>
                              </button>
                            )}
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-slate-400 hover:text-slate-200 hover:underline"
                            >
                              <span>Baca</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {provider !== "yahoo" && (
              <div className="p-5 rounded-xl bg-[#0C1017] border border-[#1E2736] text-center text-slate-400">
                Mode data ilustrasi aktif. Aktifkan mode Yahoo Finance untuk memuat berita terkini terkait {selectedTicker}.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: BANDINGKAN (MULTI-SAHAM HEAD-TO-HEAD & KURVA PERFORMA %) */}
        {activeTab === "compare" && (
          <StockCompareTab
            primaryTicker={selectedTicker}
            primaryMetrics={primaryComparableMetrics}
            quotes={allQuotes}
            provider={provider}
            customWatchlist={customWatchlist}
            watchlistNotes={watchlistNotes}
            onSelectTicker={onSelectTicker}
            onAskAiCompare={onAskAiCompare}
          />
        )}
      </div>
    </div>
  );
};
