"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Check,
  Gauge,
  Hexagon,
  Layers,
  Target,
} from "lucide-react";
import { formatNumber, formatPersen, formatRupiah } from "@/lib/format";
import { evaluateStockHealthPillars } from "@/lib/stock-health";
import {
  computeClassicPivotPoints,
  computeIdxAraArbBounds,
  evaluateTechnicalSignals,
} from "@/lib/trading-tools";
import type { MarketHistoryPoint, MarketQuote } from "@/lib/market-data";
import { STOCKS_DATA } from "@/data/stocksData";
import {
  AnimatedNumber,
  EASE_TERMINAL,
  SPRING_GAUGE,
  SPRING_SNAP,
  TerminalSpotlightCard,
} from "./terminalMotion";

interface LeftIntelligenceDockProps {
  ticker: string;
  quote?: MarketQuote;
  historyPoints: MarketHistoryPoint[];
  targetBuyPrice?: number;
  onSetTargetBuyPrice: (ticker: string, price: number) => void;
}

type AnalyticsTabId = "snowflake" | "technical" | "pivot";

const RADAR_CX = 104;
const RADAR_CY = 88;
const RADAR_MAX_R = 54;

function polarPoint(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: RADAR_CX + r * Math.cos(rad),
    y: RADAR_CY + r * Math.sin(rad),
  };
}

/**
 * Kolom Kiri Bawah (di bawah Watchlist & Screener):
 * 1) Analytics Hub Interaktif: 5-Axis Fundamental Snowflake | Technical Speedometer | Pivot & 52W Range
 * 2) IDX ARA/ARB & Fraksi Harga Tick Radar
 */
export const LeftIntelligenceDock: React.FC<LeftIntelligenceDockProps> = ({
  ticker,
  quote,
  historyPoints,
  targetBuyPrice,
  onSetTargetBuyPrice,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>("snowflake");
  const [hoveredAxisIdx, setHoveredAxisIdx] = useState<number | null>(null);
  const [appliedTargetHint, setAppliedTargetHint] = useState<string | null>(null);

  const curated = useMemo(
    () => STOCKS_DATA.find((s) => s.ticker === ticker) ?? null,
    [ticker]
  );

  const activePrice =
    quote && quote.price > 0 ? quote.price : curated?.currentPrice ?? 0;
  const prevClose =
    quote && quote.previousClose > 0 ? quote.previousClose : activePrice;

  // 1. 5-Axis Snowflake Data (Valuasi, ROE, DER, Dividen, Momentum 52W)
  const snowflakeData = useMemo(() => {
    const activePe =
      quote && !quote.isFallback && quote.peRatio && quote.peRatio > 0
        ? quote.peRatio
        : curated?.peRatio ?? 0;
    const activeDiv =
      quote && !quote.isFallback && quote.dividendYield !== undefined && quote.dividendYield >= 0
        ? quote.dividendYield
        : curated?.dividendYield ?? 0;
    const activeRoe = curated?.roe ?? quote?.roe;
    const activeDer = curated?.der ?? quote?.der;
    const sector = curated?.sector || quote?.sector || "Bursa Efek Indonesia";

    const pillars = evaluateStockHealthPillars({
      sector,
      price: activePrice,
      peRatio: activePe,
      historicalPeMean: curated?.historicalPeMean,
      peSd1Minus: curated?.peSd1Minus,
      peSd2Minus: curated?.peSd2Minus,
      peSd1Plus: curated?.peSd1Plus,
      peSd2Plus: curated?.peSd2Plus,
      roe: activeRoe,
      der: activeDer,
      dividendYield: activeDiv,
      targetBuyPrice,
    });

    // Sumbu ke-5 memakai Momentum / Posisi 52W agar selalu informatif walau Target Beli belum diisi
    const closes = historyPoints.map((p) => p.close).filter((v) => v > 0);
    const hi52 = quote?.fiftyTwoWeekHigh ?? (closes.length > 0 ? Math.max(...closes) : 0);
    const lo52 = quote?.fiftyTwoWeekLow ?? (closes.length > 0 ? Math.min(...closes) : 0);
    const pos52Pct =
      hi52 > lo52 && activePrice > 0
        ? Math.max(5, Math.min(100, Math.round(((activePrice - lo52) / (hi52 - lo52)) * 100)))
        : 55;

    const axes = [
      {
        id: "valuation",
        shortLabel: "Valuasi",
        score: pillars[0]?.score ?? 50,
        valueLabel: pillars[0]?.valueLabel ?? "-",
        detail: pillars[0]?.detailText ?? "Rasio P/E",
      },
      {
        id: "roe",
        shortLabel: "ROE",
        score: pillars[1]?.score ?? 50,
        valueLabel: pillars[1]?.valueLabel ?? "-",
        detail: pillars[1]?.detailText ?? "Profitabilitas",
      },
      {
        id: "der",
        shortLabel: "Neraca",
        score: pillars[2]?.score ?? 50,
        valueLabel: pillars[2]?.valueLabel ?? "-",
        detail: pillars[2]?.detailText ?? "Struktur DER",
      },
      {
        id: "dividend",
        shortLabel: "Dividen",
        score: pillars[3]?.score ?? 40,
        valueLabel: pillars[3]?.valueLabel ?? "-",
        detail: pillars[3]?.detailText ?? "Dividend Yield",
      },
      {
        id: "momentum",
        shortLabel: "Tren 52W",
        score: pos52Pct,
        valueLabel: `${pos52Pct}%`,
        detail: hi52 > lo52 ? `Rentang ${formatNumber(lo52)}–${formatNumber(hi52)}` : "Posisi tren harga",
      },
    ];

    const compositeScore = Math.round(
      axes.reduce((acc, item) => acc + item.score, 0) / axes.length
    );

    return { axes, compositeScore, hi52, lo52, pos52Pct };
  }, [quote, curated, activePrice, targetBuyPrice, historyPoints]);

  // 2. Technical Signals Speedometer Data
  const technicalSignals = useMemo(
    () =>
      evaluateTechnicalSignals({
        currentPrice: activePrice,
        historyPoints,
        fiftyTwoWeekLow: quote?.fiftyTwoWeekLow,
        fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh,
      }),
    [activePrice, historyPoints, quote?.fiftyTwoWeekLow, quote?.fiftyTwoWeekHigh]
  );

  // 3. Pivot Points (OHLC hari terakhir atau candle terakhir)
  const pivotLevels = useMemo(() => {
    const lastBar = historyPoints[historyPoints.length - 1];
    const high = quote?.dayHigh && quote.dayHigh > 0 ? quote.dayHigh : lastBar?.high ?? activePrice;
    const low = quote?.dayLow && quote.dayLow > 0 ? quote.dayLow : lastBar?.low ?? activePrice;
    const close = activePrice > 0 ? activePrice : lastBar?.close ?? 0;
    return computeClassicPivotPoints(high, low, close);
  }, [quote?.dayHigh, quote?.dayLow, historyPoints, activePrice]);

  // 4. IDX ARA / ARB & Fraksi Tick Bounds
  const araArb = useMemo(
    () => computeIdxAraArbBounds(prevClose, activePrice),
    [prevClose, activePrice]
  );

  const handleQuickTargetClick = (price: number, label: string) => {
    onSetTargetBuyPrice(ticker, price);
    setAppliedTargetHint(`${label} (${formatRupiah(price)}) disimpan`);
    window.setTimeout(() => {
      setAppliedTargetHint((cur) =>
        cur && cur.startsWith(label) ? null : cur
      );
    }, 2600);
  };

  // Precompute Snowflake SVG polygon points
  const radarPoints = useMemo(() => {
    return snowflakeData.axes.map((axis, idx) => {
      const angle = -90 + idx * 72;
      const r = (Math.max(14, axis.score) / 100) * RADAR_MAX_R;
      const pt = polarPoint(angle, r);
      const lblPt = polarPoint(angle, RADAR_MAX_R + 17);
      return { ...axis, angle, x: pt.x, y: pt.y, lx: lblPt.x, ly: lblPt.y };
    });
  }, [snowflakeData.axes]);

  const polygonPointsStr = radarPoints
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const focusedAxis =
    hoveredAxisIdx !== null ? radarPoints[hoveredAxisIdx] : null;

  const techVerdictColor =
    technicalSignals.tone === "emerald"
      ? "text-[#22C55E]"
      : technicalSignals.tone === "teal"
      ? "text-[#2DD4BF]"
      : technicalSignals.tone === "coral"
      ? "text-[#EF4444]"
      : "text-amber-300";

  return (
    <div className="flex flex-col gap-1.5 w-full text-xs font-sans">
      {/* KARTU 1: INTERACTIVE ANALYTICS HUB (SNOWFLAKE | TEKNIKAL | PIVOT 52W) */}
      <TerminalSpotlightCard className="rounded-lg overflow-hidden">
        <div className="relative z-10 p-3 space-y-2.5">
          {/* Tab Switcher */}
          <div className="grid grid-cols-3 gap-0.5 bg-[#080A0F] p-0.5 rounded-md border border-white/[0.06] text-[10.5px]">
            {(
              [
                {
                  id: "snowflake" as const,
                  label: "Snowflake",
                  icon: <Hexagon className="w-3 h-3" aria-hidden="true" />,
                },
                {
                  id: "technical" as const,
                  label: "Teknikal",
                  icon: <Gauge className="w-3 h-3" aria-hidden="true" />,
                },
                {
                  id: "pivot" as const,
                  label: "Pivot 52W",
                  icon: <Layers className="w-3 h-3" aria-hidden="true" />,
                },
              ] as const
            ).map((tab) => {
              const isSel = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative z-10 py-1.5 rounded inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
                    isSel ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {isSel && (
                    <motion.span
                      layoutId="left-analytics-tab"
                      transition={SPRING_SNAP}
                      aria-hidden="true"
                      className="absolute inset-0 rounded bg-[#1E7B85] border border-[#2DD4BF]/35 -z-10"
                    />
                  )}
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {/* TAB 1: 5-AXIS FUNDAMENTAL SNOWFLAKE RADAR */}
            {activeTab === "snowflake" && (
              <motion.div
                key={`snow-${ticker}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: EASE_TERMINAL }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Radar 5 Sumbu &bull; {ticker}
                    </span>
                    <span className="text-[10.5px] text-slate-500">
                      Arahkan kursor ke titik sudut
                    </span>
                  </div>
                  <div className="text-right font-mono tnum">
                    <AnimatedNumber
                      value={snowflakeData.compositeScore}
                      format={(n) => `${Math.round(n)}`}
                      className="text-base font-bold text-[#2DD4BF]"
                    />
                    <span className="text-[10px] text-slate-500">/100</span>
                  </div>
                </div>

                {/* SVG 5-Axis Snowflake */}
                <div className="flex justify-center py-0.5">
                  <svg
                    viewBox="0 0 208 176"
                    className="w-full max-w-[216px] h-[168px] overflow-visible"
                    role="img"
                    aria-label={`Radar 5 sumbu fundamental ${ticker} skor ${snowflakeData.compositeScore} dari 100`}
                  >
                    <defs>
                      <radialGradient id="snowflakeFill" cx="50%" cy="50%" r="55%">
                        <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.48" />
                        <stop offset="100%" stopColor="#1E7B85" stopOpacity="0.16" />
                      </radialGradient>
                    </defs>

                    {/* Concentric pentagon grid rings */}
                    {[0.33, 0.66, 1].map((ratio) => {
                      const pts = Array.from({ length: 5 }, (_, i) => {
                        const p = polarPoint(-90 + i * 72, RADAR_MAX_R * ratio);
                        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                      }).join(" ");
                      return (
                        <polygon
                          key={ratio}
                          points={pts}
                          fill="none"
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Radial spokes */}
                    {radarPoints.map((pt) => {
                      const outer = polarPoint(pt.angle, RADAR_MAX_R);
                      return (
                        <line
                          key={`spoke-${pt.id}`}
                          x1={RADAR_CX}
                          y1={RADAR_CY}
                          x2={outer.x}
                          y2={outer.y}
                          stroke="rgba(255,255,255,0.07)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Animated Snowflake Polygon */}
                    <motion.polygon
                      initial={false}
                      animate={{ points: polygonPointsStr }}
                      transition={SPRING_GAUGE}
                      fill="url(#snowflakeFill)"
                      stroke="#2DD4BF"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />

                    {/* Interactive vertices & axis labels */}
                    {radarPoints.map((pt, idx) => {
                      const isHov = hoveredAxisIdx === idx;
                      return (
                        <g
                          key={pt.id}
                          onPointerEnter={() => setHoveredAxisIdx(idx)}
                          onPointerLeave={() => setHoveredAxisIdx(null)}
                          onClick={() => setHoveredAxisIdx((c) => (c === idx ? null : idx))}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHov ? 5 : 3.2}
                            fill={isHov ? "#5EEAD4" : "#0F131C"}
                            stroke="#2DD4BF"
                            strokeWidth="1.8"
                          />
                          <circle cx={pt.x} cy={pt.y} r="11" fill="transparent" />
                          <text
                            x={pt.lx}
                            y={pt.ly}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className={`text-[9px] font-sans transition-colors ${
                              isHov ? "fill-[#5EEAD4] font-semibold" : "fill-slate-400"
                            }`}
                          >
                            {pt.shortLabel}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Live Axis Hover Readout */}
                <div className="px-2.5 py-2 rounded-md bg-[#0B0E15] border border-white/[0.06] flex items-center justify-between gap-2 min-h-[46px]">
                  {focusedAxis ? (
                    <>
                      <div className="min-w-0">
                        <span className="text-[10.5px] font-semibold text-[#2DD4BF] block">
                          {focusedAxis.shortLabel} ({focusedAxis.score}/100)
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {focusedAxis.detail}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-xs text-white tnum shrink-0">
                        {focusedAxis.valueLabel}
                      </span>
                    </>
                  ) : (
                    <div className="w-full grid grid-cols-5 gap-1 text-center font-mono tnum">
                      {radarPoints.map((pt, idx) => (
                        <button
                          key={pt.id}
                          type="button"
                          onPointerEnter={() => setHoveredAxisIdx(idx)}
                          onClick={() => setHoveredAxisIdx(idx)}
                          className="rounded py-0.5 hover:bg-white/[0.05] transition"
                        >
                          <span className="block text-[9px] text-slate-500 font-sans truncate">
                            {pt.shortLabel}
                          </span>
                          <span className="text-[10.5px] font-semibold text-slate-200">
                            {pt.score}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 2: TECHNICAL SIGNALS SPEEDOMETER (ALA TRADINGVIEW) */}
            {activeTab === "technical" && (
              <motion.div
                key={`tech-${ticker}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: EASE_TERMINAL }}
                className="space-y-2"
              >
                {/* Semi-circular Speedometer SVG */}
                <div className="flex flex-col items-center">
                  <svg
                    viewBox="0 0 200 112"
                    className="w-full max-w-[200px] h-[106px]"
                    role="img"
                    aria-label={`Speedometer sinyal teknikal ${ticker}: ${technicalSignals.verdict}`}
                  >
                    <defs>
                      <linearGradient id="techSpeedoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#EF4444" />
                        <stop offset="35%" stopColor="#F59E0B" />
                        <stop offset="68%" stopColor="#2DD4BF" />
                        <stop offset="100%" stopColor="#22C55E" />
                      </linearGradient>
                    </defs>

                    <path
                      d="M 22 96 A 78 78 0 0 1 178 96"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 22 96 A 78 78 0 0 1 178 96"
                      fill="none"
                      stroke="url(#techSpeedoGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      opacity="0.88"
                    />

                    {/* Spring Needle */}
                    <motion.g
                      initial={false}
                      animate={{ rotate: technicalSignals.needleAngleDeg }}
                      transition={SPRING_GAUGE}
                      style={{ transformOrigin: "100px 96px" }}
                    >
                      <line
                        x1="100"
                        y1="96"
                        x2="100"
                        y2="29"
                        stroke="#F8FAFC"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      <circle cx="100" cy="96" r="5" fill="#2DD4BF" stroke="#0B0E15" strokeWidth="2" />
                    </motion.g>

                    <text x="16" y="109" className="fill-slate-500 text-[8px] font-sans">
                      Jual
                    </text>
                    <text x="100" y="14" textAnchor="middle" className="fill-slate-500 text-[8px] font-sans">
                      Netral
                    </text>
                    <text x="184" y="109" textAnchor="end" className="fill-slate-500 text-[8px] font-sans">
                      Beli
                    </text>
                  </svg>

                  <div className="text-center -mt-1">
                    <span className={`text-sm font-bold ${techVerdictColor}`}>
                      {technicalSignals.verdict}
                    </span>
                    <div className="flex items-center justify-center gap-2 mt-1 text-[10px] font-mono tnum">
                      <span className="text-[#EF4444]">Jual {technicalSignals.sellCount}</span>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-amber-300">Netral {technicalSignals.neutralCount}</span>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-[#22C55E]">Beli {technicalSignals.buyCount}</span>
                    </div>
                  </div>
                </div>

                {/* Breakdown Baris Indikator */}
                <div className="divide-y divide-white/[0.05] rounded-md bg-[#0B0E15] border border-white/[0.06]">
                  {technicalSignals.indicators.map((ind) => (
                    <div
                      key={ind.id}
                      title={ind.detail}
                      className="px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-white/[0.025] transition"
                    >
                      <span className="text-[10.5px] text-slate-300 truncate">{ind.label}</span>
                      <div className="flex items-center gap-1.5 font-mono tnum shrink-0">
                        <span className="text-[10.5px] text-slate-200">{ind.valueLabel}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                            ind.vote === "buy"
                              ? "bg-[#22C55E]/15 text-[#22C55E]"
                              : ind.vote === "sell"
                              ? "bg-[#EF4444]/15 text-[#EF4444]"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {ind.vote === "buy" ? "Beli" : ind.vote === "sell" ? "Jual" : "Netral"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TAB 3: PIVOT SUPPORT/RESISTANCE & 52-WEEK RANGE */}
            {activeTab === "pivot" && (
              <motion.div
                key={`pivot-${ticker}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: EASE_TERMINAL }}
                className="space-y-2.5"
              >
                {/* 52-Week Range Thermometer */}
                <div className="p-2.5 rounded-md bg-[#0B0E15] border border-white/[0.06] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Rentang 52 Minggu</span>
                    <span className="font-mono text-[#2DD4BF] font-semibold tnum">
                      Posisi {snowflakeData.pos52Pct}%
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/[0.07] overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: `${snowflakeData.pos52Pct}%` }}
                      transition={SPRING_GAUGE}
                      className="h-full rounded-full bg-gradient-to-r from-[#EF4444] via-[#2DD4BF] to-[#22C55E]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono tnum text-slate-400">
                    <span>Low {snowflakeData.lo52 > 0 ? formatRupiah(snowflakeData.lo52) : "-"}</span>
                    <span>High {snowflakeData.hi52 > 0 ? formatRupiah(snowflakeData.hi52) : "-"}</span>
                  </div>
                </div>

                {/* Classic Pivot Levels (Klik S1/S2 langsung isi Target Beli!) */}
                {pivotLevels && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                      <span>Classic Pivot (Tick BEI)</span>
                      <span className="text-[#2DD4BF]">Klik S1/S2 = Target Beli</span>
                    </div>

                    <div className="divide-y divide-white/[0.05] rounded-md bg-[#0B0E15] border border-white/[0.06] font-mono tnum">
                      {(
                        [
                          { key: "R2", label: "Resistance 2", val: pivotLevels.r2, kind: "res" },
                          { key: "R1", label: "Resistance 1", val: pivotLevels.r1, kind: "res" },
                          { key: "P", label: "Pivot Harian", val: pivotLevels.pivot, kind: "piv" },
                          { key: "S1", label: "Support 1", val: pivotLevels.s1, kind: "sup" },
                          { key: "S2", label: "Support 2", val: pivotLevels.s2, kind: "sup" },
                        ] as const
                      ).map((row) => {
                        const diffPct =
                          activePrice > 0 ? ((row.val - activePrice) / activePrice) * 100 : 0;
                        const clickable = row.kind === "sup";

                        if (clickable) {
                          return (
                            <button
                              key={row.key}
                              type="button"
                              data-cursor-hint={`Set Target ${row.key}`}
                              onClick={() => handleQuickTargetClick(row.val, row.key)}
                              className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-[#1E7B85]/18 text-left transition group"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <span className="px-1 rounded bg-[#22C55E]/15 text-[#22C55E] text-[9.5px] font-bold">
                                  {row.key}
                                </span>
                                <span className="font-sans text-[10.5px] text-slate-300 group-hover:text-white">
                                  {row.label}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-white">
                                  {formatRupiah(row.val)}
                                </span>
                                <Target className="w-3 h-3 text-[#2DD4BF] opacity-70 group-hover:opacity-100" />
                              </span>
                            </button>
                          );
                        }

                        return (
                          <div
                            key={row.key}
                            className="px-2.5 py-1.5 flex items-center justify-between gap-2"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={`px-1 rounded text-[9.5px] font-bold ${
                                  row.kind === "res"
                                    ? "bg-[#EF4444]/15 text-[#EF4444]"
                                    : "bg-[#1E7B85]/25 text-[#2DD4BF]"
                                }`}
                              >
                                {row.key}
                              </span>
                              <span className="font-sans text-[10.5px] text-slate-400">
                                {row.label}
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-200">
                              {formatRupiah(row.val)}{" "}
                              <span className="text-[9.5px] text-slate-500">
                                ({formatPersen(diffPct, 1, true)})
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {appliedTargetHint && (
                      <div className="px-2 py-1 rounded bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#22C55E] text-[10px] flex items-center gap-1">
                        <Check className="w-3 h-3 shrink-0" />
                        <span className="truncate">{appliedTargetHint}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </TerminalSpotlightCard>

      {/* KARTU 2: IDX FRAKSI HARGA & RADAR ARA / ARB */}
      {araArb && (
        <TerminalSpotlightCard className="rounded-lg overflow-hidden">
          <div className="relative z-10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#2DD4BF]" aria-hidden="true" />
                <span>Radar ARA / ARB &amp; Tick</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#080A0F] border border-white/[0.07] font-mono text-[10px] text-[#2DD4BF] tnum">
                Fraksi Rp {araArb.tickSize}
              </span>
            </div>

            {/* Thermometer ARB <-> ARA */}
            <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06] space-y-1.5 font-mono tnum">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[#EF4444] font-semibold">
                  ARB (-{araArb.arbPercent}%) {formatRupiah(araArb.arbPrice)}
                </span>
                <span className="text-[#22C55E] font-semibold">
                  ARA (+{araArb.araPercent}%) {formatRupiah(araArb.araPrice)}
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-white/[0.07]">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#EF4444]/60 via-slate-500/40 to-[#22C55E]/60" />
                <motion.div
                  initial={false}
                  animate={{ left: `${araArb.positionPct}%` }}
                  transition={SPRING_GAUGE}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#2DD4BF] shadow"
                />
              </div>

              <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                <span>Jarak ARB {formatPersen(araArb.distanceToArbPct, 1, true)}</span>
                <span>Jarak ARA {formatPersen(araArb.distanceToAraPct, 1, true)}</span>
              </div>
            </div>

            {/* Papan Fraksi ±3 Tick Cepat */}
            <div className="grid grid-cols-2 gap-1.5 font-mono tnum text-[10px]">
              <div className="p-1.5 rounded bg-[#0B0E15] border border-white/[0.06] space-y-0.5">
                <span className="text-[9px] font-sans uppercase text-slate-500 block">
                  Bid (-1..-3 Tick)
                </span>
                {araArb.downTicks.map((p, idx) => (
                  <button
                    key={`dn-${p}`}
                    type="button"
                    data-cursor-hint="Jadikan Target"
                    onClick={() => handleQuickTargetClick(p, `-${idx + 1} Tick`)}
                    className="w-full flex items-center justify-between px-1 py-0.5 rounded hover:bg-[#1E7B85]/20 transition"
                  >
                    <span className="text-slate-500">-{idx + 1}t</span>
                    <span className="text-slate-200 font-semibold">{formatNumber(p)}</span>
                  </button>
                ))}
              </div>
              <div className="p-1.5 rounded bg-[#0B0E15] border border-white/[0.06] space-y-0.5">
                <span className="text-[9px] font-sans uppercase text-slate-500 block">
                  Offer (+1..+3 Tick)
                </span>
                {araArb.upTicks.map((p, idx) => (
                  <div
                    key={`up-${p}`}
                    className="flex items-center justify-between px-1 py-0.5"
                  >
                    <span className="text-slate-500">+{idx + 1}t</span>
                    <span className="text-[#22C55E] font-semibold">{formatNumber(p)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TerminalSpotlightCard>
      )}
    </div>
  );
};
