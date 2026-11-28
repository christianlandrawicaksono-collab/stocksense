"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useVelocity,
} from "framer-motion";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";
import { formatPersen } from "@/lib/format";
import { MarketTickerItem } from "@/types/market";
import { MarketProvider } from "@/lib/market-data";

interface MarketTickerProps {
  provider?: MarketProvider;
  tickers?: MarketTickerItem[];
  isMacroFallback?: boolean;
  isLoading?: boolean;
  theme?: "dark" | "light";
  embedded?: boolean;
  sharp?: boolean;
  onSelectSymbol?: (symbol: string) => void;
}

function getSymbolAccentDot(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.includes("IHSG")) return "bg-[#2DD4BF]";
  if (s.includes("S&P") || s.includes("SP500")) return "bg-[#38BDF8]";
  if (s.includes("GOLD")) return "bg-amber-400";
  if (s.includes("BRENT") || s.includes("OIL")) return "bg-orange-400";
  if (s.includes("COAL")) return "bg-emerald-400";
  if (s.includes("USD")) return "bg-violet-400";
  return "bg-[#2DD4BF]";
}

interface TickerChipGroupProps {
  tickers: MarketTickerItem[];
  isLight: boolean;
  isYahooLive: boolean;
  cloneIndex: number;
  onSelectSymbol?: (symbol: string) => void;
}

const TickerChipGroup: React.FC<TickerChipGroupProps> = ({
  tickers,
  isLight,
  isYahooLive,
  cloneIndex,
  onSelectSymbol,
}) => {
  const isClone = cloneIndex > 0;

  return (
    <div
      className="flex items-center shrink-0 gap-2.5 pr-2.5"
      aria-hidden={isClone || undefined}
    >
      {tickers.map((ticker) => {
        const isUp = ticker.change > 0;
        const isZero = Math.abs(ticker.change) < 0.005;

        const deltaClass = isLight
          ? isZero
            ? "text-[#5A6068] bg-[#E8E4DC]"
            : isUp
            ? "text-[#0D6343] bg-[#0D6343]/12"
            : "text-[#990F3D] bg-[#990F3D]/12"
          : isZero
          ? "text-slate-400 bg-white/[0.06]"
          : isUp
          ? "text-[#22C55E] bg-[#22C55E]/12"
          : "text-[#EF4444] bg-[#EF4444]/12";

        const chipBase = isLight
          ? "bg-[#FBFBFA] border-[#DFDBD2] hover:border-[#0D7680] hover:bg-white text-[#1D1F23] shadow-[0_1px_2px_rgba(29,31,35,0.04)]"
          : "bg-[#0F1420]/85 border-white/[0.08] hover:border-[#2DD4BF]/55 hover:bg-[#141B2B] text-slate-100";

        const inner = (
          <>
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getSymbolAccentDot(ticker.symbol)}`}
            />
            <span
              className={`font-mono text-[11px] font-bold tracking-tight ${
                isLight ? "text-[#1A1C1E]" : "text-slate-200"
              }`}
            >
              {ticker.symbol}
            </span>
            <span
              className={`font-mono text-[11px] tnum ${
                isLight ? "text-[#3B4048]" : "text-slate-300"
              }`}
            >
              {ticker.value}
            </span>
            <span
              className={`font-mono text-[10px] font-semibold tnum px-1.5 py-0.2 rounded ${deltaClass}`}
            >
              {isZero ? "0,00%" : formatPersen(ticker.change, 2, true)}
            </span>
          </>
        );

        const title = onSelectSymbol
          ? `${ticker.name}${isYahooLive ? " (Yahoo Live)" : " (Acuan)"} — Klik untuk sorot di 3D Globe`
          : `${ticker.name}${isYahooLive ? " (Yahoo Finance)" : " (Data Ilustrasi)"}`;

        if (onSelectSymbol && !isClone) {
          return (
            <button
              key={`${cloneIndex}-${ticker.symbol}`}
              type="button"
              onClick={() => onSelectSymbol(ticker.symbol)}
              title={title}
              data-cursor-hint="Sorot Globe"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${chipBase}`}
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={`${cloneIndex}-${ticker.symbol}`}
            onClick={onSelectSymbol ? () => onSelectSymbol(ticker.symbol) : undefined}
            title={title}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap shrink-0 ${
              onSelectSymbol ? "cursor-pointer" : ""
            } ${chipBase}`}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Orbital Velocity Market Ticker Ribbon (Terinspirasi Bloomberg × Fey × Motion.dev):
 * - Kapsul kaca modern dengan edge fade masks kiri-kanan
 * - Kecepatan pita bereaksi halus terhadap momentum scroll (useScroll + useVelocity)
 * - Hover-to-pause lembut agar nyaman dibaca & diklik
 * - Interaktif: klik simbol (IHSG, S&P 500, GOLD, BRENT, COAL, USD/IDR) langsung menyinkronkan 3D Globe!
 */
export const MarketTicker: React.FC<MarketTickerProps> = ({
  provider = "illustrative",
  tickers,
  isMacroFallback = false,
  isLoading = false,
  theme = "dark",
  embedded = false,
  sharp = false,
  onSelectSymbol,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isLight = theme === "light";
  const isYahooLive = provider === "yahoo" && !isMacroFallback && (tickers?.length ?? 0) > 0;
  const displayTickers = useMemo(
    () =>
      provider === "yahoo"
        ? tickers ?? []
        : tickers && tickers.length > 0
        ? tickers
        : LIVE_MARKET_TICKERS,
    [provider, tickers]
  );

  const trackRef = useRef<HTMLDivElement | null>(null);
  const isHoveredRef = useRef(false);
  const [isPausedVisual, setIsPausedVisual] = useState(false);

  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    stiffness: 180,
    damping: 32,
  });

  useAnimationFrame((_time, delta) => {
    if (shouldReduceMotion || displayTickers.length === 0) return;
    const track = trackRef.current;
    if (!track) return;

    const halfWidth = track.scrollWidth / 2;
    if (halfWidth <= 0) return;

    const dtSec = Math.min(0.05, delta / 1000);
    const basePxPerSec = isHoveredRef.current ? 0 : 42;
    const velBoost = isHoveredRef.current
      ? 0
      : Math.max(-140, Math.min(140, smoothVelocity.get() * 0.085));

    let next = x.get() - (basePxPerSec + velBoost) * dtSec;
    if (next <= -halfWidth) next += halfWidth;
    if (next > 0) next -= halfWidth;
    x.set(next);
  });

  const wrapperClass = embedded
    ? `w-full ${sharp ? "rounded-none" : "rounded-lg"} border text-xs py-1.5 px-3 select-none ${
        isLight
          ? "bg-[#F4F3EE]/95 border-[#E5E5DC]"
          : "bg-[#070A12]/95 border-white/[0.08]"
      }`
    : `block w-full border-b text-xs py-1.5 px-3 sm:px-4 select-none backdrop-blur-md ${
        isLight
          ? "bg-[#F4F3EE]/95 border-[#E5E5DC]"
          : "bg-[#070A12]/95 border-white/[0.08]"
      }`;

  return (
    <div className={wrapperClass}>
      <div
        className={
          embedded
            ? "flex items-center gap-2.5 min-w-0"
            : "max-w-[1520px] mx-auto flex items-center gap-2.5 min-w-0"
        }
      >
        {/* Live Telemetry Badge Kiri */}
        <div
          className={`flex items-center gap-1.5 shrink-0 pr-2.5 border-r text-[10.5px] font-sans ${
            isLight
              ? "border-[#D8D7CE] text-[#4A5058]"
              : "border-white/[0.1] text-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isYahooLive
                ? "bg-[#22C55E] animate-pulse"
                : isLoading
                ? "bg-[#2DD4BF] animate-pulse"
                : "bg-amber-400"
            }`}
          />
          <span className="font-semibold hidden sm:inline">
            {isYahooLive ? "Live Pulse" : isLoading ? "Memuat..." : "Acuan Makro"}
          </span>
          <span className="font-semibold sm:hidden">
            {isYahooLive ? "Live" : "Makro"}
          </span>
          {onSelectSymbol && (
            <span
              className={`hidden md:inline text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                isLight
                  ? "bg-[#E5E5DC] text-[#555B64]"
                  : "bg-white/[0.06] text-slate-400"
              }`}
            >
              {isPausedVisual ? "Jeda" : "Klik → 3D"}
            </span>
          )}
        </div>

        {/* Velocity-Reactive Marquee Track dengan Edge Fade Mask */}
        <div
          onPointerEnter={() => {
            isHoveredRef.current = true;
            setIsPausedVisual(true);
          }}
          onPointerLeave={() => {
            isHoveredRef.current = false;
            setIsPausedVisual(false);
          }}
          className="flex-1 min-w-0 overflow-hidden relative"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent)",
          }}
        >
          {displayTickers.length === 0 ? (
            <span className="text-[11px] text-slate-500 font-sans">
              {isLoading ? "Menarik indeks makro & komoditas global..." : "Data makro sementara tidak tersedia."}
            </span>
          ) : shouldReduceMotion ? (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
              <TickerChipGroup
                tickers={displayTickers}
                isLight={isLight}
                isYahooLive={isYahooLive}
                cloneIndex={0}
                onSelectSymbol={onSelectSymbol}
              />
            </div>
          ) : (
            <motion.div
              ref={trackRef}
              style={{ x }}
              className="flex items-center w-max will-change-transform"
            >
              <TickerChipGroup
                tickers={displayTickers}
                isLight={isLight}
                isYahooLive={isYahooLive}
                cloneIndex={0}
                onSelectSymbol={onSelectSymbol}
              />
              <TickerChipGroup
                tickers={displayTickers}
                isLight={isLight}
                isYahooLive={isYahooLive}
                cloneIndex={1}
                onSelectSymbol={onSelectSymbol}
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
