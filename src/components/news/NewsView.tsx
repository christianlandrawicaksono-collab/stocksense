"use client";

import React, { useState, useMemo } from "react";
import { MACRO_NEWS_DATA, MACRO_RISK_SUMMARY } from "@/data/macroData";
import { MacroCategory, SentimentType } from "@/types/market";
import { Search, ArrowLeft, ArrowUpRight, Clock, Tag } from "lucide-react";

// 9 Supported stocks in Terminal
const SUPPORTED_TERMINAL_TICKERS = new Set([
  "ADRO", "ANTM", "ASII", "BBCA", "BBRI", "BMRI", "ICBP", "MEDC", "TLKM"
]);

interface NewsViewProps {
  onSelectStockFromNews: (ticker: string, newsTitle: string) => void;
  initialArticleId?: string | null;
}

export const NewsView: React.FC<NewsViewProps> = ({
  onSelectStockFromNews,
  initialArticleId = null,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<"1W" | "1M">("1W");
  const [selectedCategory, setSelectedCategory] = useState<MacroCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeArticleId, setActiveArticleId] = useState<string | null>(initialArticleId);

  // Filter news according to period, category, and search query
  const filteredNews = useMemo(() => {
    return MACRO_NEWS_DATA.filter((item) => {
      if (item.period !== selectedPeriod) return false;
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSummary = item.summary.toLowerCase().includes(q);
        const inCatalyst = item.catalyst.toLowerCase().includes(q);
        const inTickers = item.sectorImpacts.some((sec) =>
          sec.tickers.some((t) => t.toLowerCase().includes(q))
        );
        if (!inTitle && !inSummary && !inCatalyst && !inTickers) return false;
      }

      return true;
    });
  }, [selectedPeriod, selectedCategory, searchQuery]);

  // Active article object for detail view
  const activeArticle = useMemo(() => {
    if (!activeArticleId) return null;
    return MACRO_NEWS_DATA.find((n) => n.id === activeArticleId) || null;
  }, [activeArticleId]);

  const leadStory = filteredNews[0] || null;
  const secondaryStories = filteredNews.slice(1);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "MONETARY_CURRENCY":
        return "Moneter & FX";
      case "GLOBAL_MACRO":
        return "Makro Global";
      case "DOMESTIC_POLITICS":
        return "Politik & Fiskal";
      case "COMMODITIES":
        return "Komoditas & Energi";
      default:
        return "Makroekonomi";
    }
  };

  const getSentimentTag = (sentiment: SentimentType) => {
    switch (sentiment) {
      case "BULLISH":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-sans font-medium text-[#1E5E45] bg-[#E2F5EC] border border-[#B5E7D0]">
            Sentimen positif
          </span>
        );
      case "BEARISH":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-sans font-medium text-[#8F252D] bg-[#FBECEE] border border-[#F3BFC4]">
            Sentimen negatif
          </span>
        );
      case "NEUTRAL":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-sans font-medium text-[#4B5563] bg-[#EFEFEA] border border-[#D5D5CA]">
            Sentimen netral
          </span>
        );
    }
  };

  return (
    <div className="bg-[#F7F7F2] text-[#1A1C1E] rounded-xl border border-[#D8D8CF] shadow-lg font-sans overflow-hidden">
      {/* 1. BROADSHEET MASTHEAD BANNER */}
      <header className="border-b border-[#D8D8CF] bg-[#EFEFEA] px-4 sm:px-8 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D8D8CF] pb-3">
          <div>
            <span className="text-[11px] font-sans font-semibold tracking-wide uppercase text-[#5A6068] block">
              StocksSense Warta Makro
            </span>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-[#1A1C1E] mt-0.5">
              Transmisi Kebijakan & Dampak Sektoral
            </h1>
          </div>
          <div className="text-left sm:text-right">
            <span className="inline-block px-2.5 py-1 rounded bg-[#E4E4DC] border border-[#CBCBC0] text-xs font-sans font-medium text-[#43484E]">
              Data contoh untuk riset antarmuka
            </span>
            <span className="text-[11px] text-[#5A6068] block mt-1 font-sans">
              Analisis dampak regulasi & transmisi harga saham
            </span>
          </div>
        </div>

        {/* Clean Single Market Summary Paragraph (NO Risk Index 62/100) */}
        <div className="pt-3 text-xs sm:text-sm text-[#3E4349] leading-relaxed">
          <span className="font-semibold text-[#1A1C1E]">Ringkasan pasar (data contoh): </span>
          {MACRO_RISK_SUMMARY.summaryBrief}
        </div>
      </header>

      {/* 2. ARTICLE DETAIL VIEW (IF AN ARTICLE IS SELECTED) */}
      {activeArticle ? (
        <article className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
          {/* Back button */}
          <button
            type="button"
            onClick={() => setActiveArticleId(null)}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-[#5A6068] hover:text-[#1A1C1E] pb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke daftar warta berita</span>
          </button>

          {/* Article Header Metadata */}
          <div className="space-y-2 border-b border-[#D8D8CF] pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#E4E4DC] text-xs font-medium text-[#43484E]">
                {getCategoryLabel(activeArticle.category)}
              </span>
              {getSentimentTag(activeArticle.marketSentiment)}
              <span className="text-xs text-[#5A6068] flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{activeArticle.date}</span>
              </span>
            </div>

            {/* Literata Headline */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#1A1C1E] leading-snug">
              {activeArticle.title}
            </h2>

            <p className="text-sm text-[#5A6068] italic">
              Data contoh simulasi transmisi kebijakan sektor keuangan.
            </p>
          </div>

          {/* Summary Lead Paragraph */}
          <div className="text-sm sm:text-base text-[#2A2E33] leading-relaxed font-sans border-b border-[#D8D8CF] pb-5">
            {activeArticle.summary}
          </div>

          {/* Catalyst & Market Impact Box */}
          <div className="p-4 rounded-lg bg-[#EFEFEA] border border-[#D8D8CF] space-y-2 text-xs sm:text-sm">
            <div>
              <span className="font-semibold text-[#1A1C1E] block">Katalis penggerak:</span>
              <span className="text-[#3E4349]">{activeArticle.catalyst}</span>
            </div>
            <div>
              <span className="font-semibold text-[#1A1C1E] block">Implikasi transmisi keseluruhan:</span>
              <span className="text-[#3E4349]">{activeArticle.overallImpact}</span>
            </div>
          </div>

          {/* TABLE: SAHAM TERDAMPAK */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-serif font-bold text-[#1A1C1E]">
                Tabel emiten dan sektor terdampak
              </h3>
              <span className="text-xs text-[#5A6068]">
                Klik ticker bertanda panah untuk membuka di Terminal
              </span>
            </div>

            <div className="border border-[#D8D8CF] rounded-lg overflow-x-auto bg-white">
              <table className="w-full text-left text-xs sm:text-sm divide-y divide-[#D8D8CF]">
                <thead className="bg-[#EFEFEA] text-[#43484E] font-medium">
                  <tr>
                    <th className="py-2.5 px-3 sm:px-4">Sektor</th>
                    <th className="py-2.5 px-3 sm:px-4">Arah dampak</th>
                    <th className="py-2.5 px-3 sm:px-4">Emiten & navigasi Terminal</th>
                    <th className="py-2.5 px-3 sm:px-4 min-w-[240px]">Alasan transmisi dampak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBE3] text-[#2A2E33]">
                  {activeArticle.sectorImpacts.map((sectorItem, idx) => (
                    <tr key={idx} className="hover:bg-[#F9F9F6]">
                      <td className="py-3 px-3 sm:px-4 font-medium align-top">
                        {sectorItem.sector}
                      </td>
                      <td className="py-3 px-3 sm:px-4 align-top">
                        {getSentimentTag(sectorItem.sentiment)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {sectorItem.tickers.map((ticker) => {
                            const isSupported = SUPPORTED_TERMINAL_TICKERS.has(ticker);

                            if (isSupported) {
                              return (
                                <button
                                  key={ticker}
                                  type="button"
                                  onClick={() => onSelectStockFromNews(ticker, activeArticle.title)}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-[#E4E4DC] hover:bg-[#1E7B85] text-[#1A1C1E] hover:text-white border border-[#CBCBC0] hover:border-[#1E7B85] text-xs font-mono tnum font-semibold transition"
                                  title={`Buka ${ticker} di Terminal Analisis`}
                                >
                                  <span>{ticker}</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              );
                            }

                            return (
                              <span
                                key={ticker}
                                className="inline-flex flex-col px-2 py-0.5 rounded bg-[#F2F2EC] border border-[#DFDFD7] text-xs text-[#5A6068]"
                                title="Data emiten ini belum tersedia di Terminal"
                              >
                                <span className="font-mono tnum font-medium text-[#43484E]">{ticker}</span>
                                <span className="text-[9px] text-[#7A8088] leading-tight">
                                  Belum ada di Terminal
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-xs text-[#3E4349] leading-snug align-top">
                        {sectorItem.impactDescription}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bottom Back Button */}
          <div className="pt-4 border-t border-[#D8D8CF]">
            <button
              type="button"
              onClick={() => setActiveArticleId(null)}
              className="px-4 py-2 rounded-lg bg-[#EFEFEA] hover:bg-[#E4E4DC] border border-[#D8D8CF] text-xs font-medium text-[#1A1C1E] transition flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke daftar warta berita</span>
            </button>
          </div>
        </article>
      ) : (
        /* 3. NEWS INDEX & HEADLINES LIST VIEW */
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Controls Bar: Timeframe toggle, Categories, and Search */}
          <div className="space-y-3 border-b border-[#D8D8CF] pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Simple Timeframe Toggle (1 Minggu vs 1 Bulan) */}
              <div className="flex items-center bg-[#EFEFEA] p-1 rounded-lg border border-[#D8D8CF] self-start">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("1W")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    selectedPeriod === "1W"
                      ? "bg-white text-[#1A1C1E] shadow-sm font-semibold"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  1 Minggu terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("1M")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    selectedPeriod === "1M"
                      ? "bg-white text-[#1A1C1E] shadow-sm font-semibold"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  1 Bulan terakhir
                </button>
              </div>

              {/* Keyword Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A8088]" />
                <input
                  type="text"
                  placeholder="Cari berita atau ticker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D8D8CF] rounded-lg text-xs text-[#1A1C1E] placeholder-[#7A8088] focus:outline-none focus:border-[#1E7B85]"
                />
              </div>
            </div>

            {/* Category Tabs as Plain Text Buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { id: "ALL", label: "Semua kategori" },
                { id: "MONETARY_CURRENCY", label: "Moneter & FX" },
                { id: "GLOBAL_MACRO", label: "Makro Global" },
                { id: "DOMESTIC_POLITICS", label: "Politik & Fiskal" },
                { id: "COMMODITIES", label: "Komoditas & Energi" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id as MacroCategory)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    selectedCategory === cat.id
                      ? "bg-[#1A1C1E] text-white"
                      : "bg-[#EFEFEA] text-[#5A6068] hover:text-[#1A1C1E] border border-[#D8D8CF]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. EDITORIAL BROADSHEET CONTENT GRID */}
          {filteredNews.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#5A6068] bg-[#EFEFEA] rounded-lg border border-[#D8D8CF]">
              Tidak ada berita yang cocok dengan filter yang dipilih.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Lead Story: Large Featured Headline (7 of 12 cols on desktop) */}
              {leadStory && (
                <article
                  onClick={() => setActiveArticleId(leadStory.id)}
                  className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-xl border border-[#D8D8CF] hover:border-[#B5B5A8] transition shadow-sm cursor-pointer space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#1E7B85] uppercase tracking-wide">
                        Berita Utama • {getCategoryLabel(leadStory.category)}
                      </span>
                      {getSentimentTag(leadStory.marketSentiment)}
                    </div>

                    <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#1A1C1E] leading-snug hover:text-[#1E7B85] transition">
                      {leadStory.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-[#43484E] leading-relaxed">
                      {leadStory.summary}
                    </p>

                    <div className="pt-2 text-xs text-[#5A6068] border-t border-[#EBEBE3] flex items-center justify-between">
                      <span className="italic">Katalis: {leadStory.catalyst}</span>
                      <span>{leadStory.date}</span>
                    </div>
                  </div>

                  {/* Impacted Tickers Badge Row */}
                  <div className="pt-3 border-t border-[#EBEBE3] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag className="w-3 h-3 text-[#7A8088]" />
                      <span className="text-xs text-[#5A6068]">Emiten terkait:</span>
                      {leadStory.sectorImpacts.flatMap((s) => s.tickers).slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded bg-[#EFEFEA] border border-[#D8D8CF] text-[11px] font-mono tnum font-semibold text-[#1A1C1E]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <span className="text-xs font-medium text-[#1E7B85] hover:underline flex items-center space-x-1">
                      <span>Baca analisis & dampak emiten →</span>
                    </span>
                  </div>
                </article>
              )}

              {/* Secondary Stories: Stacked List of Headlines (5 of 12 cols on desktop) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="pb-1 border-b border-[#D8D8CF] flex items-center justify-between text-xs text-[#5A6068]">
                  <span className="font-semibold uppercase tracking-wide">Warta Terkini Lainnya</span>
                  <span>{secondaryStories.length} Berita</span>
                </div>

                <div className="divide-y divide-[#D8D8CF]">
                  {secondaryStories.map((story) => (
                    <article
                      key={story.id}
                      onClick={() => setActiveArticleId(story.id)}
                      className="py-3.5 first:pt-0 hover:bg-white/60 p-2 rounded-lg transition cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#5A6068]">
                        <span className="font-medium text-[#1E7B85]">
                          {getCategoryLabel(story.category)}
                        </span>
                        <span>{story.date}</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-serif font-bold text-[#1A1C1E] leading-snug hover:text-[#1E7B85] transition">
                        {story.title}
                      </h3>

                      <p className="text-xs text-[#43484E] line-clamp-2 leading-relaxed">
                        {story.summary}
                      </p>

                      <div className="pt-1 flex items-center justify-between text-xs text-[#5A6068]">
                        <div className="flex items-center space-x-1">
                          {story.sectorImpacts.flatMap((s) => s.tickers).slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="px-1 py-0.5 rounded bg-[#EFEFEA] text-[10px] font-mono tnum text-[#3E4349]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        {getSentimentTag(story.marketSentiment)}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
