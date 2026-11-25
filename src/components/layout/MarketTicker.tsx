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
}

export const MarketTicker: React.FC<MarketTickerProps> = ({
  provider = "illustrative",
  tickers,
  isMacroFallback = false,
  isLoading = false,
}) => {
  const isYahooLive = provider === "yahoo" && !isMacroFallback && (tickers?.length ?? 0) > 0;
  const displayTickers =
    provider === "yahoo" ? (tickers ?? []) : (tickers && tickers.length > 0 ? tickers : LIVE_MARKET_TICKERS);

  return (
    // Sembunyikan di HP (hidden sm:block) agar tidak memakan ruang vertikal layar sentuh
    <div className="hidden sm:block w-full bg-[#0A0D14] border-b border-[#1A2230] text-xs py-2 px-4 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Ticker list horizontal scrollable satu baris */}
        <div className="flex items-center space-x-4 overflow-x-auto terminal-scroll py-0.5">
          <div className="flex items-center space-x-1.5 text-slate-400 font-sans text-xs whitespace-nowrap">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
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
            <span className="text-[11px] text-slate-400 font-sans">
              {isLoading
                ? "Memuat indikator pasar global & IHSG..."
                : "Indikator pasar global tidak tersedia saat ini."}
            </span>
          ) : (
            <div className="flex items-center space-x-5 min-w-max">
              {displayTickers.map((ticker) => {
                const isUp = ticker.change > 0;
                const isZero = Math.abs(ticker.change) < 0.005;

                return (
                  <div
                    key={ticker.symbol}
                    className="flex items-center space-x-1.5"
                    title={`${ticker.name}${isYahooLive ? " (Yahoo Finance)" : " (Data Ilustrasi)"}`}
                  >
                    <span className="text-slate-300 font-mono text-xs font-semibold">{ticker.symbol}</span>
                    <span className="text-slate-100 font-mono text-xs tnum">{ticker.value}</span>
                    <span
                      className={`text-[11px] font-mono tnum px-1 py-0.5 rounded ${
                        isZero
                          ? "text-slate-400 bg-slate-800/40"
                          : isUp
                          ? "text-[#2EB886] bg-[#2EB886]/10"
                          : "text-[#DC525F] bg-[#DC525F]/10"
                      }`}
                    >
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
