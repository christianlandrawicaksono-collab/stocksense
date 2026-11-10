"use client";

import React, { useState, useMemo } from "react";
import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import { StockFundamental } from "@/types/market";
import { 
  BarChart2, 
  Layers, 
  Calculator, 
  Info, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";

interface TerminalMainPaneProps {
  selectedTicker: string;
}

type TerminalTab = "valuation" | "simulator" | "fundamental";
type ChartTimeframe = "1Y" | "3Y" | "5Y" | "ALL";

export const TerminalMainPane: React.FC<TerminalMainPaneProps> = ({
  selectedTicker,
}) => {
  const [activeTab, setActiveTab] = useState<TerminalTab>("valuation");
  const [chartTf, setChartTf] = useState<ChartTimeframe>("ALL");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // DCA Simulator states
  const [monthlyDCA, setMonthlyDCA] = useState<number>(1000000);
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [simStartYear, setSimStartYear] = useState<string>("2020");
  const [reinvestDividends, setReinvestDividends] = useState<boolean>(true);

  const stock = useMemo(() => {
    return STOCKS_DATA.find((s) => s.ticker === selectedTicker) || STOCKS_DATA[0];
  }, [selectedTicker]);

  // Historical data for chart
  const fullSeries = useMemo(() => {
    return HISTORICAL_SERIES[selectedTicker] || [];
  }, [selectedTicker]);

  const filteredChartSeries = useMemo(() => {
    if (fullSeries.length === 0) return [];
    if (chartTf === "1Y") return fullSeries.slice(-5); // ~Last 1 year
    if (chartTf === "3Y") return fullSeries.slice(-13); // ~Last 3 years
    if (chartTf === "5Y") return fullSeries.slice(-21); // ~Last 5 years
    return fullSeries; // ALL (2020 - 2026)
  }, [fullSeries, chartTf]);

  // P/E Band and Fair Value Calculations
  const impliedEPS = stock.currentPrice / stock.peRatio;
  const impliedBVPS = stock.currentPrice / stock.pbvRatio;

  const targetMeanPrice = Math.round(impliedEPS * stock.historicalPeMean);
  const targetSd1MinusPrice = Math.round(impliedEPS * stock.peSd1Minus);
  const targetSd2MinusPrice = Math.round(impliedEPS * stock.peSd2Minus);
  const targetSd1PlusPrice = Math.round(impliedEPS * stock.peSd1Plus);
  const targetSd2PlusPrice = Math.round(impliedEPS * stock.peSd2Plus);

  const grahamNumber = Math.round(Math.sqrt(22.5 * impliedEPS * impliedBVPS));
  const grahamUpside = ((grahamNumber - stock.currentPrice) / stock.currentPrice) * 100;
  const meanUpside = ((targetMeanPrice - stock.currentPrice) / stock.currentPrice) * 100;

  // Valuation Status
  const valuationStatus = useMemo(() => {
    if (stock.peRatio <= stock.peSd2Minus) {
      return {
        label: "Diskon Ekstrim (-2 SD)",
        color: "text-[#2EB886] bg-[#2EB886]/10 border-[#2EB886]/30",
        verdict: "Berada di bawah deviasi -2 SD 5 tahun. Area margin keamanan tertinggi secara historis."
      };
    } else if (stock.peRatio <= stock.peSd1Minus) {
      return {
        label: "Undervalued (-1 SD)",
        color: "text-[#2EB886] bg-[#2EB886]/10 border-[#2EB886]/30",
        verdict: "Di bawah rerata historis 5 tahun. Menawarkan valuasi atraktif untuk akumulasi."
      };
    } else if (stock.peRatio <= stock.historicalPeMean) {
      return {
        label: "Valuasi Wajar (Area Mean)",
        color: "text-[#1E7B85] bg-[#1E7B85]/10 border-[#1E7B85]/30",
        verdict: "Mendekati rerata historis 5 tahun, mencerminkan kinerja operasi normal."
      };
    } else if (stock.peRatio <= stock.peSd1Plus) {
      return {
        label: "Cukup Premium (+1 SD)",
        color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
        verdict: "Di atas rerata wajar. Potensi kenaikan jangka pendek cenderung terbatas."
      };
    } else {
      return {
        label: "Overvalued (+2 SD)",
        color: "text-[#DC525F] bg-[#DC525F]/10 border-[#DC525F]/30",
        verdict: "Jauh di atas batas deviasi wajar historis. Memiliki risiko koreksi valuasi."
      };
    }
  }, [stock]);

  // DCA Simulation Logic
  const simulationResults = useMemo(() => {
    const rawSeries = HISTORICAL_SERIES[selectedTicker] || [];
    const ihsgSeries = IHSG_HISTORICAL;

    const series = rawSeries.filter((d) => d.date >= `${simStartYear}-01`);
    if (series.length === 0) return null;

    let totalInvested = initialCapital;
    let shares = 0;
    let totalDividendsReceived = 0;
    let ihsgUnits = 0;
    let ihsgTotalInvested = initialCapital;

    const firstPrice = series[0].price;
    const firstIhsg = ihsgSeries.find((i) => i.date === series[0].date)?.price || 6000;

    if (initialCapital > 0) {
      shares += Math.floor(initialCapital / firstPrice);
      ihsgUnits += initialCapital / firstIhsg;
    }

    let peakValue = 0;
    let maxDrawdown = 0;

    const timelineData = series.map((point) => {
      totalInvested += monthlyDCA;
      const boughtShares = Math.floor(monthlyDCA / point.price);
      shares += boughtShares;

      ihsgTotalInvested += monthlyDCA;
      const currentIhsg = ihsgSeries.find((i) => i.date === point.date)?.price || firstIhsg;
      ihsgUnits += monthlyDCA / currentIhsg;

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

      if (portfolioValue > peakValue) {
        peakValue = portfolioValue;
      } else if (peakValue > 0) {
        const drawdown = ((peakValue - portfolioValue) / peakValue) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      return {
        date: point.date,
        price: point.price,
        portfolioValue,
        totalInvested,
        ihsgValue
      };
    });

    const finalPoint = timelineData[timelineData.length - 1];
    const netProfit = finalPoint.portfolioValue - finalPoint.totalInvested;
    const totalReturnPercent = finalPoint.totalInvested > 0
      ? ((finalPoint.portfolioValue - finalPoint.totalInvested) / finalPoint.totalInvested) * 100
      : 0;

    const years = Math.max(1, (timelineData.length - 1) / 4);
    const cagr = finalPoint.totalInvested > 0
      ? (Math.pow(finalPoint.portfolioValue / finalPoint.totalInvested, 1 / years) - 1) * 100
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
      alphaVsIhsg
    };
  }, [selectedTicker, monthlyDCA, initialCapital, simStartYear, reinvestDividends]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* 1. TOP SECTION: SELECTED STOCK BANNER & PERMANENT PRICE CHART */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
        {/* Stock Information Header */}
        <div className="p-3.5 md:p-4 border-b border-[#1E2736] bg-[#0E131C] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xl font-bold text-white tnum">
                  {stock.ticker}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#1E7B85]/20 text-[#5CE1E6] border border-[#1E7B85]/30">
                  {stock.sector}
                </span>
              </div>
              <span className="text-xs text-slate-400 block mt-0.5">
                {stock.name}
              </span>
            </div>

            <div className="h-7 w-px bg-[#1E2736] hidden sm:block"></div>

            <div className="font-mono tnum">
              <span className="text-lg font-bold text-slate-100">
                Rp {stock.currentPrice.toLocaleString("id-ID")}
              </span>
              <span
                className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded ${
                  stock.change1D >= 0
                    ? "text-[#2EB886] bg-[#2EB886]/10"
                    : "text-[#DC525F] bg-[#DC525F]/10"
                }`}
              >
                {stock.change1D >= 0 ? `+${stock.change1D}%` : `${stock.change1D}%`}
              </span>
            </div>
          </div>

          {/* Timeframe Controls */}
          <div className="flex items-center space-x-1 bg-[#080B10] p-1 rounded-lg border border-[#1E2736]">
            {(["1Y", "3Y", "5Y", "ALL"] as ChartTimeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setChartTf(tf)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                  chartTf === tf
                    ? "bg-[#1E7B85] text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf === "ALL" ? "Semua" : tf}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Area Chart Section */}
        <div className="p-4 bg-[#111622]">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
            <span>Grafik Harga Penutupan Historis Bulanan (Data Tersedia: 2020–2026)</span>
            <span className="text-slate-400">
              {hoverIndex !== null && filteredChartSeries[hoverIndex]
                ? `${filteredChartSeries[hoverIndex].date}: Rp ${filteredChartSeries[hoverIndex].price.toLocaleString("id-ID")}`
                : "Arahkan kursor ke grafik"}
            </span>
          </div>

          <div className="relative w-full h-52 pt-2">
            {(() => {
              const data = filteredChartSeries;
              if (data.length < 2) return null;

              const prices = data.map((d) => d.price);
              const maxPrice = Math.max(...prices) * 1.05;
              const minPrice = Math.min(...prices) * 0.95;

              const width = 900;
              const height = 190;

              const getX = (i: number) => (i / (data.length - 1)) * width;
              const getY = (val: number) => height - ((val - minPrice) / (maxPrice - minPrice)) * height;

              const linePoints = data.map((d, i) => `${getX(i)},${getY(d.price)}`).join(" ");
              const areaPath = `M ${getX(0)},${height} L ${data
                .map((d, i) => `${getX(i)},${getY(d.price)}`)
                .join(" L ")} L ${getX(data.length - 1)},${height} Z`;

              return (
                <div className="relative w-full h-full">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1E7B85" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#1E7B85" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0.25, 0.5, 0.75].map((pct) => (
                      <line
                        key={pct}
                        x1="0"
                        y1={height * pct}
                        x2={width}
                        y2={height * pct}
                        stroke="#1C2433"
                        strokeDasharray="3 3"
                      />
                    ))}

                    {/* Area fill */}
                    <path d={areaPath} fill="url(#chartGradient)" />

                    {/* Price Line */}
                    <polyline
                      fill="none"
                      stroke="#1E7B85"
                      strokeWidth="2.5"
                      points={linePoints}
                    />

                    {/* Dividend markers */}
                    {data.map((d, i) => {
                      if (!d.dividend) return null;
                      return (
                        <circle
                          key={`div-${i}`}
                          cx={getX(i)}
                          cy={getY(d.price)}
                          r="3"
                          fill="#F59E0B"
                        />
                      );
                    })}

                    {/* Hover cursor point */}
                    {hoverIndex !== null && (
                      <g>
                        <line
                          x1={getX(hoverIndex)}
                          y1="0"
                          x2={getX(hoverIndex)}
                          y2={height}
                          stroke="#94A3B8"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={getX(hoverIndex)}
                          cy={getY(data[hoverIndex].price)}
                          r="4"
                          fill="#5CE1E6"
                          stroke="#0C1017"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                  </svg>

                  {/* Mouse hover tracker */}
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
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-[#1C2433]">
            <span>{filteredChartSeries[0]?.date || ""}</span>
            <span className="flex items-center space-x-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B]"></span>
              <span>Titik Dividen Berbayar</span>
            </span>
            <span>{filteredChartSeries[filteredChartSeries.length - 1]?.date || ""}</span>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM SECTION: TABBED MULTI-PANEL (VALUATION, SIMULATOR, FUNDAMENTAL) */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex-1 flex flex-col">
        {/* Navigation Tabs Header */}
        <div className="flex items-center border-b border-[#1E2736] bg-[#0E131C] px-3">
          <button
            onClick={() => setActiveTab("valuation")}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-mono font-semibold transition border-b-2 ${
              activeTab === "valuation"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Valuasi & P/E Band</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-mono font-semibold transition border-b-2 ${
              activeTab === "simulator"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Simulasi Strategi DCA</span>
          </button>

          <button
            onClick={() => setActiveTab("fundamental")}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-mono font-semibold transition border-b-2 ${
              activeTab === "fundamental"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Profil Fundamental</span>
          </button>
        </div>

        {/* Tab 1: Valuation & P/E Band */}
        {activeTab === "valuation" && (
          <div className="p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2736]">
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Diagnosis Valuasi Historis 5 Tahun
                </span>
                <span className="text-sm font-semibold text-slate-100 font-sans mt-0.5 block">
                  {valuationStatus.verdict}
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold self-start sm:self-center ${valuationStatus.color}`}>
                {valuationStatus.label}
              </div>
            </div>

            {/* P/E Deviation Band Table & Fair Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Deviation Level Breakdown */}
              <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736] space-y-2 text-xs font-mono tnum">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                  Pita Deviasi P/E Historis (Implied Price)
                </span>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>+2 SD (Mahal Ekstrim - {stock.peSd2Plus}x)</span>
                  <span className="text-slate-200">Rp {targetSd2PlusPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>+1 SD (Di Atas Rerata - {stock.peSd1Plus}x)</span>
                  <span className="text-slate-200">Rp {targetSd1PlusPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#1E7B85]/30 bg-[#1E7B85]/10 px-1 rounded text-[#5CE1E6] font-semibold">
                  <span>Mean (Harga Wajar Historis - {stock.historicalPeMean}x)</span>
                  <span>Rp {targetMeanPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>-1 SD (Area Undervalued - {stock.peSd1Minus}x)</span>
                  <span className="text-slate-200">Rp {targetSd1MinusPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-400">
                  <span>-2 SD (Diskon Ekstrim - {stock.peSd2Minus}x)</span>
                  <span className="text-slate-200">Rp {targetSd2MinusPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* Right: Fair Value Target Cards */}
              <div className="space-y-3">
                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[11px] font-mono text-slate-400 block mb-0.5">
                    Target Harga Wajar (Mean Historis):
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    Rp {targetMeanPrice.toLocaleString()}
                  </span>
                  <span className="text-xs font-mono text-[#5CE1E6] block mt-0.5 tnum">
                    Potensi: {meanUpside >= 0 ? `+${meanUpside.toFixed(1)}%` : `${meanUpside.toFixed(1)}%`}
                  </span>
                </div>

                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[11px] font-mono text-slate-400 block mb-0.5">
                    Nilai Intrinsik Benjamin Graham:
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    Rp {grahamNumber.toLocaleString()}
                  </span>
                  <span className="text-xs font-mono text-[#2EB886] block mt-0.5 tnum">
                    Potensi: {grahamUpside >= 0 ? `+${grahamUpside.toFixed(1)}%` : `${grahamUpside.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: DCA Strategy Simulator */}
        {activeTab === "simulator" && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Input Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-[#0C1017] rounded-xl border border-[#1E2736] text-xs font-mono">
              <div>
                <label className="text-slate-400 block text-[10px] mb-1">Nabung Rutin / Bln (Rp):</label>
                <input
                  type="number"
                  step="500000"
                  min="0"
                  value={monthlyDCA}
                  onChange={(e) => setMonthlyDCA(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#111622] border border-[#20293A] rounded px-2 py-1.5 text-white font-mono focus:outline-none focus:border-[#1E7B85]"
                />
              </div>

              <div>
                <label className="text-slate-400 block text-[10px] mb-1">Modal Awal / Lump-sum:</label>
                <input
                  type="number"
                  step="1000000"
                  min="0"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#111622] border border-[#20293A] rounded px-2 py-1.5 text-white font-mono focus:outline-none focus:border-[#1E7B85]"
                />
              </div>

              <div>
                <label className="text-slate-400 block text-[10px] mb-1">Mulai Tahun:</label>
                <select
                  value={simStartYear}
                  onChange={(e) => setSimStartYear(e.target.value)}
                  className="w-full bg-[#111622] border border-[#20293A] rounded px-2 py-1.5 text-white font-mono focus:outline-none focus:border-[#1E7B85]"
                >
                  {["2020", "2021", "2022", "2023", "2024", "2025"].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  onClick={() => setReinvestDividends(!reinvestDividends)}
                  className={`w-full py-1.5 px-2 rounded text-[11px] font-mono transition text-center ${
                    reinvestDividends
                      ? "bg-[#1E7B85]/20 text-[#5CE1E6] border border-[#1E7B85]/40"
                      : "bg-[#171F2C] text-slate-400 border border-[#232F42]"
                  }`}
                >
                  {reinvestDividends ? "DRIP Aktif (Reinvest)" : "Dividen Cair Kas"}
                </button>
              </div>
            </div>

            {/* Performance Metrics Grid */}
            {simulationResults && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono tnum">
                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[10px] text-slate-500 uppercase block">Modal Disetor</span>
                  <span className="text-sm font-bold text-slate-200 block mt-0.5">
                    {formatIDR(simulationResults.totalInvested)}
                  </span>
                </div>

                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[10px] text-slate-500 uppercase block">Nilai Portofolio</span>
                  <span className="text-sm font-bold text-[#2EB886] block mt-0.5">
                    {formatIDR(simulationResults.finalValue)}
                  </span>
                </div>

                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[10px] text-slate-500 uppercase block">Laba Bersih</span>
                  <span className="text-sm font-bold text-[#2EB886] block mt-0.5">
                    +{formatIDR(simulationResults.netProfit)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    +{simulationResults.totalReturnPercent.toFixed(1)}%
                  </span>
                </div>

                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[10px] text-slate-500 uppercase block">CAGR (Tahunan)</span>
                  <span className="text-sm font-bold text-[#5CE1E6] block mt-0.5">
                    +{simulationResults.cagr.toFixed(2)}%
                  </span>
                </div>

                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[10px] text-slate-500 uppercase block">Total Dividen</span>
                  <span className="text-sm font-bold text-amber-400 block mt-0.5">
                    {formatIDR(simulationResults.totalDividendsReceived)}
                  </span>
                </div>

                <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-[10px] text-slate-500 uppercase block">Alpha vs IHSG</span>
                  <span
                    className={`text-sm font-bold block mt-0.5 ${
                      simulationResults.alphaVsIhsg >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                    }`}
                  >
                    {simulationResults.alphaVsIhsg >= 0 ? "+" : ""}
                    {simulationResults.alphaVsIhsg.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Fundamental Profile */}
        {activeTab === "fundamental" && (
          <div className="p-4 md:p-5 space-y-4">
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              {stock.description}
            </p>

            {/* Metrics Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono tnum text-xs">
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-[10px] text-slate-500 block">ROE</span>
                <span className="font-bold text-[#2EB886]">{stock.roe}%</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-[10px] text-slate-500 block">PBV Ratio</span>
                <span className="font-bold text-slate-200">{stock.pbvRatio}x</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-[10px] text-slate-500 block">DER (Utang)</span>
                <span className="font-bold text-slate-200">{stock.der}x</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-[10px] text-slate-500 block">Dividend Yield</span>
                <span className="font-bold text-amber-400">{stock.dividendYield}%</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-[10px] text-slate-500 block">Payout Ratio</span>
                <span className="font-bold text-slate-200">{stock.payoutRatio}%</span>
              </div>
            </div>

            {/* Strengths & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                <span className="font-mono text-[11px] text-[#2EB886] uppercase font-semibold block mb-2">
                  Kekuatan & Keunggulan
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {stock.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#2EB886] font-mono">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                <span className="font-mono text-[11px] text-[#DC525F] uppercase font-semibold block mb-2">
                  Risiko yang Perlu Diwaspadai
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {stock.risks.map((r, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#DC525F] font-mono">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
