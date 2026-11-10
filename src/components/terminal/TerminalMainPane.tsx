"use client";

import React, { useState, useMemo } from "react";
import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import { formatNumber, formatIDR, parseFormattedNumber } from "@/utils/format";
import { Layers, Calculator, Info } from "lucide-react";

interface TerminalMainPaneProps {
  selectedTicker: string;
}

type TerminalTab = "valuation" | "simulator" | "fundamental";
type ChartTimeframe = "1Th" | "3Th" | "5Th" | "Semua";

export const TerminalMainPane: React.FC<TerminalMainPaneProps> = ({
  selectedTicker,
}) => {
  const [activeTab, setActiveTab] = useState<TerminalTab>("valuation");
  const [chartTf, setChartTf] = useState<ChartTimeframe>("Semua");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // DCA Simulator inputs (Quarterly frequency matching 29 data points)
  const [quarterlyDCA, setQuarterlyDCA] = useState<number>(3000000); // Rp 3.000.000/kuartal (~1jt/bln)
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [simStartYear, setSimStartYear] = useState<string>("2020");
  const [reinvestDividends, setReinvestDividends] = useState<boolean>(true);

  // Raw string states for inputs with thousand separators
  const [dcaInputStr, setDcaInputStr] = useState<string>("3.000.000");
  const [lumpSumInputStr, setLumpSumInputStr] = useState<string>("0");

  const stock = useMemo(() => {
    return STOCKS_DATA.find((s) => s.ticker === selectedTicker) || STOCKS_DATA[0];
  }, [selectedTicker]);

  // Historical quarterly series for selected ticker
  const fullSeries = useMemo(() => {
    return HISTORICAL_SERIES[selectedTicker] || [];
  }, [selectedTicker]);

  const filteredChartSeries = useMemo(() => {
    if (fullSeries.length === 0) return [];
    if (chartTf === "1Th") return fullSeries.slice(-5); // 4 quarters = 1 year + start
    if (chartTf === "3Th") return fullSeries.slice(-13); // 12 quarters = 3 years + start
    if (chartTf === "5Th") return fullSeries.slice(-21); // 20 quarters = 5 years + start
    return fullSeries; // Semua (29 titik: 2020 - 2026)
  }, [fullSeries, chartTf]);

  // P/E Band and Fair Value Calculations (Deterministic)
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
        label: "Diskon ekstrim (-2 SD)",
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
        label: "Valuasi wajar (area mean)",
        color: "text-[#1E7B85] bg-[#1E7B85]/10 border-[#1E7B85]/30",
        verdict: "Mendekati rerata historis 5 tahun, mencerminkan kinerja operasi normal."
      };
    } else if (stock.peRatio <= stock.peSd1Plus) {
      return {
        label: "Cukup premium (+1 SD)",
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

  // DCA Simulation Logic based strictly on Quarterly Intervals
  const simulationResults = useMemo(() => {
    const rawSeries = HISTORICAL_SERIES[selectedTicker] || [];
    const ihsgSeries = IHSG_HISTORICAL;

    const series = rawSeries.filter((d) => d.date >= `${simStartYear}-01`);
    if (series.length < 2) return null;

    let currentInvested = initialCapital;
    let currentShares = 0;
    let currentDividends = 0;
    let currentIhsgUnits = 0;

    const firstPrice = series[0].price;
    const firstIhsg = ihsgSeries.find((i) => i.date === series[0].date)?.price || 6000;

    if (initialCapital > 0) {
      currentShares += Math.floor(initialCapital / firstPrice);
      currentIhsgUnits += initialCapital / firstIhsg;
    }

    let peakValue = 0;
    let maxDrawdown = 0;

    interface TimelinePoint {
      date: string;
      price: number;
      portfolioValue: number;
      totalInvested: number;
      ihsgValue: number;
    }

    const timelineData: TimelinePoint[] = [];

    for (let index = 0; index < series.length; index++) {
      const point = series[index];

      // For index 0 (initial point), only lump-sum was placed. From index 1 onwards, quarterly DCA is deposited.
      if (index > 0 && quarterlyDCA > 0) {
        currentInvested += quarterlyDCA;
        const boughtShares = Math.floor(quarterlyDCA / point.price);
        currentShares += boughtShares;

        const currentIhsg = ihsgSeries.find((i) => i.date === point.date)?.price || firstIhsg;
        currentIhsgUnits += quarterlyDCA / currentIhsg;
      }

      // Handle dividend
      let currentDivAmount = 0;
      if (point.dividend && point.dividend > 0) {
        currentDivAmount = currentShares * point.dividend;
        currentDividends += currentDivAmount;

        if (reinvestDividends) {
          const dripShares = Math.floor(currentDivAmount / point.price);
          currentShares += dripShares;
        }
      }

      const portfolioValue = currentShares * point.price + (!reinvestDividends ? currentDividends : 0);
      const currentIhsg = ihsgSeries.find((i) => i.date === point.date)?.price || firstIhsg;
      const ihsgValue = currentIhsgUnits * currentIhsg;

      if (portfolioValue > peakValue) {
        peakValue = portfolioValue;
      } else if (peakValue > 0) {
        const drawdown = ((peakValue - portfolioValue) / peakValue) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }

      timelineData.push({
        date: point.date,
        price: point.price,
        portfolioValue,
        totalInvested: currentInvested,
        ihsgValue
      });
    }

    const finalPoint = timelineData[timelineData.length - 1];
    const totalQuarters = timelineData.length - 1;
    const netProfit = finalPoint.portfolioValue - finalPoint.totalInvested;
    const totalReturnPercent = finalPoint.totalInvested > 0
      ? ((finalPoint.portfolioValue - finalPoint.totalInvested) / finalPoint.totalInvested) * 100
      : 0;

    // Years duration = quarters / 4
    const years = totalQuarters / 4;
    const cagr = years >= 1 && finalPoint.totalInvested > 0
      ? (Math.pow(finalPoint.portfolioValue / finalPoint.totalInvested, 1 / years) - 1) * 100
      : null;

    const ihsgFinalReturn = finalPoint.totalInvested > 0
      ? ((finalPoint.ihsgValue - finalPoint.totalInvested) / finalPoint.totalInvested) * 100
      : 0;
    const alphaVsIhsg = totalReturnPercent - ihsgFinalReturn;

    return {
      totalQuarters,
      years,
      totalInvested: finalPoint.totalInvested,
      finalValue: finalPoint.portfolioValue,
      netProfit,
      totalReturnPercent,
      cagr,
      maxDrawdown,
      totalDividendsReceived: currentDividends,
      alphaVsIhsg
    };
  }, [selectedTicker, quarterlyDCA, initialCapital, simStartYear, reinvestDividends]);

  return (
    <div className="h-full flex flex-col space-y-4 font-sans">
      {/* 1. TOP SECTION: SELECTED STOCK BANNER & CLEAN LINE PRICE CHART */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
        {/* Stock Information Header */}
        <div className="p-3.5 md:p-4 border-b border-[#1E2736] bg-[#0E131C] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xl font-bold text-white tnum">
                  {stock.ticker}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-sans bg-[#1E7B85]/20 text-slate-200 border border-[#1E7B85]/40">
                  {stock.sector}
                </span>
              </div>
              <span className="text-xs text-slate-400 block mt-0.5 font-sans">
                {stock.name}
              </span>
            </div>

            <div className="h-7 w-px bg-[#1E2736] hidden sm:block"></div>

            <div>
              <span className="text-lg font-bold text-slate-100 font-mono tnum">
                Rp {formatNumber(stock.currentPrice)}
              </span>
              <span
                className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded font-mono tnum ${
                  stock.change1D >= 0
                    ? "text-[#2EB886] bg-[#2EB886]/10"
                    : "text-[#DC525F] bg-[#DC525F]/10"
                }`}
              >
                {stock.change1D >= 0 ? `+${stock.change1D}%` : `${stock.change1D}%`}
              </span>
            </div>
          </div>

          {/* Timeframe Controls (1Th, 3Th, 5Th, Semua) */}
          <div className="flex items-center space-x-1 bg-[#080B10] p-1 rounded-lg border border-[#1E2736]">
            {(["1Th", "3Th", "5Th", "Semua"] as ChartTimeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setChartTf(tf)}
                className={`px-2.5 py-1 rounded text-xs font-sans transition ${
                  chartTf === tf
                    ? "bg-[#1E7B85] text-white font-medium shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Pure Line Chart Section with Axis, Labels, and Tooltip */}
        <div className="p-4 bg-[#111622]">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Grafik harga penutupan kuartalan (2020–2026)</span>
            <span className="font-mono tnum text-slate-300">
              {hoverIndex !== null && filteredChartSeries[hoverIndex]
                ? `${filteredChartSeries[hoverIndex].date}: Rp ${formatNumber(filteredChartSeries[hoverIndex].price)}`
                : "Arahkan kursor ke grafik"}
            </span>
          </div>

          <div className="relative w-full h-56 pt-2">
            {(() => {
              const data = filteredChartSeries;
              if (data.length < 2) return null;

              const prices = data.map((d) => d.price);
              const maxPrice = Math.max(...prices) * 1.05;
              const minPrice = Math.min(...prices) * 0.95;

              // Dimensions with margin for Y-axis (Rp) and X-axis (Years)
              const chartWidth = 900;
              const chartHeight = 180;
              const paddingLeft = 55;
              const paddingBottom = 25;
              const plotWidth = chartWidth - paddingLeft;
              const plotHeight = chartHeight - paddingBottom;

              const getX = (i: number) => paddingLeft + (i / (data.length - 1)) * plotWidth;
              const getY = (val: number) => plotHeight - ((val - minPrice) / (maxPrice - minPrice)) * plotHeight;

              const linePoints = data.map((d, i) => `${getX(i)},${getY(d.price)}`).join(" ");

              // Y-axis ticks (4 ticks)
              const yTicks = [
                maxPrice,
                minPrice + (maxPrice - minPrice) * 0.66,
                minPrice + (maxPrice - minPrice) * 0.33,
                minPrice
              ];

              return (
                <div className="relative w-full h-full">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    {/* Y-axis Grid Lines & Price Labels */}
                    {yTicks.map((priceVal, idx) => {
                      const yPos = getY(priceVal);
                      return (
                        <g key={idx}>
                          <line
                            x1={paddingLeft}
                            y1={yPos}
                            x2={chartWidth}
                            y2={yPos}
                            stroke="#1E2736"
                            strokeDasharray="2 3"
                          />
                          <text
                            x={paddingLeft - 8}
                            y={yPos + 3.5}
                            textAnchor="end"
                            fill="#64748B"
                            fontSize="9.5"
                            fontFamily="monospace"
                          >
                            {formatNumber(priceVal)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Pure Line Chart (NO fill gradient) */}
                    <polyline
                      fill="none"
                      stroke="#1E7B85"
                      strokeWidth="2"
                      points={linePoints}
                    />

                    {/* Dividend Markers (Orange dot as per legend) */}
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

                    {/* X-axis Date/Year Labels */}
                    {data.map((d, i) => {
                      // Show label for first, last, and years switch (e.g. Q1 / -03 of each year)
                      const isFirst = i === 0;
                      const isLast = i === data.length - 1;
                      const isYearStart = d.date.endsWith("-03") || d.date.endsWith("-01");
                      if (isFirst || isLast || isYearStart) {
                        return (
                          <text
                            key={`lbl-${i}`}
                            x={getX(i)}
                            y={chartHeight - 6}
                            textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                            fill="#64748B"
                            fontSize="9.5"
                            fontFamily="monospace"
                          >
                            {d.date}
                          </text>
                        );
                      }
                      return null;
                    })}

                    {/* Hover cursor point and vertical line */}
                    {hoverIndex !== null && (
                      <g>
                        <line
                          x1={getX(hoverIndex)}
                          y1={0}
                          x2={getX(hoverIndex)}
                          y2={plotHeight}
                          stroke="#94A3B8"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={getX(hoverIndex)}
                          cy={getY(data[hoverIndex].price)}
                          r="4"
                          fill="#FFFFFF"
                          stroke="#1E7B85"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                  </svg>

                  {/* Mouse hover tracker overlay */}
                  <div
                    className="absolute inset-0 cursor-crosshair flex"
                    style={{ left: `${(paddingLeft / chartWidth) * 100}%` }}
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

                  {/* Tooltip on hover */}
                  {hoverIndex !== null && data[hoverIndex] && (
                    <div
                      className="absolute z-20 pointer-events-none p-2 rounded-lg bg-[#0C1017] border border-[#20293A] shadow-xl text-xs font-mono tnum"
                      style={{
                        left: `${Math.min(75, Math.max(15, (hoverIndex / (data.length - 1)) * 100))}%`,
                        top: "10px"
                      }}
                    >
                      <div className="text-slate-300 font-semibold border-b border-slate-800 pb-1 mb-1">
                        Periode: {data[hoverIndex].date}
                      </div>
                      <div className="text-slate-200">
                        Harga: Rp {formatNumber(data[hoverIndex].price)}
                      </div>
                      {data[hoverIndex].dividend && data[hoverIndex].dividend! > 0 && (
                        <div className="text-amber-400 text-[11px] mt-0.5">
                          Dividen: Rp {data[hoverIndex].dividend} / lbr
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Chart Subtitle & Legend */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1C2433]">
            <span>Sumbu X: Periode penutupan kuartal • Sumbu Y: Harga saham (Rp)</span>
            <span className="flex items-center space-x-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B]"></span>
              <span>Titik dividen tunai</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM SECTION: TABBED MULTI-PANEL (VALUATION, SIMULATOR, FUNDAMENTAL) */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex-1 flex flex-col">
        {/* Navigation Tabs Header (Sentence case) */}
        <div className="flex items-center border-b border-[#1E2736] bg-[#0E131C] px-3">
          <button
            onClick={() => setActiveTab("valuation")}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition border-b-2 ${
              activeTab === "valuation"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Valuasi dan P/E band</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition border-b-2 ${
              activeTab === "simulator"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Simulasi strategi DCA</span>
          </button>

          <button
            onClick={() => setActiveTab("fundamental")}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-sans font-medium transition border-b-2 ${
              activeTab === "fundamental"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Profil fundamental</span>
          </button>
        </div>

        {/* TAB 1: VALUASI & P/E BAND */}
        {activeTab === "valuation" && (
          <div className="p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2736]">
              <div>
                <span className="text-xs text-slate-400 block">
                  Diagnosis valuasi historis 5 tahun
                </span>
                <span className="text-sm font-semibold text-slate-100 mt-0.5 block">
                  {valuationStatus.verdict}
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-sans font-medium self-start sm:self-center ${valuationStatus.color}`}>
                {valuationStatus.label}
              </div>
            </div>

            {/* P/E Deviation Band Table & Fair Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Deviation Level Breakdown */}
              <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736] space-y-2 text-xs">
                <span className="text-xs text-slate-400 block mb-1">
                  Pita deviasi P/E historis (harga implikasi)
                </span>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>+2 SD (Mahal ekstrim - {stock.peSd2Plus}x)</span>
                  <span className="text-slate-200 font-mono tnum">Rp {formatNumber(targetSd2PlusPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>+1 SD (Di atas rerata - {stock.peSd1Plus}x)</span>
                  <span className="text-slate-200 font-mono tnum">Rp {formatNumber(targetSd1PlusPrice)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#1E7B85]/30 bg-[#1E7B85]/10 px-1 rounded text-slate-100 font-medium">
                  <span>Mean (Harga wajar historis - {stock.historicalPeMean}x)</span>
                  <span className="font-mono tnum">Rp {formatNumber(targetMeanPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>-1 SD (Area undervalued - {stock.peSd1Minus}x)</span>
                  <span className="text-slate-200 font-mono tnum">Rp {formatNumber(targetSd1MinusPrice)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-400">
                  <span>-2 SD (Diskon ekstrim - {stock.peSd2Minus}x)</span>
                  <span className="text-slate-200 font-mono tnum">Rp {formatNumber(targetSd2MinusPrice)}</span>
                </div>
              </div>

              {/* Right: Fair Value Target Cards */}
              <div className="space-y-3">
                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs text-slate-400 block mb-0.5">
                    Target harga wajar (mean historis):
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    Rp {formatNumber(targetMeanPrice)}
                  </span>
                  <span className={`text-xs block mt-0.5 ${meanUpside >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}`}>
                    Potensi: {meanUpside >= 0 ? `+${meanUpside.toFixed(1)}%` : `${meanUpside.toFixed(1)}%`}
                  </span>
                </div>

                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs text-slate-400 block mb-0.5">
                    Nilai intrinsik Benjamin Graham:
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    Rp {formatNumber(grahamNumber)}
                  </span>
                  <span className={`text-xs block mt-0.5 ${grahamUpside >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}`}>
                    Potensi: {grahamUpside >= 0 ? `+${grahamUpside.toFixed(1)}%` : `${grahamUpside.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SIMULASI STRATEGI DCA */}
        {activeTab === "simulator" && (
          <div className="p-4 md:p-5 space-y-4">
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
                  Setara Rp {formatNumber(Math.round(quarterlyDCA / 3))}/bulan
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
                  value={simStartYear}
                  onChange={(e) => setSimStartYear(e.target.value)}
                  className="w-full bg-[#111622] border border-[#20293A] rounded px-2.5 py-1.5 text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                >
                  {["2020", "2021", "2022", "2023", "2024", "2025"].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  onClick={() => setReinvestDividends(!reinvestDividends)}
                  className={`w-full py-1.5 px-2 rounded text-xs transition text-center ${
                    reinvestDividends
                      ? "bg-[#1E7B85]/20 text-slate-100 border border-[#1E7B85]/40"
                      : "bg-[#171F2C] text-slate-400 border border-[#232F42]"
                  }`}
                >
                  {reinvestDividends ? "Reinvestasi dividen (DRIP)" : "Dividen cair kas"}
                </button>
              </div>
            </div>

            {/* SINGLE UNIFIED SUMMARY BLOCK (Replacing the 6 broken cards) */}
            {simulationResults ? (
              <div className="bg-[#0C1017] rounded-xl border border-[#1E2736] overflow-hidden">
                <div className="p-3 bg-[#0E131C] border-b border-[#1E2736] flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Hasil kalkulasi simulasi DCA ({simStartYear} – 2026, {simulationResults.totalQuarters} kuartal)
                  </span>
                  <span className="text-slate-400">
                    Durasi: {simulationResults.years.toFixed(1)} tahun
                  </span>
                </div>

                <div className="divide-y divide-[#171F2C] text-xs">
                  {/* Total modal disetor */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Total modal disetor:</span>
                    <span className="text-slate-100 font-mono tnum font-medium">
                      {formatIDR(simulationResults.totalInvested)}
                    </span>
                  </div>

                  {/* Nilai portofolio akhir */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Nilai portofolio akhir:</span>
                    <span className="text-slate-100 font-mono tnum font-semibold">
                      {formatIDR(simulationResults.finalValue)}
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
                        {formatIDR(simulationResults.netProfit)}
                      </span>
                      <span
                        className={`ml-2 text-[11px] font-mono tnum ${
                          simulationResults.totalReturnPercent >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                        }`}
                      >
                        ({simulationResults.totalReturnPercent >= 0 ? "+" : ""}
                        {simulationResults.totalReturnPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* CAGR */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Laju pertumbuhan tahunan majemuk (CAGR):</span>
                    <span className="text-slate-200 font-mono tnum">
                      {simulationResults.cagr !== null
                        ? `+${simulationResults.cagr.toFixed(2)}% / tahun`
                        : "Periode < 1 tahun"}
                    </span>
                  </div>

                  {/* Total dividen masuk */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Akumulasi dividen yang diterima:</span>
                    <span className="text-slate-200 font-mono tnum">
                      {formatIDR(simulationResults.totalDividendsReceived)}
                    </span>
                  </div>

                  {/* Max Drawdown */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Penurunan terbesar dari puncak (drawdown):</span>
                    <span className="text-slate-200 font-mono tnum">
                      -{simulationResults.maxDrawdown.toFixed(1)}%
                    </span>
                  </div>

                  {/* Alpha vs IHSG */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Selisih performa vs acuan IHSG (Alpha):</span>
                    <span
                      className={`font-mono tnum font-semibold ${
                        simulationResults.alphaVsIhsg >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                      }`}
                    >
                      {simulationResults.alphaVsIhsg >= 0 ? "+" : ""}
                      {simulationResults.alphaVsIhsg.toFixed(1)}%{" "}
                      <span className="font-sans font-normal text-xs text-slate-400">
                        ({simulationResults.alphaVsIhsg >= 0 ? "mengungguli IHSG" : "di bawah IHSG"})
                      </span>
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0A0D14] border-t border-[#1E2736] text-[11px] text-slate-500">
                  Perhitungan berbasis 29 titik kuartalan aktual. Setiap siklus mewakili penutupan 1 kuartal (3 bulan).
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
            <p className="text-xs text-slate-300 leading-relaxed">
              {stock.description}
            </p>

            {/* Metrics Key-Value Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">ROE</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{stock.roe}%</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">PBV Ratio</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{stock.pbvRatio}x</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">DER (Utang)</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{stock.der}x</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">Dividend Yield</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{stock.dividendYield}%</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">Payout Ratio</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{stock.payoutRatio}%</span>
              </div>
            </div>

            {/* Strengths & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                <span className="text-xs font-semibold text-slate-200 block mb-2">
                  Kekuatan dan keunggulan
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {stock.strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#1E7B85]">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                <span className="text-xs font-semibold text-slate-200 block mb-2">
                  Risiko yang perlu diwaspadai
                </span>
                <ul className="space-y-1.5 text-slate-300">
                  {stock.risks.map((r, idx) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#DC525F]">•</span>
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
