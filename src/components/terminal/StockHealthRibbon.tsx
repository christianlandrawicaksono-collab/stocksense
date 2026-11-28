"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { HealthTone, StockHealthPillar } from "@/lib/stock-health";
import { EASE_TERMINAL } from "./terminalMotion";

interface StockHealthRibbonProps {
  ticker: string;
  pillars: StockHealthPillar[];
  onTriggerPillarAction: (action: StockHealthPillar["targetAction"]) => void;
}

const TONE_STYLES: Record<
  HealthTone,
  { badge: string; bar: string; value: string; borderHover: string }
> = {
  emerald: {
    badge: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
    bar: "bg-[#22C55E]",
    value: "text-[#22C55E]",
    borderHover: "hover:border-[#22C55E]/45",
  },
  teal: {
    badge: "bg-[#1E7B85]/20 text-[#2DD4BF] border-[#2DD4BF]/30",
    bar: "bg-[#2DD4BF]",
    value: "text-[#2DD4BF]",
    borderHover: "hover:border-[#2DD4BF]/45",
  },
  amber: {
    badge: "bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/35",
    bar: "bg-[#F59E0B]",
    value: "text-[#FBBF24]",
    borderHover: "hover:border-[#F59E0B]/45",
  },
  coral: {
    badge: "bg-[#EF4444]/15 text-[#F87171] border-[#EF4444]/35",
    bar: "bg-[#EF4444]",
    value: "text-[#F87171]",
    borderHover: "hover:border-[#EF4444]/45",
  },
  muted: {
    badge: "bg-white/[0.05] text-slate-400 border-white/[0.08]",
    bar: "bg-slate-600",
    value: "text-slate-300",
    borderHover: "hover:border-white/[0.18]",
  },
};

/**
 * 5-Pillar Interactive Health Pods (diadaptasi dari Score Sparkline Pods Rax Trade):
 * Memungkinkan investor membaca Valuasi, ROE, DER, Dividen, dan Target Beli dalam 2 detik
 * sekaligus klik langsung ke tab/editor terkait.
 */
export const StockHealthRibbon: React.FC<StockHealthRibbonProps> = ({
  ticker,
  pillars,
  onTriggerPillarAction,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-label={`Ringkasan 5 pilar kesehatan saham ${ticker}`}
      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5"
    >
      {pillars.map((pillar, idx) => {
        const style = TONE_STYLES[pillar.tone];
        return (
          <motion.button
            key={`${ticker}-${pillar.id}`}
            type="button"
            onClick={() => onTriggerPillarAction(pillar.targetAction)}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: idx * 0.03, ease: EASE_TERMINAL }}
            whileHover={shouldReduceMotion ? undefined : { y: -1.5 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
            className={`group text-left px-2.5 py-2 rounded-lg bg-[#0B0E15]/90 border border-white/[0.06] ${style.borderHover} transition-colors flex flex-col justify-between gap-1.5`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-sans uppercase tracking-wider text-slate-400 truncate">
                {pillar.label}
              </span>
              <ArrowUpRight
                className="w-3 h-3 text-slate-600 group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0"
                aria-hidden="true"
              />
            </div>

            <div className="flex items-baseline justify-between gap-1.5">
              <span className={`font-mono font-bold text-xs sm:text-[13px] tnum truncate ${style.value}`}>
                {pillar.valueLabel}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded border text-[9.5px] font-medium shrink-0 ${style.badge}`}
              >
                {pillar.statusLabel}
              </span>
            </div>

            {/* Micro Health Strength Bar */}
            <div className="space-y-1">
              <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(0.08, Math.min(1, pillar.score / 100)) }}
                  transition={{ duration: 0.45, delay: idx * 0.04, ease: EASE_TERMINAL }}
                  className={`h-full w-full origin-left rounded-full ${style.bar}`}
                />
              </div>
              <span className="block text-[10px] text-slate-500 truncate">{pillar.detailText}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
