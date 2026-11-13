"use client";

import React, { useState, useMemo } from "react";
import { STOCKS_DATA, HISTORICAL_SERIES, IHSG_HISTORICAL } from "@/data/stocksData";
import {
  formatNumber,
  formatDesimal,
  formatMultiple,
  formatPersen,
  formatRupiah,
  formatTanggalBulanTahun,
  parseFormattedNumber,
  calculateAnnualizedIRR,
} from "@/lib/format";
import { Layers, Calculator, Info, ArrowLeft } from "lucide-react";

interface TerminalMainPaneProps {
  selectedTicker: string;
  originNewsTitle?: string | null;
  onBackToNews?: () => void;
}

type TerminalTab = "valuation" | "simulator" | "fundamental";
type ChartTimeframe = "1Th" | "3Th" | "5Th" | "Semua";

export const TerminalMainPane: React.FC<TerminalMainPaneProps> = ({
  selectedTicker,
  originNewsTitle,
  onBackToNews,
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

  // Valuation Diagnosis: Computed dynamically from current P/E position vs bands
  // Contrast increased with vivid text & deep solid borders
  const valuationDiagnosis = useMemo(() => {
    const pe = stock.peRatio;
    const mean = stock.historicalPeMean;
    const sd1Minus = stock.peSd1Minus;
    const sd2Minus = stock.peSd2Minus;
    const sd1Plus = stock.peSd1Plus;

    const diffPercent = ((pe - mean) / mean) * 100;
    const absDiff = Math.abs(diffPercent);

    if (pe <= sd2Minus) {
      return {
        label: "Diskon ekstrim (di bawah -2 SD)",
        color: "text-[#34D399] bg-[#064E3B] border-[#059669] font-medium",
        verdict: `Rasio P/E saat ini (${formatMultiple(pe, 1)}) berada di bawah batas -2 SD (${formatMultiple(sd2Minus, 1)}), ${formatPersen(absDiff, 1)} di bawah rerata acuan (${formatMultiple(mean, 1)}). Area deviasi terendah secara komparatif.`
      };
    } else if (pe <= sd1Minus) {
      return {
        label: "Undervalued (antara -2 SD dan -1 SD)",
        color: "text-[#34D399] bg-[#064E3B] border-[#059669] font-medium",
        verdict: `Rasio P/E saat ini (${formatMultiple(pe, 1)}) berada pada rentang deviasi rendah (${formatMultiple(sd2Minus, 1)} – ${formatMultiple(sd1Minus, 1)}), ${formatPersen(absDiff, 1)} di bawah rerata acuan (${formatMultiple(mean, 1)}).`
      };
    } else if (pe <= mean) {
      return {
        label: "Valuasi wajar (antara -1 SD dan rerata)",
        color: "text-[#38BDF8] bg-[#0C4A6E] border-[#0284C7] font-medium",
        verdict: `Rasio P/E saat ini (${formatMultiple(pe, 1)}) berada mendekati rerata acuan (${formatMultiple(mean, 1)}), ${formatPersen(absDiff, 1)} di bawah titik tengah.`
      };
    } else if (pe <= sd1Plus) {
      return {
        label: "Cukup premium (antara rerata dan +1 SD)",
        color: "text-[#FDE047] bg-[#78350F] border-[#D97706] font-medium",
        verdict: `Rasio P/E saat ini (${formatMultiple(pe, 1)}) berada ${formatPersen(absDiff, 1)} di atas rerata acuan (${formatMultiple(mean, 1)}), berada di bawah batas atas +1 SD (${formatMultiple(sd1Plus, 1)}).`
      };
    } else {
      return {
        label: "Overvalued (di atas +1 SD)",
        color: "text-[#F87171] bg-[#7F1D1D] border-[#DC2626] font-medium",
        verdict: `Rasio P/E saat ini (${formatMultiple(pe, 1)}) melampaui batas deviasi atas +1 SD (${formatMultiple(sd1Plus, 1)}), ${formatPersen(absDiff, 1)} di atas rerata acuan (${formatMultiple(mean, 1)}).`
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

    // Duration in years
    const years = totalQuarters / 4;

    // Money-Weighted Internal Rate of Return (IRR)
    const cashFlows: number[] = [];
    for (let i = 0; i < series.length; i++) {
      let cf = 0;
      if (i === 0) {
        if (initialCapital > 0) cf -= initialCapital;
      } else {
        if (quarterlyDCA > 0) cf -= quarterlyDCA;
      }
      if (i === series.length - 1) {
        cf += finalPoint.portfolioValue;
      }
      cashFlows.push(cf);
    }
    const firstNonZero = cashFlows.findIndex((c) => c !== 0);
    const validCashFlows = firstNonZero >= 0 ? cashFlows.slice(firstNonZero) : [];
    const irr = calculateAnnualizedIRR(validCashFlows);
    const simpleAnnualReturn = years > 0 ? totalReturnPercent / years : null;

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
      irr,
      simpleAnnualReturn,
      maxDrawdown,
      totalDividendsReceived: currentDividends,
      alphaVsIhsg
    };
  }, [selectedTicker, quarterlyDCA, initialCapital, simStartYear, reinvestDividends]);

  // Compute neat X-axis tick indices (Maximum 4-5 ticks so they never overlap)
  const xTickIndices = useMemo(() => {
    const len = filteredChartSeries.length;
    if (len <= 4) return filteredChartSeries.map((_, i) => i);
    const step = (len - 1) / 4;
    const raw = [
      0,
      Math.round(step),
      Math.round(step * 2),
      Math.round(step * 3),
      len - 1
    ];
    return Array.from(new Set(raw));
  }, [filteredChartSeries]);

  return (
    <div className="flex flex-col space-y-4 font-sans">
      {/* Origin News Banner (if navigated from news article) */}
      {originNewsTitle && (
        <div className="bg-[#141C2B] border border-[#1E7B85]/50 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-200 shadow-md">
          <div className="flex items-center space-x-2 truncate">
            <span className="text-[#38BDF8] font-semibold whitespace-nowrap">Berita asal:</span>
            <span className="truncate italic text-slate-300">&ldquo;{originNewsTitle}&rdquo;</span>
          </div>
          {onBackToNews && (
            <button
              onClick={onBackToNews}
              className="ml-3 shrink-0 px-3 py-1 bg-[#1E7B85] text-white rounded-lg text-xs font-medium hover:bg-[#1E7B85]/80 transition flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Berita</span>
            </button>
          )}
        </div>
      )}

      {/* 1. TOP SECTION: PERMANENT CLEAN PRICE CHART */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
        {/* Header Bar: Ticker info, Current Price, and Timeframe controls */}
        <div className="p-4 border-b border-[#1E2736] flex flex-wrap items-center justify-between gap-3 bg-[#0E131C]">
          <div className="flex items-center space-x-4">
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
                {formatRupiah(stock.currentPrice)}
              </span>
              <span
                className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded font-mono tnum ${
                  stock.change1D >= 0
                    ? "text-[#2EB886] bg-[#2EB886]/10"
                    : "text-[#DC525F] bg-[#DC525F]/10"
                }`}
              >
                {formatPersen(stock.change1D, 1, true)}
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
          {/* Responsive Header: Stacked vertically on mobile, row on tablet/desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-400 mb-2 font-sans">
            <span>Grafik harga penutupan kuartalan (data ilustrasi, 2020–2026)</span>
            <span className="text-slate-200 font-sans">
              {hoverIndex !== null && filteredChartSeries[hoverIndex]
                ? `${formatTanggalBulanTahun(filteredChartSeries[hoverIndex].date)}: ${formatRupiah(filteredChartSeries[hoverIndex].price)}`
                : "Sentuh atau arahkan kursor ke grafik"}
            </span>
          </div>

          {/* Chart Canvas */}
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
              const paddingLeft = 60;
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

                    {/* X-axis Date Labels: Reduced to 4-5 ticks in "Mar 2021" format, font-sans */}
                    {xTickIndices.map((i) => {
                      const d = data[i];
                      if (!d) return null;
                      const isFirst = i === 0;
                      const isLast = i === data.length - 1;
                      const formattedDate = formatTanggalBulanTahun(d.date);

                      return (
                        <text
                          key={`lbl-${i}`}
                          x={getX(i)}
                          y={chartHeight - 6}
                          textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                          fill="#94A3B8"
                          fontSize="9.5"
                          fontFamily="var(--font-sans), sans-serif"
                        >
                          {formattedDate}
                        </text>
                      );
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

                  {/* Mouse/touch hover tracker overlay */}
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
                        onTouchStart={() => setHoverIndex(i)}
                      />
                    ))}
                  </div>

                  {/* Tooltip on hover using IBM Plex Sans font */}
                  {hoverIndex !== null && data[hoverIndex] && (
                    <div
                      className="absolute z-20 pointer-events-none p-2.5 rounded-lg bg-[#0C1017] border border-[#20293A] shadow-xl text-xs font-sans"
                      style={{
                        left: `${Math.min(75, Math.max(15, (hoverIndex / (data.length - 1)) * 100))}%`,
                        top: "10px"
                      }}
                    >
                      <div className="text-slate-300 font-semibold border-b border-slate-800 pb-1 mb-1">
                        {formatTanggalBulanTahun(data[hoverIndex].date)}
                      </div>
                      <div className="text-slate-200 flex items-center justify-between gap-3">
                        <span className="text-slate-400">Harga:</span>
                        <span className="font-mono tnum text-white font-semibold">
                          {formatRupiah(data[hoverIndex].price)}
                        </span>
                      </div>
                      {data[hoverIndex].dividend && data[hoverIndex].dividend! > 0 && (
                        <div className="text-amber-400 text-[11px] mt-0.5 flex items-center justify-between gap-3">
                          <span>Dividen:</span>
                          <span className="font-mono tnum font-semibold">
                            {formatRupiah(data[hoverIndex].dividend!)} / lbr
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Chart Legend */}
          <div className="flex items-center justify-end text-xs text-slate-400 pt-2 border-t border-[#1C2433]">
            <span className="flex items-center space-x-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#F59E0B]"></span>
              <span>Titik dividen tunai</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. BOTTOM SECTION: TABBED MULTI-PANEL (VALUATION, SIMULATOR, FUNDAMENTAL) */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg flex-1 flex flex-col">
        {/* Navigation Tabs Header (Responsive Short Labels on Mobile) */}
        <div className="flex items-center border-b border-[#1E2736] bg-[#0E131C] px-3">
          <button
            onClick={() => setActiveTab("valuation")}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-2.5 text-xs font-sans font-medium transition border-b-2 ${
              activeTab === "valuation"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="sm:hidden">Valuasi</span>
            <span className="hidden sm:inline">Valuasi dan P/E band</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-2.5 text-xs font-sans font-medium transition border-b-2 ${
              activeTab === "simulator"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="sm:hidden">Simulasi</span>
            <span className="hidden sm:inline">Simulasi strategi DCA</span>
          </button>

          <button
            onClick={() => setActiveTab("fundamental")}
            className={`flex items-center space-x-2 px-3 sm:px-4 py-2.5 text-xs font-sans font-medium transition border-b-2 ${
              activeTab === "fundamental"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span className="sm:hidden">Profil</span>
            <span className="hidden sm:inline">Profil fundamental</span>
          </button>
        </div>

        {/* TAB 1: VALUASI & P/E BAND */}
        {activeTab === "valuation" && (
          <div className="p-4 md:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2736]">
              <div>
                <span className="text-xs text-slate-400 block font-sans">
                  Diagnosis valuasi P/E (dihitung otomatis dari data acuan)
                </span>
                <span className="text-sm font-semibold text-slate-100 mt-0.5 block font-sans">
                  {valuationDiagnosis.verdict}
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-sans shadow-sm self-start sm:self-center ${valuationDiagnosis.color}`}>
                {valuationDiagnosis.label}
              </div>
            </div>

            {/* P/E Deviation Band Table & Fair Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Deviation Level Breakdown */}
              <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736] space-y-2 text-xs">
                <span className="text-xs text-slate-400 block mb-1">
                  Pita deviasi P/E (berdasarkan EPS saat ini: {formatRupiah(impliedEPS)})
                </span>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>+2 SD (Mahal ekstrim - {formatMultiple(stock.peSd2Plus, 1)})</span>
                  <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd2PlusPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>+1 SD (Di atas rerata - {formatMultiple(stock.peSd1Plus, 1)})</span>
                  <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd1PlusPrice)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[#1E7B85]/30 bg-[#1E7B85]/10 px-1 rounded text-slate-100 font-medium">
                  <span>Mean (Harga wajar acuan - {formatMultiple(stock.historicalPeMean, 1)})</span>
                  <span className="font-mono tnum">{formatRupiah(targetMeanPrice)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-900 text-slate-400">
                  <span>-1 SD (Area undervalued - {formatMultiple(stock.peSd1Minus, 1)})</span>
                  <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd1MinusPrice)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-400">
                  <span>-2 SD (Diskon ekstrim - {formatMultiple(stock.peSd2Minus, 1)})</span>
                  <span className="text-slate-200 font-mono tnum">{formatRupiah(targetSd2MinusPrice)}</span>
                </div>
              </div>

              {/* Right: Fair Value Target Cards */}
              <div className="space-y-3">
                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs text-slate-400 block mb-0.5">
                    Target harga wajar (mean acuan):
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    {formatRupiah(targetMeanPrice)}
                  </span>
                  <span className={`text-xs block mt-0.5 font-mono tnum ${meanUpside >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}`}>
                    Potensi: {formatPersen(meanUpside, 1, true)}
                  </span>
                </div>

                <div className="p-3.5 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                  <span className="text-xs text-slate-400 block mb-0.5">
                    Nilai intrinsik Benjamin Graham:
                  </span>
                  <span className="text-lg font-bold font-mono text-slate-100 tnum">
                    {formatRupiah(grahamNumber)}
                  </span>
                  <span className={`text-xs block mt-0.5 font-mono tnum ${grahamUpside >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"}`}>
                    Potensi: {formatPersen(grahamUpside, 1, true)}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-1.5 font-sans leading-tight">
                    Catatan: Kurang relevan untuk perbankan dan saham pertumbuhan.
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
                  Setara {formatRupiah(Math.round(quarterlyDCA / 3))}/bulan
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

              {/* Explicit DRIP Toggle Button */}
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => setReinvestDividends(!reinvestDividends)}
                  className={`w-full py-1.5 px-3 rounded-lg text-xs font-sans transition flex items-center justify-between border ${
                    reinvestDividends
                      ? "bg-[#1E7B85]/20 text-white border-[#1E7B85]"
                      : "bg-[#111622] text-slate-400 border-[#20293A]"
                  }`}
                >
                  <span className="truncate">Reinvestasi dividen:</span>
                  <span
                    className={`ml-1.5 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                      reinvestDividends
                        ? "bg-[#1E7B85] text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {reinvestDividends ? "Ya" : "Tidak"}
                  </span>
                </button>
              </div>
            </div>

            {/* SINGLE UNIFIED SUMMARY BLOCK (Key-Value List) */}
            {simulationResults ? (
              <div className="bg-[#0C1017] rounded-xl border border-[#1E2736] overflow-hidden">
                <div className="p-3 bg-[#0E131C] border-b border-[#1E2736] flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">
                    Hasil kalkulasi simulasi DCA (data ilustrasi: {simStartYear} – 2026, {simulationResults.totalQuarters} kuartal)
                  </span>
                  <span className="text-slate-400 font-mono tnum">
                    Durasi: {formatDesimal(simulationResults.years, 1)} tahun
                  </span>
                </div>

                <div className="divide-y divide-[#171F2C] text-xs">
                  {/* Total modal disetor */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Total modal disetor:</span>
                    <span className="text-slate-100 font-mono tnum font-medium">
                      {formatRupiah(simulationResults.totalInvested)}
                    </span>
                  </div>

                  {/* Nilai portofolio akhir */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Nilai portofolio akhir:</span>
                    <span className="text-slate-100 font-mono tnum font-semibold">
                      {formatRupiah(simulationResults.finalValue)}
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
                        {formatRupiah(simulationResults.netProfit)}
                      </span>
                      <span
                        className={`ml-2 text-[11px] font-mono tnum ${
                          simulationResults.totalReturnPercent >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                        }`}
                      >
                        ({formatPersen(simulationResults.totalReturnPercent, 1, true)})
                      </span>
                    </div>
                  </div>

                  {/* Money-Weighted Rate of Return (IRR) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 gap-1">
                    <div>
                      <span className="text-slate-400 block">Laju imbal hasil tahunan (IRR - Money-Weighted):</span>
                      <span className="text-[10px] text-slate-500 block">
                        Memperhitungkan waktu tiap setoran berkala (DCA), bukan modal awal sekaligus.
                      </span>
                    </div>
                    <span className="text-slate-200 font-mono tnum font-semibold self-end sm:self-center">
                      {simulationResults.irr !== null
                        ? `${formatPersen(simulationResults.irr, 1, true)} / tahun`
                        : simulationResults.simpleAnnualReturn !== null
                        ? `${formatPersen(simulationResults.simpleAnnualReturn, 1, true)} / tahun (sederhana)`
                        : "Periode < 1 tahun"}
                    </span>
                  </div>

                  {/* Total dividen masuk */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Akumulasi dividen yang diterima:</span>
                    <span className="text-slate-200 font-mono tnum">
                      {formatRupiah(simulationResults.totalDividendsReceived)}
                    </span>
                  </div>

                  {/* Max Drawdown */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Penurunan terbesar dari puncak (drawdown):</span>
                    <span className="text-slate-200 font-mono tnum">
                      -{formatPersen(simulationResults.maxDrawdown, 1)}
                    </span>
                  </div>

                  {/* Alpha vs IHSG */}
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-400">Selisih kalkulasi vs acuan IHSG (Alpha):</span>
                    <span
                      className={`font-mono tnum font-semibold ${
                        simulationResults.alphaVsIhsg >= 0 ? "text-[#2EB886]" : "text-[#DC525F]"
                      }`}
                    >
                      {formatPersen(simulationResults.alphaVsIhsg, 1, true)}{" "}
                      <span className="font-sans font-normal text-xs text-slate-400">
                        ({simulationResults.alphaVsIhsg >= 0 ? "mengungguli simulasi IHSG" : "di bawah simulasi IHSG"})
                      </span>
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#0A0D14] border-t border-[#1E2736] text-[11px] text-slate-400">
                  Perhitungan berbasis 29 titik kuartalan data ilustrasi. Setiap siklus mewakili penutupan 1 kuartal (3 bulan). Angka IRR dan Alpha merupakan hasil kalkulasi simulasi atas data ilustrasi ini.
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
            <div className="text-[11px] text-slate-400 bg-[#0C1017] px-3 py-1.5 rounded-lg border border-[#1E2736]">
              Ringkasan contoh, belum diverifikasi
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {stock.description}
            </p>

            {/* Metrics Key-Value Grid: Single neutral text color for ratios */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">ROE</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{formatPersen(stock.roe, 1)}</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">PBV Ratio</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{formatMultiple(stock.pbvRatio, 2)}</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">DER (Utang)</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{formatMultiple(stock.der, 2)}</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">Dividend Yield</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{formatPersen(stock.dividendYield, 1)}</span>
              </div>
              <div className="p-2.5 bg-[#0C1017] rounded-lg border border-[#1E2736]">
                <span className="text-slate-400 block text-[11px]">Payout Ratio</span>
                <span className="font-mono tnum text-slate-100 font-semibold">{formatPersen(stock.payoutRatio, 1)}</span>
              </div>
            </div>

            {/* Strengths & Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                <span className="text-xs font-semibold text-slate-200 block mb-2">
                  Kekuatan dan keunggulan
                </span>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                  {stock.strengths.map((s, idx) => (
                    <li key={idx} className="leading-snug">{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-[#0C1017] rounded-xl border border-[#1E2736]">
                <span className="text-xs font-semibold text-slate-200 block mb-2">
                  Faktor risiko & tantangan
                </span>
                <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                  {stock.risks.map((r, idx) => (
                    <li key={idx} className="leading-snug">{r}</li>
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
