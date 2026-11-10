"use client";

import React, { useState } from "react";
import { STOCKS_DATA } from "@/data/stocksData";
import { StockFundamental } from "@/types/market";
import { 
  Search, 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Layers, 
  Filter,
  DollarSign
} from "lucide-react";

interface StockScreenerViewProps {
  onSelectTickerForSimulator: (ticker: string) => void;
  onSelectTickerForValuation: (ticker: string) => void;
}

type FilterPreset = "ALL" | "DIVIDEND" | "UNDERVALUED" | "PROFITABLE" | "LOW_DEBT";
type SortField = "ticker" | "currentPrice" | "change1D" | "peRatio" | "pbvRatio" | "roe" | "dividendYield";

export const StockScreenerView: React.FC<StockScreenerViewProps> = ({
  onSelectTickerForSimulator,
  onSelectTickerForValuation,
}) => {
  const [filterPreset, setFilterPreset] = useState<FilterPreset>("ALL");
  const [search, setSearch] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("dividendYield");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const filteredStocks = STOCKS_DATA.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q);
      if (!match) return false;
    }

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="p-5 md:p-6 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Filter className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                IDX Stock Screener & Valuation Radar
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Filter saham berdasarkan kriteria dividen jumbo, valuasi murah, dan profitabilitas tinggi
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari kode saham, emiten, atau sektor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-sans"
            />
          </div>
        </div>

        {/* Preset Filter Buttons */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-2 border-t border-slate-800/80">
          {[
            { id: "ALL", label: "Semua Saham" },
            { id: "DIVIDEND", label: "💰 High Dividend (Yield > 5%)" },
            { id: "UNDERVALUED", label: "🏷️ Undervalued (P/E < 12x)" },
            { id: "PROFITABLE", label: "🔥 High Profitability (ROE > 18%)" },
            { id: "LOW_DEBT", label: "🛡️ Neraca Sehat (DER < 1.0x)" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => setFilterPreset(preset.id as FilterPreset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filterPreset === preset.id
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Screener Table */}
      <div className="overflow-x-auto rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("ticker")}>
                <div className="flex items-center space-x-1">
                  <span>Ticker / Nama</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("currentPrice")}>
                <div className="flex items-center space-x-1">
                  <span>Harga (Rp)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("change1D")}>
                <div className="flex items-center space-x-1">
                  <span>1D Change</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("peRatio")}>
                <div className="flex items-center space-x-1">
                  <span>P/E Ratio</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("pbvRatio")}>
                <div className="flex items-center space-x-1">
                  <span>PBV Ratio</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("roe")}>
                <div className="flex items-center space-x-1">
                  <span>ROE</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort("dividendYield")}>
                <div className="flex items-center space-x-1">
                  <span>Div Yield</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredStocks.map((stock) => {
              const isUp = stock.change1D > 0;
              return (
                <tr key={stock.ticker} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-white text-sm">
                        {stock.ticker}
                      </span>
                      <span className="text-[11px] text-slate-400 font-sans truncate max-w-[150px]">
                        {stock.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans block">
                      {stock.sector}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-200">
                    Rp {stock.currentPrice.toLocaleString("id-ID")}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        isUp
                          ? "text-emerald-400 bg-emerald-950/40"
                          : "text-rose-400 bg-rose-950/40"
                      }`}
                    >
                      {isUp ? `+${stock.change1D}%` : `${stock.change1D}%`}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`font-semibold ${
                        stock.peRatio <= stock.historicalPeMean
                          ? "text-emerald-400"
                          : "text-slate-300"
                      }`}
                    >
                      {stock.peRatio}x
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Mean: {stock.historicalPeMean}x
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-300">
                    {stock.pbvRatio}x
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`font-semibold ${
                        stock.roe >= 18 ? "text-emerald-400" : "text-slate-300"
                      }`}
                    >
                      {stock.roe}%
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`font-bold ${
                        stock.dividendYield >= 6.0
                          ? "text-amber-400"
                          : stock.dividendYield >= 4.0
                          ? "text-emerald-400"
                          : "text-slate-300"
                      }`}
                    >
                      {stock.dividendYield}%
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => onSelectTickerForSimulator(stock.ticker)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/30 transition"
                        title="Simulasi DCA"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectTickerForValuation(stock.ticker)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 border border-slate-700 hover:border-cyan-500/30 transition"
                        title="Lihat PE Band"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

