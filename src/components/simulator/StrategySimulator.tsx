"use client";

import React, { useState, useMemo } from "react";
import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import { 
  BarChart3, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  Repeat, 
  HelpCircle,
  Calendar,
  Layers,
  Award
} from "lucide-react";

interface StrategySimulatorProps {
  initialTicker?: string;
  onGoToValuation?: (ticker: string) => void;
}

export const StrategySimulator: React.FC<StrategySimulatorProps> = ({
  initialTicker = "BBCA",
  onGoToValuation
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>(initialTicker);
  const [monthlyDCA, setMonthlyDCA] = useState<number>(1000000); // 1 Million Rp default
  const [initialCapital, setInitialCapital] = useState<number>(0); // Lump-sum
  const [startYear, setStartYear] = useState<string>("2020");
  const [reinvestDividends, setReinvestDividends] = useState<boolean>(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const stockInfo = STOCKS_DATA.find((s) => s.ticker === selectedTicker) || STOCKS_DATA[0];

  // Simulation Logic
  const simulationResults = useMemo(() => {
    const rawSeries = HISTORICAL_SERIES[selectedTicker] || [];
    const ihsgSeries = IHSG_HISTORICAL;

    // Filter by start year
    const series = rawSeries.filter((d) => d.date >= `${startYear}-01`);
    if (series.length === 0) return null;

    let totalInvested = initialCapital;
    let shares = 0;
    let totalDividendsReceived = 0;
    let ihsgUnits = 0;
    let ihsgTotalInvested = initialCapital;

    // Initial Lump-sum at first date
    const firstPrice = series[0].price;
    const firstIhsg = ihsgSeries.find((i) => i.date === series[0].date)?.price || 6000;

    if (initialCapital > 0) {
      shares += Math.floor(initialCapital / firstPrice);
      ihsgUnits += initialCapital / firstIhsg;
    }

    let peakValue = 0;
    let maxDrawdown = 0;

    const timelineData = series.map((point) => {
      // Monthly DCA contribution
      totalInvested += monthlyDCA;
      const boughtShares = Math.floor(monthlyDCA / point.price);
      shares += boughtShares;

      // Benchmark IHSG DCA
      ihsgTotalInvested += monthlyDCA;
      const currentIhsg = ihsgSeries.find((i) => i.date === point.date)?.price || firstIhsg;
      ihsgUnits += monthlyDCA / currentIhsg;

      // Handle Dividend if any
      let currentDivAmount = 0;
      if (point.dividend && point.dividend > 0) {
        currentDivAmount = shares * point.dividend;
        totalDividendsReceived += currentDivAmount;

        if (reinvestDividends) {
          const dripShares = Math.floor(currentDivAmount / point.price);
          shares += dripShares;
        }
      }

      const portfolioValue = shares * point.price + (!reinvestDividends ? totalDividendsReceived : 0);
      const ihsgValue = ihsgUnits * currentIhsg;

      // Track Max Drawdown
      if (portfolioValue > peakValue) {
        peakValue = portfolioValue;
      } else if (peakValue > 0) {
        const drawdown = ((peakValue - portfolioValue) / peakValue) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      return {
        date: point.date,
        price: point.price,
        shares,
        totalInvested,
        portfolioValue,
        ihsgValue,
        dividendReceived: currentDivAmount,
        gainLoss: portfolioValue - totalInvested,
        returnPercent: totalInvested > 0 ? ((portfolioValue - totalInvested) / totalInvested) * 100 : 0
      };
    });

    const finalPoint = timelineData[timelineData.length - 1];
    const netProfit = finalPoint.portfolioValue - finalPoint.totalInvested;
    const totalReturnPercent = finalPoint.returnPercent;

    // Calculate CAGR (Compounded Annual Growth Rate)
    const years = (timelineData.length - 1) / 4; // Approximately 4 quarters per year in series
    const cagr = years > 0 && finalPoint.totalInvested > 0
      ? (Math.pow(finalPoint.portfolioValue / finalPoint.totalInvested, 1 / Math.max(years, 1)) - 1) * 100
      : 0;

    const ihsgFinalReturn = ((finalPoint.ihsgValue - finalPoint.totalInvested) / finalPoint.totalInvested) * 100;
    const alphaVsIhsg = totalReturnPercent - ihsgFinalReturn;

    return {
      timeline: timelineData,
      totalInvested: finalPoint.totalInvested,
      finalValue: finalPoint.portfolioValue,
      netProfit,
      totalReturnPercent,
      cagr,
      maxDrawdown,
      totalDividendsReceived,
      finalShares: finalPoint.shares,
      ihsgFinalValue: finalPoint.ihsgValue,
      ihsgFinalReturn,
      alphaVsIhsg
    };
  }, [selectedTicker, monthlyDCA, initialCapital, startYear, reinvestDividends]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Panel */}
      <div className="p-5 md:p-6 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Interactive DCA & Strategy Simulator
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Uji performa riil strategi nabung rutin (Dollar Cost Averaging) pada saham bluechip pilihan IHSG
            </p>
          </div>

          {/* Ticker Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-mono">Pilih Saham:</span>
            <div className="flex flex-wrap gap-1.5">
              {["BBCA", "BBRI", "BMRI", "ASII", "ADRO"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition ${
                    selectedTicker === t
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
          {/* Monthly DCA Input */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Nabung Rutin / Bulan (DCA):
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-mono">Rp</span>
              <input
                type="number"
                step="500000"
                min="0"
                value={monthlyDCA}
                onChange={(e) => setMonthlyDCA(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {[500000, 1000000, 2500000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setMonthlyDCA(preset)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  {(preset / 1000000).toFixed(1)}jt
                </button>
              ))}
            </div>
          </div>

          {/* Initial Capital (Lump-sum) */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Modal Awal / Lump-sum:
            </label>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-mono">Rp</span>
              <input
                type="number"
                step="1000000"
                min="0"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-1 mt-2">
              {[0, 5000000, 10000000].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setInitialCapital(preset)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  {preset === 0 ? "Nol" : `${preset / 1000000}jt`}
                </button>
              ))}
            </div>
          </div>

          {/* Start Date Year */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Mulai Investasi Sejak:
            </label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {["2020", "2021", "2022", "2023", "2024", "2025"].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setStartYear(yr)}
                  className={`py-1 rounded text-xs font-mono font-semibold transition ${
                    startYear === yr
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Reinvest Dividend (DRIP) Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="block text-[11px] font-mono text-slate-400 mb-1">
                Dividen Reinvestment (DRIP):
              </span>
              <p className="text-[10px] text-slate-500">
                Otomatis belikan saham tambahan tiap kali terima dividen
              </p>
            </div>
            <button
              onClick={() => setReinvestDividends(!reinvestDividends)}
              className={`mt-2 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                reinvestDividends
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{reinvestDividends ? "DRIP Aktif (Snowball)" : "Terima Kas Tunai"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Simulator Metrics Dashboard */}
      {simulationResults && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Invested */}
          <div className="p-4 rounded-xl bg-[#0e1626] border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Total Modal Disetor
            </span>
            <span className="text-base md:text-lg font-bold font-mono text-white">
              {formatIDR(simulationResults.totalInvested)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-1 font-mono">
              {simulationResults.timeline.length} Periode
            </span>
          </div>

          {/* Final Value */}
          <div className="p-4 rounded-xl bg-[#0e1626] border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Nilai Portofolio Kini
            </span>
            <span className="text-base md:text-lg font-bold font-mono text-emerald-400">
              {formatIDR(simulationResults.finalValue)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-mono">
              {simulationResults.finalShares.toLocaleString()} Lembar (
              {Math.floor(simulationResults.finalShares / 100)} Lot)
            </span>
          </div>

          {/* Net Profit & Return % */}
          <div className="p-4 rounded-xl bg-[#0e1626] border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Keuntungan Bersih
            </span>
            <span className="text-base md:text-lg font-bold font-mono text-emerald-400">
              +{formatIDR(simulationResults.netProfit)}
            </span>
            <span className="text-[11px] font-mono font-semibold text-emerald-400 block mt-1">
              +{simulationResults.totalReturnPercent.toFixed(1)}% Total
            </span>
          </div>

          {/* CAGR */}
          <div className="p-4 rounded-xl bg-[#0e1626] border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              CAGR (Tahunan)
            </span>
            <span className="text-base md:text-lg font-bold font-mono text-cyan-400">
              +{simulationResults.cagr.toFixed(2)}%/thn
            </span>
            <span className="text-[11px] text-slate-500 block mt-1">
              Laju Bunga Majemuk
            </span>
          </div>

          {/* Total Dividends */}
          <div className="p-4 rounded-xl bg-[#0e1626] border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Total Dividen Masuk
            </span>
            <span className="text-base md:text-lg font-bold font-mono text-amber-400">
              {formatIDR(simulationResults.totalDividendsReceived)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-mono">
              Yield on Cost ~{(simulationResults.totalDividendsReceived / Math.max(1, simulationResults.totalInvested) * 100).toFixed(1)}%
            </span>
          </div>

          {/* Alpha vs IHSG */}
          <div className="p-4 rounded-xl bg-[#0e1626] border border-slate-800">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Vs Benchmark IHSG
            </span>
            <span
              className={`text-base md:text-lg font-bold font-mono ${
                simulationResults.alphaVsIhsg >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {simulationResults.alphaVsIhsg >= 0 ? "+" : ""}
              {simulationResults.alphaVsIhsg.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400 block mt-1 font-mono">
              {simulationResults.alphaVsIhsg >= 0 ? "Outperform" : "Underperform"}
            </span>
          </div>
        </div>
      )}

      {/* Visual Chart of Portfolio Growth */}
      {simulationResults && (
        <div className="p-5 md:p-6 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
                <span>Grafik Pertumbuhan Nilai Portofolio ({selectedTicker})</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-sans">
                  Vs Modal Pokok & IHSG
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Hover pada grafik untuk melihat rincian tanggal, modal, dan nilai aset
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                <span className="text-slate-200">Portofolio {selectedTicker}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 bg-cyan-400"></span>
                <span className="text-slate-400">IHSG</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-slate-500"></span>
                <span className="text-slate-500">Modal Disetor</span>
              </div>
            </div>
          </div>

          {/* SVG Canvas Area Chart */}
          <div className="relative w-full h-72 pt-4">
            {(() => {
              const data = simulationResults.timeline;
              if (data.length < 2) return null;

              const maxVal = Math.max(
                ...data.map((d) => Math.max(d.portfolioValue, d.ihsgValue, d.totalInvested))
              ) * 1.08;
              const minVal = 0;

              const width = 1000;
              const height = 240;

              const getX = (index: number) => (index / (data.length - 1)) * width;
              const getY = (val: number) => height - ((val - minVal) / (maxVal - minVal)) * height;

              // Build path strings
              const portPoints = data.map((d, i) => `${getX(i)},${getY(d.portfolioValue)}`).join(" ");
              const investedPoints = data.map((d, i) => `${getX(i)},${getY(d.totalInvested)}`).join(" ");
              const ihsgPoints = data.map((d, i) => `${getX(i)},${getY(d.ihsgValue)}`).join(" ");

              const areaPath = `M ${getX(0)},${height} L ${data
                .map((d, i) => `${getX(i)},${getY(d.portfolioValue)}`)
                .join(" L ")} L ${getX(data.length - 1)},${height} Z`;

              return (
                <div className="relative w-full h-full">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="portGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                      <line
                        key={pct}
                        x1="0"
                        y1={height * (1 - pct)}
                        x2={width}
                        y2={height * (1 - pct)}
                        stroke="#1e293b"
                        strokeDasharray="4 4"
                      />
                    ))}

                    {/* Area fill for portfolio */}
                    <path d={areaPath} fill="url(#portGradient)" />

                    {/* Capital Invested Line */}
                    <polyline
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="2"
                      strokeDasharray="5 5"
                      points={investedPoints}
                    />

                    {/* IHSG Line */}
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      points={ihsgPoints}
                    />

                    {/* Portfolio Line */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      points={portPoints}
                    />

                    {/* Interactive Points on Hover */}
                    {hoverIndex !== null && (
                      <g>
                        <line
                          x1={getX(hoverIndex)}
                          y1="0"
                          x2={getX(hoverIndex)}
                          y2={height}
                          stroke="#94a3b8"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={getX(hoverIndex)}
                          cy={getY(data[hoverIndex].portfolioValue)}
                          r="5"
                          fill="#10b981"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                  </svg>

                  {/* Invisible Overlay for mouse events */}
                  <div
                    className="absolute inset-0 cursor-crosshair flex"
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    {data.map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-full"
                        onMouseEnter={() => setHoverIndex(i)}
                      />
                    ))}
                  </div>

                  {/* Floating Tooltip */}
                  {hoverIndex !== null && (
                    <div
                      className="absolute z-20 pointer-events-none p-3 rounded-xl bg-slate-950/95 border border-slate-700 shadow-2xl text-xs font-mono"
                      style={{
                        left: `${Math.min(80, Math.max(10, (hoverIndex / (data.length - 1)) * 100))}%`,
                        top: "10px"
                      }}
                    >
                      <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1.5 flex justify-between">
                        <span>{data[hoverIndex].date}</span>
                        <span className="text-emerald-400">Rp {data[hoverIndex].price.toLocaleString()}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between space-x-4">
                          <span className="text-slate-400">Nilai Portofolio:</span>
                          <span className="font-bold text-emerald-400">
                            {formatIDR(data[hoverIndex].portfolioValue)}
                          </span>
                        </div>
                        <div className="flex justify-between space-x-4">
                          <span className="text-slate-400">Total Modal:</span>
                          <span className="text-slate-200">
                            {formatIDR(data[hoverIndex].totalInvested)}
                          </span>
                        </div>
                        <div className="flex justify-between space-x-4">
                          <span className="text-slate-400">Akumulasi Return:</span>
                          <span className="text-emerald-400 font-bold">
                            +{data[hoverIndex].returnPercent.toFixed(1)}%
                          </span>
                        </div>
                        {data[hoverIndex].dividendReceived > 0 && (
                          <div className="flex justify-between space-x-4 text-amber-300">
                            <span>Dividen Cair:</span>
                            <span>{formatIDR(data[hoverIndex].dividendReceived)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/80">
            <span>Awal: {simulationResults.timeline[0].date}</span>
            <span>Max Drawdown: -{simulationResults.maxDrawdown.toFixed(1)}%</span>
            <span>Akhir: {simulationResults.timeline[simulationResults.timeline.length - 1].date}</span>
          </div>
        </div>
      )}

      {/* Stock Fundamental Snapshot & Valuation Button */}
      <div className="p-5 rounded-2xl bg-[#0e1626] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono text-slate-400 uppercase">
            Emiten Profile: {stockInfo.ticker} ({stockInfo.name})
          </span>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            {stockInfo.description}
          </p>
        </div>

        {onGoToValuation && (
          <button
            onClick={() => onGoToValuation(stockInfo.ticker)}
            className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-2 whitespace-nowrap self-start sm:self-center"
          >
            <Layers className="w-4 h-4" />
            <span>Lihat PE Band & Valuasi {stockInfo.ticker}</span>
          </button>
        )}
      </div>
    </div>
  );
};

