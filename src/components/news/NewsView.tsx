"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { MACRO_NEWS_DATA, MACRO_MARKET_SUMMARY } from "@/data/macroData";
import {
  LiveMarketNewsItem,
  MacroCategory,
  MacroNewsItem,
  MarketTickerItem,
  SentimentType,
} from "@/types/market";
import { getLiveMarketNews, MarketProvider } from "@/lib/market-data";
import { formatNewsCategoryLabel } from "@/lib/format";
import { MarketTicker } from "@/components/layout/MarketTicker";
import { Search, Sparkles, ExternalLink, RotateCcw } from "lucide-react";

// 9 Saham yang memiliki data kurasi lengkap di mode ilustrasi
export const SUPPORTED_TERMINAL_TICKERS = new Set([
  "ADRO", "ANTM", "ASII", "BBCA", "BBRI", "BMRI", "ICBP", "MEDC", "TLKM"
]);

type NewsSourceTab = "live" | "scenario";
type NewsFilterCategory = MacroCategory | "CORPORATE";
type NewsFilterSentiment = "ALL" | SentimentType;

function formatCurrentWibClock(): string {
  const clock = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date());
  return `${clock} WIB`;
}

function renderSentimentText(sentiment: SentimentType) {
  switch (sentiment) {
    case "BULLISH":
      return <span className="text-[#0D6343] font-medium">Sentimen positif</span>;
    case "BEARISH":
      return <span className="text-[#B91C1C] font-medium">Sentimen negatif</span>;
    case "NEUTRAL":
    default:
      return <span className="text-[#4B5563] font-medium">Sentimen netral</span>;
  }
}

function PublisherBadge({
  publisher,
  sourceDomain,
  emphasis = false,
}: {
  publisher: string;
  sourceDomain?: string;
  emphasis?: boolean;
}) {
  const initial = (publisher.trim().charAt(0) || "B").toUpperCase();
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={sourceDomain ? `Sumber: ${publisher} (${sourceDomain})` : `Sumber: ${publisher}`}
    >
      <span className="w-4 h-4 rounded-sm bg-[#EFEFEA] border border-[#D8D8CF] text-[#1E7B85] font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0">
        {initial}
      </span>
      <span className={`${emphasis ? "font-semibold" : "font-medium"} text-[#1E7B85]`}>
        {publisher}
      </span>
    </span>
  );
}

interface NewsArticleImageProps {
  src: string;
  alt: string;
  href: string;
  publisher: string;
  sourceDomain?: string;
  variant: "lead" | "grid" | "sidebar";
}

const NewsArticleImage: React.FC<NewsArticleImageProps> = ({
  src,
  alt,
  href,
  publisher,
  sourceDomain,
  variant,
}) => {
  const [hasError, setHasError] = useState(false);
  if (hasError) return null;

  if (variant === "lead") {
    return (
      <figure className="overflow-hidden rounded-lg border border-[#E5E5DC] bg-[#EFEFEA]">
        <a href={href} target="_blank" rel="noopener noreferrer" className="block group">
          {/* Dynamic RSS CDN hosts vary by publisher; native img prevents remotePatterns errors */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className="w-full aspect-[16/9] max-h-[340px] object-cover group-hover:scale-[1.01] transition-transform duration-300"
          />
        </a>
        <figcaption className="px-3 py-1.5 text-[11px] text-[#5A6068] bg-[#F3F3ED] border-t border-[#E5E5DC] flex items-center justify-between gap-2">
          <span>Foto: {publisher}</span>
          {sourceDomain && <span className="font-mono text-[#7A8088]">{sourceDomain}</span>}
        </figcaption>
      </figure>
    );
  }

  if (variant === "grid") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-[#E5E5DC] bg-[#EFEFEA] group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-24 h-16 shrink-0 overflow-hidden rounded border border-[#E5E5DC] bg-[#EFEFEA] block group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
      />
    </a>
  );
};

interface LiveStoryCardProps {
  story: LiveMarketNewsItem;
  variant: "grid" | "sidebar";
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
}

const LiveStoryCard: React.FC<LiveStoryCardProps> = ({
  story,
  variant,
  onSelectStockFromNews,
  onAskAiLiveNews,
}) => {
  const isGrid = variant === "grid";

  return (
    <div
      className={
        isGrid
          ? "pt-4 border-t border-[#E5E5DC] flex flex-col justify-between space-y-2.5"
          : "py-4 first:pt-0 space-y-1.5"
      }
    >
      <div className="space-y-2">
        {isGrid && story.imageUrl && (
          <NewsArticleImage
            src={story.imageUrl}
            alt={story.title}
            href={story.link}
            publisher={story.publisher}
            sourceDomain={story.sourceDomain}
            variant="grid"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A6068]">
          <div className="flex items-center gap-x-2">
            <PublisherBadge publisher={story.publisher} sourceDomain={story.sourceDomain} />
            <span className="text-[#D8D8CF]">|</span>
            {renderSentimentText(story.sentiment || "NEUTRAL")}
          </div>
          <span>{story.publishedWib}</span>
        </div>

        <div className={!isGrid && story.imageUrl ? "flex items-start gap-3" : ""}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3
              className="text-base sm:text-lg font-serif font-bold text-[#1A1C1E] leading-snug"
              style={{ textWrap: "balance" }}
            >
              <a
                href={story.link}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1E7B85] transition"
              >
                {story.title}
              </a>
            </h3>

            {story.summary && (
              <p className="text-xs text-[#3E4349] line-clamp-2 leading-relaxed">
                {story.summary}
              </p>
            )}
          </div>

          {!isGrid && story.imageUrl && (
            <NewsArticleImage
              src={story.imageUrl}
              alt={story.title}
              href={story.link}
              publisher={story.publisher}
              sourceDomain={story.sourceDomain}
              variant="sidebar"
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
        <div className="flex flex-wrap items-center gap-1.5 font-mono tnum">
          {story.tickers.slice(0, 3).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onSelectStockFromNews(t, "", story.title, story)}
              className="px-1.5 py-0.5 rounded bg-[#EFEFEA] hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border border-[#D8D8CF] font-semibold transition"
              title={`Buka ${t} di Terminal`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {onAskAiLiveNews && (
            <button
              type="button"
              onClick={() => onAskAiLiveNews(story)}
              className="inline-flex items-center space-x-1 text-[#1E7B85] hover:underline font-medium"
            >
              <Sparkles className="w-3 h-3" />
              <span>Bedah AI</span>
            </button>
          )}
          <a
            href={story.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-0.5 text-[#5A6068] hover:text-[#1E7B85] hover:underline"
          >
            <span>Baca</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

interface NewsViewProps {
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  activeArticleId?: string | null;
  onOpenArticle?: (articleId: string | null) => void;
  onAskAiArticle?: (article: MacroNewsItem) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
  provider?: MarketProvider;
  macroTickers?: MarketTickerItem[];
  isMacroFallback?: boolean;
  isMacroLoading?: boolean;
}

export const NewsView: React.FC<NewsViewProps> = ({
  onSelectStockFromNews,
  activeArticleId: propArticleId = null,
  onOpenArticle,
  onAskAiArticle,
  onAskAiLiveNews,
  provider = "illustrative",
  macroTickers,
  isMacroFallback = false,
  isMacroLoading = false,
}) => {
  const [sourceTabPref, setSourceTabPref] = useState<NewsSourceTab | null>(null);
  const activeSourceTab: NewsSourceTab =
    sourceTabPref ?? (provider === "yahoo" ? "live" : "scenario");

  const [selectedPeriod, setSelectedPeriod] = useState<"1W" | "1M">("1W");
  const [selectedCategory, setSelectedCategory] = useState<NewsFilterCategory>("ALL");
  const [selectedSentiment, setSelectedSentiment] = useState<NewsFilterSentiment>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [localArticleId, setLocalArticleId] = useState<string | null>(propArticleId);
  const [isMarketSummaryExpanded, setIsMarketSummaryExpanded] = useState<boolean>(false);
  const [showAllLiveSidebar, setShowAllLiveSidebar] = useState<boolean>(false);

  const [liveNewsState, setLiveNewsState] = useState<{
    fetched: boolean;
    items: LiveMarketNewsItem[];
    updatedAtWib: string;
  }>({ fetched: false, items: [], updatedAtWib: "" });
  const [liveRetryCount, setLiveRetryCount] = useState<number>(0);

  const isLiveNewsLoading =
    provider === "yahoo" && activeSourceTab === "live" && !liveNewsState.fetched;

  const handleRetryLiveNews = useCallback(() => {
    setShowAllLiveSidebar(false);
    setLiveNewsState((prev) => ({ ...prev, fetched: false }));
    setLiveRetryCount((c) => c + 1);
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedCategory("ALL");
    setSelectedSentiment("ALL");
    setSearchQuery("");
    setShowAllLiveSidebar(false);
  }, []);

  useEffect(() => {
    if (provider !== "yahoo" || activeSourceTab !== "live") return;
    if (liveNewsState.fetched) return;

    let cancelled = false;
    getLiveMarketNews()
      .then((res) => {
        if (!cancelled) {
          setLiveNewsState({
            fetched: true,
            items: res.items,
            updatedAtWib: formatCurrentWibClock(),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveNewsState((prev) => ({
            fetched: true,
            items: prev.items,
            updatedAtWib: prev.updatedAtWib,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [provider, activeSourceTab, liveNewsState.fetched, liveRetryCount]);

  const activeArticleId = onOpenArticle ? propArticleId : localArticleId;
  const setActiveArticle = (id: string | null) => {
    if (onOpenArticle) {
      onOpenArticle(id);
    } else {
      setLocalArticleId(id);
    }
  };

  const canOpenTickerInTerminal = (ticker: string) => {
    return provider === "yahoo"
      ? /^[A-Z]{4}$/.test(ticker)
      : SUPPORTED_TERMINAL_TICKERS.has(ticker);
  };

  const hasActiveFilters =
    selectedCategory !== "ALL" || selectedSentiment !== "ALL" || searchQuery.trim().length > 0;

  const filteredLiveNews = useMemo(() => {
    return liveNewsState.items.filter((item) => {
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;
      if (selectedSentiment !== "ALL" && (item.sentiment || "NEUTRAL") !== selectedSentiment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSummary = item.summary.toLowerCase().includes(q);
        const inPublisher = item.publisher.toLowerCase().includes(q);
        const inTickers = item.tickers.some((t) => t.toLowerCase().includes(q));
        if (!inTitle && !inSummary && !inPublisher && !inTickers) return false;
      }
      return true;
    });
  }, [liveNewsState.items, selectedCategory, selectedSentiment, searchQuery]);

  const filteredScenarioNews = useMemo(() => {
    return MACRO_NEWS_DATA.filter((item) => {
      if (item.period !== selectedPeriod) return false;
      if (
        selectedCategory !== "ALL" &&
        selectedCategory !== "CORPORATE" &&
        item.category !== selectedCategory
      ) {
        return false;
      }
      if (selectedSentiment !== "ALL" && item.marketSentiment !== selectedSentiment) {
        return false;
      }

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
  }, [selectedPeriod, selectedCategory, selectedSentiment, searchQuery]);

  const activeArticle = useMemo(() => {
    if (!activeArticleId) return null;
    return MACRO_NEWS_DATA.find((n) => n.id === activeArticleId) || null;
  }, [activeArticleId]);

  const leadStory = filteredScenarioNews[0] || null;
  const secondaryStories = filteredScenarioNews.slice(1);

  const leadLiveStory = useMemo(() => {
    if (filteredLiveNews.length === 0) return null;
    return filteredLiveNews.find((item) => Boolean(item.imageUrl)) || filteredLiveNews[0];
  }, [filteredLiveNews]);

  const remainingLiveStories = useMemo(() => {
    if (!leadLiveStory) return [];
    return filteredLiveNews.filter((item) => item.id !== leadLiveStory.id);
  }, [filteredLiveNews, leadLiveStory]);

  const hasMultiGridLeft = filteredLiveNews.length > 6;

  const featuredLiveStories = useMemo(() => {
    if (!hasMultiGridLeft) return [];
    const withImages = remainingLiveStories.filter((item) => Boolean(item.imageUrl));
    const withoutImages = remainingLiveStories.filter((item) => !item.imageUrl);
    return [...withImages, ...withoutImages].slice(0, 4);
  }, [hasMultiGridLeft, remainingLiveStories]);

  const allSidebarLiveStories = useMemo(() => {
    if (!hasMultiGridLeft) return remainingLiveStories;
    const featuredIds = new Set(featuredLiveStories.map((item) => item.id));
    return remainingLiveStories.filter((item) => !featuredIds.has(item.id));
  }, [hasMultiGridLeft, remainingLiveStories, featuredLiveStories]);

  const visibleSidebarLiveStories = showAllLiveSidebar
    ? allSidebarLiveStories
    : allSidebarLiveStories.slice(0, 6);
  const hiddenSidebarCount = Math.max(0, allSidebarLiveStories.length - 6);

  return (
    <div className="w-full text-[#1A1C1E] font-sans">
      {/* JIKA MEMBUKA HALAMAN ARTIKEL SKENARIO */}
      {activeArticle ? (
        <article className="max-w-[680px] mx-auto py-6 px-4 sm:px-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setActiveArticle(null)}
              className="min-h-[44px] inline-flex items-center text-xs text-[#1E7B85] hover:underline font-medium"
            >
              ← Kembali ke daftar berita
            </button>
            {onAskAiArticle && (
              <button
                type="button"
                onClick={() => onAskAiArticle(activeArticle)}
                className="min-h-[44px] inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#EFEFEA] hover:bg-[#E5E5DC] text-[#1E7B85] border border-[#D5D5CA] text-xs font-medium transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tanya AI soal skenario ini</span>
              </button>
            )}
          </div>

          <div className="border-b border-[#E5E5DC] pb-4 space-y-2">
            <span className="text-xs text-[#7A8088] font-medium tracking-wide block">
              Skenario contoh, bukan berita.
            </span>

            <h1
              className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1C1E] leading-snug"
              style={{ textWrap: "balance" }}
            >
              {activeArticle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5A6068] pt-1">
              <span>{formatNewsCategoryLabel(activeArticle.category)}</span>
              <span className="text-[#D8D8CF]">|</span>
              {renderSentimentText(activeArticle.marketSentiment)}
              <span className="text-[#D8D8CF]">|</span>
              <span>{activeArticle.date}</span>
            </div>
          </div>

          <div className="text-base sm:text-[17px] text-[#2A2E33] leading-relaxed font-sans border-b border-[#E5E5DC] pb-6">
            {activeArticle.summary}
          </div>

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

          <section className="space-y-4 pt-2">
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-[#1A1C1E]">
                Emiten dan sektor terdampak
              </h2>
              <span className="text-xs text-[#5A6068]">
                Skenario transmisi kebijakan per sektor emiten IDX.
              </span>
            </div>

            {/* Desktop Table */}
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
                            const isSupported = canOpenTickerInTerminal(ticker);
                            if (isSupported) {
                              return (
                                <button
                                  key={ticker}
                                  type="button"
                                  onClick={() =>
                                    onSelectStockFromNews(ticker, activeArticle.id, activeArticle.title)
                                  }
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 py-1 text-[#1E7B85] hover:underline font-semibold"
                                  title={`Buka ${ticker} di Terminal`}
                                >
                                  {ticker}
                                </button>
                              );
                            }
                            return (
                              <span
                                key={ticker}
                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-1 text-[#9CA3AF]"
                              >
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

            {/* Mobile Stacked List */}
            <div className="sm:hidden divide-y divide-[#E5E5DC]">
              {activeArticle.sectorImpacts.map((sec, idx) => (
                <div key={idx} className="py-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1A1C1E]">{sec.sector}</span>
                    {renderSentimentText(sec.sentiment)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono tnum pt-0.5">
                    <span className="text-[#5A6068] font-sans text-xs">Emiten:</span>
                    {sec.tickers.map((ticker) => {
                      const isSupported = canOpenTickerInTerminal(ticker);
                      if (isSupported) {
                        return (
                          <button
                            key={ticker}
                            type="button"
                            onClick={() =>
                              onSelectStockFromNews(ticker, activeArticle.id, activeArticle.title)
                            }
                            className="min-h-[44px] min-w-[48px] px-3 py-2 rounded bg-[#EFEFEA] hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border border-[#D5D5CA] text-xs font-semibold inline-flex items-center justify-center transition"
                            title={`Buka ${ticker} di Terminal`}
                          >
                            {ticker} ↗
                          </button>
                        );
                      }
                      return (
                        <span
                          key={ticker}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-2 text-[#9CA3AF] text-xs"
                        >
                          {ticker}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[#3E4349] leading-relaxed pt-1">
                    {sec.impactDescription}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#7A8088] pt-2 border-t border-[#E5E5DC]">
              {provider === "yahoo"
                ? "Semua kode saham IDX 4 huruf berwarna biru dapat dibuka langsung di Terminal (mode Yahoo Finance)."
                : "Ticker abu-abu belum tersedia pada dataset contoh Terminal (aktif penuh di mode Yahoo Finance)."}
            </p>
          </section>

          <div className="pt-6 border-t border-[#E5E5DC]">
            <button
              type="button"
              onClick={() => setActiveArticle(null)}
              className="min-h-[44px] inline-flex items-center text-xs text-[#1E7B85] hover:underline font-medium"
            >
              ← Kembali ke daftar berita
            </button>
          </div>
        </article>
      ) : (
        /* BERANDA BERITA */
        <div className="max-w-7xl mx-auto py-6 space-y-6">
          <div className="border-b border-[#E5E5DC] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1C1E]">
                {activeSourceTab === "live"
                  ? "Warta pasar modal & makro terkini"
                  : "Warta makro dan transmisi kebijakan"}
              </h1>
              <p className="text-xs sm:text-sm text-[#5A6068]">
                {activeSourceTab === "live"
                  ? "Berita terkini pasar saham Indonesia dari RSS publik (CNBC Indonesia, ANTARA Ekonomi & Google News IDX)."
                  : "Skenario transmisi kebijakan ekonomi moneter dan fiskal terhadap kinerja sektoral saham."}
              </p>
            </div>

            {provider === "yahoo" && (
              <div className="flex items-center bg-[#EFEFEA] p-0.5 rounded-lg border border-[#D8D8CF] text-xs self-start">
                <button
                  type="button"
                  onClick={() => {
                    setSourceTabPref("live");
                    if (selectedCategory === "CORPORATE") setSelectedCategory("ALL");
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-md font-medium transition ${
                    activeSourceTab === "live"
                      ? "bg-[#1E7B85] text-white shadow-sm"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  Berita Pasar Terkini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceTabPref("scenario");
                    if (selectedCategory === "CORPORATE") setSelectedCategory("ALL");
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-md font-medium transition ${
                    activeSourceTab === "scenario"
                      ? "bg-[#1E7B85] text-white shadow-sm"
                      : "text-[#5A6068] hover:text-[#1A1C1E]"
                  }`}
                >
                  Skenario Contoh
                </button>
              </div>
            )}
          </div>

          {activeSourceTab === "live" && (
            <MarketTicker
              provider={provider}
              tickers={macroTickers}
              isMacroFallback={isMacroFallback}
              isLoading={isMacroLoading}
              theme="light"
              embedded
            />
          )}

          {activeSourceTab === "scenario" && (
            <div className="text-xs sm:text-sm text-[#3E4349] leading-relaxed border-b border-[#E5E5DC] pb-3">
              <div className={!isMarketSummaryExpanded ? "line-clamp-2 sm:line-clamp-none" : ""}>
                <span className="font-semibold text-[#1A1C1E]">Ringkasan pasar (data contoh): </span>
                {MACRO_MARKET_SUMMARY.summaryBrief}
              </div>
              <button
                type="button"
                onClick={() => setIsMarketSummaryExpanded(!isMarketSummaryExpanded)}
                className="sm:hidden text-xs text-[#1E7B85] hover:underline font-medium min-h-[44px] inline-flex items-center"
              >
                {isMarketSummaryExpanded ? "Tutup ringkasan" : "Selengkapnya"}
              </button>
            </div>
          )}

          {/* Baris Kontrol */}
          <div className="space-y-3 border-b border-[#E5E5DC] pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {activeSourceTab === "scenario" ? (
                <div className="flex items-center space-x-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriod("1W")}
                    className={`min-h-[44px] inline-flex items-center px-1 transition font-medium ${
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
                    className={`min-h-[44px] inline-flex items-center px-1 transition font-medium ${
                      selectedPeriod === "1M"
                        ? "text-[#1A1C1E] border-b-2 border-[#1E7B85]"
                        : "text-[#5A6068] hover:text-[#1A1C1E]"
                    }`}
                  >
                    1 Bulan terakhir
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A6068]">
                  <span className="w-2 h-2 rounded-full bg-[#2EB886] shrink-0"></span>
                  <span>
                    CNBC, ANTARA &amp; Google News BEI ({filteredLiveNews.length} berita)
                    {liveNewsState.updatedAtWib ? ` • Diperbarui ${liveNewsState.updatedAtWib}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleRetryLiveNews}
                    disabled={isLiveNewsLoading}
                    className="min-h-[32px] inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-[#EFEFEA] hover:bg-[#E5E5DC] text-[#1A1C1E] border border-[#D8D8CF] font-medium transition disabled:opacity-50"
                    title="Muat ulang berita pasar terkini"
                  >
                    <RotateCcw
                      className={`w-3 h-3 text-[#1E7B85] ${isLiveNewsLoading ? "animate-spin" : ""}`}
                    />
                    <span>Segarkan</span>
                  </button>
                </div>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8088]" />
                <input
                  type="text"
                  placeholder="Cari berita atau kode saham..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowAllLiveSidebar(false);
                  }}
                  className="w-full h-[44px] pl-9 pr-3 bg-transparent border border-[#D8D8CF] rounded text-xs text-[#1A1C1E] placeholder-[#7A8088] focus:outline-none focus:border-[#1E7B85]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                {[
                  { id: "ALL", label: "Semua" },
                  ...(activeSourceTab === "live"
                    ? [{ id: "CORPORATE", label: "Korporasi & bursa" }]
                    : []),
                  { id: "MONETARY_CURRENCY", label: "Moneter dan FX" },
                  { id: "GLOBAL_MACRO", label: "Makro global" },
                  { id: "DOMESTIC_POLITICS", label: "Politik dan fiskal" },
                  { id: "COMMODITIES", label: "Komoditas dan energi" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id as NewsFilterCategory);
                      setShowAllLiveSidebar(false);
                    }}
                    className={`min-h-[44px] inline-flex items-center px-1 transition font-medium ${
                      selectedCategory === cat.id
                        ? "text-[#1A1C1E] border-b-2 border-[#1E7B85]"
                        : "text-[#5A6068] hover:text-[#1A1C1E]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-[#EFEFEA] p-0.5 rounded-lg border border-[#D8D8CF] text-[11px]">
                {[
                  { id: "ALL", label: "Semua sentimen" },
                  { id: "BULLISH", label: "Positif" },
                  { id: "BEARISH", label: "Negatif" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedSentiment(opt.id as NewsFilterSentiment);
                      setShowAllLiveSidebar(false);
                    }}
                    className={`min-h-[32px] px-2.5 py-1 rounded-md font-medium transition ${
                      selectedSentiment === opt.id
                        ? "bg-[#1E7B85] text-white shadow-sm"
                        : "text-[#5A6068] hover:text-[#1A1C1E]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* KONTEN TAB 1: BERITA PASAR TERKINI (RSS NYATA) */}
          {activeSourceTab === "live" ? (
            isLiveNewsLoading && liveNewsState.items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5A6068] animate-pulse">
                Mengambil berita pasar modal Indonesia terkini...
              </div>
            ) : filteredLiveNews.length === 0 ? (
              <div className="py-12 text-center space-y-3 text-xs text-[#5A6068]">
                <p>
                  {liveNewsState.items.length === 0
                    ? "Berita pasar terkini belum dapat dimuat dari sumber RSS saat ini."
                    : "Tidak ada berita terkini yang cocok dengan filter pencarian Anda."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {liveNewsState.items.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleRetryLiveNews}
                      className="min-h-[40px] inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#EFEFEA] hover:bg-[#E5E5DC] text-[#1A1C1E] border border-[#D8D8CF] transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#1E7B85]" />
                      <span>Coba Lagi</span>
                    </button>
                  ) : (
                    hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="min-h-[40px] inline-flex items-center px-3 py-1.5 rounded bg-[#EFEFEA] hover:bg-[#E5E5DC] text-[#1A1C1E] border border-[#D8D8CF] transition"
                      >
                        Reset filter
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setSourceTabPref("scenario")}
                    className="min-h-[40px] inline-flex items-center px-3 py-1.5 rounded bg-[#1E7B85] text-white transition"
                  >
                    Buka Skenario Contoh
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
                {leadLiveStory && (
                  <div
                    className={`${
                      allSidebarLiveStories.length > 0 ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl"
                    } space-y-6`}
                  >
                    <div className="space-y-3">
                      {leadLiveStory.imageUrl && (
                        <NewsArticleImage
                          src={leadLiveStory.imageUrl}
                          alt={leadLiveStory.title}
                          href={leadLiveStory.link}
                          publisher={leadLiveStory.publisher}
                          sourceDomain={leadLiveStory.sourceDomain}
                          variant="lead"
                        />
                      )}

                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#5A6068]">
                        <PublisherBadge
                          publisher={leadLiveStory.publisher}
                          sourceDomain={leadLiveStory.sourceDomain}
                          emphasis
                        />
                        <span className="text-[#D8D8CF]">|</span>
                        <span>{formatNewsCategoryLabel(leadLiveStory.category)}</span>
                        <span className="text-[#D8D8CF]">|</span>
                        {renderSentimentText(leadLiveStory.sentiment || "NEUTRAL")}
                        <span className="text-[#D8D8CF]">|</span>
                        <span>{leadLiveStory.publishedWib}</span>
                      </div>

                      <h2
                        className="text-2xl sm:text-3xl font-serif font-bold text-[#1A1C1E] leading-snug"
                        style={{ textWrap: "balance" }}
                      >
                        <a
                          href={leadLiveStory.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#1E7B85] transition"
                        >
                          {leadLiveStory.title}
                        </a>
                      </h2>

                      {leadLiveStory.summary && (
                        <p className="text-xs sm:text-sm text-[#3E4349] leading-relaxed">
                          {leadLiveStory.summary}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-[#5A6068] border-t border-[#E5E5DC]">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono tnum">
                          {leadLiveStory.tickers.length > 0 && (
                            <>
                              <span className="font-sans">Emiten terkait:</span>
                              {leadLiveStory.tickers.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() =>
                                    onSelectStockFromNews(t, "", leadLiveStory.title, leadLiveStory)
                                  }
                                  className="min-h-[36px] px-2 py-0.5 rounded bg-[#EFEFEA] hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border border-[#D8D8CF] font-semibold transition"
                                  title={`Buka ${t} di Terminal`}
                                >
                                  {t}
                                </button>
                              ))}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {onAskAiLiveNews && (
                            <button
                              type="button"
                              onClick={() => onAskAiLiveNews(leadLiveStory)}
                              className="min-h-[40px] inline-flex items-center space-x-1 text-[#1E7B85] hover:underline font-medium"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Bedah dengan AI</span>
                            </button>
                          )}
                          <a
                            href={leadLiveStory.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[40px] inline-flex items-center space-x-1 text-[#2A2E33] hover:text-[#1E7B85] hover:underline font-medium"
                          >
                            <span>Sumber asli</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {featuredLiveStories.length > 0 && (
                      <div className="space-y-4 pt-2">
                        <span className="text-xs font-semibold text-[#5A6068] block">
                          Sorotan pasar pilihan
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                          {featuredLiveStories.map((story) => (
                            <LiveStoryCard
                              key={story.id}
                              story={story}
                              variant="grid"
                              onSelectStockFromNews={onSelectStockFromNews}
                              onAskAiLiveNews={onAskAiLiveNews}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {allSidebarLiveStories.length > 0 && (
                  <div className="lg:col-span-5 space-y-4 lg:border-l lg:border-[#E5E5DC] lg:pl-8">
                    <span className="text-xs font-semibold text-[#5A6068] block">
                      Berita terbaru lainnya
                    </span>

                    <div className="divide-y divide-[#E5E5DC]">
                      {visibleSidebarLiveStories.map((story) => (
                        <LiveStoryCard
                          key={story.id}
                          story={story}
                          variant="sidebar"
                          onSelectStockFromNews={onSelectStockFromNews}
                          onAskAiLiveNews={onAskAiLiveNews}
                        />
                      ))}
                    </div>

                    {allSidebarLiveStories.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllLiveSidebar((prev) => !prev)}
                        className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#EFEFEA] hover:bg-[#E5E5DC] text-[#1A1C1E] border border-[#D8D8CF] text-xs font-medium transition"
                      >
                        {showAllLiveSidebar
                          ? "Ringkas daftar berita"
                          : `Tampilkan ${hiddenSidebarCount} berita lainnya`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          ) : /* KONTEN TAB 2: SKENARIO CONTOH */ filteredScenarioNews.length === 0 ? (
            <div className="py-12 text-center space-y-3 text-xs text-[#5A6068]">
              <p>Tidak ada skenario berita yang cocok dengan filter yang dipilih.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-[40px] inline-flex items-center px-3 py-1.5 rounded bg-[#EFEFEA] hover:bg-[#E5E5DC] text-[#1A1C1E] border border-[#D8D8CF] transition"
                >
                  Reset filter
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
              {leadStory && (
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center space-x-2 text-xs text-[#5A6068]">
                    <span className="font-semibold text-[#1E7B85]">Berita utama</span>
                    <span className="text-[#D8D8CF]">|</span>
                    <span>{formatNewsCategoryLabel(leadStory.category)}</span>
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
                      {(() => {
                        const supported = leadStory.sectorImpacts
                          .flatMap((s) => s.tickers)
                          .filter((t) => canOpenTickerInTerminal(t));
                        const other = leadStory.sectorImpacts
                          .flatMap((s) => s.tickers)
                          .filter((t) => !canOpenTickerInTerminal(t));
                        const combined = Array.from(new Set([...supported, ...other])).slice(0, 5);
                        return combined.map((t) => (
                          <span
                            key={t}
                            className={
                              canOpenTickerInTerminal(t)
                                ? "text-[#1E7B85] font-semibold"
                                : "text-[#7A8088]"
                            }
                          >
                            {t}
                          </span>
                        ));
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveArticle(leadStory.id)}
                      className="min-h-[44px] inline-flex items-center text-[#1E7B85] hover:underline font-medium"
                    >
                      Baca analisis lengkap →
                    </button>
                  </div>
                </div>
              )}

              <div className="lg:col-span-5 space-y-5 lg:border-l lg:border-[#E5E5DC] lg:pl-8">
                <span className="text-xs font-semibold text-[#5A6068] block">
                  Warta lainnya
                </span>

                <div className="divide-y divide-[#E5E5DC]">
                  {secondaryStories.map((story) => (
                    <div key={story.id} className="py-4 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-[#5A6068]">
                        <span>{formatNewsCategoryLabel(story.category)}</span>
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
                            <span
                              key={t}
                              className={
                                canOpenTickerInTerminal(t)
                                  ? "text-[#1E7B85] font-semibold"
                                  : "text-[#9CA3AF]"
                              }
                            >
                              {t}
                            </span>
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
