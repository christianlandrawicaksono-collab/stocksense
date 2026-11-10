"use client";

import React from "react";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const MarketTicker: React.FC = () => {
  return (
    <div className="w-full bg-[#0d131f] border-b border-slate-800 text-xs overflow-x-auto no-scrollbar py-2 px-4 select-none">
      <div className="flex items-center space-x-6 min-w-max">
        <div className="flex items-center space-x-2 font-mono font-semibold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>IDX TERMINAL:</span>
        </div>

        {LIVE_MARKET_TICKERS.map((ticker) => {
          const isUp = ticker.change > 0;
          const isZero = ticker.change === 0;

          return (
            <div key={ticker.symbol} className="flex items-center space-x-2 font-mono">
              <span className="text-slate-300 font-bold">{ticker.symbol}</span>
              <span className="text-slate-100">{ticker.value}</span>
              <span
                className={`flex items-center text-[11px] font-semibold px-1 rounded ${
                  isZero
                    ? "text-slate-400 bg-slate-800/60"
                    : isUp
                    ? "text-emerald-400 bg-emerald-950/40"
                    : "text-rose-400 bg-rose-950/40"
                }`}
              >
                {isZero ? (
                  <Minus className="w-3 h-3 mr-0.5" />
                ) : isUp ? (
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                )}
                {isUp ? `+${ticker.change}%` : `${ticker.change}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

