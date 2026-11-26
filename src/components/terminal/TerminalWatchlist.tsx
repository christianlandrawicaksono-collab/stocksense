"use client";

import React, { useState, useMemo, useEffect } from "react";
import { STOCKS_DATA } from "@/data/stocksData";
import { formatNumber, formatMultiple, formatPersen, formatRupiah } from "@/lib/format";
import {
  MAX_CUSTOM_WATCHLIST,
  evaluateTargetBuyStatus,
  matchesWatchlistFilterPreset,
  type WatchlistEntryMeta,
  type WatchlistFilterPreset,
} from "@/lib/watchlist";
import { Search, ArrowUpDown, Plus, Loader2, Star, Bookmark, Target, StickyNote, X } from "lucide-react";
import {
  MarketQuote,
  MarketProvider,
  searchStocks,
  StockSearchItem,
} from "@/lib/market-data";

interface TerminalWatchlistProps {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  quotes?: Record<string, MarketQuote>;
  provider?: MarketProvider;
  customWatchlist?: string[];
  watchlistNotes?: Record<string, WatchlistEntryMeta>;
  onToggleWatchlist?: (ticker: string) => void;
  onAddToWatchlist?: (ticker: string) => void;
  maxWatchlistSize?: number;
}

type WatchlistTab = "watchlist" | "curated";
type SortField = "ticker" | "currentPrice" | "change1D" | "peRatio" | "dividendYield";

interface WatchlistRowItem {
  ticker: string;
  name: string;
  sector: string;
  currentPrice: number;
  change1D: number;
  peRatio: number;
  pbvRatio: number;
  dividendYield: number;
  roe?: number;
  der?: number;
  isLive: boolean;
  isCurated: boolean;
  hasQuoteData: boolean;
}

const CURATED_BY_TICKER = new Map(STOCKS_DATA.map((s) => [s.ticker, s]));
const CURATED_TICKERS = STOCKS_DATA.map((s) => s.ticker);

function buildWatchlistRow(
  ticker: string,
  quotes: Record<string, MarketQuote> | undefined,
  provider: MarketProvider
): WatchlistRowItem {
  const curated = CURATED_BY_TICKER.get(ticker);
  const q = quotes?.[ticker];
  const isLive = Boolean(provider === "yahoo" && q && !q.isFallback);

  if (curated) {
    return {
      ticker: curated.ticker,
      name: curated.name,
      sector: curated.sector,
      currentPrice: q ? q.price : curated.currentPrice,
      change1D: q ? q.changePercent : curated.change1D,
      peRatio: isLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : curated.peRatio,
      pbvRatio: isLive && q?.pbvRatio && q.pbvRatio > 0 ? q.pbvRatio : curated.pbvRatio,
      dividendYield:
        isLive && q?.dividendYield !== undefined && q.dividendYield >= 0
          ? q.dividendYield
          : curated.dividendYield,
      roe: curated.roe,
      der: curated.der,
      isLive,
      isCurated: true,
      hasQuoteData: true,
    };
  }

  const hasCustomQuote = Boolean(provider === "yahoo" && q && !q.isFallback && q.price > 0);
  return {
    ticker,
    name: hasCustomQuote && q?.name ? q.name : "Saham BEI",
    sector: hasCustomQuote && q?.sector ? q.sector : "Saham BEI",
    currentPrice: hasCustomQuote && q ? q.price : 0,
    change1D: hasCustomQuote && q ? q.changePercent : 0,
    peRatio: hasCustomQuote && q?.peRatio ? q.peRatio : 0,
    pbvRatio: hasCustomQuote && q?.pbvRatio ? q.pbvRatio : 0,
    dividendYield: hasCustomQuote && q?.dividendYield ? q.dividendYield : 0,
    roe: hasCustomQuote ? q?.roe : undefined,
    der: hasCustomQuote ? q?.der : undefined,
    isLive: hasCustomQuote,
    isCurated: false,
    hasQuoteData: hasCustomQuote,
  };
}

export const TerminalWatchlist: React.FC<TerminalWatchlistProps> = ({
  selectedTicker,
  onSelectTicker,
  quotes,
  provider = "illustrative",
  customWatchlist = [],
  watchlistNotes = {},
  onToggleWatchlist,
  onAddToWatchlist,
  maxWatchlistSize = MAX_CUSTOM_WATCHLIST,
}) => {
  const [listTabPref, setListTabPref] = useState<WatchlistTab | null>(null);
  const [search, setSearch] = useState<string>("");
  const [filterPreset, setFilterPreset] = useState<WatchlistFilterPreset>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("ticker");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [remoteState, setRemoteState] = useState<{
    query: string;
    items: StockSearchItem[];
  }>({ query: "", items: [] });

  const watchlistSet = useMemo(() => new Set(customWatchlist), [customWatchlist]);
  const isWatchlistFull = customWatchlist.length >= maxWatchlistSize;

  // Tampilkan "Watchlist Saya" otomatis jika user sudah punya daftar tersimpan, kecuali user memilih tab lain
  const activeTab: WatchlistTab =
    listTabPref ?? (customWatchlist.length > 0 ? "watchlist" : "curated");

  const trimmedSearch = search.trim();
  const isRemoteSearching =
    provider === "yahoo" &&
    trimmedSearch.length >= 2 &&
    remoteState.query !== trimmedSearch;

  useEffect(() => {
    if (provider !== "yahoo" || trimmedSearch.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      searchStocks(trimmedSearch)
        .then((results) => {
          if (!cancelled) {
            setRemoteState({ query: trimmedSearch, items: results });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRemoteState({ query: trimmedSearch, items: [] });
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedSearch, provider]);

  const activeTickers = activeTab === "watchlist" ? customWatchlist : CURATED_TICKERS;

  const activeRows = useMemo(
    () => activeTickers.map((t) => buildWatchlistRow(t, quotes, provider)),
    [activeTickers, quotes, provider]
  );

  const enrichedRows = useMemo(() => {
    return activeRows.map((row) => {
      const entryMeta = watchlistNotes[row.ticker];
      const targetEval = evaluateTargetBuyStatus(
        row.hasQuoteData ? row.currentPrice : 0,
        entryMeta?.targetBuyPrice
      );
      return {
        ...row,
        entryMeta,
        targetEval,
      };
    });
  }, [activeRows, watchlistNotes]);

  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const row of activeRows) {
      if (row.sector && row.sector !== "Saham BEI") {
        set.add(row.sector);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeRows]);

  const effectiveSector =
    selectedSector !== "ALL" && availableSectors.includes(selectedSector)
      ? selectedSector
      : "ALL";

  const targetOpportunityCount = useMemo(
    () =>
      enrichedRows.filter(
        (r) => r.targetEval.status === "hit" || r.targetEval.status === "near"
      ).length,
    [enrichedRows]
  );

  const filteredAndSortedStocks = useMemo(() => {
    return enrichedRows
      .filter((s) => {
        if (trimmedSearch) {
          const q = trimmedSearch.toLowerCase();
          const match =
            s.ticker.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.sector.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (effectiveSector !== "ALL" && s.sector !== effectiveSector) {
          return false;
        }

        return matchesWatchlistFilterPreset(
          { ...s, targetStatus: s.targetEval.status },
          filterPreset
        );
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === "string" && typeof valB === "string") {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
  }, [enrichedRows, trimmedSearch, effectiveSector, filterPreset, sortField, sortAsc]);

  // Hasil pencarian Yahoo eksternal yang belum ada di tab aktif saat ini
  const externalSearchResults = useMemo(() => {
    if (provider !== "yahoo" || trimmedSearch.length < 2 || remoteState.query !== trimmedSearch) {
      return [];
    }
    const existingTickers = new Set(activeRows.map((m) => m.ticker));
    return remoteState.items.filter((item) => !existingTickers.has(item.ticker));
  }, [provider, trimmedSearch, remoteState, activeRows]);

  const isViewingTemporaryExternal =
    !watchlistSet.has(selectedTicker) && !CURATED_BY_TICKER.has(selectedTicker);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleAddAndOpenFromSearch = (ticker: string) => {
    if (!isWatchlistFull || watchlistSet.has(ticker)) {
      onAddToWatchlist?.(ticker);
      setListTabPref("watchlist");
    }
    onSelectTicker(ticker);
  };

  const handleStarClick = (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    // Kunci tab agar daftar tidak melompat saat user menambah bintang pertama dari tab Kurasi
    if (!listTabPref) {
      setListTabPref(activeTab);
    }
    onToggleWatchlist?.(ticker);
  };

  return (
    <div className="h-full flex flex-col bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg font-sans">
      {/* Pane Header, Tab Pemisah & Search */}
      <div className="p-3 border-b border-[#1E2736] bg-[#0E131C] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                provider === "yahoo" ? "bg-[#2EB886]" : "bg-[#1E7B85]"
              }`}
            ></span>
            <span className="text-xs font-semibold text-slate-300">
              Daftar pantau dan penyaring
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono tnum">
            {filteredAndSortedStocks.length} dari {activeRows.length} saham
          </span>
        </div>

        {/* Pemisah Tegas: Watchlist Saya vs Saham Kurasi */}
        <div className="grid grid-cols-2 gap-1 bg-[#080B10] p-1 rounded-lg border border-[#20293A] text-xs">
          <button
            type="button"
            onClick={() => setListTabPref("watchlist")}
            className={`px-2 py-1.5 rounded-md font-medium transition flex items-center justify-center space-x-1.5 ${
              activeTab === "watchlist"
                ? "bg-[#1E7B85] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Star
              className={`w-3 h-3 ${
                activeTab === "watchlist"
                  ? "fill-amber-300 text-amber-300"
                  : customWatchlist.length > 0
                  ? "text-amber-400"
                  : "text-slate-500"
              }`}
            />
            <span>Watchlist Saya</span>
            <span className="font-mono text-[10px] opacity-90 tnum">
              ({customWatchlist.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setListTabPref("curated")}
            className={`px-2 py-1.5 rounded-md font-medium transition flex items-center justify-center space-x-1.5 ${
              activeTab === "curated"
                ? "bg-[#1E7B85] text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bookmark className="w-3 h-3" />
            <span>Saham Kurasi</span>
            <span className="font-mono text-[10px] opacity-90 tnum">
              ({CURATED_TICKERS.length})
            </span>
          </button>
        </div>

        {/* Info singkat jika membuka emiten sementara dari Berita */}
        {isViewingTemporaryExternal && (
          <div className="px-2.5 py-1.5 rounded-lg bg-[#172332]/70 border border-[#1E7B85]/40 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-300 truncate">
              Dibuka: <strong className="font-mono text-[#2DD4BF]">{selectedTicker}</strong>
            </span>
            {onAddToWatchlist && (
              <button
                type="button"
                disabled={isWatchlistFull}
                onClick={() => {
                  onAddToWatchlist(selectedTicker);
                  setListTabPref("watchlist");
                }}
                className="shrink-0 inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#1E7B85]/25 hover:bg-[#1E7B85] text-[#2DD4BF] hover:text-white border border-[#1E7B85]/50 font-medium transition disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>{isWatchlistFull ? "Penuh" : "Simpan ke Watchlist"}</span>
              </button>
            )}
          </div>
        )}

        {/* Search input & Sector Dropdown */}
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="watchlist-search-input"
              name="watchlistSearch"
              type="text"
              aria-label="Cari kode saham atau emiten"
              placeholder={
                provider === "yahoo"
                  ? "Cari kode BEI..."
                  : "Cari saham / sektor..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#1E7B85]"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Bersihkan pencarian"
                title="Bersihkan pencarian"
                className="p-1 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {availableSectors.length > 1 && (
            <select
              id="watchlist-sector-select"
              name="watchlistSector"
              value={effectiveSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              aria-label="Filter sektor saham"
              title="Filter berdasarkan sektor"
              className="max-w-[132px] px-2 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-[#1E7B85] truncate"
            >
              <option value="ALL">Semua Sektor</option>
              {availableSectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Filter Presets Chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {[
            { id: "ALL", label: "Semua", title: "Tampilkan semua saham" },
            {
              id: "TARGET_BUY",
              label:
                targetOpportunityCount > 0
                  ? `Area Beli (${targetOpportunityCount})`
                  : "Area Beli",
              title: "Saham di Area Beli atau mendekati Target Beli (+5%)",
            },
            { id: "DIVIDEND", label: "Div > 5%", title: "Dividen Yield ≥ 5%" },
            { id: "UNDERVALUED", label: "P/E < 12", title: "Rasio P/E ≤ 12x" },
            { id: "PROFITABLE", label: "ROE > 18%", title: "Return on Equity ≥ 18%" },
            { id: "LOW_DEBT", label: "DER < 1", title: "Debt to Equity Ratio ≤ 1,0x" },
          ].map((preset) => {
            const isTargetChip = preset.id === "TARGET_BUY";
            const isActive = filterPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.title}
                onClick={() => setFilterPreset(preset.id as WatchlistFilterPreset)}
                className={`px-2 py-1 rounded text-[11px] transition inline-flex items-center gap-1 ${
                  isActive
                    ? isTargetChip
                      ? "bg-[#2EB886] text-[#08120E] font-semibold shadow-sm"
                      : "bg-[#1E7B85] text-white font-medium shadow-sm"
                    : isTargetChip && targetOpportunityCount > 0
                    ? "bg-[#2EB886]/15 text-[#2EB886] hover:bg-[#2EB886]/25 border border-[#2EB886]/40"
                    : "bg-[#171F2C] text-slate-400 hover:text-slate-200 border border-[#232F42]"
                }`}
              >
                {isTargetChip && <Target className="w-3 h-3 shrink-0" />}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,0.85fr)_minmax(0,0.72fr)_minmax(0,0.88fr)] gap-1 px-3 py-2 bg-[#0C1017] border-b border-[#1E2736] text-[11px] text-slate-400 select-none">
        <button
          onClick={() => handleSort("ticker")}
          className="flex items-center space-x-1 text-left hover:text-slate-200"
        >
          <span>Emiten</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={() => handleSort("currentPrice")}
          className="text-right flex items-center justify-end space-x-1 hover:text-slate-200"
        >
          <span>Harga</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={() => handleSort("change1D")}
          className="text-right flex items-center justify-end space-x-0.5 hover:text-slate-200"
          title={
            provider === "yahoo"
              ? "Perubahan harga hari ini (Yahoo Finance, tertunda ~10 menit)"
              : "Perubahan harga hari ini (data ilustrasi)"
          }
        >
          <span className="truncate">Hari ini</span>
          <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
        </button>
        <button
          onClick={() => handleSort("peRatio")}
          className="text-right flex items-center justify-end space-x-1 hover:text-slate-200"
          title={
            provider === "yahoo"
              ? "Rasio P/E (TTM) dan Dividen Yield (Yahoo Finance)"
              : "Rasio P/E dan Dividen Yield (data fundamental ilustrasi)"
          }
        >
          <span className="truncate">{provider === "yahoo" ? "P/E (Live)" : "P/E (ilus)"}</span>
          <ArrowUpDown className="w-2.5 h-2.5 shrink-0" />
        </button>
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto terminal-scroll divide-y divide-[#1A2230]">
        {filteredAndSortedStocks.map((stock) => {
          const isSelected = selectedTicker === stock.ticker;
          const inWatchlist = watchlistSet.has(stock.ticker);
          const { entryMeta, targetEval } = stock;
          const isUp = stock.change1D > 0;
          const isDown = stock.change1D < 0;

          return (
            <div
              key={stock.ticker}
              onClick={() => onSelectTicker(stock.ticker)}
              className={`grid grid-cols-[minmax(0,1.55fr)_minmax(0,0.85fr)_minmax(0,0.72fr)_minmax(0,0.88fr)] gap-1 px-3 py-2 min-h-[46px] items-center cursor-pointer transition select-none text-xs ${
                isSelected
                  ? "bg-[#1E7B85]/15 border-l-2 border-[#1E7B85]"
                  : targetEval.status === "hit"
                  ? "bg-[#2EB886]/[0.06] hover:bg-[#2EB886]/[0.12] border-l-2 border-[#2EB886]"
                  : targetEval.status === "near"
                  ? "bg-amber-500/[0.04] hover:bg-[#151C2A] border-l-2 border-amber-400/70"
                  : "hover:bg-[#151C2A] border-l-2 border-transparent"
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 pr-1">
                {onToggleWatchlist && (
                  <button
                    type="button"
                    onClick={(e) => handleStarClick(e, stock.ticker)}
                    disabled={!inWatchlist && isWatchlistFull}
                    title={
                      inWatchlist
                        ? `Hapus ${stock.ticker} dari Watchlist Saya`
                        : isWatchlistFull
                        ? `Watchlist Saya penuh (maks. ${maxWatchlistSize} saham)`
                        : `Simpan ${stock.ticker} ke Watchlist Saya`
                    }
                    aria-label={
                      inWatchlist
                        ? `Hapus ${stock.ticker} dari Watchlist Saya`
                        : `Simpan ${stock.ticker} ke Watchlist Saya`
                    }
                    className="p-1 -ml-1 rounded hover:bg-[#1E2736] transition disabled:opacity-35 shrink-0"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        inWatchlist
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-500 hover:text-amber-300"
                      }`}
                    />
                  </button>
                )}

                <div className="flex flex-col justify-center min-w-0">
                  <div className="flex items-center space-x-1 min-w-0">
                    <span
                      className={`font-mono font-bold text-xs shrink-0 ${
                        isSelected ? "text-white" : "text-slate-200"
                      }`}
                    >
                      {stock.ticker}
                    </span>
                    {!stock.isCurated && (
                      <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-[#1E7B85]/20 text-[#2DD4BF] border border-[#1E7B85]/40 shrink-0">
                        BEI
                      </span>
                    )}
                    {provider === "yahoo" && stock.isCurated && !stock.isLive && (
                      <span
                        className="text-[9px] font-sans px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0"
                        title="Quote Yahoo gagal diambil; menggunakan data acuan ilustrasi sementara"
                      >
                        ilus
                      </span>
                    )}
                    <span
                      className="text-[10px] text-slate-500 truncate min-w-0"
                      title={stock.sector}
                    >
                      &middot; {stock.sector}
                    </span>
                    {entryMeta?.note && (
                      <span title={entryMeta.note} className="shrink-0 text-[#2DD4BF]/80">
                        <StickyNote className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] text-slate-400 truncate leading-tight"
                    title={`${stock.name} (${stock.sector})`}
                  >
                    {stock.name}
                  </span>
                  {entryMeta?.targetBuyPrice && (
                    <div className="mt-0.5 flex items-center min-w-0">
                      <span
                        className={`inline-flex items-center space-x-1 text-[10px] font-mono tnum px-1.5 py-0.2 rounded truncate ${
                          targetEval.status === "hit"
                            ? "bg-[#2EB886]/20 text-[#2EB886] border border-[#2EB886]/35 font-semibold"
                            : targetEval.status === "near"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium"
                            : "bg-[#171F2C] text-slate-400 border border-[#232F42]"
                        }`}
                        title={
                          targetEval.status === "hit"
                            ? `Harga di area target beli (${formatRupiah(entryMeta.targetBuyPrice)})`
                            : targetEval.status === "near"
                            ? `Mendekati target beli (${formatRupiah(entryMeta.targetBuyPrice)})`
                            : `Target beli: ${formatRupiah(entryMeta.targetBuyPrice)}`
                        }
                      >
                        <Target className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">
                          {targetEval.status === "hit"
                            ? `Area Beli ≤${formatNumber(entryMeta.targetBuyPrice)}`
                            : targetEval.status === "near"
                            ? `Dekat ${formatNumber(entryMeta.targetBuyPrice)}`
                            : `Beli ${formatNumber(entryMeta.targetBuyPrice)}`}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right flex flex-col justify-center">
                <span className="font-mono font-semibold text-slate-100 text-xs tnum">
                  {stock.hasQuoteData && stock.currentPrice > 0
                    ? formatNumber(stock.currentPrice)
                    : "-"}
                </span>
                <span className="text-[11px] text-slate-400 font-mono tnum">
                  {stock.hasQuoteData && stock.pbvRatio > 0
                    ? `PBV ${formatMultiple(stock.pbvRatio, 2)}`
                    : !stock.isCurated && provider !== "yahoo"
                    ? "Butuh Yahoo"
                    : "PBV -"}
                </span>
              </div>

              <div className="text-right flex items-center justify-end">
                {stock.hasQuoteData ? (
                  <span
                    className={`text-[11px] font-mono tnum px-1 py-0.5 rounded ${
                      isUp
                        ? "text-[#2EB886] bg-[#2EB886]/10"
                        : isDown
                        ? "text-[#DC525F] bg-[#DC525F]/10"
                        : "text-slate-400 bg-slate-800/40"
                    }`}
                  >
                    {formatPersen(stock.change1D, 1, true)}
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-slate-500">-</span>
                )}
              </div>

              <div className="text-right flex flex-col justify-center">
                <span className="font-mono text-xs text-slate-200 tnum">
                  {stock.hasQuoteData && stock.peRatio > 0
                    ? formatMultiple(stock.peRatio, 1)
                    : "-"}
                </span>
                <span className="text-[11px] text-slate-400 font-mono tnum">
                  {filterPreset === "PROFITABLE"
                    ? stock.roe !== undefined
                      ? `ROE ${formatPersen(stock.roe, 1)}`
                      : "ROE -"
                    : filterPreset === "LOW_DEBT"
                    ? stock.der !== undefined
                      ? `DER ${formatMultiple(stock.der, 2)}`
                      : "DER -"
                    : stock.hasQuoteData && stock.dividendYield > 0
                    ? `Div ${formatPersen(stock.dividendYield, 1)}`
                    : "Div -"}
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty state Watchlist Saya saat belum ada saham dipilih */}
        {activeTab === "watchlist" && customWatchlist.length === 0 && !trimmedSearch && (
          <div className="p-6 text-center space-y-3">
            <div className="w-9 h-9 mx-auto rounded-full bg-[#171F2C] border border-[#232F42] flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-200">
                Watchlist Saya masih kosong
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Simpan hingga {maxWatchlistSize} saham pilihan Anda secara permanen. Klik ikon bintang di{" "}
                <strong className="text-slate-300">Saham Kurasi</strong> atau cari kode BEI di atas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setListTabPref("curated")}
              className="px-3 py-1.5 rounded-lg bg-[#1E7B85] hover:bg-[#1E7B85]/85 text-white text-xs font-medium transition"
            >
              Pilih dari Saham Kurasi
            </button>
          </div>
        )}

        {/* Pencarian Live Bursa BEI (Yahoo) */}
        {provider === "yahoo" && trimmedSearch.length >= 2 && (
          <div className="bg-[#0C111B]">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-[#1A2230] flex items-center justify-between">
              <span>Pencarian Saham BEI (Yahoo)</span>
              {isRemoteSearching && <Loader2 className="w-3 h-3 animate-spin text-[#2DD4BF]" />}
            </div>

            {externalSearchResults.map((item) => {
              const alreadySaved = watchlistSet.has(item.ticker);
              return (
                <button
                  key={item.ticker}
                  type="button"
                  onClick={() => handleAddAndOpenFromSearch(item.ticker)}
                  className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#151C2A] text-left transition text-xs border-b border-[#171F2C]/60"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-[#2DD4BF]">{item.ticker}</span>
                      {item.sector && (
                        <span className="text-[10px] text-slate-400 truncate">&bull; {item.sector}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-300 truncate block">{item.name}</span>
                  </div>
                  <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#1E7B85]/20 text-[#2DD4BF] border border-[#1E7B85]/40 text-[11px] shrink-0">
                    {alreadySaved ? (
                      <span>Buka</span>
                    ) : isWatchlistFull ? (
                      <span>Buka (penuh)</span>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        <span>Watchlist</span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}

            {!isRemoteSearching &&
              externalSearchResults.length === 0 &&
              filteredAndSortedStocks.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ditemukan emiten BEI yang cocok untuk &ldquo;{trimmedSearch}&rdquo;.
                </div>
              )}
          </div>
        )}

        {filteredAndSortedStocks.length === 0 &&
          !(activeTab === "watchlist" && customWatchlist.length === 0 && !trimmedSearch) &&
          !(provider === "yahoo" && trimmedSearch.length >= 2) && (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2.5">
              <p>
                {filterPreset === "TARGET_BUY"
                  ? "Belum ada emiten di Area Beli atau mendekati Target Beli (+5%)."
                  : "Tidak ada emiten yang sesuai kriteria filter."}
              </p>
              {(filterPreset !== "ALL" || effectiveSector !== "ALL" || trimmedSearch.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterPreset("ALL");
                    setSelectedSector("ALL");
                    setSearch("");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#171F2C] hover:bg-[#1E2736] text-slate-200 border border-[#232F42] text-[11px] font-medium transition"
                >
                  Reset Filter
                </button>
              )}
            </div>
          )}
      </div>

      {/* Pane Footer Note */}
      <div className="p-2.5 border-t border-[#1E2736] bg-[#0E131C] text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        {activeTab === "watchlist" ? (
          <>
            <span>
              Tersimpan lokal: {customWatchlist.length}/{maxWatchlistSize} saham
            </span>
            <span>
              {isWatchlistFull
                ? "Batas maksimal tercapai"
                : provider === "yahoo"
                ? "Sektor, ROE & DER: Yahoo Finance"
                : "Juga memprioritaskan feed Berita"}
            </span>
          </>
        ) : provider === "yahoo" ? (
          <>
            <span>Harga, P/E, PBV, Div: Yahoo (~10 mnt)</span>
            <span>Filter ROE &amp; DER: kurasi + Yahoo</span>
          </>
        ) : (
          <>
            <span>Basis data: 9 emiten IDX</span>
            <span>*Data ilustrasi, bukan harga pasar</span>
          </>
        )}
      </div>
    </div>
  );
};
