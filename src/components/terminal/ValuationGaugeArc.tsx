"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatMultiple, formatPersen, formatRupiah } from "@/lib/format";
import type { ValuationGaugeBandStop, ValuationGaugeResult } from "@/lib/stock-health";
import { EASE_TERMINAL, SPRING_GAUGE } from "./terminalMotion";

interface ValuationGaugeArcProps {
  ticker: string;
  activePe: number;
  activePrice: number;
  gauge: ValuationGaugeResult;
  bandKindLabel: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Interactive Valuation / Margin of Safety Gauge Arc (diadaptasi dari Volatility Gauge Rax Trade):
 * Busur gradien Emerald -> Teal -> Amber -> Coral dengan penanda jarum spring Framer Motion
 * serta 5 tombol pita deviasi interaktif (-2 SD s.d. +2 SD) untuk pratinjau harga target & upside.
 */
export const ValuationGaugeArc: React.FC<ValuationGaugeArcProps> = ({
  ticker,
  activePe,
  activePrice,
  gauge,
  bandKindLabel,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [selectedStopId, setSelectedStopId] = useState<ValuationGaugeBandStop["id"]>("mean");

  const activeStop =
    gauge.stops.find((s) => s.id === selectedStopId) ?? gauge.stops[2] ?? gauge.stops[0];

  const cx = 130;
  const cy = 114;
  const radius = 86;
  const markerPoint = polarToCartesian(cx, cy, radius, gauge.angleDeg);

  const zoneTextClass =
    gauge.tone === "emerald"
      ? "text-[#22C55E]"
      : gauge.tone === "teal"
      ? "text-[#2DD4BF]"
      : gauge.tone === "amber"
      ? "text-[#FBBF24]"
      : "text-[#F87171]";

  return (
    <div className="p-4 rounded-xl bg-[#0B0E15] border border-white/[0.07] flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="block text-[10px] font-mono uppercase tracking-[0.12em] text-[#2DD4BF]">
            Meteran Deviasi P/E
          </span>
          <span className="text-xs text-slate-400">{bandKindLabel}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
            gauge.tone === "emerald"
              ? "bg-[#22C55E]/15 border-[#22C55E]/35 text-[#22C55E]"
              : gauge.tone === "teal"
              ? "bg-[#1E7B85]/20 border-[#2DD4BF]/35 text-[#2DD4BF]"
              : gauge.tone === "amber"
              ? "bg-[#F59E0B]/15 border-[#F59E0B]/35 text-[#FBBF24]"
              : "bg-[#EF4444]/15 border-[#EF4444]/35 text-[#F87171]"
          }`}
        >
          {gauge.zoneLabel}
        </span>
      </div>

      {/* Semi-Circular SVG Gauge */}
      <div className="relative flex flex-col items-center">
        <svg
          viewBox="0 0 260 132"
          className="w-full max-w-[268px] overflow-visible"
          role="img"
          aria-label={`Meteran valuasi ${ticker}: P/E ${formatMultiple(activePe, 1)}, zona ${gauge.zoneLabel}`}
        >
          <defs>
            <linearGradient id={`val-gauge-grad-${ticker}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="32%" stopColor="#2DD4BF" />
              <stop offset="68%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Track latar belakang */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Busur gradien utama */}
          <motion.path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={`url(#val-gauge-grad-${ticker})`}
            strokeWidth="12"
            strokeLinecap="round"
            initial={shouldReduceMotion ? false : { pathLength: 0.15, opacity: 0.6 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: EASE_TERMINAL }}
          />

          {/* Penanda 5 Pita SD di sepanjang busur */}
          {gauge.stops.map((stop) => {
            const stopAngle = (stop.pctOnArc / 100) * 180 - 90;
            const inner = polarToCartesian(cx, cy, radius - 11, stopAngle);
            const outer = polarToCartesian(cx, cy, radius + 11, stopAngle);
            const isSelected = stop.id === activeStop.id;
            return (
              <line
                key={stop.id}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke={isSelected ? "#FFFFFF" : "rgba(255,255,255,0.22)"}
                strokeWidth={isSelected ? 2 : 1}
              />
            );
          })}

          {/* Titik Posisi P/E Aktif */}
          <motion.g
            initial={false}
            animate={{ x: markerPoint.x, y: markerPoint.y }}
            transition={shouldReduceMotion ? { duration: 0 } : SPRING_GAUGE}
          >
            <circle r="11" fill="rgba(45, 212, 191, 0.22)" />
            <circle r="6" fill="#FFFFFF" stroke="#080A0F" strokeWidth="2.5" />
          </motion.g>

          {/* Label Ujung */}
          <text
            x={cx - radius - 2}
            y={cy + 16}
            textAnchor="middle"
            className="fill-[#22C55E] font-mono text-[9.5px]"
          >
            -2 SD
          </text>
          <text
            x={cx}
            y={cy - radius - 14}
            textAnchor="middle"
            className="fill-slate-400 font-mono text-[9.5px]"
          >
            Mean
          </text>
          <text
            x={cx + radius + 2}
            y={cy + 16}
            textAnchor="middle"
            className="fill-[#EF4444] font-mono text-[9.5px]"
          >
            +2 SD
          </text>
        </svg>

        {/* Angka Pusat P/E */}
        <div className="-mt-11 text-center pointer-events-none">
          <span className="block font-mono text-2xl font-bold text-white tnum leading-none">
            {formatMultiple(activePe, 1)}
          </span>
          <span className={`block font-mono text-[11px] font-semibold tnum mt-1 ${zoneTextClass}`}>
            {formatPersen(gauge.diffFromMeanPct, 1, true)} vs Mean
          </span>
        </div>
      </div>

      {/* 5 Tombol Pita Interaktif + Pratinjau Harga Implied */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <div className="grid grid-cols-5 gap-1">
          {gauge.stops.map((stop) => {
            const isSelected = stop.id === activeStop.id;
            return (
              <button
                key={stop.id}
                type="button"
                onMouseEnter={() => setSelectedStopId(stop.id)}
                onClick={() => setSelectedStopId(stop.id)}
                aria-pressed={isSelected}
                className={`py-1 px-1 rounded text-[10.5px] font-mono transition border ${
                  isSelected
                    ? "bg-[#161C29] border-[#2DD4BF]/70 text-white font-semibold"
                    : "bg-[#0F131C] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:border-white/[0.14]"
                }`}
              >
                {stop.label}
              </button>
            );
          })}
        </div>

        <div
          aria-live="polite"
          className="px-2.5 py-2 rounded-lg bg-[#0F131C] border border-white/[0.06] flex items-center justify-between gap-2 text-[11px] font-mono tnum"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${ticker}-${activeStop.id}`}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
              transition={{ duration: 0.16, ease: EASE_TERMINAL }}
              className="w-full flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="text-slate-400 font-sans text-[10.5px] block">
                  Implied {activeStop.label} ({formatMultiple(activeStop.pe, 1)})
                </span>
                <span className="text-slate-100 font-bold text-xs">
                  {activeStop.impliedPrice > 0 ? formatRupiah(activeStop.impliedPrice) : "-"}
                </span>
              </div>

              {activePrice > 0 && activeStop.impliedPrice > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-slate-500 font-sans text-[10px] block">vs Harga Aktif</span>
                  <span
                    className={`font-semibold text-xs ${
                      activeStop.upsidePct >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    {formatPersen(activeStop.upsidePct, 1, true)}
                  </span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
