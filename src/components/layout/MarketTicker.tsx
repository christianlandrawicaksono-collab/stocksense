"use client";

import React from "react";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";
import { formatPersen } from "@/lib/format";

export const MarketTicker: React.FC = () => {
  return (
    <div className="w-full bg-[#0A0D14] border-b border-[#1A2230] text-xs py-2 px-4 select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
        {/* Left: Ticker list */}
        <div className="flex items-center space-x-4 overflow-x-auto terminal-scroll pb-1 md:pb-0">
          <div className="flex items-center space-x-1.5 text-slate-400 font-sans text-xs whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            <span>Indikator acuan:</span>
          </div>

          <div className="flex items-center space-x-5 min-w-max">
            {LIVE_MARKET_TICKERS.map((ticker) => {
              const isUp = ticker.change > 0;
              const isZero = ticker.change === 0;

              return (
                <div key={ticker.symbol} className="flex items-center space-x-1.5">
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
        </div>

        {/* Right: Full, clear, unwrapped status badge */}
        <div className="text-[11px] text-slate-400 font-sans whitespace-nowrap pl-1 md:pl-4 md:border-l md:border-slate-800 self-start md:self-auto">
          Status: Data statis contoh
        </div>
      </div>
    </div>
  );
};
