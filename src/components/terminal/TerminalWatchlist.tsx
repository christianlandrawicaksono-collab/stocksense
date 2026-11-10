"use client";

import React, { useState, useMemo } from "react";
import { STOCKS_DATA } from "@/data/stocksData";
import { StockFundamental } from "@/types/market";
import { Search, ArrowUpDown, ChevronDown } from "lucide-react";

interface TerminalWatchlistProps {
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

type FilterPreset = "ALL" | "DIVIDEND" | "UNDERVALUED" | "PROFITABLE" | "LOW_DEBT";
type SortField = "ticker" | "currentPrice" | "change1D" | "peRatio" | "dividendYield";

export const TerminalWatchlist: React.FC<TerminalWatchlistProps> = ({
  selectedTicker,
  onSelectTicker,
}) => {
  const [search, setSearch] = useState<string>("");
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("ALL");
  const [sortField, setSortField] = useState<SortField>("ticker");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const filteredAndSortedStocks = useMemo(() => {
    return STOCKS_DATA.filter((s) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          s.ticker.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Presets
      if (filterPreset === "DIVIDEND") return s.dividendYield >= 5.0;
      if (filterPreset === "UNDERVALUED") return s.peRatio <= 12.0;
      if (filterPreset === "PROFITABLE") return s.roe >= 18.0;
      if (filterPreset === "LOW_DEBT") return s.der <= 1.0;
      return true;
    }).sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [search, filterPreset, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
      {/* Pane Header & Search */}
      <div className="p-3 border-b border-[#1E2736] bg-[#0E131C] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1E7B85]"></span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
              Daftar Pantau & Screener
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 tnum">
            {filteredAndSortedStocks.length} dari {STOCKS_DATA.length} Saham
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari kode, nama, atau sektor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#1E7B85] font-sans"
          />
        </div>

        {/* Filter Presets Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto terminal-scroll pb-1 text-[11px]">
          {[
            { id: "ALL", label: "Semua" },
            { id: "DIVIDEND", label: "Dividen > 5%" },
            { id: "UNDERVALUED", label: "P/E < 12x" },
            { id: "PROFITABLE", label: "ROE > 18%" },
            { id: "LOW_DEBT", label: "DER < 1.0x" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setFilterPreset(preset.id as FilterPreset)}
              className={`px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap transition ${
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

      {/* Table Headers */}
      <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-[#0C1017] border-b border-[#1E2736] text-[10px] font-mono text-slate-400 uppercase tracking-wider select-none">
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
          title="Perubahan sesi snapshot terakhir"
        >
          <span>1H %</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={() => handleSort("peRatio")}
          className="col-span-3 text-right flex items-center justify-end space-x-1 hover:text-slate-200"
        >
          <span>P/E</span>
          <ArrowUpDown className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Table Rows (Watchlist) */}
      <div className="flex-1 overflow-y-auto terminal-scroll divide-y divide-[#1A2230]">
        {filteredAndSortedStocks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            Tidak ada emiten yang sesuai kriteria filter.
          </div>
        ) : (
          filteredAndSortedStocks.map((stock) => {
            const isSelected = selectedTicker === stock.ticker;
            const isUp = stock.change1D > 0;
            const isDown = stock.change1D < 0;

            return (
              <div
                key={stock.ticker}
                onClick={() => onSelectTicker(stock.ticker)}
                className={`grid grid-cols-12 gap-1 px-3 py-2.5 cursor-pointer transition select-none text-xs ${
                  isSelected
                    ? "bg-[#1E7B85]/15 border-l-2 border-[#1E7B85]"
                    : "hover:bg-[#151C2A] border-l-2 border-transparent"
                }`}
              >
                {/* Ticker & Name */}
                <div className="col-span-4 flex flex-col justify-center min-w-0 pr-1">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`font-mono font-bold text-xs ${
                        isSelected ? "text-[#5CE1E6]" : "text-white"
                      }`}
                    >
                      {stock.ticker}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">
                    {stock.name}
                  </span>
                </div>

                {/* Price */}
                <div className="col-span-3 text-right flex flex-col justify-center font-mono tnum">
                  <span className="font-semibold text-slate-100 text-xs">
                    {stock.currentPrice.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    PBV {stock.pbvRatio}x
                  </span>
                </div>

                {/* 1D Change % */}
                <div className="col-span-2 text-right flex items-center justify-end font-mono tnum">
                  <span
                    className={`text-[11px] font-medium px-1 py-0.5 rounded ${
                      isUp
                        ? "text-[#2EB886] bg-[#2EB886]/10"
                        : isDown
                        ? "text-[#DC525F] bg-[#DC525F]/10"
                        : "text-slate-400 bg-slate-800/40"
                    }`}
                  >
                    {isUp ? `+${stock.change1D}%` : `${stock.change1D}%`}
                  </span>
                </div>

                {/* Valuation & Dividend */}
                <div className="col-span-3 text-right flex flex-col justify-center font-mono tnum">
                  <span
                    className={`font-medium text-xs ${
                      stock.peRatio <= stock.historicalPeMean
                        ? "text-[#2EB886]"
                        : "text-slate-300"
                    }`}
                  >
                    {stock.peRatio}x
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Div {stock.dividendYield}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pane Footer Note */}
      <div className="p-2 border-t border-[#1E2736] bg-[#0E131C] text-[10px] font-mono text-slate-400 flex items-center justify-between">
        <span>Basis Data: 9 Bluechips IDX</span>
        <span>Harga: Penutupan Terakhir</span>
      </div>
    </div>
  );
};
