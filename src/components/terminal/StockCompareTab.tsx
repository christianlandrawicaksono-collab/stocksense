"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  Time,
} from "lightweight-charts";
import { STOCKS_DATA } from "@/data/stocksData";
import { formatDesimal, formatMultiple, formatPersen, formatRupiah } from "@/lib/format";
import {
  getHistory,
  getIllustrativeHistoryPoints,
  getQuotes,
  HistoryRange,
  MarketHistoryPoint,
  MarketProvider,
  MarketQuote,
  searchStocks,
  StockSearchItem,
} from "@/lib/market-data";
import {
  ComparableStockMetrics,
  computeComparisonWinners,
  normalizeComparisonHistories,
} from "@/lib/compare";
import { evaluateTargetBuyStatus, type WatchlistEntryMeta } from "@/lib/watchlist";
import { buildComparisonResearchMarkdown } from "@/lib/research-export";
import { Plus, X, Sparkles, Search, Loader2, GitCompareArrows, Copy, Check } from "lucide-react";

interface StockCompareTabProps {
  primaryTicker: string;
  primaryMetrics: ComparableStockMetrics;
  quotes?: Record<string, MarketQuote>;
  provider: MarketProvider;
  customWatchlist: string[];
  watchlistNotes: Record<string, WatchlistEntryMeta>;
  onSelectTicker?: (ticker: string) => void;
  onAskAiCompare?: (tickers: string[]) => void;
}

const LINE_COLORS = ["#1E7B85", "#F59E0B", "#A855F7"] as const;
const COMPARE_RANGES: ("3Bl" | "6Bl" | "1Th")[] = ["3Bl", "6Bl", "1Th"];
const CURATED_BY_TICKER = new Map(STOCKS_DATA.map((s) => [s.ticker, s]));

export const StockCompareTab: React.FC<StockCompareTabProps> = ({
  primaryTicker,
  primaryMetrics,
  quotes,
  provider,
  customWatchlist,
  watchlistNotes,
  onSelectTicker,
  onAskAiCompare,
}) => {
  const [peerOverride, setPeerOverride] = useState<{
    baseTicker: string;
    peers: string[];
  } | null>(null);
  const [compareRange, setCompareRange] = useState<"3Bl" | "6Bl" | "1Th">("6Bl");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchState, setSearchState] = useState<{
    query: string;
    items: StockSearchItem[];
  }>({ query: "", items: [] });
  const [extraQuotes, setExtraQuotes] = useState<Record<string, MarketQuote>>({});
  const [historyMapState, setHistoryMapState] = useState<{
    key: string;
    data: Record<string, MarketHistoryPoint[]>;
  }>({ key: "", data: {} });
  const [copiedCompareKey, setCopiedCompareKey] = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Auto-pilih maksimal 2 pembanding default dari Watchlist Saya atau sektor serupa di Saham Kurasi
  const autoDefaultPeers = useMemo(() => {
    const candidates: string[] = [];
    for (const t of customWatchlist) {
      if (t !== primaryTicker && !candidates.includes(t)) {
        candidates.push(t);
      }
      if (candidates.length >= 2) return candidates;
    }

    const primarySector = primaryMetrics.sector;
    for (const s of STOCKS_DATA) {
      if (s.ticker !== primaryTicker && s.sector === primarySector && !candidates.includes(s.ticker)) {
        candidates.push(s.ticker);
      }
      if (candidates.length >= 2) return candidates;
    }

    for (const s of STOCKS_DATA) {
      if (s.ticker !== primaryTicker && !candidates.includes(s.ticker)) {
        candidates.push(s.ticker);
      }
      if (candidates.length >= 2) return candidates;
    }

    return candidates;
  }, [customWatchlist, primaryTicker, primaryMetrics.sector]);

  const activePeers = useMemo(() => {
    const chosen =
      peerOverride && peerOverride.baseTicker === primaryTicker
        ? peerOverride.peers
        : autoDefaultPeers;
    return chosen.filter((t) => t !== primaryTicker).slice(0, 2);
  }, [peerOverride, primaryTicker, autoDefaultPeers]);

  const comparedTickers = useMemo(
    () => [primaryTicker, ...activePeers],
    [primaryTicker, activePeers]
  );

  const trimmedQuery = searchQuery.trim();
  const isRemoteSearching =
    provider === "yahoo" && trimmedQuery.length >= 2 && searchState.query !== trimmedQuery;

  // Pencarian emiten BEI eksternal untuk menambah saham pembanding
  useEffect(() => {
    if (provider !== "yahoo" || trimmedQuery.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchStocks(trimmedQuery)
        .then((items) => {
          if (!cancelled) setSearchState({ query: trimmedQuery, items });
        })
        .catch(() => {
          if (!cancelled) setSearchState({ query: trimmedQuery, items: [] });
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [provider, trimmedQuery]);

  // Tarik quote jika pembanding berasal dari pencarian baru yang belum ada di quotes utama
  const missingQuoteKey = useMemo(() => {
    if (provider !== "yahoo") return "";
    return activePeers
      .filter((t) => {
        const existing = quotes?.[t] ?? extraQuotes[t];
        return !existing || existing.isFallback || existing.price <= 0;
      })
      .sort()
      .join(",");
  }, [provider, activePeers, quotes, extraQuotes]);

  useEffect(() => {
    if (provider !== "yahoo" || !missingQuoteKey) return;
    let cancelled = false;
    const list = missingQuoteKey.split(",").filter(Boolean);
    getQuotes(list).then((res) => {
      if (!cancelled && res.quotes) {
        setExtraQuotes((prev) => ({ ...prev, ...res.quotes }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, missingQuoteKey]);

  // Tarik riwayat harga seluruh saham pembanding untuk grafik return relatif (%)
  const historyFetchKey = `${provider}|${compareRange}|${comparedTickers.join(",")}`;
  const isHistoryLoading =
    provider === "yahoo" && historyMapState.key !== historyFetchKey;

  useEffect(() => {
    let cancelled = false;
    if (provider !== "yahoo") return;

    Promise.allSettled(
      comparedTickers.map((t) => getHistory(t, compareRange as HistoryRange))
    ).then((results) => {
      if (cancelled) return;
      const nextMap: Record<string, MarketHistoryPoint[]> = {};
      results.forEach((res, idx) => {
        const ticker = comparedTickers[idx];
        if (res.status === "fulfilled" && !res.value.isFallback) {
          nextMap[ticker] = res.value.points;
        } else {
          nextMap[ticker] = [];
        }
      });
      setHistoryMapState({ key: historyFetchKey, data: nextMap });
    });

    return () => {
      cancelled = true;
    };
  }, [provider, compareRange, comparedTickers, historyFetchKey]);

  const effectiveHistoryMap = useMemo(() => {
    if (provider !== "yahoo") {
      const map: Record<string, MarketHistoryPoint[]> = {};
      for (const t of comparedTickers) {
        map[t] = getIllustrativeHistoryPoints(t, compareRange as HistoryRange);
      }
      return map;
    }
    return historyMapState.key === historyFetchKey ? historyMapState.data : {};
  }, [provider, comparedTickers, compareRange, historyMapState, historyFetchKey]);

  const normalizedSeries = useMemo(
    () => normalizeComparisonHistories(effectiveHistoryMap, comparedTickers),
    [effectiveHistoryMap, comparedTickers]
  );

  // Render multi-line comparison chart
  useEffect(() => {
    if (!chartContainerRef.current || normalizedSeries.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 560,
      height: 210,
      layout: {
        background: { type: ColorType.Solid, color: "#0C1017" },
        textColor: "#94A3B8",
        fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
        fontSize: 11,
      },
      localization: {
        priceFormatter: (val: number) => `${val >= 0 ? "+" : ""}${formatDesimal(val, 1)}%`,
      },
      grid: {
        vertLines: { color: "#1A2230", style: 2 },
        horzLines: { color: "#1A2230", style: 2 },
      },
      rightPriceScale: {
        borderColor: "#1E2736",
      },
      timeScale: {
        borderColor: "#1E2736",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    });

    chartRef.current = chart;

    normalizedSeries.forEach((entry, idx) => {
      const color = LINE_COLORS[idx % LINE_COLORS.length];
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: idx === 0 ? 3 : 2,
        title: entry.ticker,
        priceFormat: {
          type: "custom",
          formatter: (val: number) => `${val >= 0 ? "+" : ""}${formatDesimal(val, 1)}%`,
        },
      });
      line.setData(
        entry.points.map((pt) => ({
          time: pt.time as Time,
          value: pt.value,
        }))
      );
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !entries[0].contentRect) return;
      const newWidth = entries[0].contentRect.width;
      if (newWidth > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: newWidth });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [normalizedSeries]);

  // Bangun tabel metrik head-to-head
  const comparableMetrics: ComparableStockMetrics[] = useMemo(() => {
    const peerItems: ComparableStockMetrics[] = activePeers.map((ticker) => {
      const curated = CURATED_BY_TICKER.get(ticker);
      const q = quotes?.[ticker] ?? extraQuotes[ticker];
      const isLive = Boolean(provider === "yahoo" && q && !q.isFallback && q.price > 0);
      return {
        ticker,
        name: curated?.name || q?.name || ticker,
        sector: curated?.sector || q?.sector || "Saham BEI",
        price: q?.price ?? curated?.currentPrice ?? 0,
        changePercent: q?.changePercent ?? curated?.change1D ?? 0,
        peRatio: isLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : curated?.peRatio ?? 0,
        pbvRatio: isLive && q?.pbvRatio && q.pbvRatio > 0 ? q.pbvRatio : curated?.pbvRatio ?? 0,
        dividendYield:
          isLive && q?.dividendYield !== undefined && q.dividendYield >= 0
            ? q.dividendYield
            : curated?.dividendYield ?? 0,
        roe: curated?.roe ?? q?.roe,
        der: curated?.der ?? q?.der,
        marketCapTrillion: q?.marketCapTrillion ?? curated?.marketCapTrillion,
        targetBuyPrice: watchlistNotes[ticker]?.targetBuyPrice,
        isLive,
      };
    });

    return [primaryMetrics, ...peerItems];
  }, [primaryMetrics, activePeers, quotes, extraQuotes, provider, watchlistNotes]);

  const winners = useMemo(
    () => computeComparisonWinners(comparableMetrics),
    [comparableMetrics]
  );

  // Kandidat cepat yang belum dipilih
  const quickCandidates = useMemo(() => {
    const chosen = new Set(comparedTickers);
    const ordered = Array.from(
      new Set([...customWatchlist, ...STOCKS_DATA.map((s) => s.ticker)])
    );
    return ordered
      .filter((t) => !chosen.has(t))
      .filter((t) => (provider === "yahoo" ? true : CURATED_BY_TICKER.has(t)))
      .slice(0, 8);
  }, [comparedTickers, customWatchlist, provider]);

  const remoteSearchFiltered = useMemo(() => {
    if (provider !== "yahoo" || trimmedQuery.length < 2 || searchState.query !== trimmedQuery) {
      return [];
    }
    const chosen = new Set(comparedTickers);
    return searchState.items.filter((i) => !chosen.has(i.ticker)).slice(0, 5);
  }, [provider, trimmedQuery, searchState, comparedTickers]);

  const handleAddComparePeer = (ticker: string) => {
    const clean = ticker.trim().toUpperCase();
    if (!clean || clean === primaryTicker || activePeers.includes(clean)) return;
    const nextPeers = activePeers.length >= 2 ? [activePeers[0], clean] : [...activePeers, clean];
    setPeerOverride({ baseTicker: primaryTicker, peers: nextPeers });
    setSearchQuery("");
  };

  const handleRemoveComparePeer = (ticker: string) => {
    const nextPeers = activePeers.filter((t) => t !== ticker);
    setPeerOverride({ baseTicker: primaryTicker, peers: nextPeers });
  };

  const compareKey = comparedTickers.join(",");
  const handleCopyComparison = async () => {
    if (comparableMetrics.length < 2) return;
    const targetKey = compareKey;
    const markdown = buildComparisonResearchMarkdown({
      metrics: comparableMetrics,
      winners,
      compareRange,
      normalizedSeries,
      providerLabel: provider === "yahoo" ? "Yahoo Finance" : "Data Ilustrasi",
    });

    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedCompareKey(targetKey);
      setTimeout(() => {
        setCopiedCompareKey((cur) => (cur === targetKey ? null : cur));
      }, 2000);
    } catch {
      // Abaikan jika Clipboard API tidak tersedia
    }
  };

  return (
    <div className="p-4 md:p-5 space-y-5 text-xs">
      {/* Toolbar Pembanding: Ticker pills + Search BEI + AI Button */}
      <div className="bg-[#0C1017] border border-[#1E2736] rounded-xl p-3 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="text-slate-400 font-medium flex items-center space-x-1.5 mr-0.5 shrink-0">
              <GitCompareArrows className="w-3.5 h-3.5 text-[#1E7B85]" />
              <span>Bandingkan (maks. 3):</span>
            </span>

            {comparedTickers.map((t, idx) => (
              <span
                key={t}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#111622] border border-[#232F42] font-mono font-semibold text-slate-100 text-[11px]"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                />
                <span>{t}</span>
                {idx === 0 ? (
                  <span className="text-[10px] font-sans font-normal text-[#2DD4BF]">(Aktif)</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveComparePeer(t)}
                    className="text-slate-400 hover:text-white ml-0.5"
                    title={`Hapus ${t} dari perbandingan`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-auto">
            {comparableMetrics.length >= 2 && (
              <button
                type="button"
                onClick={() => void handleCopyComparison()}
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap transition ${
                  copiedCompareKey === compareKey
                    ? "bg-[#2EB886]/20 border-[#2EB886]/50 text-[#2EB886]"
                    : "bg-[#111622] hover:bg-[#171F2C] text-slate-200 border-[#232F42]"
                }`}
                title="Salin tabel perbandingan metrik & performa ke clipboard (Markdown)"
              >
                {copiedCompareKey === compareKey ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Tabel</span>
                  </>
                )}
              </button>
            )}

            {onAskAiCompare && comparedTickers.length >= 2 && (
              <button
                type="button"
                onClick={() => onAskAiCompare(comparedTickers)}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#1E7B85]/20 hover:bg-[#1E7B85]/35 text-[#2DD4BF] border border-[#1E7B85]/40 text-[11px] font-medium whitespace-nowrap transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bedah Perbandingan AI</span>
              </button>
            )}
          </div>
        </div>

        {/* Pilihan cepat & search ticker pembanding */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pt-2 border-t border-[#1A2230]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">Tambah cepat:</span>
            {quickCandidates.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleAddComparePeer(t)}
                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#151C2A] hover:bg-[#1E7B85]/25 text-slate-300 hover:text-[#2DD4BF] border border-[#232F42] font-mono text-[11px] transition"
                title={
                  activePeers.length >= 2
                    ? `Ganti pembanding kedua dengan ${t}`
                    : `Tambahkan ${t} ke perbandingan`
                }
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{t}</span>
              </button>
            ))}
          </div>

          {provider === "yahoo" && (
            <div className="relative w-full md:w-56">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="compare-ticker-search"
                name="compareTickerSearch"
                type="text"
                aria-label="Cari kode BEI pembanding"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode BEI pembanding..."
                className="w-full pl-7 pr-3 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#1E7B85]"
              />
              {trimmedQuery.length >= 2 && (
                <div className="absolute right-0 left-0 mt-1 z-30 rounded-lg bg-[#0E131C] border border-[#232F42] shadow-xl overflow-hidden">
                  {isRemoteSearching ? (
                    <div className="p-2.5 flex items-center space-x-2 text-[11px] text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin text-[#2DD4BF]" />
                      <span>Mencari emiten BEI...</span>
                    </div>
                  ) : remoteSearchFiltered.length === 0 ? (
                    <div className="p-2.5 text-[11px] text-slate-500">
                      Tidak ada hasil cocok.
                    </div>
                  ) : (
                    remoteSearchFiltered.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => handleAddComparePeer(item.ticker)}
                        className="w-full px-2.5 py-2 text-left hover:bg-[#172332] flex items-center justify-between gap-2 border-b border-[#1A2230] last:border-b-0"
                      >
                        <span className="truncate text-[11px] text-slate-200">
                          <strong className="font-mono text-[#2DD4BF] mr-1.5">{item.ticker}</strong>
                          {item.name}
                        </span>
                        <Plus className="w-3 h-3 text-[#2DD4BF] shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grafik Performa Relatif (%) */}
      <div className="bg-[#0C1017] border border-[#1E2736] rounded-xl overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-[#1E2736] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-200">
              Performa Relatif (%)
            </span>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tnum">
              {normalizedSeries.map((s, idx) => (
                <span
                  key={s.ticker}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#111622] border border-[#20293A]"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                  />
                  <span className="text-slate-200 font-semibold">{s.ticker}</span>
                  <span className={s.totalReturnPct >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}>
                    {formatPersen(s.totalReturnPct, 1, true)}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-1 bg-[#080B10] p-0.5 rounded border border-[#1E2736]">
            {COMPARE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setCompareRange(r)}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  compareRange === r
                    ? "bg-[#1E7B85] text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-[210px] w-full bg-[#0C1017]">
          {isHistoryLoading && normalizedSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center space-x-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-[#2DD4BF]" />
              <span>Memuat perbandingan historis ({compareRange})...</span>
            </div>
          ) : normalizedSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Pilih minimal 1 emiten pembanding dengan riwayat harga tersedia.
            </div>
          ) : (
            <div ref={chartContainerRef} className="w-full h-full" />
          )}
        </div>
      </div>

      {/* Tabel Matriks Perbandingan Head-to-Head */}
      <div className="bg-[#0C1017] border border-[#1E2736] rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1E2736] bg-[#0A0E16]">
              <th className="py-2.5 px-3.5 text-[11px] font-medium text-slate-400 w-40">
                Metrik
              </th>
              {comparableMetrics.map((m, idx) => (
                <th key={m.ticker} className="py-2.5 px-3.5">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                    />
                    <button
                      type="button"
                      onClick={() => onSelectTicker?.(m.ticker)}
                      className="font-mono font-bold text-slate-100 hover:text-[#2DD4BF] transition"
                      title={`Buka ${m.ticker} sebagai saham utama`}
                    >
                      {m.ticker}
                    </button>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400 block truncate max-w-[140px]">
                    {m.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#171F2C] font-mono tnum">
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">Harga Terkini</td>
              {comparableMetrics.map((m) => (
                <td key={m.ticker} className="py-2.5 px-3.5 text-slate-100 font-semibold">
                  <div>{m.price > 0 ? formatRupiah(m.price) : "-"}</div>
                  {m.price > 0 && (
                    <span
                      className={`text-[10px] ${
                        m.changePercent >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                      }`}
                    >
                      {formatPersen(m.changePercent, 1, true)}
                    </span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">Sektor</td>
              {comparableMetrics.map((m) => (
                <td key={m.ticker} className="py-2.5 px-3.5 font-sans text-slate-300 text-[11px]">
                  {m.sector}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">P/E Ratio (TTM)</td>
              {comparableMetrics.map((m) => {
                const isBest = winners.lowestPeTicker === m.ticker;
                return (
                  <td key={m.ticker} className="py-2.5 px-3.5 text-slate-200">
                    <span>{m.peRatio > 0 ? formatMultiple(m.peRatio, 1) : "-"}</span>
                    {isBest && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#2EB886]/15 text-[#2EB886] font-sans text-[10px]">
                        Terendah
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">PBV Ratio</td>
              {comparableMetrics.map((m) => {
                const isBest = winners.lowestPbvTicker === m.ticker;
                return (
                  <td key={m.ticker} className="py-2.5 px-3.5 text-slate-200">
                    <span>{m.pbvRatio > 0 ? formatMultiple(m.pbvRatio, 2) : "-"}</span>
                    {isBest && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#2EB886]/15 text-[#2EB886] font-sans text-[10px]">
                        Terendah
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">Dividend Yield</td>
              {comparableMetrics.map((m) => {
                const isBest = winners.highestDividendTicker === m.ticker;
                return (
                  <td key={m.ticker} className="py-2.5 px-3.5 text-slate-200">
                    <span>{m.dividendYield > 0 ? formatPersen(m.dividendYield, 1) : "-"}</span>
                    {isBest && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#2EB886]/15 text-[#2EB886] font-sans text-[10px]">
                        Tertinggi
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">ROE</td>
              {comparableMetrics.map((m) => {
                const isBest = winners.highestRoeTicker === m.ticker;
                return (
                  <td key={m.ticker} className="py-2.5 px-3.5 text-slate-200">
                    <span>{m.roe !== undefined ? formatPersen(m.roe, 1) : "-"}</span>
                    {isBest && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#2EB886]/15 text-[#2EB886] font-sans text-[10px]">
                        Tertinggi
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">DER (Utang)</td>
              {comparableMetrics.map((m) => {
                const isBest = winners.lowestDerTicker === m.ticker;
                return (
                  <td key={m.ticker} className="py-2.5 px-3.5 text-slate-200">
                    <span>{m.der !== undefined ? formatMultiple(m.der, 2) : "-"}</span>
                    {isBest && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#2EB886]/15 text-[#2EB886] font-sans text-[10px]">
                        Teraman
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">Kapitalisasi Pasar</td>
              {comparableMetrics.map((m) => (
                <td key={m.ticker} className="py-2.5 px-3.5 text-slate-300">
                  {m.marketCapTrillion && m.marketCapTrillion > 0
                    ? `Rp ${formatDesimal(m.marketCapTrillion, 1)} T`
                    : "-"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2.5 px-3.5 font-sans text-slate-400">Target Beli Watchlist</td>
              {comparableMetrics.map((m) => {
                const evalRes = evaluateTargetBuyStatus(m.price, m.targetBuyPrice);
                return (
                  <td key={m.ticker} className="py-2.5 px-3.5">
                    {m.targetBuyPrice ? (
                      <span
                        className={
                          evalRes.status === "hit"
                            ? "text-[#2EB886] font-semibold"
                            : evalRes.status === "near"
                            ? "text-amber-400"
                            : "text-slate-300"
                        }
                      >
                        {formatRupiah(m.targetBuyPrice)}
                        {evalRes.status === "hit" && " (Area Beli)"}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
