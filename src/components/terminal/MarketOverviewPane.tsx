"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  IChartApi,
  LineSeries,
  Time,
  createChart,
} from "lightweight-charts";
import { normalizeComparisonHistories } from "@/lib/compare";
import {
  formatNewsCategoryLabel,
  formatNewsTimestamp,
  formatNumber,
  formatPersen,
  formatRupiah,
  getJakartaDateKey,
} from "@/lib/format";
import {
  getHistory,
  getIllustrativeHistoryPoints,
  HistoryRange,
  MarketHistoryPoint,
  MarketProvider,
  MarketQuote,
} from "@/lib/market-data";
import {
  buildMarketPulseSummary,
  buildOverviewStockPool,
  buildSectorHeatmap,
  buildTopMovers,
  type MoverFilterMode,
} from "@/lib/market-overview";
import type { WatchlistEntryMeta } from "@/lib/watchlist";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";
import {
  Activity,
  ExternalLink,
  Flame,
  Globe,
  Newspaper,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface MarketOverviewPaneProps {
  provider: MarketProvider;
  quotes: Record<string, MarketQuote>;
  macroTickers: MarketTickerItem[];
  customWatchlist: string[];
  watchlistNotes: Record<string, WatchlistEntryMeta>;
  liveNewsItems: LiveMarketNewsItem[];
  onSelectStock: (ticker: string) => void;
  onSwitchToNews?: () => void;
}

const BENCHMARK_LINE_COLORS = ["#2DD4BF", "#F59E0B", "#A855F7", "#38BDF8"] as const;
const OVERVIEW_RANGES: ("3Bl" | "6Bl" | "1Th")[] = ["3Bl", "6Bl", "1Th"];
const YAHOO_BENCHMARKS = ["IHSG", "SP500", "GOLD", "BRENT"] as const;
const ILLUSTRATIVE_BENCHMARKS = ["IHSG", "BBCA", "TLKM", "ADRO"] as const;

function getHeatmapTileStyle(changePercent: number): {
  bg: string;
  border: string;
  text: string;
} {
  if (changePercent >= 2) {
    return {
      bg: "bg-[#059669]/45 hover:bg-[#059669]/60",
      border: "border-[#2EB886]/50",
      text: "text-emerald-100",
    };
  }
  if (changePercent > 0.05) {
    return {
      bg: "bg-[#2EB886]/25 hover:bg-[#2EB886]/40",
      border: "border-[#2EB886]/35",
      text: "text-emerald-200",
    };
  }
  if (changePercent <= -2) {
    return {
      bg: "bg-[#DC525F]/45 hover:bg-[#DC525F]/60",
      border: "border-[#DC525F]/55",
      text: "text-rose-100",
    };
  }
  if (changePercent < -0.05) {
    return {
      bg: "bg-[#DC525F]/25 hover:bg-[#DC525F]/40",
      border: "border-[#DC525F]/35",
      text: "text-rose-200",
    };
  }
  return {
    bg: "bg-[#171F2C] hover:bg-[#1E2736]",
    border: "border-[#28354A]",
    text: "text-slate-300",
  };
}

export const MarketOverviewPane: React.FC<MarketOverviewPaneProps> = ({
  provider,
  quotes,
  macroTickers,
  customWatchlist,
  watchlistNotes,
  liveNewsItems,
  onSelectStock,
  onSwitchToNews,
}) => {
  const [chartRange, setChartRange] = useState<"3Bl" | "6Bl" | "1Th">("3Bl");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [moverMode, setMoverMode] = useState<MoverFilterMode>("gainers");
  const [benchmarkHistState, setBenchmarkHistState] = useState<{
    key: string;
    data: Record<string, MarketHistoryPoint[]>;
  }>({ key: "", data: {} });

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const activeBenchmarks = useMemo(
    () =>
      provider === "yahoo" ? [...YAHOO_BENCHMARKS] : [...ILLUSTRATIVE_BENCHMARKS],
    [provider]
  );

  const fetchKey = `${provider}|${chartRange}|${activeBenchmarks.join(",")}`;
  const isChartLoading = provider === "yahoo" && benchmarkHistState.key !== fetchKey;

  useEffect(() => {
    if (provider !== "yahoo") return;
    let cancelled = false;

    Promise.allSettled(
      activeBenchmarks.map((sym) => getHistory(sym, chartRange as HistoryRange))
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, MarketHistoryPoint[]> = {};
      results.forEach((res, idx) => {
        const sym = activeBenchmarks[idx];
        if (res.status === "fulfilled" && !res.value.isFallback) {
          next[sym] = res.value.points;
        } else {
          next[sym] = [];
        }
      });
      setBenchmarkHistState({ key: fetchKey, data: next });
    });

    return () => {
      cancelled = true;
    };
  }, [provider, chartRange, activeBenchmarks, fetchKey]);

  const effectiveHistoryMap = useMemo(() => {
    if (provider !== "yahoo") {
      const map: Record<string, MarketHistoryPoint[]> = {};
      for (const sym of activeBenchmarks) {
        map[sym] = getIllustrativeHistoryPoints(sym, chartRange as HistoryRange);
      }
      return map;
    }
    return benchmarkHistState.key === fetchKey ? benchmarkHistState.data : {};
  }, [provider, activeBenchmarks, chartRange, benchmarkHistState, fetchKey]);

  const normalizedBenchmarks = useMemo(
    () => normalizeComparisonHistories(effectiveHistoryMap, activeBenchmarks),
    [effectiveHistoryMap, activeBenchmarks]
  );

  useEffect(() => {
    if (!chartContainerRef.current || normalizedBenchmarks.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 540,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "#0C1017" },
        textColor: "#94A3B8",
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        fontSize: 11,
      },
      localization: {
        priceFormatter: (val: number) => formatPersen(val, 1, true),
      },
      grid: {
        vertLines: { color: "#1A2230", style: 2 },
        horzLines: { color: "#1A2230", style: 2 },
      },
      rightPriceScale: { borderColor: "#1E2736" },
      timeScale: { borderColor: "#1E2736", timeVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    chartRef.current = chart;

    normalizedBenchmarks.forEach((seriesItem, idx) => {
      const line = chart.addSeries(LineSeries, {
        color: BENCHMARK_LINE_COLORS[idx % BENCHMARK_LINE_COLORS.length],
        lineWidth: 2,
        priceFormat: {
          type: "custom",
          formatter: (v: number) => formatPersen(v, 1, true),
        },
      });
      line.setData(
        seriesItem.points.map((p) => ({ time: p.time as Time, value: p.value }))
      );
    });

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      if (!entries[0]?.contentRect) return;
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: w, height: 220 });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [normalizedBenchmarks]);

  const stockPool = useMemo(
    () =>
      buildOverviewStockPool({
        customWatchlist,
        quotes,
        provider,
        watchlistNotes,
      }),
    [customWatchlist, quotes, provider, watchlistNotes]
  );

  const sectorHeatmap = useMemo(() => buildSectorHeatmap(stockPool), [stockPool]);
  const sectorNames = useMemo(() => sectorHeatmap.map((s) => s.sector), [sectorHeatmap]);
  const effectiveSector =
    selectedSector !== "ALL" && sectorNames.includes(selectedSector)
      ? selectedSector
      : "ALL";
  const displayedSectors = useMemo(
    () =>
      effectiveSector === "ALL"
        ? sectorHeatmap
        : sectorHeatmap.filter((s) => s.sector === effectiveSector),
    [sectorHeatmap, effectiveSector]
  );

  const movers = useMemo(
    () => buildTopMovers(stockPool, moverMode, 10),
    [stockPool, moverMode]
  );
  const pulseSummary = useMemo(() => buildMarketPulseSummary(stockPool), [stockPool]);
  const todayWibKey = getJakartaDateKey(new Date());

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Baris Atas: Grafik Perbandingan Indeks/Makro (Kiri) + Denyut Pasar & Indikator Makro (Kanan) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Perbandingan Indeks & Komoditas */}
        <div className="xl:col-span-7 bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-[#1E2736] bg-[#0E131C] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <Globe className="w-4 h-4 text-[#2DD4BF]" />
                <span>
                  {provider === "yahoo"
                    ? "Indeks & Komoditas Acuan (% Relatif)"
                    : "Kinerja IHSG & Wakil Sektor (% Relatif)"}
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-[11px] tnum">
                {normalizedBenchmarks.map((s, idx) => (
                  <span
                    key={s.ticker}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#0C1017] border border-[#20293A]"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          BENCHMARK_LINE_COLORS[idx % BENCHMARK_LINE_COLORS.length],
                      }}
                    />
                    <span className="text-slate-200 font-semibold">{s.ticker}</span>
                    <span
                      className={
                        s.totalReturnPct >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                      }
                    >
                      {formatPersen(s.totalReturnPct, 1, true)}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-1 bg-[#080B10] p-1 rounded-lg border border-[#1E2736]">
              {OVERVIEW_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setChartRange(r)}
                  className={`px-2 py-1 rounded text-[11px] transition ${
                    chartRange === r
                      ? "bg-[#1E7B85] text-white font-medium"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#0C1017]">
            {isChartLoading && normalizedBenchmarks.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400">
                Memuat kurva perbandingan indeks &amp; komoditas...
              </div>
            ) : normalizedBenchmarks.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-slate-400">
                Data historis indeks belum tersedia untuk periode ini.
              </div>
            ) : (
              <div ref={chartContainerRef} className="w-full h-[220px]" />
            )}
          </div>
        </div>

        {/* Kartu Ringkasan Sinyal & Grid Indikator Makro (Pengganti World Map) */}
        <div className="xl:col-span-5 bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="px-4 py-3 border-b border-[#1E2736] bg-[#0E131C] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#2EB886]" />
              <span>Indikator Makro &amp; Denyut Pantauan</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono tnum">
              {pulseSummary.totalStocks} emiten pantau
            </span>
          </div>

          <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            {/* Ringkasan Luas Pasar & Area Beli */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-[#0C1017] border border-[#1E2736]">
                <span className="text-[10px] text-slate-400 block">Menguat / Turun</span>
                <div className="font-mono text-xs font-semibold tnum mt-0.5">
                  <span className="text-[#2EB886]">{pulseSummary.advancers}</span>
                  <span className="text-slate-500 mx-1">/</span>
                  <span className="text-[#DC525F]">{pulseSummary.decliners}</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0C1017] border border-[#1E2736]">
                <span className="text-[10px] text-slate-400 block">Sektor Terkuat</span>
                <span className="text-[11px] font-semibold text-slate-100 truncate block mt-0.5">
                  {pulseSummary.strongestSector?.sector || "-"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#0C1017] border border-[#1E2736]">
                <span className="text-[10px] text-slate-400 block">Sinyal Area Beli</span>
                <span className="font-mono text-xs font-semibold text-[#2EB886] tnum block mt-0.5">
                  {pulseSummary.buyZoneCount} saham
                </span>
              </div>
            </div>

            {/* Grid 6 Indikator Makro */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {macroTickers.slice(0, 6).map((m) => (
                <div
                  key={m.symbol}
                  className="p-2.5 rounded-lg bg-[#0A0E16] border border-[#182030] space-y-0.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono font-semibold text-slate-300">{m.symbol}</span>
                    <span
                      className={`font-mono tnum ${
                        m.isPositive ? "text-[#2EB886]" : "text-[#DC525F]"
                      }`}
                    >
                      {formatPersen(m.change, 2, true)}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-slate-100 text-xs tnum truncate">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Baris Bawah: 3 Panel Sejajar (Heat Map Sektor | Berita Teratas | Top Movers) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* 1. Heat Map Sektor (Kurasi + Watchlist) */}
        <div className="lg:col-span-5 bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-[#1E2736] bg-[#0E131C] flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>Heat Map Kurasi &amp; Watchlist</span>
            </span>
            {sectorNames.length > 1 && (
              <select
                id="overview-sector-filter"
                name="overviewSectorFilter"
                aria-label="Filter sektor heat map"
                value={effectiveSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="max-w-[140px] px-2 py-1 rounded bg-[#080B10] border border-[#20293A] text-[11px] text-slate-200 focus:outline-none focus:border-[#1E7B85] truncate"
              >
                <option value="ALL">Semua Sektor</option>
                {sectorNames.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto terminal-scroll max-h-[420px]">
            {displayedSectors.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                Belum ada data emiten yang dimuat.
              </div>
            ) : (
              displayedSectors.map((group) => (
                <div key={group.sector} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-300 truncate">{group.sector}</span>
                    <span
                      className={`font-mono tnum ${
                        group.avgChangePercent >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                      }`}
                    >
                      {formatPersen(group.avgChangePercent, 1, true)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {group.tiles.map((tile) => {
                      const style = getHeatmapTileStyle(tile.changePercent);
                      return (
                        <button
                          key={tile.ticker}
                          type="button"
                          onClick={() => onSelectStock(tile.ticker)}
                          className={`p-2 rounded-lg border text-left transition ${style.bg} ${style.border}`}
                          title={`Buka ${tile.ticker} (${tile.name}) di Riset Saham`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-bold text-white text-xs">
                              {tile.ticker}
                            </span>
                            {tile.targetStatus === "hit" && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-[#2EB886]"
                                title="Masuk Area Beli"
                              />
                            )}
                          </div>
                          <div className={`font-mono font-semibold text-xs tnum mt-0.5 ${style.text}`}>
                            {formatPersen(tile.changePercent, 1, true)}
                          </div>
                          <div className="text-[10px] text-slate-300/80 font-mono tnum">
                            {formatRupiah(tile.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Berita Teratas (RSS Live) */}
        <div className="lg:col-span-4 bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-[#1E2736] bg-[#0E131C] flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Newspaper className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span>Berita Pasar Teratas</span>
            </span>
            {onSwitchToNews && (
              <button
                type="button"
                onClick={onSwitchToNews}
                className="text-[11px] text-[#2DD4BF] hover:underline"
              >
                Buka Semua →
              </button>
            )}
          </div>

          <div className="divide-y divide-[#1A2230]/80 flex-1 overflow-y-auto terminal-scroll max-h-[420px]">
            {liveNewsItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                {provider === "yahoo"
                  ? "Memuat berita pasar modal terkini..."
                  : "Aktifkan provider Live (Yahoo + RSS) untuk berita bursa terkini."}
              </div>
            ) : (
              liveNewsItems.slice(0, 7).map((item) => (
                <div key={item.id} className="p-3 hover:bg-[#151C2A]/70 transition space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span className="text-[#2DD4BF] font-medium truncate">
                      {item.publisher} &bull; {formatNewsCategoryLabel(item.category)}
                    </span>
                    <span className="shrink-0">
                      {formatNewsTimestamp(item.publishedAt, item.publishedWib, todayWibKey, true)}
                    </span>
                  </div>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-medium text-slate-100 hover:text-[#2DD4BF] line-clamp-2 leading-snug"
                  >
                    {item.title}
                  </a>
                  {item.tickers.length > 0 && (
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                        {item.tickers.slice(0, 3).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => onSelectStock(t)}
                            className="px-1.5 py-0.2 rounded bg-[#171F2C] hover:bg-[#1E7B85] text-slate-300 hover:text-white border border-[#25354A] transition"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-400 hover:text-slate-200 inline-flex items-center space-x-1"
                      >
                        <span>Baca</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Top Movers (Kurasi + Watchlist) */}
        <div className="lg:col-span-3 bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="px-3.5 py-2.5 border-b border-[#1E2736] bg-[#0E131C] space-y-2">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#2EB886]" />
              <span>Penggerak Pantauan</span>
            </span>
            <div className="grid grid-cols-3 gap-1 bg-[#080B10] p-0.5 rounded-lg border border-[#20293A] text-[11px]">
              <button
                type="button"
                onClick={() => setMoverMode("gainers")}
                className={`py-1 rounded-md transition flex items-center justify-center space-x-1 ${
                  moverMode === "gainers"
                    ? "bg-[#2EB886]/20 text-[#2EB886] font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>Naik</span>
              </button>
              <button
                type="button"
                onClick={() => setMoverMode("losers")}
                className={`py-1 rounded-md transition flex items-center justify-center space-x-1 ${
                  moverMode === "losers"
                    ? "bg-[#DC525F]/20 text-[#DC525F] font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <TrendingDown className="w-3 h-3" />
                <span>Turun</span>
              </button>
              <button
                type="button"
                onClick={() => setMoverMode("buy_zone")}
                className={`py-1 rounded-md transition flex items-center justify-center space-x-1 ${
                  moverMode === "buy_zone"
                    ? "bg-[#1E7B85] text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Target className="w-3 h-3" />
                <span>Beli</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-[#1A2230]/80 flex-1 overflow-y-auto terminal-scroll max-h-[420px]">
            {movers.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                {moverMode === "buy_zone"
                  ? "Belum ada saham Watchlist di Area Beli / dekat target."
                  : "Belum ada data emiten tersedia."}
              </div>
            ) : (
              movers.map((m) => (
                <button
                  key={m.ticker}
                  type="button"
                  onClick={() => onSelectStock(m.ticker)}
                  className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#172030] text-left transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-slate-100">{m.ticker}</span>
                      {m.targetStatus === "hit" && (
                        <span className="text-[9px] px-1 rounded bg-[#2EB886]/20 text-[#2EB886] font-mono">
                          Beli
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block">{m.name}</span>
                  </div>
                  <div className="text-right font-mono tnum shrink-0">
                    <div className="text-slate-200 font-medium">{formatNumber(m.price)}</div>
                    <div
                      className={`text-[11px] font-semibold ${
                        moverMode === "buy_zone"
                          ? m.targetStatus === "hit"
                            ? "text-[#2EB886]"
                            : "text-amber-300"
                          : m.changePercent >= 0
                          ? "text-[#2EB886]"
                          : "text-[#DC525F]"
                      }`}
                    >
                      {moverMode === "buy_zone"
                        ? formatPersen(m.targetDiffPercent, 1, true)
                        : formatPersen(m.changePercent, 1, true)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
