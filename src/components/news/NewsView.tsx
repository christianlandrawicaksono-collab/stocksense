"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  LiveMarketNewsItem,
  MacroCategory,
  MarketTickerItem,
  SentimentType,
} from "@/types/market";
import { MarketProvider } from "@/lib/market-data";
import {
  formatNewsCategoryLabel,
  formatNewsTimestamp,
  getJakartaDateKey,
} from "@/lib/format";
import {
  allocateEditorialBuckets,
  buildLiveMarketBrief,
  computeNewsCategoryCounts,
  filterLiveNewsItems,
  type LiveMarketBrief,
} from "@/lib/news-brief";
import { MarketTicker } from "@/components/layout/MarketTicker";
import {
  Search,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Bookmark,
  Star,
  Building2,
  Landmark,
  Globe,
  Scale,
  Flame,
  Newspaper,
  ChevronDown,
  ChevronUp,
  Quote,
  X,
} from "lucide-react";

type NewsFilterCategory = "ALL" | MacroCategory | "CORPORATE";
type NewsFilterSentiment = "ALL" | SentimentType;

function renderCategoryTag(
  category: MacroCategory | "CORPORATE",
  onDark = false
) {
  const iconClass = "w-3.5 h-3.5 shrink-0";
  let icon: React.ReactNode = <Newspaper className={iconClass} />;
  if (category === "CORPORATE") icon = <Building2 className={iconClass} />;
  else if (category === "MONETARY_CURRENCY") icon = <Landmark className={iconClass} />;
  else if (category === "GLOBAL_MACRO") icon = <Globe className={iconClass} />;
  else if (category === "DOMESTIC_POLITICS") icon = <Scale className={iconClass} />;
  else if (category === "COMMODITIES") icon = <Flame className={iconClass} />;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] ${
        onDark ? "text-white/90" : "text-[#676E7E]"
      }`}
    >
      {icon}
      <span>{formatNewsCategoryLabel(category)}</span>
    </span>
  );
}

function renderSentimentText(sentiment: SentimentType, onDark = false) {
  switch (sentiment) {
    case "BULLISH":
      return (
        <span className={onDark ? "text-[#5EEAD4] font-semibold" : "text-[#0D6343] font-semibold"}>
          Positif
        </span>
      );
    case "BEARISH":
      return (
        <span className={onDark ? "text-[#FCA5A5] font-semibold" : "text-[#B91C1C] font-semibold"}>
          Negatif
        </span>
      );
    case "NEUTRAL":
    default:
      return (
        <span className={onDark ? "text-white/75 font-medium" : "text-[#676E7E] font-medium"}>
          Netral
        </span>
      );
  }
}

interface NewsArticleImageProps {
  src: string;
  alt: string;
  href: string;
  publisher: string;
  sourceDomain?: string;
  variant: "lead" | "grid";
  onErrorFallback?: () => void;
}

const NewsArticleImage: React.FC<NewsArticleImageProps> = ({
  src,
  alt,
  href,
  publisher,
  sourceDomain,
  variant,
  onErrorFallback,
}) => {
  const [hasError, setHasError] = useState(false);
  if (hasError) return null;

  const handleError = () => {
    setHasError(true);
    onErrorFallback?.();
  };

  if (variant === "lead") {
    return (
      <figure className="h-full flex flex-col overflow-hidden bg-[#E9E8E2]">
        <a href={href} target="_blank" rel="noopener noreferrer" className="block flex-1 min-h-0 group overflow-hidden">
          {/* Dynamic RSS CDN hosts vary by publisher; native img prevents remotePatterns errors */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="eager"
            referrerPolicy="no-referrer"
            onError={handleError}
            className="w-full aspect-[16/10] lg:h-full lg:max-h-[380px] object-cover group-hover:scale-[1.015] transition-transform duration-300"
          />
        </a>
        <figcaption className="px-3 py-1.5 text-[11px] text-[#676E7E] bg-[#F4F3EE] border-t border-[#E5E5DC] flex items-center justify-between gap-2">
          <span>Foto: {publisher}</span>
          {sourceDomain && <span className="font-mono text-[#848B99]">{sourceDomain}</span>}
        </figcaption>
      </figure>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden bg-[#E9E8E2] group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={handleError}
        className="w-full aspect-[3/2] object-cover group-hover:scale-[1.02] transition-transform duration-300"
      />
    </a>
  );
};

interface EditorialCardActionsProps {
  story: LiveMarketNewsItem;
  watchlistSet: ReadonlySet<string>;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
  onDark?: boolean;
  compact?: boolean;
}

const EditorialCardActions: React.FC<EditorialCardActionsProps> = ({
  story,
  watchlistSet,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onDark = false,
  compact = false,
}) => {
  const maxTickers = compact ? 3 : 4;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
      <div className="flex flex-wrap items-center gap-1.5 font-mono tnum">
        {story.tickers.slice(0, maxTickers).map((t) => {
          const isMatchedTicker = watchlistSet.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => onSelectStockFromNews(t, "", story.title, story)}
              className={`px-1.5 py-0.5 border text-[11px] font-semibold transition ${
                onDark
                  ? isMatchedTicker
                    ? "bg-[#1E7B85] text-white border-[#2DD4BF]/60"
                    : "bg-white/10 hover:bg-[#1E7B85] text-white border-white/25"
                  : isMatchedTicker
                  ? "bg-[#1E7B85]/12 hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border-[#1E7B85]/50"
                  : "bg-[#F4F3EE] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border-[#D5D7DC]"
              }`}
              title={
                isMatchedTicker
                  ? `${t} ada di Watchlist Anda • Buka di Terminal`
                  : `Buka ${t} di Terminal`
              }
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        {onAskAiLiveNews && (
          <button
            type="button"
            onClick={() => onAskAiLiveNews(story)}
            className={`inline-flex items-center space-x-1 font-semibold hover:underline ${
              onDark ? "text-[#5EEAD4]" : "text-[#1E7B85]"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Bedah AI</span>
          </button>
        )}
        <a
          href={story.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center space-x-0.5 hover:underline ${
            onDark ? "text-white/80 hover:text-white" : "text-[#676E7E] hover:text-[#1D1F23]"
          }`}
        >
          <span>Baca</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

interface LeadBroadsheetHeroProps {
  story: LiveMarketNewsItem;
  watchlistSet: ReadonlySet<string>;
  todayWibKey?: string;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
}

const LeadBroadsheetHero: React.FC<LeadBroadsheetHeroProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(story.imageUrl && !imageFailed);
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const formattedTime = formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey);

  return (
    <article className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
      <div
        className={`${
          showImage ? "lg:col-span-5" : "lg:col-span-12 max-w-4xl"
        } flex flex-col justify-between pb-4 border-b-2 ${
          isWatchlistMatch
            ? "border-[#1E7B85] border-l-[3px] border-l-[#1E7B85] pl-4 bg-[#1E7B85]/[0.04]"
            : "border-[#1D1F23]"
        }`}
      >
        <div className="space-y-3.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {renderCategoryTag(story.category)}
            {isWatchlistMatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
                <Star className="w-2.5 h-2.5 fill-white" />
                <span>Watchlist</span>
              </span>
            )}
          </div>

          <h2
            className="text-2xl sm:text-3xl lg:text-[38px] font-serif font-bold text-[#1D1F23] leading-[1.15]"
            style={{ textWrap: "balance" }}
          >
            <a
              href={story.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1E7B85] transition-colors"
            >
              {story.title}
            </a>
          </h2>

          {story.summary && (
            <p className="text-[15px] sm:text-base text-[#4E5563] leading-[1.65] line-clamp-6">
              {story.summary}
            </p>
          )}
        </div>

        <div className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#676E7E]">
            <span>{formattedTime}</span>
            <span className="text-[#C5C7CE]">|</span>
            <span className="font-semibold text-[#1D1F23]">{story.publisher}</span>
            <span className="text-[#C5C7CE]">|</span>
            {renderSentimentText(story.sentiment || "NEUTRAL")}
          </div>

          <EditorialCardActions
            story={story}
            watchlistSet={watchlistSet}
            onSelectStockFromNews={onSelectStockFromNews}
            onAskAiLiveNews={onAskAiLiveNews}
          />
        </div>
      </div>

      {showImage && story.imageUrl && (
        <div className="lg:col-span-7">
          <NewsArticleImage
            key={story.imageUrl}
            src={story.imageUrl}
            alt={story.title}
            href={story.link}
            publisher={story.publisher}
            sourceDomain={story.sourceDomain}
            variant="lead"
            onErrorFallback={() => setImageFailed(true)}
          />
        </div>
      )}
    </article>
  );
};

interface EditorialGridCardProps {
  story: LiveMarketNewsItem;
  watchlistSet: ReadonlySet<string>;
  todayWibKey?: string;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
}

const EditorialGridCard: React.FC<EditorialGridCardProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
}) => {
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const formattedTime = formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey);

  return (
    <article
      className={`flex flex-col justify-between pb-4 border-b-2 ${
        isWatchlistMatch
          ? "border-[#1E7B85] border-l-[3px] border-l-[#1E7B85] pl-3.5 bg-[#1E7B85]/[0.04]"
          : "border-[#1D1F23]"
      }`}
    >
      <div className="space-y-3">
        {story.imageUrl && (
          <NewsArticleImage
            src={story.imageUrl}
            alt={story.title}
            href={story.link}
            publisher={story.publisher}
            sourceDomain={story.sourceDomain}
            variant="grid"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {renderCategoryTag(story.category)}
          {isWatchlistMatch && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
              <Star className="w-2.5 h-2.5 fill-white" />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        <h3
          className="text-lg sm:text-[21px] font-serif font-bold text-[#1D1F23] leading-[1.28]"
          style={{ textWrap: "balance" }}
        >
          <a
            href={story.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1E7B85] transition-colors"
          >
            {story.title}
          </a>
        </h3>

        {story.summary && (
          <p className="text-xs sm:text-[13px] text-[#676E7E] leading-relaxed line-clamp-3">
            {story.summary}
          </p>
        )}
      </div>

      <div className="space-y-2 pt-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#676E7E]">
          <span>{formattedTime}</span>
          <span className="text-[#C5C7CE]">|</span>
          <span className="font-medium text-[#1D1F23]">{story.publisher}</span>
          <span className="text-[#C5C7CE]">|</span>
          {renderSentimentText(story.sentiment || "NEUTRAL")}
        </div>

        <EditorialCardActions
          story={story}
          watchlistSet={watchlistSet}
          onSelectStockFromNews={onSelectStockFromNews}
          onAskAiLiveNews={onAskAiLiveNews}
        />
      </div>
    </article>
  );
};

interface EditorialOverlayFeatureProps {
  story: LiveMarketNewsItem;
  watchlistSet: ReadonlySet<string>;
  todayWibKey?: string;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
}

const EditorialOverlayFeature: React.FC<EditorialOverlayFeatureProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const formattedTime = formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey);

  if (!story.imageUrl || imageFailed) {
    return (
      <EditorialGridCard
        story={story}
        watchlistSet={watchlistSet}
        todayWibKey={todayWibKey}
        onSelectStockFromNews={onSelectStockFromNews}
        onAskAiLiveNews={onAskAiLiveNews}
      />
    );
  }

  return (
    <article
      className={`relative min-h-[360px] lg:min-h-[420px] flex flex-col justify-end overflow-hidden bg-[#1D1F23] group ${
        isWatchlistMatch ? "ring-2 ring-inset ring-[#1E7B85]" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={story.imageUrl}
        alt={story.title}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:scale-[1.03] transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1D1F23] via-[#1D1F23]/65 to-[#1D1F23]/20" />

      <div className="relative z-10 p-5 space-y-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {renderCategoryTag(story.category, true)}
          {isWatchlistMatch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
              <Star className="w-2.5 h-2.5 fill-white" />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        <h3
          className="text-xl sm:text-2xl font-serif font-bold text-white leading-snug"
          style={{ textWrap: "balance" }}
        >
          <a
            href={story.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#5EEAD4] transition-colors"
          >
            {story.title}
          </a>
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/80">
          <span>{formattedTime}</span>
          <span className="text-white/40">|</span>
          <span className="font-semibold text-white">{story.publisher}</span>
          <span className="text-white/40">|</span>
          {renderSentimentText(story.sentiment || "NEUTRAL", true)}
        </div>

        <EditorialCardActions
          story={story}
          watchlistSet={watchlistSet}
          onSelectStockFromNews={onSelectStockFromNews}
          onAskAiLiveNews={onAskAiLiveNews}
          onDark
        />
      </div>
    </article>
  );
};

interface EditorialTextItemProps {
  story: LiveMarketNewsItem;
  watchlistSet: ReadonlySet<string>;
  todayWibKey?: string;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
  compact?: boolean;
}

const EditorialTextItem: React.FC<EditorialTextItemProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
  compact = false,
}) => {
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const formattedTime = formatNewsTimestamp(
    story.publishedAt,
    story.publishedWib,
    todayWibKey,
    compact
  );

  return (
    <article
      className={`flex flex-col justify-between pb-3.5 border-b-2 ${
        isWatchlistMatch
          ? "border-[#1E7B85] border-l-[3px] border-l-[#1E7B85] pl-3.5 bg-[#1E7B85]/[0.04]"
          : "border-[#1D1F23]"
      }`}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {renderCategoryTag(story.category)}
          {isWatchlistMatch && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
              <Star className="w-2.5 h-2.5 fill-white" />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        <h3
          className={`${
            compact
              ? "text-[15px] sm:text-base font-sans font-semibold leading-snug"
              : "text-lg sm:text-[20px] font-serif font-bold leading-[1.28]"
          } text-[#1D1F23]`}
          style={{ textWrap: "balance" }}
        >
          <a
            href={story.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1E7B85] transition-colors"
          >
            {story.title}
          </a>
        </h3>
      </div>

      <div className="space-y-1.5 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#676E7E]">
          <span>{formattedTime}</span>
          <span className="text-[#C5C7CE]">|</span>
          <span className="font-medium text-[#1D1F23]">{story.publisher}</span>
          {!compact && (
            <>
              <span className="text-[#C5C7CE]">|</span>
              {renderSentimentText(story.sentiment || "NEUTRAL")}
            </>
          )}
        </div>

        <EditorialCardActions
          story={story}
          watchlistSet={watchlistSet}
          onSelectStockFromNews={onSelectStockFromNews}
          onAskAiLiveNews={onAskAiLiveNews}
          compact={compact}
        />
      </div>
    </article>
  );
};

const BroadsheetNewsSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 pt-2 animate-pulse" aria-label="Memuat berita pasar modal terkini">
      <div className="border-b border-[#D5D7DC] pb-2">
        <div className="h-5 w-72 bg-[#E9E8E2]" />
      </div>

      {/* Lead Story Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        <div className="lg:col-span-5 flex flex-col justify-between pb-4 border-b-2 border-[#D5D7DC] space-y-4">
          <div className="space-y-3">
            <div className="h-3.5 w-32 bg-[#E9E8E2]" />
            <div className="h-8 w-full bg-[#E3E2DA]" />
            <div className="h-8 w-4/5 bg-[#E3E2DA]" />
            <div className="h-4 w-full bg-[#EFEFEA]" />
            <div className="h-4 w-5/6 bg-[#EFEFEA]" />
          </div>
          <div className="flex items-center justify-between pt-4">
            <div className="h-3.5 w-40 bg-[#E9E8E2]" />
            <div className="h-3.5 w-24 bg-[#E9E8E2]" />
          </div>
        </div>
        <div className="lg:col-span-7 aspect-[16/10] bg-[#E9E8E2]" />
      </div>

      {/* 3-Column Photo Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="space-y-3 pb-4 border-b-2 border-[#D5D7DC]">
            <div className="aspect-[3/2] bg-[#E9E8E2]" />
            <div className="h-3 w-28 bg-[#E9E8E2]" />
            <div className="h-5 w-full bg-[#E3E2DA]" />
            <div className="h-5 w-4/5 bg-[#E3E2DA]" />
            <div className="h-3.5 w-3/4 bg-[#EFEFEA]" />
          </div>
        ))}
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
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
  provider?: MarketProvider;
  macroTickers?: MarketTickerItem[];
  isMacroFallback?: boolean;
  isMacroLoading?: boolean;
  liveNewsItems?: LiveMarketNewsItem[];
  isLiveNewsLoading?: boolean;
  liveNewsUpdatedAtWib?: string;
  onRefreshLiveNews?: () => void;
  watchlistTickers?: string[];
  onOpenTerminalWatchlist?: () => void;
  aiMarketBrief?: LiveMarketBrief | null;
  aiBriefNotice?: string | null;
  isAiBriefLoading?: boolean;
  onRequestAiBrief?: (items: LiveMarketNewsItem[], macroTickers: MarketTickerItem[]) => void;
}

export const NewsView: React.FC<NewsViewProps> = ({
  onSelectStockFromNews,
  onAskAiLiveNews,
  provider = "illustrative",
  macroTickers = [],
  isMacroFallback = false,
  isMacroLoading = false,
  liveNewsItems = [],
  isLiveNewsLoading = false,
  liveNewsUpdatedAtWib = "",
  onRefreshLiveNews,
  watchlistTickers = [],
  onOpenTerminalWatchlist,
  aiMarketBrief = null,
  aiBriefNotice = null,
  isAiBriefLoading = false,
  onRequestAiBrief,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NewsFilterCategory>("ALL");
  const [selectedSentiment, setSelectedSentiment] = useState<NewsFilterSentiment>("ALL");
  const [onlyWatchlist, setOnlyWatchlist] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMarketSummaryExpanded, setIsMarketSummaryExpanded] = useState<boolean>(false);
  const [showAllCompactStories, setShowAllCompactStories] = useState<boolean>(false);
  const [todayWibKey] = useState<string>(() => getJakartaDateKey(new Date()));

  const handleRetryLiveNews = useCallback(() => {
    setShowAllCompactStories(false);
    onRefreshLiveNews?.();
  }, [onRefreshLiveNews]);

  const resetFilters = useCallback(() => {
    setSelectedCategory("ALL");
    setSelectedSentiment("ALL");
    setOnlyWatchlist(false);
    setSearchQuery("");
    setShowAllCompactStories(false);
  }, []);

  const watchlistSet = useMemo(
    () => new Set(watchlistTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
    [watchlistTickers]
  );

  const hasActiveFilters =
    selectedCategory !== "ALL" ||
    selectedSentiment !== "ALL" ||
    onlyWatchlist ||
    searchQuery.trim().length > 0;

  const liveWatchlistCount = useMemo(() => {
    if (watchlistSet.size === 0) return 0;
    return liveNewsItems.filter((item) => item.tickers.some((t) => watchlistSet.has(t))).length;
  }, [liveNewsItems, watchlistSet]);

  const categoryCounts = useMemo(
    () =>
      computeNewsCategoryCounts(liveNewsItems, {
        sentiment: selectedSentiment,
        onlyWatchlist,
        watchlistSet,
        searchQuery,
      }),
    [liveNewsItems, selectedSentiment, onlyWatchlist, watchlistSet, searchQuery]
  );

  const filteredLiveNews = useMemo(
    () =>
      filterLiveNewsItems(liveNewsItems, {
        category: selectedCategory,
        sentiment: selectedSentiment,
        onlyWatchlist,
        watchlistSet,
        searchQuery,
      }),
    [liveNewsItems, selectedCategory, selectedSentiment, onlyWatchlist, watchlistSet, searchQuery]
  );

  const deterministicBrief = useMemo(
    () => buildLiveMarketBrief(liveNewsItems, macroTickers),
    [liveNewsItems, macroTickers]
  );
  const activeBrief = aiMarketBrief || deterministicBrief;

  const editorialBuckets = useMemo(
    () => allocateEditorialBuckets(filteredLiveNews, watchlistSet),
    [filteredLiveNews, watchlistSet]
  );

  const visibleCompactStories = showAllCompactStories
    ? editorialBuckets.compactStories
    : editorialBuckets.compactStories.slice(0, 8);
  const hiddenCompactCount = Math.max(0, editorialBuckets.compactStories.length - 8);

  return (
    <div className="w-full text-[#1D1F23] font-sans">
      <div className="max-w-7xl mx-auto py-5 space-y-5">
        {/* Compact Broadsheet Masthead */}
        <div className="border-b-2 border-[#1D1F23] pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#1D1F23] tracking-tight leading-tight">
              Warta pasar modal &amp; makro terkini
            </h1>
            <p className="text-xs sm:text-sm text-[#676E7E]">
              Sari berita Bursa Efek Indonesia dari CNBC Indonesia, ANTARA Ekonomi &amp; Google News IDX.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 text-xs text-[#676E7E]">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  provider === "yahoo" ? "bg-[#2EB886]" : "bg-[#848B99]"
                }`}
              />
              <span>
                {filteredLiveNews.length} berita
                {liveNewsUpdatedAtWib ? ` • ${liveNewsUpdatedAtWib}` : ""}
              </span>
              {provider === "yahoo" && (
                <button
                  type="button"
                  onClick={handleRetryLiveNews}
                  disabled={isLiveNewsLoading}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#F4F3EE] hover:bg-[#E5E5DC] text-[#1D1F23] border border-[#D5D7DC] text-xs font-medium transition disabled:opacity-50"
                  title="Muat ulang berita pasar terkini"
                >
                  <RotateCcw
                    className={`w-3 h-3 text-[#1E7B85] ${isLiveNewsLoading ? "animate-spin" : ""}`}
                  />
                  <span>Segarkan</span>
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#848B99]" />
              <input
                id="news-search-input"
                name="newsSearch"
                type="text"
                aria-label="Cari berita atau kode saham"
                placeholder="Cari berita atau kode saham..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowAllCompactStories(false);
                }}
                className="w-full h-[38px] pl-9 pr-8 bg-[#FBFBFA] border border-[#D5D7DC] rounded-none text-xs text-[#1D1F23] placeholder-[#848B99] focus:outline-none focus:border-[#1E7B85]"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowAllCompactStories(false);
                  }}
                  aria-label="Bersihkan pencarian berita"
                  className="p-1 absolute right-1.5 top-1/2 -translate-y-1/2 text-[#848B99] hover:text-[#1D1F23] transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Embedded Sharp Macro Ticker Strip */}
        <MarketTicker
          provider={provider}
          tickers={macroTickers}
          isMacroFallback={isMacroFallback}
          isLoading={isMacroLoading}
          theme="light"
          embedded
          sharp
        />

        {/* Compact Collapsible "Ringkasan Pasar Hari Ini" + Expandable Quote-Break Editorial Band */}
        {provider === "yahoo" && liveNewsItems.length > 0 && (
          <div className="bg-[#F4F3EE] border border-[#E5E5DC] border-l-[3px] border-l-[#1E7B85] px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-[#1E7B85] text-white inline-flex items-center justify-center shrink-0">
                  <Quote className="w-2.5 h-2.5" />
                </span>
                <span className="font-serif font-bold text-sm text-[#1D1F23]">
                  Ringkasan pasar hari ini
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                    activeBrief.source === "gemini"
                      ? "bg-[#1E7B85]/12 text-[#1E7B85] border-[#1E7B85]/30"
                      : "bg-[#FBFBFA] text-[#676E7E] border-[#D5D7DC]"
                  }`}
                >
                  {activeBrief.source === "gemini"
                    ? `AI (${activeBrief.model || "flash"})`
                    : "Sintesis otomatis"}
                </span>
                <span className="text-[11px] text-[#676E7E] tnum">
                  {activeBrief.sentimentCounts.bullish} positif &bull;{" "}
                  {activeBrief.sentimentCounts.bearish} negatif &bull;{" "}
                  {activeBrief.sentimentCounts.neutral} netral
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isMarketSummaryExpanded && activeBrief.topTickers.length > 0 && (
                  <div className="hidden md:flex items-center gap-1 font-mono tnum">
                    <span className="text-[11px] text-[#676E7E] font-sans mr-0.5">Disorot:</span>
                    {activeBrief.topTickers.slice(0, 4).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onSelectStockFromNews(t, "", activeBrief.headline)}
                        className="px-1.5 py-0.5 bg-[#FBFBFA] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border border-[#D5D7DC] text-[11px] font-semibold transition"
                        title={`Buka ${t} di Terminal`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {onRequestAiBrief && activeBrief.source !== "gemini" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMarketSummaryExpanded(true);
                      onRequestAiBrief(liveNewsItems, macroTickers);
                    }}
                    disabled={isAiBriefLoading}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#FBFBFA] hover:bg-[#E5E5DC] text-[#1E7B85] border border-[#D5D7DC] font-semibold text-[11px] transition disabled:opacity-60"
                  >
                    <Sparkles className={`w-3 h-3 ${isAiBriefLoading ? "animate-pulse" : ""}`} />
                    <span>{isAiBriefLoading ? "Meringkas..." : "Ringkas AI"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsMarketSummaryExpanded((prev) => !prev)}
                  className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-[#1D1F23] hover:text-[#1E7B85] transition"
                >
                  <span>{isMarketSummaryExpanded ? "Tutup ringkasan" : "Lihat ringkasan"}</span>
                  {isMarketSummaryExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {isMarketSummaryExpanded && (
              <div className="mt-3 pt-3 border-t border-[#D5D7DC] space-y-2.5">
                <p className="text-sm italic text-[#1D1F23] leading-relaxed font-sans max-w-4xl">
                  &ldquo;{activeBrief.summary}&rdquo;
                </p>

                {activeBrief.topTickers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#676E7E]">
                    <span>Banyak disorot hari ini:</span>
                    <div className="flex flex-wrap items-center gap-1 font-mono tnum">
                      {activeBrief.topTickers.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => onSelectStockFromNews(t, "", activeBrief.headline)}
                          className="px-1.5 py-0.5 bg-[#FBFBFA] hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border border-[#D5D7DC] font-semibold transition"
                          title={`Buka ${t} di Terminal`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiBriefNotice && (
                  <p className="text-[11px] text-[#848B99]">{aiBriefNotice}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Minimal Broadsheet Filter Bar (Underline Category Tabs + Watchlist + Sentiment) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5D7DC] text-xs">
          <div className="w-full md:w-auto flex items-center gap-x-4 sm:gap-x-5 overflow-x-auto scrollbar-none news-tabs-fade pr-5 md:pr-0">
            {[
              { id: "ALL", label: "Semua" },
              { id: "CORPORATE", label: "Korporasi & bursa" },
              { id: "MONETARY_CURRENCY", label: "Moneter dan FX" },
              { id: "GLOBAL_MACRO", label: "Makro global" },
              { id: "DOMESTIC_POLITICS", label: "Politik dan fiskal" },
              { id: "COMMODITIES", label: "Komoditas & energi" },
            ].map((cat) => {
              const count = categoryCounts[cat.id as keyof typeof categoryCounts] ?? 0;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id as NewsFilterCategory);
                    setShowAllCompactStories(false);
                  }}
                  className={`min-h-[42px] inline-flex items-center gap-1.5 px-0.5 transition whitespace-nowrap border-b-2 -mb-px ${
                    isSelected
                      ? "text-[#1D1F23] font-bold border-[#1E7B85]"
                      : count === 0
                      ? "text-[#848B99]/70 hover:text-[#676E7E] font-medium border-transparent"
                      : "text-[#676E7E] hover:text-[#1D1F23] font-medium border-transparent"
                  }`}
                >
                  <span>{cat.label}</span>
                  {liveNewsItems.length > 0 && (
                    <span
                      className={`font-mono text-[10px] tnum ${
                        isSelected
                          ? "text-[#1E7B85]"
                          : count === 0
                          ? "text-[#848B99]/60"
                          : "text-[#848B99]"
                      }`}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2">
            {watchlistSet.size > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setOnlyWatchlist((prev) => !prev);
                  setShowAllCompactStories(false);
                }}
                className={`h-[34px] inline-flex items-center space-x-1.5 px-2.5 border text-[11px] font-semibold transition ${
                  onlyWatchlist
                    ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                    : "bg-[#F4F3EE] text-[#1D1F23] hover:border-[#1E7B85] border-[#D5D7DC]"
                }`}
                title="Saring hanya berita saham Watchlist Saya"
              >
                <Bookmark className="w-3 h-3" />
                <span>Watchlist ({liveWatchlistCount})</span>
              </button>
            ) : (
              onOpenTerminalWatchlist && (
                <button
                  type="button"
                  onClick={onOpenTerminalWatchlist}
                  className="h-[34px] inline-flex items-center space-x-1.5 px-2.5 border border-[#D5D7DC] bg-[#F4F3EE] hover:border-[#1E7B85] text-[#676E7E] hover:text-[#1E7B85] text-[11px] font-medium transition"
                  title="Pilih saham favorit di Watchlist Terminal agar beritanya diprioritaskan di sini"
                >
                  <Star className="w-3 h-3 text-[#1E7B85]" />
                  <span>Atur Watchlist</span>
                </button>
              )
            )}

            <div className="flex items-center bg-[#F4F3EE] border border-[#D5D7DC] text-[11px]">
              {[
                { id: "ALL", label: "Semua", title: "Tampilkan semua sentimen" },
                { id: "BULLISH", label: "Positif", title: "Hanya berita sentimen positif" },
                { id: "BEARISH", label: "Negatif", title: "Hanya berita sentimen negatif" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.title}
                  onClick={() => {
                    setSelectedSentiment(opt.id as NewsFilterSentiment);
                    setShowAllCompactStories(false);
                  }}
                  className={`h-[32px] px-2.5 font-medium transition ${
                    selectedSentiment === opt.id
                      ? "bg-[#1E7B85] text-white font-semibold"
                      : "text-[#676E7E] hover:text-[#1D1F23]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KONTEN BERITA BROADSHEET */}
        {provider !== "yahoo" ? (
          <div className="py-12 px-4 text-center space-y-2 text-xs text-[#676E7E] border border-[#E5E5DC] bg-[#F4F3EE]">
            <p className="font-serif font-bold text-base text-[#1D1F23]">
              Mode data ilustrasi sedang aktif
            </p>
            <p className="max-w-md mx-auto">
              Feed berita RSS pasar modal real-time (CNBC Indonesia, ANTARA Ekonomi &amp; Google News IDX) aktif ketika penyedia data Yahoo Finance diaktifkan.
            </p>
          </div>
        ) : isLiveNewsLoading && liveNewsItems.length === 0 ? (
          <BroadsheetNewsSkeleton />
        ) : filteredLiveNews.length === 0 ? (
          <div className="py-12 text-center space-y-3 text-xs text-[#676E7E] border border-[#E5E5DC] bg-[#F4F3EE]">
            <p>
              {liveNewsItems.length === 0
                ? "Berita pasar terkini belum dapat dimuat dari sumber RSS saat ini."
                : "Tidak ada berita terkini yang cocok dengan filter pencarian Anda."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {liveNewsItems.length === 0 ? (
                <button
                  type="button"
                  onClick={handleRetryLiveNews}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#FBFBFA] hover:bg-[#E5E5DC] text-[#1D1F23] border border-[#D5D7DC] transition font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#1E7B85]" />
                  <span>Coba Lagi</span>
                </button>
              ) : (
                hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center px-3.5 py-2 bg-[#FBFBFA] hover:bg-[#1D1F23] hover:text-white text-[#1D1F23] border border-[#1D1F23] transition font-medium"
                  >
                    Reset filter
                  </button>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-10 pt-1">
            {/* Band 1: Section Intro & Asymmetric Lead Broadsheet Story */}
            {editorialBuckets.leadStory && (
              <section className="space-y-6">
                <div className="border-b border-[#D5D7DC] pb-2 flex items-center justify-between gap-2">
                  <p className="text-base sm:text-lg italic text-[#676E7E]">
                    Sorotan{" "}
                    <strong className="text-[#1D1F23] font-semibold">
                      pasar modal &amp; makro utama
                    </strong>
                    <span className="text-[#1E7B85] font-bold"> :</span>
                  </p>
                </div>

                <LeadBroadsheetHero
                  key={editorialBuckets.leadStory.id}
                  story={editorialBuckets.leadStory}
                  watchlistSet={watchlistSet}
                  todayWibKey={todayWibKey}
                  onSelectStockFromNews={onSelectStockFromNews}
                  onAskAiLiveNews={onAskAiLiveNews}
                />

                {/* 3-Column Image-Top Grid ("Sorotan pasar pilihan") */}
                {editorialBuckets.gridStories.length > 0 && (
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-7 gap-y-8">
                    {editorialBuckets.gridStories.map((story) => (
                      <EditorialGridCard
                        key={story.id}
                        story={story}
                        watchlistSet={watchlistSet}
                        todayWibKey={todayWibKey}
                        onSelectStockFromNews={onSelectStockFromNews}
                        onAskAiLiveNews={onAskAiLiveNews}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Band 2 (Warm Stone Background): Tall Photo Highlight + Stacked Text Feed + 4-Col Compact Headlines */}
            {(editorialBuckets.overlayStory ||
              editorialBuckets.stackedStories.length > 0 ||
              editorialBuckets.compactStories.length > 0) && (
              <section className="bg-[#F4F3EE] border-y border-[#E5E5DC] px-4 sm:px-7 py-7 space-y-8">
                <div className="border-b border-[#D5D7DC] pb-2">
                  <p className="text-base sm:text-lg italic text-[#676E7E]">
                    Dinamika emiten &amp;{" "}
                    <strong className="text-[#1D1F23] font-semibold">warta terbaru lainnya</strong>
                    <span className="text-[#1E7B85] font-bold"> :</span>
                  </p>
                </div>

                {/* Split Row: Left 1/3 Dark Photo Overlay Card + Right 2/3 Stacked Text Editorial List */}
                {(editorialBuckets.overlayStory || editorialBuckets.stackedStories.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
                    {editorialBuckets.overlayStory && (
                      <div className="lg:col-span-4">
                        <EditorialOverlayFeature
                          key={editorialBuckets.overlayStory.id}
                          story={editorialBuckets.overlayStory}
                          watchlistSet={watchlistSet}
                          todayWibKey={todayWibKey}
                          onSelectStockFromNews={onSelectStockFromNews}
                          onAskAiLiveNews={onAskAiLiveNews}
                        />
                      </div>
                    )}

                    {editorialBuckets.stackedStories.length > 0 && (
                      <div
                        className={`${
                          editorialBuckets.overlayStory
                            ? "lg:col-span-8 flex flex-col justify-between space-y-5"
                            : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
                        }`}
                      >
                        {editorialBuckets.stackedStories.map((story) => (
                          <EditorialTextItem
                            key={story.id}
                            story={story}
                            watchlistSet={watchlistSet}
                            todayWibKey={todayWibKey}
                            onSelectStockFromNews={onSelectStockFromNews}
                            onAskAiLiveNews={onAskAiLiveNews}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Row: 4-Column Compact Headline Strip */}
                {editorialBuckets.compactStories.length > 0 && (
                  <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
                      {visibleCompactStories.map((story) => (
                        <EditorialTextItem
                          key={story.id}
                          story={story}
                          watchlistSet={watchlistSet}
                          todayWibKey={todayWibKey}
                          onSelectStockFromNews={onSelectStockFromNews}
                          onAskAiLiveNews={onAskAiLiveNews}
                          compact
                        />
                      ))}
                    </div>

                    {editorialBuckets.compactStories.length > 8 && (
                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAllCompactStories((prev) => !prev)}
                          className="px-6 py-2.5 border border-[#1D1F23] bg-[#FBFBFA] hover:bg-[#1D1F23] text-[#1D1F23] hover:text-white text-xs font-semibold tracking-wide transition"
                        >
                          {showAllCompactStories
                            ? "Ringkas daftar berita"
                            : `Tampilkan ${hiddenCompactCount} berita lainnya`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
