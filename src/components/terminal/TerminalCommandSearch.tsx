"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, Search, Star, X } from "lucide-react";
import { HISTORICAL_SERIES, STOCKS_DATA } from "@/data/stocksData";
import { formatMultiple, formatPersen, formatRupiah } from "@/lib/format";
import {
  MarketProvider,
  MarketQuote,
  StockSearchItem,
  searchStocks,
} from "@/lib/market-data";
import { EASE_TERMINAL, SPRING_SNAP } from "./terminalMotion";

type SearchScopeTab = "all" | "watchlist" | "curated";

interface CommandSearchRow {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  peRatio: number;
  isInWatchlist: boolean;
  isCurated: boolean;
  sparklinePoints: number[];
}

interface TerminalCommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  quotes: Record<string, MarketQuote>;
  provider: MarketProvider;
  customWatchlist: string[];
  isWatchlistFull: boolean;
  onToggleWatchlist: (ticker: string) => void;
}

const CURATED_MAP = new Map(STOCKS_DATA.map((s) => [s.ticker, s]));

function getSparklineSeries(ticker: string, changePercent: number): number[] {
  const hist = HISTORICAL_SERIES[ticker];
  if (hist && hist.length >= 6) {
    return hist.slice(-8).map((p) => p.price);
  }
  const base = 100;
  const delta = Math.max(-8, Math.min(8, changePercent));
  return [
    base,
    base + delta * 0.15,
    base + delta * 0.4,
    base + delta * 0.25,
    base + delta * 0.7,
    base + delta,
  ];
}

const MiniSvgSparkline: React.FC<{ points: number[]; isPositive: boolean }> = ({
  points,
  isPositive,
}) => {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(0.0001, max - min);
  const width = 56;
  const height = 18;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = isPositive ? "#22C55E" : "#EF4444";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
};

/**
 * Command-Palette Global Stock Search (⌘K / S) ala Rax Trade & Fey:
 * Tab Semua / Watchlist / Kurasi, pencarian live Yahoo BEI, mini-sparkline,
 * tombol ★ Watchlist langsung, dan navigasi keyboard ↑/↓/Enter/Esc.
 */
export const TerminalCommandSearch: React.FC<TerminalCommandSearchProps> = ({
  isOpen,
  onClose,
  selectedTicker,
  onSelectTicker,
  quotes,
  provider,
  customWatchlist,
  isWatchlistFull,
  onToggleWatchlist,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [scopeTab, setScopeTab] = useState<SearchScopeTab>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteState, setRemoteState] = useState<{
    query: string;
    items: StockSearchItem[];
    loading: boolean;
  }>({ query: "", items: [], loading: false });

  const watchlistSet = useMemo(() => new Set(customWatchlist), [customWatchlist]);

  // Fokus otomatis input saat modal terbuka
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Pencarian remote Yahoo Finance untuk kode saham BEI di luar daftar kurasi
  const trimmedQuery = query.trim();
  useEffect(() => {
    if (!isOpen || provider !== "yahoo" || trimmedQuery.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRemoteState((prev) => ({ ...prev, query: trimmedQuery, loading: true }));
      searchStocks(trimmedQuery)
        .then((res) => {
          if (!cancelled) {
            setRemoteState({ query: trimmedQuery, items: res, loading: false });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemoteState({ query: trimmedQuery, items: [], loading: false });
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, provider, trimmedQuery]);

  const localRows = useMemo<CommandSearchRow[]>(() => {
    const tickers = Array.from(
      new Set([...customWatchlist, ...STOCKS_DATA.map((s) => s.ticker)])
    );
    return tickers.map((ticker) => {
      const curated = CURATED_MAP.get(ticker);
      const q = quotes[ticker];
      const isLive = Boolean(provider === "yahoo" && q && !q.isFallback && q.price > 0);
      const price = isLive ? q.price : curated?.currentPrice ?? 0;
      const changePercent = isLive ? q.changePercent : curated?.change1D ?? 0;
      const peRatio = isLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : curated?.peRatio ?? 0;

      return {
        ticker,
        name: curated?.name || q?.name || "Saham BEI",
        sector: curated?.sector || q?.sector || "Bursa Efek Indonesia",
        price,
        changePercent,
        peRatio,
        isInWatchlist: watchlistSet.has(ticker),
        isCurated: Boolean(curated),
        sparklinePoints: getSparklineSeries(ticker, changePercent),
      };
    });
  }, [customWatchlist, quotes, provider, watchlistSet]);

  const results = useMemo<CommandSearchRow[]>(() => {
    const qLower = trimmedQuery.toLowerCase();
    const scoped = localRows.filter((row) => {
      if (scopeTab === "watchlist" && !row.isInWatchlist) return false;
      if (scopeTab === "curated" && !row.isCurated) return false;
      if (!qLower) return true;
      return (
        row.ticker.toLowerCase().includes(qLower) ||
        row.name.toLowerCase().includes(qLower) ||
        row.sector.toLowerCase().includes(qLower)
      );
    });

    if (
      scopeTab === "all" &&
      provider === "yahoo" &&
      trimmedQuery.length >= 2 &&
      remoteState.query === trimmedQuery
    ) {
      const existing = new Set(scoped.map((r) => r.ticker));
      const extras: CommandSearchRow[] = [];
      for (const item of remoteState.items) {
        if (existing.has(item.ticker)) continue;
        const q = quotes[item.ticker];
        const price = q && !q.isFallback ? q.price : 0;
        const changePercent = q && !q.isFallback ? q.changePercent : 0;
        extras.push({
          ticker: item.ticker,
          name: item.name,
          sector: item.sector || "Saham BEI",
          price,
          changePercent,
          peRatio: q?.peRatio ?? 0,
          isInWatchlist: watchlistSet.has(item.ticker),
          isCurated: false,
          sparklinePoints: getSparklineSeries(item.ticker, changePercent),
        });
      }
      return [...scoped, ...extras].slice(0, 14);
    }

    // Jika user mengetik persis 4 huruf BEI yang belum ada di daftar lokal, tawarkan langsung buka
    const upperDirect = trimmedQuery.toUpperCase();
    if (
      provider === "yahoo" &&
      /^[A-Z]{4}$/.test(upperDirect) &&
      !scoped.some((r) => r.ticker === upperDirect)
    ) {
      return [
        {
          ticker: upperDirect,
          name: `Buka langsung emiten ${upperDirect}.JK`,
          sector: "Bursa Efek Indonesia",
          price: 0,
          changePercent: 0,
          peRatio: 0,
          isInWatchlist: watchlistSet.has(upperDirect),
          isCurated: false,
          sparklinePoints: [100, 100],
        },
        ...scoped,
      ].slice(0, 14);
    }

    return scoped.slice(0, 14);
  }, [localRows, scopeTab, trimmedQuery, provider, remoteState, quotes, watchlistSet]);

  const safeActiveIndex = results.length > 0 ? Math.min(activeIndex, results.length - 1) : -1;

  const handleSelectRow = (ticker: string) => {
    onSelectTicker(ticker);
    setQuery("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && safeActiveIndex >= 0 && results[safeActiveIndex]) {
      e.preventDefault();
      handleSelectRow(results[safeActiveIndex].ticker);
    }
  };

  const isSearchingRemote =
    provider === "yahoo" &&
    trimmedQuery.length >= 2 &&
    remoteState.loading &&
    remoteState.query === trimmedQuery;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3"
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian cepat emiten saham BEI"
          onKeyDown={handleKeyDown}
        >
          {/* Blurred Obsidian Backdrop */}
          <motion.div
            key="cmd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#05070C]/75 backdrop-blur-sm"
          />

          {/* Modal Panel */}
          <motion.div
            key="cmd-panel"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: EASE_TERMINAL }}
            className="relative z-10 w-full max-w-2xl bg-[#0F131C] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden text-xs font-sans"
          >
            {/* Input Bar */}
            <div className="px-4 py-3 border-b border-white/[0.08] bg-[#0B0E15] flex items-center gap-3">
              {isSearchingRemote ? (
                <Loader2 className="w-4 h-4 text-[#2DD4BF] animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <Search className="w-4 h-4 text-[#2DD4BF] shrink-0" aria-hidden="true" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Ketik kode saham (BBCA, BREN, ANTM) atau nama emiten BEI..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Bersihkan pencarian"
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-1.5 py-0.5 rounded bg-[#161C29] border border-white/[0.08] font-mono text-[10px] text-slate-400 hover:text-white"
              >
                ESC
              </button>
            </div>

            {/* Scope Tabs */}
            <div className="px-4 py-2 border-b border-white/[0.07] bg-[#0D1119] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {[
                  { id: "all" as const, label: "Semua Emiten" },
                  { id: "watchlist" as const, label: `Watchlist (${customWatchlist.length})` },
                  { id: "curated" as const, label: `Kurasi (${STOCKS_DATA.length})` },
                ].map((tab) => {
                  const isActive = scopeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setScopeTab(tab.id);
                        setActiveIndex(0);
                      }}
                      className={`relative z-10 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        isActive ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="cmd-search-tab"
                          transition={SPRING_SNAP}
                          aria-hidden="true"
                          className="absolute inset-0 rounded bg-[#1E7B85]/80 -z-10"
                        />
                      )}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                ↑↓ Pilih &bull; Enter Buka
              </span>
            </div>

            {/* Results Table */}
            <div className="max-h-[52vh] overflow-y-auto terminal-scroll divide-y divide-white/[0.05]">
              {results.length === 0 ? (
                <div className="py-10 px-4 text-center text-slate-400">
                  Tidak ada emiten cocok untuk &ldquo;{query}&rdquo;.
                </div>
              ) : (
                results.map((row, idx) => {
                  const isHighlighted = idx === safeActiveIndex;
                  const isCurrent = row.ticker === selectedTicker;
                  const isUp = row.changePercent >= 0;

                  return (
                    <div
                      key={row.ticker}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isHighlighted
                          ? "bg-[#161C29] border-l-2 border-l-[#2DD4BF]"
                          : "hover:bg-[#131823]"
                      }`}
                      onClick={() => handleSelectRow(row.ticker)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!row.isInWatchlist && isWatchlistFull) return;
                            onToggleWatchlist(row.ticker);
                          }}
                          disabled={!row.isInWatchlist && isWatchlistFull}
                          aria-label={
                            row.isInWatchlist
                              ? `Hapus ${row.ticker} dari Watchlist`
                              : `Tambah ${row.ticker} ke Watchlist`
                          }
                          className="p-1 rounded hover:bg-white/[0.06] disabled:opacity-35 transition shrink-0"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              row.isInWatchlist
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-500 hover:text-amber-300"
                            }`}
                          />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-white">
                              {row.ticker}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded bg-[#1E7B85]/25 border border-[#2DD4BF]/40 text-[#2DD4BF] font-mono text-[9.5px]">
                                AKTIF
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                              {row.sector}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 truncate block">
                            {row.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 font-mono tnum">
                        <div className="hidden sm:block">
                          <MiniSvgSparkline points={row.sparklinePoints} isPositive={isUp} />
                        </div>

                        <div className="text-right w-24">
                          <span className="block text-slate-100 font-semibold">
                            {row.price > 0 ? formatRupiah(row.price) : "Live BEI"}
                          </span>
                          {row.price > 0 ? (
                            <span className={`text-[10.5px] ${isUp ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                              {formatPersen(row.changePercent, 1, true)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Klik buka</span>
                          )}
                        </div>

                        <div className="hidden md:block text-right w-14">
                          <span className="block text-[10px] text-slate-500 font-sans">P/E</span>
                          <span className="text-slate-300 text-[11px]">
                            {row.peRatio > 0 ? formatMultiple(row.peRatio, 1) : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
