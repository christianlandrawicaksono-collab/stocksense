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
      <div className={embedded ? "flex items-center justify-between" : "max-w-7xl mx-auto flex items-center justify-between"}>
        {/* Ticker list horizontal scrollable satu baris */}
        <div className="flex items-center space-x-4 overflow-x-auto terminal-scroll py-0.5 w-full">
          <div
            className={`flex items-center space-x-1.5 font-sans text-xs whitespace-nowrap ${
              isLight ? "text-[#5A6068]" : "text-slate-400"
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
            <span>
              {isYahooLive
                ? "Indikator pasar (Yahoo):"
                : provider === "yahoo"
                ? "Indikator pasar:"
                : "Indikator acuan (ilustrasi):"}
            </span>
          </div>

          {provider === "yahoo" && displayTickers.length === 0 ? (
            <span className={`text-[11px] font-sans ${isLight ? "text-[#5A6068]" : "text-slate-400"}`}>
              {isLoading
                ? "Memuat indikator pasar global & IHSG..."
                : "Indikator pasar global tidak tersedia saat ini."}
            </span>
          ) : (
            <div className="flex items-center space-x-5 min-w-max">
              {displayTickers.map((ticker) => {
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
                    key={ticker.symbol}
                    className="flex items-center space-x-1.5"
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
          )}
        </div>
      </div>
    </div>
  );
};
