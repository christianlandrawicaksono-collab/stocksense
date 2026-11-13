"use client";

import React, { useState, useMemo } from "react";
import { MACRO_NEWS_DATA, MACRO_MARKET_SUMMARY } from "@/data/macroData";
import { MacroCategory, SentimentType } from "@/types/market";
import { Search } from "lucide-react";

// 9 Saham yang memiliki data lengkap di Terminal
export const SUPPORTED_TERMINAL_TICKERS = new Set([
  "ADRO", "ANTM", "ASII", "BBCA", "BBRI", "BMRI", "ICBP", "MEDC", "TLKM"
]);

interface NewsViewProps {
  onSelectStockFromNews: (ticker: string, newsId: string, newsTitle: string) => void;
  activeArticleId?: string | null;
  onOpenArticle?: (articleId: string | null) => void;
}

export const NewsView: React.FC<NewsViewProps> = ({
  onSelectStockFromNews,
  activeArticleId: propArticleId = null,
  onOpenArticle,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<"1W" | "1M">("1W");
  const [selectedCategory, setSelectedCategory] = useState<MacroCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [localArticleId, setLocalArticleId] = useState<string | null>(propArticleId);

  const activeArticleId = onOpenArticle ? propArticleId : localArticleId;
  const setActiveArticle = (id: string | null) => {
    if (onOpenArticle) {
      onOpenArticle(id);
    } else {
      setLocalArticleId(id);
    }
  };

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

  const activeArticle = useMemo(() => {
    if (!activeArticleId) return null;
    return MACRO_NEWS_DATA.find((n) => n.id === activeArticleId) || null;
  }, [activeArticleId]);

  const leadStory = filteredNews[0] || null;
  const secondaryStories = filteredNews.slice(1);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "MONETARY_CURRENCY":
        return "Moneter dan FX";
      case "GLOBAL_MACRO":
        return "Makro global";
      case "DOMESTIC_POLITICS":
        return "Politik dan fiskal";
      case "COMMODITIES":
        return "Komoditas dan energi";
      default:
        return "Makroekonomi";
    }
  };

  const renderSentimentText = (sentiment: SentimentType) => {
    switch (sentiment) {
      case "BULLISH":
        return <span className="text-[#2EB886] font-medium">Sentimen positif</span>;
      case "BEARISH":
        return <span className="text-[#DC525F] font-medium">Sentimen negatif</span>;
      case "NEUTRAL":
      default:
        return <span className="text-[#5A6068] font-medium">Sentimen netral</span>;
    }
  };

  return (
    <div className="w-full text-[#1A1C1E] font-sans">
      {/* JIKA MEMBUKA HALAMAN ARTIKEL */}
      {activeArticle ? (
        <article className="max-w-[680px] mx-auto py-8 px-4 sm:px-0 space-y-6">
          {/* Navigasi kembali ke daftar */}
          <button
            type="button"
            onClick={() => setActiveArticle(null)}
            className="text-xs text-[#1E7B85] hover:underline font-medium block"
          >
            ← Kembali ke daftar berita
          </button>

          {/* Label tegas skenario contoh */}
          <div className="border-b border-[#E5E5DC] pb-4 space-y-2">
            <span className="text-xs text-[#7A8088] font-medium tracking-wide block">
              Skenario contoh, bukan berita.
            </span>

            {/* Judul artikel: Literata, text-wrap: balance, tanpa menggantung */}
            <h1
              className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1C1E] leading-snug"
              style={{ textWrap: "balance" }}
            >
              {activeArticle.title}
            </h1>

            {/* Baris meta teks biasa: kategori | sentimen | tanggal */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A6068] pt-1">
              <span>{getCategoryLabel(activeArticle.category)}</span>
              <span className="text-[#D8D8CF]">|</span>
              {renderSentimentText(activeArticle.marketSentiment)}
              <span className="text-[#D8D8CF]">|</span>
              <span>{activeArticle.date}</span>
            </div>
          </div>

          {/* Paragraf ringkasan isi artikel */}
          <div className="text-base sm:text-[17px] text-[#2A2E33] leading-relaxed font-sans border-b border-[#E5E5DC] pb-6">
            {activeArticle.summary}
          </div>

          {/* Blok Katalis dan Implikasi dengan garis vertikal tipis di kiri (tanpa kartu) */}
          <div className="space-y-4 border-b border-[#E5E5DC] pb-6">
            <div className="border-l-2 border-[#1E7B85] pl-4 py-0.5 space-y-1">
              <span className="text-xs font-semibold text-[#1A1C1E] block">
                Katalis penggerak
              </span>
              <p className="text-xs sm:text-sm text-[#3E4349] leading-relaxed">
                {activeArticle.catalyst}
              </p>
            </div>

            <div className="border-l-2 border-[#D8D8CF] pl-4 py-0.5 space-y-1">
              <span className="text-xs font-semibold text-[#1A1C1E] block">
                Implikasi transmisi kebijakan
              </span>
              <p className="text-xs sm:text-sm text-[#3E4349] leading-relaxed">
                {activeArticle.overallImpact}
              </p>
            </div>
          </div>

          {/* Bagian Emiten dan Sektor Terdampak: Tabel Hairline (Desktop) & Daftar Bertumpuk (Mobile) */}
          <section className="space-y-4 pt-2">
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-[#1A1C1E]">
                Emiten dan sektor terdampak
              </h2>
              <span className="text-xs text-[#5A6068]">
                Skenario transmisi kebijakan per sektor emiten IDX.
              </span>
            </div>

            {/* Desktop Hairline Table (hidden on small mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-[#E5E5DC]">
                <thead>
                  <tr className="text-[#5A6068] font-medium">
                    <th className="py-2.5 pr-4 font-medium">Sektor</th>
                    <th className="py-2.5 pr-4 font-medium">Arah dampak</th>
                    <th className="py-2.5 pr-4 font-medium">Emiten</th>
                    <th className="py-2.5 font-medium">Alasan transmisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5DC] text-[#2A2E33]">
                  {activeArticle.sectorImpacts.map((sec, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-3 pr-4 font-medium text-[#1A1C1E]">
                        {sec.sector}
                      </td>
                      <td className="py-3 pr-4">
                        {renderSentimentText(sec.sentiment)}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5 font-mono tnum">
                          {sec.tickers.map((ticker) => {
                            const isSupported = SUPPORTED_TERMINAL_TICKERS.has(ticker);
                            if (isSupported) {
                              return (
                                <button
                                  key={ticker}
                                  type="button"
                                  onClick={() =>
                                    onSelectStockFromNews(ticker, activeArticle.id, activeArticle.title)
                                  }
                                  className="text-[#1E7B85] hover:underline font-semibold"
                                  title={`Buka ${ticker} di Terminal`}
                                >
                                  {ticker}
                                </button>
                              );
                            }
                            return (
                              <span key={ticker} className="text-[#9CA3AF]">
                                {ticker}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 text-[#3E4349] leading-relaxed">
                        {sec.impactDescription}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked List (per sektor bertumpuk, nyaman di layar HP) */}
            <div className="sm:hidden divide-y divide-[#E5E5DC]">
              {activeArticle.sectorImpacts.map((sec, idx) => (
                <div key={idx} className="py-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1A1C1E]">{sec.sector}</span>
                    {renderSentimentText(sec.sentiment)}
                  </div>
                  <div className="flex items-center space-x-1.5 font-mono tnum">
                    <span className="text-[#5A6068] font-sans">Emiten:</span>
                    {sec.tickers.map((ticker) => {
                      const isSupported = SUPPORTED_TERMINAL_TICKERS.has(ticker);
                      if (isSupported) {
                        return (
                          <button
                            key={ticker}
                            type="button"
                            onClick={() =>
                              onSelectStockFromNews(ticker, activeArticle.id, activeArticle.title)
                            }
                            className="text-[#1E7B85] hover:underline font-semibold"
                          >
                            {ticker}
                          </button>
                        );
                      }
                      return (
                        <span key={ticker} className="text-[#9CA3AF]">
                          {ticker}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[#3E4349] leading-relaxed pt-0.5">
                    {sec.impactDescription}
                  </p>
                </div>
              ))}
            </div>

            {/* SATU catatan tegas di bawah tabel */}
            <p className="text-xs text-[#7A8088] pt-2 border-t border-[#E5E5DC]">
              Ticker abu-abu belum tersedia di Terminal.
            </p>
          </section>

          {/* Link kembali di bawah artikel */}
          <div className="pt-6 border-t border-[#E5E5DC]">
            <button
              type="button"
              onClick={() => setActiveArticle(null)}
              className="text-xs text-[#1E7B85] hover:underline font-medium block"
            >
              ← Kembali ke daftar berita
            </button>
          </div>
        </article>
      ) : (
        /* BERANDA BERITA */
        <div className="max-w-7xl mx-auto py-6 space-y-6">
          {/* Masthead sederhana (Logo StocksSense tidak diulang di sini) */}
          <div className="border-b border-[#E5E5DC] pb-4 space-y-1">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1C1E]">
              Warta makro dan transmisi kebijakan
            </h1>
            <p className="text-xs sm:text-sm text-[#5A6068]">
              Skenario transmisi kebijakan ekonomi moneter dan fiskal terhadap kinerja sektoral saham.
            </p>
          </div>

          {/* Ringkasan pasar: satu paragraf biasa berlabel data contoh (Risk index 62/100 telah dihapus) */}
          <div className="text-xs sm:text-sm text-[#3E4349] leading-relaxed border-b border-[#E5E5DC] pb-4">
            <span className="font-semibold text-[#1A1C1E]">Ringkasan pasar (data contoh): </span>
            {MACRO_MARKET_SUMMARY.summaryBrief}
          </div>

          {/* Baris Kontrol: Toggle periode + Kategori tab garis bawah + Kolom pencarian */}
          <div className="space-y-3 border-b border-[#E5E5DC] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Toggle 1 Minggu vs 1 Bulan sebagai tab teks bergaris bawah */}
              <div className="flex items-center space-x-4 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("1W")}
                  className={`pb-1 transition font-medium ${
                    selectedPeriod === "1W"
                      ? "text-[#1A1C1E] border-b-2 border-[#1E7B85]"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  1 Minggu terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("1M")}
                  className={`pb-1 transition font-medium ${
                    selectedPeriod === "1M"
                      ? "text-[#1A1C1E] border-b-2 border-[#1E7B85]"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  1 Bulan terakhir
                </button>
              </div>

              {/* Kolom pencarian berita / ticker */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7A8088]" />
                <input
                  type="text"
                  placeholder="Cari skenario berita atau ticker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-transparent border border-[#D8D8CF] rounded text-xs text-[#1A1C1E] placeholder-[#7A8088] focus:outline-none focus:border-[#1E7B85]"
                />
              </div>
            </div>

            {/* Kategori tab teks dengan garis bawah untuk yang aktif (bukan pill) */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs pt-1">
              {[
                { id: "ALL", label: "Semua" },
                { id: "MONETARY_CURRENCY", label: "Moneter dan FX" },
                { id: "GLOBAL_MACRO", label: "Makro global" },
                { id: "DOMESTIC_POLITICS", label: "Politik dan fiskal" },
                { id: "COMMODITIES", label: "Komoditas dan energi" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id as MacroCategory)}
                  className={`pb-1 transition font-medium ${
                    selectedCategory === cat.id
                      ? "text-[#1A1C1E] border-b-2 border-[#1E7B85]"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* DAFTAR BERITA: STRUKTUR DARI SPASI DAN GARIS TIPIS (TANPA KARTU ATAU BINGKAI) */}
          {filteredNews.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5A6068]">
              Tidak ada skenario berita yang cocok dengan filter yang dipilih.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
              {/* Satu berita utama besar (Lead Story) */}
              {leadStory && (
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center space-x-2 text-xs text-[#5A6068]">
                    <span className="font-semibold text-[#1E7B85]">Berita utama</span>
                    <span className="text-[#D8D8CF]">|</span>
                    <span>{getCategoryLabel(leadStory.category)}</span>
                    <span className="text-[#D8D8CF]">|</span>
                    {renderSentimentText(leadStory.marketSentiment)}
                  </div>

                  <h2
                    onClick={() => setActiveArticle(leadStory.id)}
                    className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1C1E] leading-snug cursor-pointer hover:text-[#1E7B85] transition"
                    style={{ textWrap: "balance" }}
                  >
                    {leadStory.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-[#3E4349] leading-relaxed">
                    {leadStory.summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-[#5A6068] border-t border-[#E5E5DC]">
                    <div className="flex items-center space-x-2 font-mono tnum">
                      <span className="font-sans">Emiten terkait:</span>
                      {leadStory.sectorImpacts.flatMap((s) => s.tickers).slice(0, 5).map((t) => (
                        <span key={t} className="text-[#1A1C1E] font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveArticle(leadStory.id)}
                      className="text-[#1E7B85] hover:underline font-medium"
                    >
                      Baca analisis lengkap →
                    </button>
                  </div>
                </div>
              )}

              {/* Daftar warta lainnya bertanggal dengan ticker terkait di bawahnya (tanpa kartu) */}
              <div className="lg:col-span-5 space-y-5 lg:border-l lg:border-[#E5E5DC] lg:pl-8">
                <span className="text-xs font-semibold text-[#5A6068] block uppercase tracking-wide">
                  Warta lainnya
                </span>

                <div className="divide-y divide-[#E5E5DC]">
                  {secondaryStories.map((story) => (
                    <div key={story.id} className="py-4 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-[#5A6068]">
                        <span>{getCategoryLabel(story.category)}</span>
                        <span>{story.date}</span>
                      </div>

                      <h3
                        onClick={() => setActiveArticle(story.id)}
                        className="text-base sm:text-lg font-serif font-bold text-[#1A1C1E] leading-snug cursor-pointer hover:text-[#1E7B85] transition"
                        style={{ textWrap: "balance" }}
                      >
                        {story.title}
                      </h3>

                      <p className="text-xs text-[#3E4349] line-clamp-2 leading-relaxed">
                        {story.summary}
                      </p>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center space-x-2 font-mono tnum text-[#5A6068]">
                          {story.sectorImpacts.flatMap((s) => s.tickers).slice(0, 3).map((t) => (
                            <span key={t}>{t}</span>
                          ))}
                        </div>
                        {renderSentimentText(story.marketSentiment)}
                      </div>
                    </div>
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
