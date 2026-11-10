"use client";

import React, { useState } from "react";
import { 
  MACRO_NEWS_DATA, 
  MACRO_RISK_SUMMARY 
} from "@/data/macroData";
import { MacroCategory, SentimentType } from "@/types/market";
import { 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ExternalLink, 
  Filter, 
  Search,
  Sparkles,
  ArrowRight,
  Flame,
  Calendar,
  Building2,
  Landmark
} from "lucide-react";

interface MacroRadarViewProps {
  onSelectTicker: (ticker: string) => void;
  onOpenAiAssistant: (presetQuery?: string) => void;
}

export const MacroRadarView: React.FC<MacroRadarViewProps> = ({
  onSelectTicker,
  onOpenAiAssistant
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<"1W" | "1M">("1W");
  const [selectedCategory, setSelectedCategory] = useState<MacroCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter news
  const filteredNews = MACRO_NEWS_DATA.filter((item) => {
    if (item.period !== selectedPeriod) return false;
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;
    
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inSummary = item.summary.toLowerCase().includes(q);
      const inTickers = item.sectorImpacts.some((sec) =>
        sec.tickers.some((t) => t.toLowerCase().includes(q))
      );
      if (!inTitle && !inSummary && !inTickers) return false;
    }
    return true;
  });

  const getSentimentBadge = (sentiment: SentimentType) => {
    switch (sentiment) {
      case "BULLISH":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BULLISH KATALIS</span>
          </span>
        );
      case "BEARISH":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>BEARISH TEKANAN</span>
          </span>
        );
      case "NEUTRAL":
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Minus className="w-3.5 h-3.5" />
            <span>NETRAL / SELEKTIF</span>
          </span>
        );
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "GLOBAL_MACRO":
        return "🌐 Geopolitik & Makro Global";
      case "DOMESTIC_POLITICS":
        return "🏛️ Politik & Regulasi Domestik";
      case "MONETARY_CURRENCY":
        return "🏦 Moneter, Suku Bunga & Kurs";
      case "COMMODITIES":
        return "⚡ Komoditas & Hilirisasi";
      default:
        return cat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Macro Market Synthesis & Risk Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk & Regime Gauge */}
        <div className="lg:col-span-1 p-5 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                IHSG Macro Risk Index
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShieldAlert className="w-3 h-3 mr-1" />
                {MACRO_RISK_SUMMARY.currentRiskLevel}
              </span>
            </div>

            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-4xl font-extrabold font-mono text-white tracking-tight">
                {MACRO_RISK_SUMMARY.score}
              </span>
              <span className="text-xs text-slate-400 font-mono">/ 100</span>
              <span className="ml-auto text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800/40">
                {MACRO_RISK_SUMMARY.marketRegime}
              </span>
            </div>

            {/* Visual Risk Bar */}
            <div className="mt-3 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-2 rounded-full"
                style={{ width: `${MACRO_RISK_SUMMARY.score}%` }}
              ></div>
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Risk: Rendah (0)</span>
              <span>Netral (50)</span>
              <span>Tinggi (100)</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Foreign Flow:</span>
              <span className="font-mono font-medium text-emerald-400 text-right">
                {MACRO_RISK_SUMMARY.foreignFlowStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Executive Macro Takeaway */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-[#0e1626] to-[#0c1421] border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  Executive Macro Pulse & Market Narrative
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Updated: 10 Nov 2026
              </span>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed font-sans mt-2">
              {MACRO_RISK_SUMMARY.summaryBrief}
            </p>

            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <span className="text-slate-400 block text-[11px] font-mono mb-0.5">Top Driver:</span>
                <span className="font-medium text-slate-200">{MACRO_RISK_SUMMARY.keyDriver}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px] font-mono mb-0.5">AI Tanya Jawab:</span>
                  <span className="font-medium text-emerald-400">Konsultasi Skenario Pasar</span>
                </div>
                <button
                  onClick={() => onOpenAiAssistant("Apa dampak kenaikan PPN dan suku bunga The Fed terhadap saham perbankan?")}
                  className="px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg border border-emerald-500/30 transition flex items-center space-x-1"
                >
                  <span>Tanya AI</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Timeframe Toggle, Category Tabs & Search */}
      <div className="p-4 rounded-2xl bg-[#0e1626] border border-slate-800 shadow-lg space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Timeframe Selector (1W vs 1M) */}
          <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setSelectedPeriod("1W")}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                selectedPeriod === "1W"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>1 Minggu (Weekly Flash)</span>
            </button>
            <button
              onClick={() => setSelectedPeriod("1M")}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                selectedPeriod === "1M"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>1 Bulan (Monthly Macro Review)</span>
            </button>
          </div>

          {/* Search by Ticker / Keyword */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari emiten (e.g. BBRI, ADRO) / kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-1">
          <span className="text-xs text-slate-400 font-mono flex items-center mr-1">
            <Filter className="w-3 h-3 mr-1" /> Kategori:
          </span>
          {[
            { id: "ALL", label: "Semua Isu" },
            { id: "GLOBAL_MACRO", label: "Geopolitik & Global" },
            { id: "DOMESTIC_POLITICS", label: "Politik & Regulasi Domestik" },
            { id: "MONETARY_CURRENCY", label: "Moneter & Kurs" },
            { id: "COMMODITIES", label: "Komoditas & Hilirisasi" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as MacroCategory)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? "bg-slate-700/80 text-white border border-slate-600 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* News Feed with Impact Matrix Cards */}
      <div className="space-y-4">
        {filteredNews.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0e1626] border border-slate-800">
            <p className="text-slate-400 text-sm">Tidak ada berita atau emiten yang cocok dengan filter pencarian ini.</p>
            <button
              onClick={() => {
                setSelectedCategory("ALL");
                setSearchQuery("");
              }}
              className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          filteredNews.map((news) => (
            <article
              key={news.id}
              className="p-5 md:p-6 rounded-2xl bg-[#0e1626] border border-slate-800 hover:border-slate-700/80 transition-all shadow-md group"
            >
              {/* Header: Date, Source, Category & Sentiment */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                  <span className="text-slate-300 font-semibold">{news.date}</span>
                  <span>•</span>
                  <span className="text-slate-400">{news.source}</span>
                  <span>•</span>
                  <span className="text-cyan-400 font-sans">{getCategoryLabel(news.category)}</span>
                </div>
                <div>{getSentimentBadge(news.marketSentiment)}</div>
              </div>

              {/* Title & Catalyst */}
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                {news.title}
              </h2>

              <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-slate-800/80 text-slate-300 border border-slate-700/50">
                <span className="text-slate-500">Katalis:</span>
                <span className="text-slate-200">{news.catalyst}</span>
              </div>

              {/* Summary */}
              <p className="mt-3 text-sm text-slate-300 leading-relaxed font-sans">
                {news.summary}
              </p>

              {/* Overall Market Takeaway */}
              <div className="mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300">
                <span className="font-semibold text-slate-200 font-mono">Dampak Pasar Umum: </span>
                {news.overallImpact}
              </div>

              {/* THE KILLER FEATURE: Sector & Ticker Impact Matrix */}
              <div className="mt-5 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Transmisi Sektor & Ticker Terdampak:
                  </span>
                  <span className="text-[11px] text-slate-500 italic">
                    Klik ticker untuk melihat simulasi & valuasi
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {news.sectorImpacts.map((sectorImpact, idx) => {
                    const isBullish = sectorImpact.sentiment === "BULLISH";
                    const isBearish = sectorImpact.sentiment === "BEARISH";

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border transition ${
                          isBullish
                            ? "bg-emerald-950/20 border-emerald-900/40"
                            : isBearish
                            ? "bg-rose-950/20 border-rose-900/40"
                            : "bg-slate-900/40 border-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-200">
                            {sectorImpact.sector}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                              isBullish
                                ? "bg-emerald-500/20 text-emerald-400"
                                : isBearish
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {sectorImpact.sentiment}
                          </span>
                        </div>

                        {/* Ticker Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          {sectorImpact.tickers.map((t) => (
                            <button
                              key={t}
                              onClick={() => onSelectTicker(t)}
                              className={`px-2 py-0.5 rounded font-mono text-xs font-bold transition flex items-center space-x-1 ${
                                isBullish
                                  ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40"
                                  : isBearish
                                  ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40"
                                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                              }`}
                              title={`Buka analisis dan simulasi saham ${t}`}
                            >
                              <span>{t}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ))}
                        </div>

                        {/* Impact Mechanism Explanation */}
                        <p className="text-xs text-slate-400 leading-snug">
                          {sectorImpact.impactDescription}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
