"use client";

import React from "react";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";

export const MarketTicker: React.FC = () => {
  return (
    <div className="w-full bg-[#0A0D14] border-b border-[#1A2230] text-[11px] overflow-x-auto terminal-scroll py-1.5 px-4 select-none">
      <div className="flex items-center space-x-6 min-w-max">
        <div className="flex items-center space-x-2 font-mono text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
          <span className="font-semibold tracking-wider text-[10px] text-slate-400">
            INDIKATOR ACUAN (SNAPSHOT):
          </span>
        </div>

        {LIVE_MARKET_TICKERS.map((ticker) => {
          const isUp = ticker.change > 0;
          const isZero = ticker.change === 0;

          return (
            <div key={ticker.symbol} className="flex items-center space-x-2 font-mono tnum">
              <span className="text-slate-300 font-semibold">{ticker.symbol}</span>
              <span className="text-slate-100">{ticker.value}</span>
              <span
                className={`text-[10px] font-medium px-1 rounded ${
                  isZero
                    ? "text-slate-400 bg-slate-800/50"
                    : isUp
                    ? "text-[#2EB886] bg-[#2EB886]/10"
                    : "text-[#DC525F] bg-[#DC525F]/10"
                }`}
              >
                {isUp ? `+${ticker.change}%` : `${ticker.change}%`}
              </span>
            </div>
          );
        })}

        <div className="text-[10px] text-slate-400 font-mono pl-4 border-l border-slate-800">
          Status: Data Statis Contoh
        </div>
      </div>
    </div>
  );
};
