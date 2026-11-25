"use client";

import React, { useState, useMemo, useEffect } from "react";
import { STOCKS_DATA } from "@/data/stocksData";
import { formatNumber, formatMultiple, formatPersen } from "@/lib/format";
import { Search, ArrowUpDown, Plus, Loader2 } from "lucide-react";
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
  customTickers?: string[];
  onAddCustomTicker?: (ticker: string) => void;
}

type FilterPreset = "ALL" | "DIVIDEND" | "UNDERVALUED" | "PROFITABLE" | "LOW_DEBT";
type SortField = "ticker" | "currentPrice" | "change1D" | "peRatio" | "dividendYield";

const DEFAULT_SET = new Set(STOCKS_DATA.map((s) => s.ticker));

export const TerminalWatchlist: React.FC<TerminalWatchlistProps> = ({
  selectedTicker,
  onSelectTicker,
  quotes,
  provider = "illustrative",
  customTickers = [],
  onAddCustomTicker,
}) => {
  const [search, setSearch] = useState<string>("");
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("ALL");
  const [sortField, setSortField] = useState<SortField>("ticker");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [remoteState, setRemoteState] = useState<{
    query: string;
    items: StockSearchItem[];
  }>({ query: "", items: [] });

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

  // Gabungkan 9 emiten kurasi + emiten kustom sesi aktif (atau selectedTicker jika di luar 9)
  const mergedStocks = useMemo(() => {
    const baseList = STOCKS_DATA.map((s) => {
      const q = quotes?.[s.ticker];
      const isLive = Boolean(provider === "yahoo" && q && !q.isFallback);
      return {
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        currentPrice: q ? q.price : s.currentPrice,
        change1D: q ? q.changePercent : s.change1D,
        peRatio: isLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : s.peRatio,
        pbvRatio: isLive && q?.pbvRatio && q.pbvRatio > 0 ? q.pbvRatio : s.pbvRatio,
        dividendYield:
          isLive && q?.dividendYield !== undefined && q.dividendYield >= 0
            ? q.dividendYield
            : s.dividendYield,
        roe: s.roe,
        der: s.der,
        isLive,
        isCustom: false,
      };
    });

    if (provider !== "yahoo") {
      return baseList;
    }

    const extraCandidates = Array.from(
      new Set([
        ...customTickers,
        ...(DEFAULT_SET.has(selectedTicker) ? [] : [selectedTicker]),
      ])
    ).filter((t) => /^[A-Z]{4}$/.test(t) && !DEFAULT_SET.has(t));

    const customRows = extraCandidates
      .map((t) => {
        const q = quotes?.[t];
        if (!q || q.isFallback) return null;
        return {
          ticker: t,
          name: q.name || t,
          sector: "Saham Kustom BEI",
          currentPrice: q.price,
          change1D: q.changePercent,
          peRatio: q.peRatio ?? 0,
          pbvRatio: q.pbvRatio ?? 0,
          dividendYield: q.dividendYield ?? 0,
          roe: -1, // tidak dipakai di preset ROE ilustrasi
          der: 99, // tidak dipakai di preset DER ilustrasi
          isLive: true,
          isCustom: true,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return [...customRows, ...baseList];
  }, [quotes, provider, customTickers, selectedTicker]);

  const filteredAndSortedStocks = useMemo(() => {
    return mergedStocks
      .filter((s) => {
        if (trimmedSearch) {
          const q = trimmedSearch.toLowerCase();
          const match =
            s.ticker.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.sector.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (filterPreset === "DIVIDEND") return s.dividendYield >= 5.0;
        if (filterPreset === "UNDERVALUED") return s.peRatio > 0 && s.peRatio <= 12.0;
        if (filterPreset === "PROFITABLE") return !s.isCustom && s.roe >= 18.0;
        if (filterPreset === "LOW_DEBT") return !s.isCustom && s.der <= 1.0;
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === "string" && typeof valB === "string") {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
  }, [mergedStocks, trimmedSearch, filterPreset, sortField, sortAsc]);

  // Hasil pencarian Yahoo eksternal yang belum ada di list saat ini
  const externalSearchResults = useMemo(() => {
    if (provider !== "yahoo" || trimmedSearch.length < 2 || remoteState.query !== trimmedSearch) {
      return [];
    }
    const existingTickers = new Set(mergedStocks.map((m) => m.ticker));
    return remoteState.items.filter((item) => !existingTickers.has(item.ticker));
  }, [provider, trimmedSearch, remoteState, mergedStocks]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleOpenCustomTicker = (ticker: string) => {
    onAddCustomTicker?.(ticker);
    onSelectTicker(ticker);
  };

  return (
    <div className="h-full flex flex-col bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg font-sans">
      {/* Pane Header & Search */}
      <div className="p-3 border-b border-[#1E2736] bg-[#0E131C] space-y-2.5">
        <div className="flex items-center justify-between">
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
            {filteredAndSortedStocks.length} dari {mergedStocks.length} saham
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={
              provider === "yahoo"
                ? "Cari kode IDX apa saja (mis. BBNI, AMRT, TLKM)..."
                : "Cari kode saham, emiten, atau sektor..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#1E7B85]"
          />
        </div>

        {/* Filter Presets Chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {[
            { id: "ALL", label: "Semua" },
            { id: "DIVIDEND", label: "Dividen > 5%" },
            { id: "UNDERVALUED", label: "P/E < 12x" },
            { id: "PROFITABLE", label: "ROE > 18%" },
            { id: "LOW_DEBT", label: "DER < 1,0x" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setFilterPreset(preset.id as FilterPreset)}
              className={`px-2.5 py-1 rounded text-xs transition ${
                filterPreset === preset.id
                  ? "bg-[#1E7B85] text-white font-medium shadow-sm"
                  : "bg-[#171F2C] text-slate-400 hover:text-slate-200 border border-[#232F42]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Column Headers */}
      <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-[#0C1017] border-b border-[#1E2736] text-[11px] text-slate-400 select-none">
        <button
          onClick={() => handleSort("ticker")}
          className="col-span-4 flex items-center space-x-1 text-left hover:text-slate-200"
        >
          <span>Emiten</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={() => handleSort("currentPrice")}
          className="col-span-3 text-right flex items-center justify-end space-x-1 hover:text-slate-200"
        >
          <span>Harga</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={() => handleSort("change1D")}
          className="col-span-2 text-right flex items-center justify-end space-x-0.5 hover:text-slate-200"
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
          className="col-span-3 text-right flex items-center justify-end space-x-1 hover:text-slate-200"
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

      {/* Table Rows (Watchlist + Pencarian Bursa BEI) */}
      <div className="flex-1 overflow-y-auto terminal-scroll divide-y divide-[#1A2230]">
        {filteredAndSortedStocks.map((stock) => {
          const isSelected = selectedTicker === stock.ticker;
          const isUp = stock.change1D > 0;
          const isDown = stock.change1D < 0;

          return (
            <div
              key={stock.ticker}
              onClick={() => onSelectTicker(stock.ticker)}
              className={`grid grid-cols-12 gap-1 px-3 py-2.5 min-h-[48px] items-center cursor-pointer transition select-none text-xs ${
                isSelected
                  ? "bg-[#1E7B85]/15 border-l-2 border-[#1E7B85]"
                  : "hover:bg-[#151C2A] border-l-2 border-transparent"
              }`}
            >
              <div className="col-span-4 flex flex-col justify-center min-w-0 pr-1">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`font-mono font-bold text-xs ${
                      isSelected ? "text-white" : "text-slate-200"
                    }`}
                  >
                    {stock.ticker}
                  </span>
                  {stock.isCustom && (
                    <span className="text-[9px] font-sans px-1 py-0.2 rounded bg-[#1E7B85]/20 text-[#2DD4BF] border border-[#1E7B85]/40">
                      BEI
                    </span>
                  )}
                  {provider === "yahoo" && !stock.isLive && (
                    <span
                      className="text-[9px] font-sans px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      title="Quote Yahoo gagal diambil; menggunakan data acuan ilustrasi sementara"
                    >
                      ilus
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 truncate">
                  {stock.name}
                </span>
              </div>

              <div className="col-span-3 text-right flex flex-col justify-center">
                <span className="font-mono font-semibold text-slate-100 text-xs tnum">
                  {formatNumber(stock.currentPrice)}
                </span>
                <span className="text-[11px] text-slate-400 font-mono tnum">
                  {stock.pbvRatio > 0 ? `PBV ${formatMultiple(stock.pbvRatio, 2)}` : "PBV -"}
                </span>
              </div>

              <div className="col-span-2 text-right flex items-center justify-end">
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
              </div>

              <div className="col-span-3 text-right flex flex-col justify-center">
                <span className="font-mono text-xs text-slate-200 tnum">
                  {stock.peRatio > 0 ? formatMultiple(stock.peRatio, 1) : "-"}
                </span>
                <span className="text-[11px] text-slate-400 font-mono tnum">
                  {stock.dividendYield > 0 ? `Div ${formatPersen(stock.dividendYield, 1)}` : "Div -"}
                </span>
              </div>
            </div>
          );
        })}

        {/* Pencarian Live Bursa BEI (untuk kode di luar watchlist default) */}
        {provider === "yahoo" && trimmedSearch.length >= 2 && (
          <div className="bg-[#0C111B]">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-[#1A2230] flex items-center justify-between">
              <span>Pencarian Saham BEI (Yahoo)</span>
              {isRemoteSearching && <Loader2 className="w-3 h-3 animate-spin text-[#2DD4BF]" />}
            </div>

            {externalSearchResults.map((item) => (
              <button
                key={item.ticker}
                type="button"
                onClick={() => handleOpenCustomTicker(item.ticker)}
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
                  <Plus className="w-3 h-3" />
                  <span>Buka</span>
                </span>
              </button>
            ))}

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
          !(provider === "yahoo" && trimmedSearch.length >= 2) && (
            <div className="p-8 text-center text-xs text-slate-500">
              Tidak ada emiten yang sesuai kriteria filter.
            </div>
          )}
      </div>

      {/* Pane Footer Note */}
      <div className="p-2.5 border-t border-[#1E2736] bg-[#0E131C] text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        {provider === "yahoo" ? (
          <>
            <span>Harga, P/E, PBV, Div: Yahoo (~10 mnt)</span>
            <span>*Filter ROE &amp; DER: profil ilustrasi</span>
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
