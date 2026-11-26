"use client";

import React from "react";
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
}

interface TickerGroupProps {
  tickers: MarketTickerItem[];
  isLight: boolean;
  isYahooLive: boolean;
  cloneIndex?: number;
}

const TickerGroup: React.FC<TickerGroupProps> = ({
  tickers,
  isLight,
  isYahooLive,
  cloneIndex = 0,
}) => {
  const isClone = cloneIndex > 0;
  return (
    <div
      className={`flex items-center shrink-0 gap-5 pr-5 ${isClone ? "market-marquee-clone" : ""}`}
      aria-hidden={isClone || undefined}
    >
      {tickers.map((ticker) => {
        const isUp = ticker.change > 0;
        const isZero = Math.abs(ticker.change) < 0.005;

        const deltaBadgeClass = isLight
          ? isZero
            ? "text-[#5A6068] bg-[#E5E5DC]/70"
            : isUp
            ? "text-[#0D6343] bg-[#0D6343]/10"
            : "text-[#B91C1C] bg-[#B91C1C]/10"
          : isZero
          ? "text-slate-400 bg-slate-800/40"
          : isUp
          ? "text-[#2EB886] bg-[#2EB886]/10"
          : "text-[#DC525F] bg-[#DC525F]/10";

        return (
          <div
            key={`${cloneIndex}-${ticker.symbol}`}
            className="flex items-center space-x-1.5 whitespace-nowrap"
            title={`${ticker.name}${isYahooLive ? " (Yahoo Finance)" : " (Data Ilustrasi)"}`}
          >
            <span
              className={`font-mono text-xs font-semibold ${
                isLight ? "text-[#1A1C1E]" : "text-slate-300"
              }`}
            >
              {ticker.symbol}
            </span>
            <span
              className={`font-mono text-xs tnum ${
                isLight ? "text-[#2A2E33]" : "text-slate-100"
              }`}
            >
              {ticker.value}
            </span>
            <span className={`text-[11px] font-mono tnum px-1 py-0.5 rounded ${deltaBadgeClass}`}>
              {isZero ? "0,00%" : formatPersen(ticker.change, 2, true)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const MarketTicker: React.FC<MarketTickerProps> = ({
  provider = "illustrative",
  tickers,
  isMacroFallback = false,
  isLoading = false,
  theme = "dark",
  embedded = false,
}) => {
  const isYahooLive = provider === "yahoo" && !isMacroFallback && (tickers?.length ?? 0) > 0;
  const displayTickers =
    provider === "yahoo" ? (tickers ?? []) : (tickers && tickers.length > 0 ? tickers : LIVE_MARKET_TICKERS);
  const isLight = theme === "light";

  const wrapperClass = embedded
    ? `w-full rounded-lg border text-xs py-2 px-3.5 select-none ${
        isLight
          ? "bg-[#F3F3ED]/80 border-[#E5E5DC]"
          : "bg-[#0A0D14] border-[#1A2230]"
      }`
    : `hidden sm:block w-full border-b text-xs py-2 px-4 select-none ${
        isLight
          ? "bg-[#F3F3ED] border-[#E5E5DC]"
          : "bg-[#0A0D14] border-[#1A2230]"
      }`;

  return (
    <div className={wrapperClass}>
      <div
        className={
          embedded
            ? "flex items-center gap-3 min-w-0"
            : "max-w-7xl mx-auto flex items-center gap-3 min-w-0"
        }
      >
        {/* Label sumber indikator tetap statis di kiri */}
        <div
          className={`flex items-center space-x-1.5 font-sans text-xs whitespace-nowrap shrink-0 pr-3 border-r ${
            isLight ? "text-[#5A6068] border-[#D8D8CF]" : "text-slate-400 border-[#1E2736]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isYahooLive
                ? "bg-[#2EB886]"
                : provider === "yahoo"
                ? "bg-amber-400"
                : "bg-[#1E7B85]"
            }`}
          ></span>
          <span className="hidden sm:inline">
            {isYahooLive
              ? "Indikator pasar (Yahoo)"
              : provider === "yahoo"
              ? "Indikator pasar"
              : "Indikator acuan (ilustrasi)"}
          </span>
          <span className="sm:hidden">Pasar</span>
        </div>

        {/* Area ticker berjalan otomatis (pause saat hover/focus) */}
        {provider === "yahoo" && displayTickers.length === 0 ? (
          <span className={`text-[11px] font-sans truncate ${isLight ? "text-[#5A6068]" : "text-slate-400"}`}>
            {isLoading
              ? "Memuat indikator pasar global & IHSG..."
              : "Indikator pasar global tidak tersedia saat ini."}
          </span>
        ) : (
          <div className="market-marquee-wrapper flex-1 min-w-0 py-0.5">
            <div className="animate-market-marquee">
              {[0, 1, 2, 3].map((cloneIndex) => (
                <TickerGroup
                  key={cloneIndex}
                  tickers={displayTickers}
                  isLight={isLight}
                  isYahooLive={isYahooLive}
                  cloneIndex={cloneIndex}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
