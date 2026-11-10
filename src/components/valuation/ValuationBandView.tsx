"use client";

import React, { useState } from "react";
import { STOCKS_DATA } from "@/data/stocksData";
import { 
  Layers, 
  Target, 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  HelpCircle,
  Percent,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface ValuationBandViewProps {
  initialTicker?: string;
  onGoToSimulator?: (ticker: string) => void;
}

export const ValuationBandView: React.FC<ValuationBandViewProps> = ({
  initialTicker = "BBCA",
  onGoToSimulator
}) => {
  const [selectedTicker, setSelectedTicker] = useState<string>(initialTicker);

  const stock = STOCKS_DATA.find((s) => s.ticker === selectedTicker) || STOCKS_DATA[0];

  // Calculate target prices based on P/E bands
  // P/E = Price / EPS => EPS = CurrentPrice / currentPE
  const impliedEPS = stock.currentPrice / stock.peRatio;
  const impliedBVPS = stock.currentPrice / stock.pbvRatio;

  const targetMeanPrice = Math.round(impliedEPS * stock.historicalPeMean);
  const targetSd1MinusPrice = Math.round(impliedEPS * stock.peSd1Minus);
  const targetSd2MinusPrice = Math.round(impliedEPS * stock.peSd2Minus);
  const targetSd1PlusPrice = Math.round(impliedEPS * stock.peSd1Plus);
  const targetSd2PlusPrice = Math.round(impliedEPS * stock.peSd2Plus);

  // Graham Number: sqrt(22.5 * EPS * BVPS)
  const grahamNumber = Math.round(Math.sqrt(22.5 * impliedEPS * impliedBVPS));
  const grahamUpside = ((grahamNumber - stock.currentPrice) / stock.currentPrice) * 100;
  const meanUpside = ((targetMeanPrice - stock.currentPrice) / stock.currentPrice) * 100;

  // Valuation Status Evaluation
  const getValuationStatus = () => {
    if (stock.peRatio <= stock.peSd2Minus) {
      return {
        label: "Extreme Undervalued (-2 SD)",
        color: "text-emerald-400 bg-emerald-950/60 border-emerald-800",
        verdict: "Diskon historis ekstrim, margin of safety sangat tebal.",
        zone: "Strong Buy / Deep Value"
      };
    } else if (stock.peRatio <= stock.peSd1Minus) {
      return {
        label: "Undervalued (-1 SD)",
        color: "text-emerald-400 bg-emerald-950/40 border-emerald-700/60",
        verdict: "Di bawah rerata historis 5 tahun, area akumulasi ideal.",
        zone: "Buy / Accumulation"
      };
    } else if (stock.peRatio <= stock.historicalPeMean) {
      return {
        label: "Fair Valuation (Near Mean)",
        color: "text-cyan-400 bg-cyan-950/40 border-cyan-800/60",
        verdict: "Valuasi wajar, sejalan dengan pertumbuhan laba perusahaan.",
        zone: "Hold / Neutral"
      };
    } else if (stock.peRatio <= stock.peSd1Plus) {
      return {
        label: "Slightly Premium (+1 SD)",
        color: "text-amber-400 bg-amber-950/40 border-amber-800/60",
        verdict: "Valuasi cukup mahal, potensi kenaikan jangka pendek terbatas.",
        zone: "Trim / Caution"
      };
    } else {
      return {
        label: "Overvalued (+2 SD)",
        color: "text-rose-400 bg-rose-950/60 border-rose-800",
        verdict: "Jauh di atas valuasi wajar historis, rawan koreksi.",
        zone: "Sell / Overheated"
      };
    }
  };

  const status = getValuationStatus();

  return (
    <div className="space-y-6">
      {/* Header & Stock Selector */}
      <div className="p-5 md:p-6 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">
                P/E Historical Valuation Band & Fair Value
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Analisis posisi harga saham terhadap standar deviasi valuasi historis 5 tahun
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-mono">Pilih Saham:</span>
            <div className="flex flex-wrap gap-1.5">
              {STOCKS_DATA.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => setSelectedTicker(s.ticker)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition ${
                    selectedTicker === s.ticker
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/60"
                  }`}
                >
                  {s.ticker}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Current Stock Banner */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-2xl font-extrabold font-mono text-white">
                {stock.ticker}
              </span>
              <span className="text-xs text-slate-400 block font-sans">
                {stock.name} • {stock.sector}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div>
              <span className="text-xs text-slate-500 block font-mono">Harga Saat Ini:</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                Rp {stock.currentPrice.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${status.color}`}>
              {status.label}
            </div>
            {onGoToSimulator && (
              <button
                onClick={() => onGoToSimulator(stock.ticker)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-mono transition"
              >
                Simulasi DCA Saham Ini →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Valuation Band Visualizer & Standard Deviation Levels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Band Levels Table */}
        <div className="lg:col-span-1 p-5 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Tingkat Deviasi P/E 5-Tahun
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded">
              P/E Now: {stock.peRatio}x
            </span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            {/* +2 SD */}
            <div className="p-2.5 rounded-xl bg-slate-900/40 border border-rose-900/30 flex items-center justify-between">
              <div>
                <span className="text-rose-400 font-bold block">+2 SD (Mahal Sekali)</span>
                <span className="text-slate-500 text-[11px]">{stock.peSd2Plus}x P/E</span>
              </div>
              <span className="font-bold text-slate-300">
                Rp {targetSd2PlusPrice.toLocaleString()}
              </span>
            </div>

            {/* +1 SD */}
            <div className="p-2.5 rounded-xl bg-slate-900/40 border border-amber-900/30 flex items-center justify-between">
              <div>
                <span className="text-amber-400 font-bold block">+1 SD (Di Atas Rerata)</span>
                <span className="text-slate-500 text-[11px]">{stock.peSd1Plus}x P/E</span>
              </div>
              <span className="font-bold text-slate-300">
                Rp {targetSd1PlusPrice.toLocaleString()}
              </span>
            </div>

            {/* Mean (Fair Value) */}
            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-700/50 flex items-center justify-between">
              <div>
                <span className="text-cyan-400 font-bold block">Mean (Harga Wajar Historis)</span>
                <span className="text-slate-400 text-[11px]">{stock.historicalPeMean}x P/E</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-cyan-300 text-sm">
                  Rp {targetMeanPrice.toLocaleString()}
                </span>
                <span className="block text-[10px] text-cyan-400">
                  {meanUpside >= 0 ? `+${meanUpside.toFixed(1)}%` : `${meanUpside.toFixed(1)}%`}
                </span>
              </div>
            </div>

            {/* -1 SD */}
            <div className="p-2.5 rounded-xl bg-slate-900/40 border border-emerald-900/40 flex items-center justify-between">
              <div>
                <span className="text-emerald-400 font-bold block">-1 SD (Area Undervalued)</span>
                <span className="text-slate-500 text-[11px]">{stock.peSd1Minus}x P/E</span>
              </div>
              <span className="font-bold text-slate-300">
                Rp {targetSd1MinusPrice.toLocaleString()}
              </span>
            </div>

            {/* -2 SD */}
            <div className="p-2.5 rounded-xl bg-slate-900/40 border border-emerald-950 flex items-center justify-between">
              <div>
                <span className="text-emerald-300 font-bold block">-2 SD (Diskon Ekstrim)</span>
                <span className="text-slate-500 text-[11px]">{stock.peSd2Minus}x P/E</span>
              </div>
              <span className="font-bold text-slate-300">
                Rp {targetSd2MinusPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Gauge & Fair Value Targets */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Diagnosis Valuasi & Rekomendasi
              </span>
              <span className="text-xs font-mono text-slate-400">
                Status: <strong className="text-white">{status.zone}</strong>
              </span>
            </div>

            {/* Visual Gauge Meter */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span className="text-emerald-400 font-bold">-2 SD</span>
                <span className="text-emerald-400">-1 SD</span>
                <span className="text-cyan-400 font-bold">Mean</span>
                <span className="text-amber-400">+1 SD</span>
                <span className="text-rose-400 font-bold">+2 SD</span>
              </div>

              {/* Progress Slider Track */}
              <div className="relative w-full h-3 bg-gradient-to-r from-emerald-500 via-cyan-400 via-amber-400 to-rose-500 rounded-full">
                {/* Pointer indicator */}
                {(() => {
                  const min = stock.peSd2Minus * 0.9;
                  const max = stock.peSd2Plus * 1.1;
                  const pct = Math.min(100, Math.max(0, ((stock.peRatio - min) / (max - min)) * 100));

                  return (
                    <div
                      className="absolute -top-1 w-5 h-5 -ml-2.5 bg-white rounded-full border-2 border-slate-950 shadow-lg shadow-white/40 flex items-center justify-center transition-all"
                      style={{ left: `${pct}%` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
                    </div>
                  );
                })()}
              </div>

              <p className="text-xs text-slate-300 font-sans leading-relaxed pt-1">
                {status.verdict}
              </p>
            </div>

            {/* Target Price Cards (Mean & Graham Number) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40">
                <span className="text-[11px] font-mono text-cyan-400 block mb-1">
                  Target Harga Wajar (Historis Mean):
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  Rp {targetMeanPrice.toLocaleString()}
                </span>
                <span className="text-xs font-mono font-semibold text-cyan-400 block mt-1">
                  Potensi: {meanUpside >= 0 ? `+${meanUpside.toFixed(1)}%` : `${meanUpside.toFixed(1)}%`}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
                <span className="text-[11px] font-mono text-emerald-400 block mb-1">
                  Harga Benjamin Graham (Graham Number):
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  Rp {grahamNumber.toLocaleString()}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-400 block mt-1">
                  Potensi: {grahamUpside >= 0 ? `+${grahamUpside.toFixed(1)}%` : `${grahamUpside.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Fundamental Scoreboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/80 text-xs font-mono">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">PBV Ratio:</span>
              <span className="text-slate-200 font-bold">{stock.pbvRatio}x</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">ROE (Laba Modal):</span>
              <span className="text-emerald-400 font-bold">{stock.roe}%</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Dividend Yield:</span>
              <span className="text-amber-400 font-bold">{stock.dividendYield}%</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 block text-[10px]">DER (Utang):</span>
              <span className="text-slate-200 font-bold">{stock.der}x</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fundamental Strengths & Risks Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="p-5 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-md">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase mb-3">
            <CheckCircle2 className="w-4 h-4" />
            <span>Kekuatan & Katalis Fundamental {stock.ticker}</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300 font-sans">
            {stock.strengths.map((s, i) => (
              <li key={i} className="flex items-start space-x-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div className="p-5 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-md">
          <div className="flex items-center space-x-2 text-rose-400 font-mono text-xs font-bold uppercase mb-3">
            <XCircle className="w-4 h-4" />
            <span>Risiko & Hal yang Perlu Diwaspadai</span>
          </div>
          <ul className="space-y-2 text-xs text-slate-300 font-sans">
            {stock.risks.map((r, i) => (
              <li key={i} className="flex items-start space-x-2">
                <span className="text-rose-400 mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

