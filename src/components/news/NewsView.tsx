"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useDeferredValue,
  useRef,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
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
  buildMarketQaInsights,
  computeNewsCategoryCounts,
  computeNewsPublisherCounts,
  countTodayNewsItems,
  filterLiveNewsItems,
  isNewsFromToday,
  type LiveMarketBrief,
  type NewsPublisherGroup,
  type NewsTimeRange,
} from "@/lib/news-brief";
import {
  getNewsBookmarksServerSnapshot,
  parseNewsBookmarksJson,
  readNewsBookmarksStorageSnapshot,
  resolveBookmarkedNewsPool,
  subscribeNewsBookmarksStorage,
  toggleNewsBookmark,
  writeNewsBookmarksStorage,
} from "@/lib/news-bookmarks";
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
  X,
  ArrowUp,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import {
  CountUpNumber,
  EASE_PREMIUM,
  EditorialReveal,
  EditorialTiltFrame,
  MagneticButton,
  NewsScrollProgressBar,
  ParallaxMediaFrame,
  SPRING_INDICATOR,
  SpotlightSurface,
} from "./newsMotion";
import { NewsAmbientBackground } from "./NewsAmbientBackground";
import { MarketBriefPanel } from "./MarketBriefPanel";
import { MarketQaAccordion } from "./MarketQaAccordion";
import { WireHoverPreview } from "./WireHoverPreview";
import { NewsFloatingDock } from "./NewsFloatingDock";
import { NewsReaderDrawer } from "./NewsReaderDrawer";

type NewsFilterCategory = "ALL" | MacroCategory | "CORPORATE";
type NewsFilterSentiment = "ALL" | SentimentType;

const INITIAL_WIRE_VISIBLE_COUNT = 12;

const PUBLISHER_PILLS: readonly { id: NewsPublisherGroup; label: string }[] = [
  { id: "ALL", label: "Semua media" },
  { id: "CNBC", label: "CNBC" },
  { id: "ANTARA", label: "ANTARA" },
  { id: "CNN", label: "CNN" },
  { id: "KONTAN", label: "Kontan" },
  { id: "OTHER", label: "Lainnya" },
];

function renderCategoryTag(
  category: MacroCategory | "CORPORATE",
  onDark = false
) {
  const iconClass = "w-3.5 h-3.5 shrink-0";
  let icon: React.ReactNode = <Newspaper className={iconClass} aria-hidden="true" />;
  if (category === "CORPORATE") icon = <Building2 className={iconClass} aria-hidden="true" />;
  else if (category === "MONETARY_CURRENCY") icon = <Landmark className={iconClass} aria-hidden="true" />;
  else if (category === "GLOBAL_MACRO") icon = <Globe className={iconClass} aria-hidden="true" />;
  else if (category === "DOMESTIC_POLITICS") icon = <Scale className={iconClass} aria-hidden="true" />;
  else if (category === "COMMODITIES") icon = <Flame className={iconClass} aria-hidden="true" />;

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
  publisher: string;
  sourceDomain?: string;
  variant: "lead" | "grid" | "thumb" | "wire";
  onOpenPreview?: () => void;
  onErrorFallback?: () => void;
}

const NewsArticleImage: React.FC<NewsArticleImageProps> = ({
  src,
  alt,
  publisher,
  sourceDomain,
  variant,
  onOpenPreview,
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
      <figure className="h-full flex flex-col overflow-hidden bg-[#E9E8E2] border border-[#E5E5DC]">
        <button
          type="button"
          onClick={onOpenPreview}
          aria-label={`Buka pratinjau cepat: ${alt}`}
          className="relative block flex-1 min-h-0 group overflow-hidden text-left w-full"
        >
          <ParallaxMediaFrame offsetPx={15} className="w-full aspect-[16/10] lg:h-full lg:max-h-[390px]">
            {/* Dynamic RSS CDN hosts vary by publisher; native img prevents remotePatterns errors */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              loading="eager"
              referrerPolicy="no-referrer"
              onError={handleError}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
            />
          </ParallaxMediaFrame>
          <span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#1D1F23]/85 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200">
            <Eye className="w-3 h-3 text-[#5EEAD4]" aria-hidden="true" />
            <span>Pratinjau cepat</span>
          </span>
        </button>
        <figcaption className="px-3 py-1.5 text-[11px] text-[#676E7E] bg-[#F4F3EE] border-t border-[#E5E5DC] flex items-center justify-between gap-2">
          <span>Foto: {publisher}</span>
          {sourceDomain && <span className="font-mono text-[#848B99]">{sourceDomain}</span>}
        </figcaption>
      </figure>
    );
  }

  if (variant === "thumb") {
    return (
      <button
        type="button"
        onClick={onOpenPreview}
        aria-label={`Pratinjau foto berita: ${alt}`}
        className="block shrink-0 w-28 sm:w-36 aspect-[3/2] overflow-hidden bg-[#E9E8E2] border border-[#E5E5DC] group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleError}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
        />
      </button>
    );
  }

  if (variant === "wire") {
    return (
      <button
        type="button"
        onClick={onOpenPreview}
        aria-label={`Pratinjau berita: ${alt}`}
        className="block shrink-0 w-20 sm:w-24 aspect-[3/2] overflow-hidden bg-[#E9E8E2] border border-[#E5E5DC] group"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleError}
          className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-300"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenPreview}
      aria-label={`Pratinjau cepat: ${alt}`}
      className="relative block w-full overflow-hidden bg-[#E9E8E2] border border-[#E5E5DC] group text-left"
    >
      <ParallaxMediaFrame offsetPx={9} className="w-full aspect-[3/2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleError}
          className="w-full h-full object-cover group-hover:scale-[1.035] transition-transform duration-500 ease-out"
        />
      </ParallaxMediaFrame>
      <span className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 bg-[#1D1F23]/80 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200">
        <Eye className="w-2.5 h-2.5 text-[#5EEAD4]" aria-hidden="true" />
        <span>Pratinjau</span>
      </span>
    </button>
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
  onOpenPreview: (story: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (story: LiveMarketNewsItem) => void;
  onDark?: boolean;
  compact?: boolean;
}

const EditorialCardActions: React.FC<EditorialCardActionsProps> = ({
  story,
  watchlistSet,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onOpenPreview,
  isBookmarked = false,
  onToggleBookmark,
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
              className={`px-1.5 py-0.5 border text-[11px] font-semibold transition active:scale-95 ${
                onDark
                  ? isMatchedTicker
                    ? "bg-[#1E7B85] text-white border-[#2DD4BF]/60"
                    : "bg-white/10 hover:bg-[#1E7B85] text-white border-white/25"
                  : isMatchedTicker
                  ? "bg-[#1E7B85]/12 hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border-[#1E7B85]/50"
                  : "bg-[#F4F3EE] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border-[#D5D7DC] hover:border-[#1E7B85]"
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

      <div className="flex items-center gap-2.5 text-[11px]">
        {onToggleBookmark && (
          <button
            type="button"
            aria-pressed={isBookmarked}
            onClick={() => onToggleBookmark(story)}
            title={isBookmarked ? "Hapus dari tersimpan" : "Simpan berita"}
            aria-label={isBookmarked ? "Hapus dari tersimpan" : "Simpan berita"}
            className={`inline-flex items-center space-x-1 font-medium transition ${
              onDark
                ? isBookmarked
                  ? "text-[#5EEAD4]"
                  : "text-white/75 hover:text-white"
                : isBookmarked
                ? "text-[#1E7B85] font-semibold"
                : "text-[#676E7E] hover:text-[#1E7B85]"
            }`}
          >
            <Bookmark
              className={`w-3 h-3 ${
                isBookmarked ? (onDark ? "fill-[#5EEAD4]" : "fill-[#1E7B85]") : ""
              }`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">{isBookmarked ? "Tersimpan" : "Simpan"}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenPreview(story)}
          className={`inline-flex items-center space-x-1 font-medium hover:underline ${
            onDark ? "text-white/90 hover:text-white" : "text-[#4E5563] hover:text-[#1E7B85]"
          }`}
        >
          <Eye className="w-3 h-3" aria-hidden="true" />
          <span>Pratinjau</span>
        </button>

        {onAskAiLiveNews && (
          <button
            type="button"
            onClick={() => onAskAiLiveNews(story)}
            className={`inline-flex items-center space-x-1 font-semibold hover:underline ${
              onDark ? "text-[#5EEAD4]" : "text-[#1E7B85]"
            }`}
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            <span>Bedah AI</span>
          </button>
        )}

        <a
          href={story.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`group/ext inline-flex items-center space-x-0.5 hover:underline ${
            onDark ? "text-white/80 hover:text-white" : "text-[#676E7E] hover:text-[#1D1F23]"
          }`}
        >
          <span>Baca</span>
          <ExternalLink
            className="w-3 h-3 group-hover/ext:translate-x-0.5 group-hover/ext:-translate-y-0.5 transition-transform"
            aria-hidden="true"
          />
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
  onOpenPreview: (story: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (story: LiveMarketNewsItem) => void;
}

const LeadBroadsheetHero: React.FC<LeadBroadsheetHeroProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onOpenPreview,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(story.imageUrl && !imageFailed);
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const isToday = isNewsFromToday(story, todayWibKey);
  const formattedTime = formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey);

  return (
    <article className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch group/lead">
      <SpotlightSurface
        className={`${
          showImage ? "lg:col-span-5" : "lg:col-span-12 max-w-4xl"
        } flex flex-col justify-between pb-4 pt-2 px-3 -mx-3 sm:mx-0 border-b-2 transition-colors ${
          isWatchlistMatch
            ? "border-[#1E7B85] border-l-[3px] border-l-[#1E7B85] pl-4 bg-[#1E7B85]/[0.05]"
            : "border-[#1D1F23] group-hover/lead:border-[#1E7B85] bg-[#FBFBFA]/80 backdrop-blur-[1px]"
        }`}
      >
        <div className="relative z-10 space-y-3.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {renderCategoryTag(story.category)}
              {isToday && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1E7B85]/10 text-[#1E7B85] border border-[#1E7B85]/25 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2EB886]" aria-hidden="true" />
                  Baru
                </span>
              )}
            </div>
            {isWatchlistMatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
                <Star className="w-2.5 h-2.5 fill-white" aria-hidden="true" />
                <span>Watchlist</span>
              </span>
            )}
          </div>

          <h2
            className="text-2xl sm:text-3xl lg:text-[36px] font-serif font-bold text-[#1D1F23] leading-[1.16]"
            style={{ textWrap: "balance" }}
          >
            <button
              type="button"
              onClick={() => onOpenPreview(story)}
              className="text-left editorial-link-sweep hover:text-[#1E7B85] transition-colors"
            >
              {story.title}
            </button>
          </h2>

          {story.summary && (
            <p className="text-[15px] sm:text-base text-[#4E5563] leading-[1.65] line-clamp-5">
              {story.summary}
            </p>
          )}
        </div>

        <div className="relative z-10 space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#676E7E]">
            <span className="font-mono text-[11px] tnum">{formattedTime}</span>
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
            onOpenPreview={onOpenPreview}
            isBookmarked={isBookmarked}
            onToggleBookmark={onToggleBookmark}
          />
        </div>
      </SpotlightSurface>

      {showImage && story.imageUrl && (
        <EditorialTiltFrame className="lg:col-span-7">
          <NewsArticleImage
            key={story.imageUrl}
            src={story.imageUrl}
            alt={story.title}
            publisher={story.publisher}
            sourceDomain={story.sourceDomain}
            variant="lead"
            onOpenPreview={() => onOpenPreview(story)}
            onErrorFallback={() => setImageFailed(true)}
          />
        </EditorialTiltFrame>
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
  onOpenPreview: (story: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (story: LiveMarketNewsItem) => void;
}

const EditorialGridCard: React.FC<EditorialGridCardProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onOpenPreview,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const isToday = isNewsFromToday(story, todayWibKey);
  const formattedTime = formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey);

  return (
    <motion.article
      whileHover={shouldReduceMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.24, ease: EASE_PREMIUM }}
      className="h-full"
    >
      <SpotlightSurface
        className={`group h-full flex flex-col justify-between pb-4 pt-1.5 px-2 -mx-2 sm:mx-0 border-b-2 transition-colors ${
          isWatchlistMatch
            ? "border-[#1E7B85] border-l-[3px] border-l-[#1E7B85] pl-3.5 bg-[#1E7B85]/[0.05]"
            : "border-[#1D1F23] hover:border-[#1E7B85] bg-[#FBFBFA]/82 backdrop-blur-[1px]"
        }`}
      >
        <div className="relative z-10 space-y-3">
          {story.imageUrl && (
            <NewsArticleImage
              src={story.imageUrl}
              alt={story.title}
              publisher={story.publisher}
              sourceDomain={story.sourceDomain}
              variant="grid"
              onOpenPreview={() => onOpenPreview(story)}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              {renderCategoryTag(story.category)}
              {isToday && (
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1E7B85]">
                  &bull; Baru
                </span>
              )}
            </div>
            {isWatchlistMatch && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
                <Star className="w-2.5 h-2.5 fill-white" aria-hidden="true" />
                <span>Watchlist</span>
              </span>
            )}
          </div>

          <h3
            className="text-lg sm:text-[21px] font-serif font-bold text-[#1D1F23] leading-[1.28]"
            style={{ textWrap: "balance" }}
          >
            <button
              type="button"
              onClick={() => onOpenPreview(story)}
              className="text-left editorial-link-sweep hover:text-[#1E7B85] transition-colors"
            >
              {story.title}
            </button>
          </h3>

          {story.summary && (
            <p className="text-xs sm:text-[13px] text-[#676E7E] leading-relaxed line-clamp-3">
              {story.summary}
            </p>
          )}
        </div>

        <div className="relative z-10 space-y-2 pt-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#676E7E]">
            <span className="font-mono text-[10.5px] tnum">{formattedTime}</span>
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
            onOpenPreview={onOpenPreview}
            isBookmarked={isBookmarked}
            onToggleBookmark={onToggleBookmark}
          />
        </div>
      </SpotlightSurface>
    </motion.article>
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
  onOpenPreview: (story: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (story: LiveMarketNewsItem) => void;
}

const EditorialOverlayFeature: React.FC<EditorialOverlayFeatureProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onOpenPreview,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const shouldReduceMotion = useReducedMotion();
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
        onOpenPreview={onOpenPreview}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
      />
    );
  }

  return (
    <motion.article
      whileHover={shouldReduceMotion ? undefined : { y: -3 }}
      transition={{ duration: 0.28, ease: EASE_PREMIUM }}
      className="h-full"
    >
      <SpotlightSurface
        tone="dark"
        className={`relative min-h-[360px] lg:min-h-[430px] h-full flex flex-col justify-end overflow-hidden bg-[#1D1F23] group ${
          isWatchlistMatch ? "ring-2 ring-inset ring-[#1E7B85]" : ""
        }`}
      >
        <ParallaxMediaFrame offsetPx={16} className="absolute inset-0 w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.imageUrl}
            alt={story.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover opacity-75 group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        </ParallaxMediaFrame>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1D1F23] via-[#1D1F23]/65 to-[#1D1F23]/20" />

        <div className="relative z-10 p-5 space-y-3 text-white">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {renderCategoryTag(story.category, true)}
            {isWatchlistMatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
                <Star className="w-2.5 h-2.5 fill-white" aria-hidden="true" />
                <span>Watchlist</span>
              </span>
            )}
          </div>

          <h3
            className="text-xl sm:text-2xl font-serif font-bold text-white leading-snug"
            style={{ textWrap: "balance" }}
          >
            <button
              type="button"
              onClick={() => onOpenPreview(story)}
              className="text-left hover:text-[#5EEAD4] transition-colors"
            >
              {story.title}
            </button>
          </h3>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/80">
            <span className="font-mono text-[10.5px] tnum">{formattedTime}</span>
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
            onOpenPreview={onOpenPreview}
            isBookmarked={isBookmarked}
            onToggleBookmark={onToggleBookmark}
            onDark
          />
        </div>
      </SpotlightSurface>
    </motion.article>
  );
};

interface EditorialStackedItemProps {
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
  onOpenPreview: (story: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (story: LiveMarketNewsItem) => void;
}

/**
 * Item editorial bertumpuk di Band 2 — menampilkan thumbnail foto di sisi kanan jika tersedia
 * sehingga lebih banyak berita bergambar terlihat langsung.
 */
const EditorialStackedItem: React.FC<EditorialStackedItemProps> = ({
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onOpenPreview,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const isToday = isNewsFromToday(story, todayWibKey);
  const formattedTime = formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey);

  return (
    <article
      className={`group flex items-start justify-between gap-4 pb-4 border-b border-[#D5D7DC] hover:border-[#1E7B85] transition-colors ${
        isWatchlistMatch
          ? "border-l-[3px] border-l-[#1E7B85] pl-3.5 bg-[#1E7B85]/[0.04] py-2 pr-2"
          : ""
      }`}
    >
      <div className="min-w-0 flex-1 flex flex-col justify-between space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {renderCategoryTag(story.category)}
            {isToday && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#1E7B85]">
                &bull; Baru
              </span>
            )}
          </div>
          {isWatchlistMatch && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
              <Star className="w-2.5 h-2.5 fill-white" aria-hidden="true" />
              <span>Watchlist</span>
            </span>
          )}
        </div>

        <h3
          className="text-lg sm:text-[19px] font-serif font-bold text-[#1D1F23] leading-[1.28]"
          style={{ textWrap: "balance" }}
        >
          <button
            type="button"
            onClick={() => onOpenPreview(story)}
            className="text-left editorial-link-sweep hover:text-[#1E7B85] transition-colors"
          >
            {story.title}
          </button>
        </h3>

        {story.summary && (
          <p className="text-xs text-[#676E7E] leading-relaxed line-clamp-2">{story.summary}</p>
        )}

        <div className="space-y-1.5 pt-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#676E7E]">
            <span className="font-mono text-[10.5px] tnum">{formattedTime}</span>
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
            onOpenPreview={onOpenPreview}
            isBookmarked={isBookmarked}
            onToggleBookmark={onToggleBookmark}
          />
        </div>
      </div>

      {story.imageUrl && (
        <NewsArticleImage
          src={story.imageUrl}
          alt={story.title}
          publisher={story.publisher}
          sourceDomain={story.sourceDomain}
          variant="thumb"
          onOpenPreview={() => onOpenPreview(story)}
        />
      )}
    </article>
  );
};

interface EditorialWireRowProps {
  index: number;
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
  onOpenPreview: (story: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (story: LiveMarketNewsItem) => void;
  isKeyboardFocused?: boolean;
  onHoverStart?: (story: LiveMarketNewsItem) => void;
  onHoverEnd?: () => void;
}

/**
 * Baris indeks editorial 4-kolom terinspirasi pola 07 / PROCESS NewMinds:
 * Index + Waktu | Foto Thumbnail & Tajuk | Emiten & Penerbit | Aksi + Arrow micro-slide
 */
const EditorialWireRow: React.FC<EditorialWireRowProps> = ({
  index,
  story,
  watchlistSet,
  todayWibKey,
  onSelectStockFromNews,
  onAskAiLiveNews,
  onOpenPreview,
  isBookmarked = false,
  onToggleBookmark,
  isKeyboardFocused = false,
  onHoverStart,
  onHoverEnd,
}) => {
  const isWatchlistMatch =
    watchlistSet.size > 0 && story.tickers.some((t) => watchlistSet.has(t));
  const isToday = isNewsFromToday(story, todayWibKey);
  const formattedTime = formatNewsTimestamp(
    story.publishedAt,
    story.publishedWib,
    todayWibKey,
    true
  );

  return (
    <article
      data-wire-index={index}
      onMouseEnter={() => onHoverStart?.(story)}
      onMouseLeave={() => onHoverEnd?.()}
      className={`group relative grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-center py-4 px-3 -mx-3 border-b border-[#D5D7DC] hover:bg-[#FBFBFA] transition-colors ${
        isKeyboardFocused
          ? "bg-[#F4F3EE] ring-1 ring-inset ring-[#1E7B85] border-l-[3px] border-l-[#1E7B85]"
          : isWatchlistMatch
          ? "bg-[#1E7B85]/[0.04] border-l-[3px] border-l-[#1E7B85]"
          : ""
      }`}
    >
      {/* Left accent reveal bar on hover */}
      {!isWatchlistMatch && !isKeyboardFocused && (
        <span
          aria-hidden="true"
          className="hidden lg:block absolute left-0 top-2 bottom-2 w-[2px] bg-[#1E7B85] scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-200"
        />
      )}

      {/* Col 1: Indeks Monospace + Waktu */}
      <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-start justify-between lg:justify-center gap-1 font-mono tnum">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#1E7B85]">
            {String(index + 1).padStart(2, "0")}
          </span>
          {isToday && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#1E7B85]/10 text-[#1E7B85] text-[9px] font-bold uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-[#2EB886]" aria-hidden="true" />
              Hari ini
            </span>
          )}
          {isKeyboardFocused && (
            <kbd className="px-1.5 py-0.5 bg-[#1E7B85] text-white text-[9px] font-mono uppercase">
              Enter ↵
            </kbd>
          )}
        </div>
        <span className="text-[11px] text-[#676E7E]">{formattedTime}</span>
      </div>

      {/* Col 2: Thumbnail Opsional + Tajuk + Ringkasan 1 baris */}
      <div className="lg:col-span-6 flex items-start gap-3.5 min-w-0">
        {story.imageUrl && (
          <NewsArticleImage
            src={story.imageUrl}
            alt={story.title}
            publisher={story.publisher}
            sourceDomain={story.sourceDomain}
            variant="wire"
            onOpenPreview={() => onOpenPreview(story)}
          />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#848B99]">
            <span>{formatNewsCategoryLabel(story.category)}</span>
            <span>&bull;</span>
            {renderSentimentText(story.sentiment || "NEUTRAL")}
            {isWatchlistMatch && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#1E7B85] text-white text-[9px] font-bold tracking-wider">
                <Star className="w-2.5 h-2.5 fill-white" aria-hidden="true" />
                Watchlist
              </span>
            )}
          </div>

          <h3 className="text-[15px] sm:text-[16px] font-serif font-bold text-[#1D1F23] leading-[1.32]">
            <button
              type="button"
              onClick={() => onOpenPreview(story)}
              className="text-left editorial-link-sweep hover:text-[#1E7B85] transition-colors"
            >
              {story.title}
            </button>
          </h3>

          {story.summary && (
            <p className="text-xs text-[#676E7E] line-clamp-1 hidden sm:block">{story.summary}</p>
          )}
        </div>
      </div>

      {/* Col 3: Penerbit & Chip Ticker */}
      <div className="lg:col-span-2 flex flex-wrap lg:flex-col items-center lg:items-start gap-1.5">
        <span className="text-[11px] font-semibold text-[#1D1F23] truncate max-w-full">
          {story.publisher}
        </span>
        {story.tickers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 font-mono tnum">
            {story.tickers.slice(0, 3).map((t) => {
              const isMatchedTicker = watchlistSet.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelectStockFromNews(t, "", story.title, story)}
                  className={`px-1.5 py-0.5 border text-[10px] font-semibold transition ${
                    isMatchedTicker
                      ? "bg-[#1E7B85]/12 hover:bg-[#1E7B85] text-[#1E7B85] hover:text-white border-[#1E7B85]/50"
                      : "bg-[#FBFBFA] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border-[#D5D7DC]"
                  }`}
                  title={`Buka ${t} di Terminal`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Col 4: Aksi Cepat + Simpan + Arrow Slide */}
      <div className="lg:col-span-2 flex items-center lg:justify-end gap-2.5 text-[11px]">
        {onToggleBookmark && (
          <button
            type="button"
            aria-pressed={isBookmarked}
            onClick={() => onToggleBookmark(story)}
            title={isBookmarked ? "Hapus dari tersimpan" : "Simpan berita"}
            aria-label={isBookmarked ? "Hapus dari tersimpan" : "Simpan berita"}
            className={`p-1.5 border transition ${
              isBookmarked
                ? "bg-[#1E7B85]/12 border-[#1E7B85] text-[#1E7B85]"
                : "bg-[#FBFBFA] border-[#D5D7DC] text-[#676E7E] hover:border-[#1E7B85] hover:text-[#1E7B85]"
            }`}
          >
            <Bookmark
              className={`w-3 h-3 ${isBookmarked ? "fill-[#1E7B85]" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}

        {onAskAiLiveNews && (
          <button
            type="button"
            onClick={() => onAskAiLiveNews(story)}
            className="inline-flex items-center gap-1 font-semibold text-[#1E7B85] hover:underline"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            <span>Bedah AI</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenPreview(story)}
          className="inline-flex items-center gap-1 px-2 py-1 border border-[#D5D7DC] bg-[#FBFBFA] group-hover:border-[#1E7B85] group-hover:text-[#1E7B85] text-[#1D1F23] font-medium transition"
        >
          <span>Baca</span>
          <ArrowUpRight
            className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            aria-hidden="true"
          />
        </button>
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
  const [selectedTimeRange, setSelectedTimeRange] = useState<NewsTimeRange>("ALL");
  const [selectedPublisherGroup, setSelectedPublisherGroup] = useState<NewsPublisherGroup>("ALL");
  const [onlyWatchlist, setOnlyWatchlist] = useState<boolean>(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState<boolean>(false);
  const [onlyWithImagesInWire, setOnlyWithImagesInWire] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedTickerFilter, setSelectedTickerFilter] = useState<string | null>(null);
  // Default TRUE agar pengguna langsung melihat ringkasan pasar begitu masuk ke halaman Berita
  const [isMarketSummaryExpanded, setIsMarketSummaryExpanded] = useState<boolean>(true);
  const [showAllCompactStories, setShowAllCompactStories] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [previewStoryId, setPreviewStoryId] = useState<string | null>(null);
  const [hoveredWireStory, setHoveredWireStory] = useState<LiveMarketNewsItem | null>(null);
  const [focusedWireIndex, setFocusedWireIndex] = useState<number | null>(null);
  const [todayWibKey] = useState<string>(() => getJakartaDateKey(new Date()));

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const briefSectionRef = useRef<HTMLDivElement | null>(null);

  const bookmarksJson = useSyncExternalStore(
    subscribeNewsBookmarksStorage,
    readNewsBookmarksStorageSnapshot,
    getNewsBookmarksServerSnapshot
  );
  const bookmarkedItems = useMemo(() => parseNewsBookmarksJson(bookmarksJson), [bookmarksJson]);
  const bookmarkedIds = useMemo(
    () => new Set(bookmarkedItems.map((item) => item.id)),
    [bookmarkedItems]
  );

  const handleToggleBookmark = useCallback(
    (story: LiveMarketNewsItem) => {
      const updated = toggleNewsBookmark(bookmarkedItems, story);
      writeNewsBookmarksStorage(updated);
    },
    [bookmarkedItems]
  );

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 460);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleFocusSearch = useCallback(() => {
    if (!searchInputRef.current) return;
    searchInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current.focus();
    searchInputRef.current.select();
  }, []);

  const handleJumpToBrief = useCallback(() => {
    setIsMarketSummaryExpanded(true);
    briefSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleToggleBriefTicker = useCallback((ticker: string) => {
    setSelectedTickerFilter((prev) => (prev === ticker ? null : ticker));
    setShowAllCompactStories(false);
    setFocusedWireIndex(null);
  }, []);

  const handleRetryLiveNews = useCallback(() => {
    setShowAllCompactStories(false);
    setFocusedWireIndex(null);
    onRefreshLiveNews?.();
  }, [onRefreshLiveNews]);

  const resetFilters = useCallback(() => {
    setSelectedCategory("ALL");
    setSelectedSentiment("ALL");
    setSelectedTimeRange("ALL");
    setSelectedPublisherGroup("ALL");
    setOnlyWatchlist(false);
    setOnlyBookmarked(false);
    setOnlyWithImagesInWire(false);
    setSearchQuery("");
    setSelectedTickerFilter(null);
    setShowAllCompactStories(false);
    setFocusedWireIndex(null);
    setHoveredWireStory(null);
  }, []);

  const watchlistSet = useMemo(
    () => new Set(watchlistTickers.map((t) => t.trim().toUpperCase()).filter(Boolean)),
    [watchlistTickers]
  );

  const hasActiveFilters =
    selectedCategory !== "ALL" ||
    selectedSentiment !== "ALL" ||
    selectedTimeRange !== "ALL" ||
    selectedPublisherGroup !== "ALL" ||
    onlyWatchlist ||
    onlyBookmarked ||
    onlyWithImagesInWire ||
    selectedTickerFilter !== null ||
    searchQuery.trim().length > 0;

  const activeNewsPool = useMemo(
    () =>
      onlyBookmarked
        ? resolveBookmarkedNewsPool(liveNewsItems, bookmarkedItems)
        : liveNewsItems,
    [onlyBookmarked, liveNewsItems, bookmarkedItems]
  );

  const todayNewsCount = useMemo(
    () => countTodayNewsItems(activeNewsPool, todayWibKey),
    [activeNewsPool, todayWibKey]
  );

  const liveWatchlistCount = useMemo(() => {
    if (watchlistSet.size === 0) return 0;
    return activeNewsPool.filter((item) => item.tickers.some((t) => watchlistSet.has(t))).length;
  }, [activeNewsPool, watchlistSet]);

  const categoryCounts = useMemo(
    () =>
      computeNewsCategoryCounts(activeNewsPool, {
        sentiment: selectedSentiment,
        onlyWatchlist,
        watchlistSet,
        searchQuery: deferredSearchQuery,
        tickerFilter: selectedTickerFilter,
        timeRange: selectedTimeRange,
        todayWibKey,
        publisherGroup: selectedPublisherGroup,
      }),
    [
      activeNewsPool,
      selectedSentiment,
      onlyWatchlist,
      watchlistSet,
      deferredSearchQuery,
      selectedTickerFilter,
      selectedTimeRange,
      todayWibKey,
      selectedPublisherGroup,
    ]
  );

  const publisherCounts = useMemo(
    () =>
      computeNewsPublisherCounts(activeNewsPool, {
        category: selectedCategory,
        sentiment: selectedSentiment,
        onlyWatchlist,
        watchlistSet,
        searchQuery: deferredSearchQuery,
        tickerFilter: selectedTickerFilter,
        timeRange: selectedTimeRange,
        todayWibKey,
      }),
    [
      activeNewsPool,
      selectedCategory,
      selectedSentiment,
      onlyWatchlist,
      watchlistSet,
      deferredSearchQuery,
      selectedTickerFilter,
      selectedTimeRange,
      todayWibKey,
    ]
  );

  const filteredLiveNews = useMemo(
    () =>
      filterLiveNewsItems(activeNewsPool, {
        category: selectedCategory,
        sentiment: selectedSentiment,
        onlyWatchlist,
        watchlistSet,
        searchQuery: deferredSearchQuery,
        tickerFilter: selectedTickerFilter,
        timeRange: selectedTimeRange,
        todayWibKey,
        publisherGroup: selectedPublisherGroup,
      }),
    [
      activeNewsPool,
      selectedCategory,
      selectedSentiment,
      onlyWatchlist,
      watchlistSet,
      deferredSearchQuery,
      selectedTickerFilter,
      selectedTimeRange,
      todayWibKey,
      selectedPublisherGroup,
    ]
  );

  const filteredPhotoNewsCount = useMemo(
    () => filteredLiveNews.filter((item) => Boolean(item.imageUrl)).length,
    [filteredLiveNews]
  );

  const deterministicBrief = useMemo(
    () => buildLiveMarketBrief(liveNewsItems, macroTickers),
    [liveNewsItems, macroTickers]
  );
  const activeBrief = aiMarketBrief || deterministicBrief;

  const marketQaItems = useMemo(
    () => buildMarketQaInsights(liveNewsItems, macroTickers),
    [liveNewsItems, macroTickers]
  );

  const editorialBuckets = useMemo(
    () => allocateEditorialBuckets(filteredLiveNews, watchlistSet),
    [filteredLiveNews, watchlistSet]
  );

  const wirePool = useMemo(
    () =>
      onlyWithImagesInWire
        ? editorialBuckets.compactStories.filter((story) => Boolean(story.imageUrl))
        : editorialBuckets.compactStories,
    [editorialBuckets.compactStories, onlyWithImagesInWire]
  );

  const visibleWireStories = useMemo(
    () => (showAllCompactStories ? wirePool : wirePool.slice(0, INITIAL_WIRE_VISIBLE_COUNT)),
    [showAllCompactStories, wirePool]
  );
  const hiddenWireCount = Math.max(0, wirePool.length - INITIAL_WIRE_VISIBLE_COUNT);

  const safeFocusedWireIndex =
    focusedWireIndex !== null && focusedWireIndex < visibleWireStories.length
      ? focusedWireIndex
      : null;

  // Urutan datar seluruh artikel tampil untuk navigasi Sebelumnya/Berikutnya di dalam Reader Drawer
  const orderedPreviewList = useMemo(() => {
    const list: LiveMarketNewsItem[] = [];
    if (editorialBuckets.leadStory) list.push(editorialBuckets.leadStory);
    list.push(...editorialBuckets.gridStories);
    if (editorialBuckets.overlayStory) list.push(editorialBuckets.overlayStory);
    list.push(...editorialBuckets.stackedStories);
    list.push(...wirePool);
    return list;
  }, [editorialBuckets, wirePool]);

  const activePreviewIndex = useMemo(() => {
    if (!previewStoryId) return -1;
    return orderedPreviewList.findIndex((item) => item.id === previewStoryId);
  }, [orderedPreviewList, previewStoryId]);

  const activePreviewStory = useMemo(() => {
    if (!previewStoryId) return null;
    if (activePreviewIndex >= 0) return orderedPreviewList[activePreviewIndex];
    return (
      liveNewsItems.find((item) => item.id === previewStoryId) ||
      bookmarkedItems.find((item) => item.id === previewStoryId) ||
      null
    );
  }, [previewStoryId, activePreviewIndex, orderedPreviewList, liveNewsItems, bookmarkedItems]);

  const handleOpenPreview = useCallback((story: LiveMarketNewsItem) => {
    setHoveredWireStory(null);
    setPreviewStoryId(story.id);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewStoryId(null);
  }, []);

  const handleNavigatePreview = useCallback(
    (direction: "prev" | "next") => {
      if (activePreviewIndex < 0) return;
      const nextIdx =
        direction === "prev"
          ? Math.max(0, activePreviewIndex - 1)
          : Math.min(orderedPreviewList.length - 1, activePreviewIndex + 1);
      const nextItem = orderedPreviewList[nextIdx];
      if (nextItem) setPreviewStoryId(nextItem.id);
    },
    [activePreviewIndex, orderedPreviewList]
  );

  // Pintasan keyboard cepat: '/' cari, 'J'/'K' pindah sorotan Kawat Pasar, 'Enter' buka Pratinjau, 'Esc' bersihkan
  useEffect(() => {
    if (previewStoryId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);

      if (isEditable) {
        if (event.key === "Escape" && target === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        handleFocusSearch();
        return;
      }

      if (event.key === "Escape") {
        setFocusedWireIndex(null);
        setHoveredWireStory(null);
        return;
      }

      if ((event.key === "j" || event.key === "J") && visibleWireStories.length > 0) {
        event.preventDefault();
        const nextIdx =
          safeFocusedWireIndex === null
            ? 0
            : Math.min(visibleWireStories.length - 1, safeFocusedWireIndex + 1);
        setFocusedWireIndex(nextIdx);
        document
          .querySelector<HTMLElement>(`[data-wire-index="${nextIdx}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      if ((event.key === "k" || event.key === "K") && visibleWireStories.length > 0) {
        event.preventDefault();
        const prevIdx =
          safeFocusedWireIndex === null ? 0 : Math.max(0, safeFocusedWireIndex - 1);
        setFocusedWireIndex(prevIdx);
        document
          .querySelector<HTMLElement>(`[data-wire-index="${prevIdx}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      if (
        event.key === "Enter" &&
        safeFocusedWireIndex !== null &&
        tag !== "BUTTON" &&
        tag !== "A"
      ) {
        const story = visibleWireStories[safeFocusedWireIndex];
        if (story) {
          event.preventDefault();
          handleOpenPreview(story);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewStoryId, visibleWireStories, safeFocusedWireIndex, handleFocusSearch, handleOpenPreview]);

  const filterStateKey = `${selectedCategory}-${selectedSentiment}-${selectedTimeRange}-${selectedPublisherGroup}-${onlyWatchlist}-${onlyBookmarked}-${selectedTickerFilter || ""}-${deferredSearchQuery}`;

  return (
    <MotionConfig reducedMotion="user">
      <NewsAmbientBackground />
      <NewsScrollProgressBar />

      <div className="relative z-10 w-full text-[#1D1F23] font-sans">
        <div className="max-w-7xl mx-auto py-5 space-y-5">
          {/* Compact Broadsheet Masthead */}
          <header className="border-b-2 border-[#1D1F23] pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#676E7E]">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    provider === "yahoo" ? "bg-[#2EB886]" : "bg-[#848B99]"
                  }`}
                  aria-hidden="true"
                />
                <span>Edisi Pasar Modal Indonesia &bull; Arsip Maks. 3 Hari</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#1D1F23] tracking-tight leading-tight">
                Warta pasar modal &amp; makro terkini
              </h1>
              <p className="text-xs sm:text-sm text-[#676E7E]">
                Sari berita terpercaya dari CNBC Indonesia, ANTARA, CNN Indonesia Ekonomi, Kontan &amp; Google News IDX.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#676E7E]">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F3EE] border border-[#E5E5DC] font-mono text-[11px] tnum">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      provider === "yahoo" ? "bg-[#2EB886]" : "bg-[#848B99]"
                    }`}
                    aria-hidden="true"
                  />
                  <strong className="text-[#1D1F23]">
                    <CountUpNumber value={todayNewsCount} />
                  </strong>
                  <span>baru hari ini</span>
                  <span className="text-[#C5C7CE]">/</span>
                  <span>
                    <CountUpNumber value={liveNewsItems.length} /> total
                  </span>
                  {liveNewsUpdatedAtWib && (
                    <>
                      <span className="text-[#C5C7CE]">&bull;</span>
                      <span>{liveNewsUpdatedAtWib}</span>
                    </>
                  )}
                </span>

                {provider === "yahoo" && (
                  <MagneticButton
                    onClick={handleRetryLiveNews}
                    disabled={isLiveNewsLoading}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#F4F3EE] hover:bg-[#1D1F23] text-[#1D1F23] hover:text-white border border-[#D5D7DC] hover:border-[#1D1F23] text-xs font-medium transition disabled:opacity-50"
                    title="Muat ulang berita pasar terkini"
                  >
                    <RotateCcw
                      className={`w-3 h-3 text-[#1E7B85] ${isLiveNewsLoading ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    <span>Segarkan</span>
                  </MagneticButton>
                )}
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#848B99]"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  id="news-search-input"
                  name="newsSearch"
                  type="text"
                  aria-label="Cari berita atau kode saham"
                  placeholder="Cari berita atau kode saham... (/)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowAllCompactStories(false);
                    setFocusedWireIndex(null);
                  }}
                  className="w-full h-[38px] pl-9 pr-8 bg-[#FBFBFA] border border-[#D5D7DC] rounded-none text-xs text-[#1D1F23] placeholder-[#848B99] focus:outline-none focus:border-[#1E7B85] transition-colors"
                />
                <AnimatePresence>
                  {searchQuery.length > 0 && (
                    <motion.button
                      key="clear-search"
                      type="button"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.14 }}
                      onClick={() => {
                        setSearchQuery("");
                        setShowAllCompactStories(false);
                      }}
                      aria-label="Bersihkan pencarian berita"
                      className="p-1 absolute right-1.5 top-1/2 -translate-y-1/2 text-[#848B99] hover:text-[#1D1F23] transition"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

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

          {/* Ringkasan Pasar Hari Ini — Otomatis Terbuka + Dual-Axis Lensa & Stepper */}
          {provider === "yahoo" && liveNewsItems.length > 0 && (
            <div ref={briefSectionRef} className="scroll-mt-20">
              <MarketBriefPanel
                activeBrief={activeBrief}
                liveNewsItems={liveNewsItems}
                macroTickers={macroTickers}
                todayNewsCount={todayNewsCount}
                todayWibKey={todayWibKey}
                selectedTickerFilter={selectedTickerFilter}
                isExpanded={isMarketSummaryExpanded}
                onToggleExpanded={() => setIsMarketSummaryExpanded((prev) => !prev)}
                onToggleBriefTicker={handleToggleBriefTicker}
                onRequestAiBrief={onRequestAiBrief}
                isAiBriefLoading={isAiBriefLoading}
                aiBriefNotice={aiBriefNotice}
                onOpenStoryPreview={handleOpenPreview}
                onSelectStockFromNews={onSelectStockFromNews}
              />
            </div>
          )}

          {/* Interactive Broadsheet Filter Bar (Sliding layoutId Tabs + Hari ini/3 Hari + Watchlist + Sentiment) */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5D7DC] text-xs">
            <div
              role="tablist"
              aria-label="Kategori berita pasar"
              className="w-full lg:w-auto flex items-center gap-x-4 sm:gap-x-5 overflow-x-auto scrollbar-none news-tabs-fade pr-5 lg:pr-0"
            >
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
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedCategory(cat.id as NewsFilterCategory);
                      setShowAllCompactStories(false);
                    }}
                    className={`relative min-h-[42px] inline-flex items-center gap-1.5 px-0.5 transition-colors whitespace-nowrap -mb-px ${
                      isSelected
                        ? "text-[#1D1F23] font-bold"
                        : count === 0
                        ? "text-[#848B99]/70 hover:text-[#676E7E] font-medium"
                        : "text-[#676E7E] hover:text-[#1D1F23] font-medium"
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
                    {isSelected && (
                      <motion.span
                        layoutId="news-category-underline"
                        transition={SPRING_INDICATOR}
                        aria-hidden="true"
                        className="absolute left-0 right-0 bottom-0 h-[2px] bg-[#1E7B85]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pb-2">
              {/* Filter Rentang Waktu: Semua (3 hari) vs Hari ini (berita terbaru) */}
              <div
                role="group"
                aria-label="Rentang waktu berita"
                className="flex items-center bg-[#F4F3EE] border border-[#D5D7DC] text-[11px] p-0.5"
              >
                {[
                  {
                    id: "ALL" as NewsTimeRange,
                    label: "3 Hari",
                    count: liveNewsItems.length,
                    title: "Tampilkan seluruh berita maksimal 3 hari terakhir",
                  },
                  {
                    id: "TODAY" as NewsTimeRange,
                    label: "Hari ini",
                    count: todayNewsCount,
                    title: "Saring hanya berita baru yang terbit hari ini (WIB)",
                  },
                ].map((opt) => {
                  const isActive = selectedTimeRange === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.title}
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelectedTimeRange(opt.id);
                        setShowAllCompactStories(false);
                      }}
                      className={`relative h-[30px] px-2.5 inline-flex items-center gap-1.5 font-medium transition-colors z-10 ${
                        isActive ? "text-white font-semibold" : "text-[#676E7E] hover:text-[#1D1F23]"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="news-time-pill"
                          transition={SPRING_INDICATOR}
                          aria-hidden="true"
                          className="absolute inset-0 bg-[#1D1F23] -z-10"
                        />
                      )}
                      {opt.id === "TODAY" && opt.count > 0 && (
                        <span
                          aria-hidden="true"
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? "bg-[#5EEAD4]" : "bg-[#2EB886]"
                          }`}
                        />
                      )}
                      <span>{opt.label}</span>
                      {liveNewsItems.length > 0 && (
                        <span
                          className={`font-mono text-[10px] tnum ${
                            isActive ? "text-white/80" : "text-[#848B99]"
                          }`}
                        >
                          ({opt.count})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {watchlistSet.size > 0 ? (
                <button
                  type="button"
                  aria-pressed={onlyWatchlist}
                  onClick={() => {
                    setOnlyWatchlist((prev) => !prev);
                    setShowAllCompactStories(false);
                  }}
                  className={`h-[34px] inline-flex items-center space-x-1.5 px-2.5 border text-[11px] font-semibold transition active:scale-[0.98] ${
                    onlyWatchlist
                      ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                      : "bg-[#F4F3EE] text-[#1D1F23] hover:border-[#1E7B85] border-[#D5D7DC]"
                  }`}
                  title="Saring hanya berita saham Watchlist Saya"
                >
                  <Bookmark className="w-3 h-3" aria-hidden="true" />
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
                    <Star className="w-3 h-3 text-[#1E7B85]" aria-hidden="true" />
                    <span>Atur Watchlist</span>
                  </button>
                )
              )}

              {/* Toggle Sentimen dengan sliding layoutId pill */}
              <div
                role="group"
                aria-label="Filter sentimen berita"
                className="flex items-center bg-[#F4F3EE] border border-[#D5D7DC] text-[11px] p-0.5"
              >
                {[
                  { id: "ALL", label: "Semua", title: "Tampilkan semua sentimen" },
                  { id: "BULLISH", label: "Positif", title: "Hanya berita sentimen positif" },
                  { id: "BEARISH", label: "Negatif", title: "Hanya berita sentimen negatif" },
                ].map((opt) => {
                  const isActive = selectedSentiment === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.title}
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelectedSentiment(opt.id as NewsFilterSentiment);
                        setShowAllCompactStories(false);
                        setFocusedWireIndex(null);
                      }}
                      className={`relative h-[30px] px-2.5 font-medium transition-colors z-10 ${
                        isActive
                          ? "text-white font-semibold"
                          : "text-[#676E7E] hover:text-[#1D1F23]"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="news-sentiment-pill"
                          transition={SPRING_INDICATOR}
                          aria-hidden="true"
                          className="absolute inset-0 bg-[#1E7B85] -z-10"
                        />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Strip Filter Sumber Media Terpercaya + Berita Tersimpan + Pintasan Keyboard */}
          {provider === "yahoo" && (liveNewsItems.length > 0 || bookmarkedItems.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-[11px]">
              <div
                role="group"
                aria-label="Filter sumber media"
                className="flex flex-wrap items-center gap-1"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#848B99] mr-1">
                  Media:
                </span>
                {PUBLISHER_PILLS.filter(
                  (pill) =>
                    pill.id === "ALL" ||
                    publisherCounts[pill.id] > 0 ||
                    selectedPublisherGroup === pill.id
                ).map((pill) => {
                  const isActive = selectedPublisherGroup === pill.id;
                  const count = publisherCounts[pill.id] ?? 0;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setSelectedPublisherGroup(pill.id);
                        setShowAllCompactStories(false);
                        setFocusedWireIndex(null);
                      }}
                      className={`relative px-2.5 py-1 border font-medium transition-colors z-10 ${
                        isActive
                          ? "text-white border-[#1D1F23] font-semibold"
                          : "bg-[#FBFBFA] border-[#D5D7DC] text-[#4E5563] hover:border-[#1E7B85] hover:text-[#1D1F23]"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="news-publisher-pill"
                          transition={SPRING_INDICATOR}
                          aria-hidden="true"
                          className="absolute inset-0 bg-[#1D1F23] -z-10"
                        />
                      )}
                      <span>{pill.label}</span>
                      <span
                        className={`ml-1 font-mono text-[10px] tnum ${
                          isActive ? "text-white/75" : "text-[#848B99]"
                        }`}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  aria-pressed={onlyBookmarked}
                  onClick={() => {
                    setOnlyBookmarked((prev) => !prev);
                    setShowAllCompactStories(false);
                    setFocusedWireIndex(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-semibold transition ${
                    onlyBookmarked
                      ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                      : "bg-[#F4F3EE] text-[#1D1F23] hover:border-[#1E7B85] border-[#D5D7DC]"
                  }`}
                  title="Tampilkan daftar berita yang Anda simpan di perangkat ini"
                >
                  <Bookmark
                    className={`w-3 h-3 ${
                      onlyBookmarked
                        ? "fill-white"
                        : bookmarkedItems.length > 0
                        ? "text-[#1E7B85] fill-[#1E7B85]/20"
                        : "text-[#676E7E]"
                    }`}
                    aria-hidden="true"
                  />
                  <span>Tersimpan ({bookmarkedItems.length})</span>
                </button>

                <span className="hidden xl:inline-flex items-center gap-1.5 font-mono text-[10px] text-[#848B99]">
                  <kbd className="px-1 py-0.5 bg-[#F4F3EE] border border-[#D5D7DC] text-[#1D1F23]">
                    /
                  </kbd>
                  <span>Cari</span>
                  <span className="text-[#C5C7CE]">&bull;</span>
                  <kbd className="px-1 py-0.5 bg-[#F4F3EE] border border-[#D5D7DC] text-[#1D1F23]">
                    J
                  </kbd>
                  <kbd className="px-1 py-0.5 bg-[#F4F3EE] border border-[#D5D7DC] text-[#1D1F23]">
                    K
                  </kbd>
                  <span>Navigasi</span>
                  <span className="text-[#C5C7CE]">&bull;</span>
                  <kbd className="px-1 py-0.5 bg-[#F4F3EE] border border-[#D5D7DC] text-[#1D1F23]">
                    Enter
                  </kbd>
                  <span>Baca</span>
                </span>
              </div>
            </div>
          )}

          {/* Active Ticker Filter Banner from "Disorot" */}
          <AnimatePresence>
            {selectedTickerFilter && (
              <motion.div
                key="active-ticker-banner"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE_PREMIUM }}
                className="bg-[#1E7B85]/[0.06] border border-[#1E7B85]/35 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#676E7E]">Menyaring berita emiten:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTickerFilter(null)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#1E7B85] hover:bg-[#166068] text-white font-mono font-semibold text-[11px] transition"
                    title={`Hapus filter ${selectedTickerFilter}`}
                  >
                    <span>{selectedTickerFilter}</span>
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <span className="text-[11px] text-[#676E7E]">
                    ({filteredLiveNews.length} berita)
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectStockFromNews(selectedTickerFilter, "", activeBrief.headline)
                    }
                    className="inline-flex items-center space-x-1 font-semibold text-[#1E7B85] hover:underline"
                  >
                    <span>Buka {selectedTickerFilter} di Terminal</span>
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTickerFilter(null)}
                    className="text-[#676E7E] hover:text-[#1D1F23] hover:underline"
                  >
                    Tampilkan semua
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* KONTEN BERITA BROADSHEET INTERAKTIF */}
          {provider !== "yahoo" ? (
            <div className="py-12 px-4 text-center space-y-2 text-xs text-[#676E7E] border border-[#E5E5DC] bg-[#F4F3EE]">
              <p className="font-serif font-bold text-base text-[#1D1F23]">
                Mode data ilustrasi sedang aktif
              </p>
              <p className="max-w-md mx-auto">
                Feed berita RSS pasar modal real-time (CNBC Indonesia, ANTARA, CNN Indonesia Ekonomi, Kontan &amp; Google News IDX) aktif ketika penyedia data Yahoo Finance diaktifkan.
              </p>
            </div>
          ) : isLiveNewsLoading && liveNewsItems.length === 0 ? (
            <BroadsheetNewsSkeleton />
          ) : filteredLiveNews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="py-12 text-center space-y-3 text-xs text-[#676E7E] border border-[#E5E5DC] bg-[#F4F3EE]"
            >
              <p>
                {onlyBookmarked && bookmarkedItems.length === 0
                  ? "Belum ada berita tersimpan. Klik tombol Simpan pada kartu berita atau panel pratinjau untuk menambahkannya."
                  : liveNewsItems.length === 0
                  ? "Berita pasar terkini belum dapat dimuat dari sumber RSS saat ini."
                  : selectedTimeRange === "TODAY"
                  ? "Belum ada berita yang cocok untuk hari ini (WIB) pada filter yang dipilih."
                  : "Tidak ada berita terkini yang cocok dengan filter pencarian Anda."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {liveNewsItems.length === 0 ? (
                  <button
                    type="button"
                    onClick={handleRetryLiveNews}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#FBFBFA] hover:bg-[#E5E5DC] text-[#1D1F23] border border-[#D5D7DC] transition font-medium"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#1E7B85]" aria-hidden="true" />
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
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={filterStateKey}
                initial={{ opacity: 0.4, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0.4 }}
                transition={{ duration: 0.24, ease: EASE_PREMIUM }}
                className="space-y-10 pt-1"
              >
                {/* Band 1: 01 / SOROTAN UTAMA — Asymmetric Lead Hero + 3-Col Photo Grid */}
                {editorialBuckets.leadStory && (
                  <section className="space-y-6">
                    <div className="border-b border-[#D5D7DC] pb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-[#1E7B85]">
                          01 /
                        </span>
                        <p className="text-base sm:text-lg italic text-[#676E7E]">
                          Sorotan{" "}
                          <strong className="text-[#1D1F23] font-semibold not-italic">
                            pasar modal &amp; makro utama
                          </strong>
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-[#848B99] tnum">
                        {filteredPhotoNewsCount} berita bergambar &bull; Klik tajuk untuk pratinjau cepat
                      </span>
                    </div>

                    <EditorialReveal y={14}>
                      <LeadBroadsheetHero
                        key={editorialBuckets.leadStory.id}
                        story={editorialBuckets.leadStory}
                        watchlistSet={watchlistSet}
                        todayWibKey={todayWibKey}
                        onSelectStockFromNews={onSelectStockFromNews}
                        onAskAiLiveNews={onAskAiLiveNews}
                        onOpenPreview={handleOpenPreview}
                        isBookmarked={bookmarkedIds.has(editorialBuckets.leadStory.id)}
                        onToggleBookmark={handleToggleBookmark}
                      />
                    </EditorialReveal>

                    {/* 3-Column Image-Top Grid */}
                    {editorialBuckets.gridStories.length > 0 && (
                      <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-7 gap-y-8">
                        {editorialBuckets.gridStories.map((story, idx) => (
                          <EditorialReveal key={story.id} delay={idx * 0.06} y={16}>
                            <EditorialGridCard
                              story={story}
                              watchlistSet={watchlistSet}
                              todayWibKey={todayWibKey}
                              onSelectStockFromNews={onSelectStockFromNews}
                              onAskAiLiveNews={onAskAiLiveNews}
                              onOpenPreview={handleOpenPreview}
                              isBookmarked={bookmarkedIds.has(story.id)}
                              onToggleBookmark={handleToggleBookmark}
                            />
                          </EditorialReveal>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Band 2 (Warm Stone): 02 / DINAMIKA EMITEN — Overlay Feature + Thumbnail Stacked Editorial */}
                {(editorialBuckets.overlayStory || editorialBuckets.stackedStories.length > 0) && (
                  <section className="bg-[#F4F3EE]/88 backdrop-blur-[2px] border-y border-[#E5E5DC] px-4 sm:px-7 py-7 space-y-6">
                    <div className="border-b border-[#D5D7DC] pb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-[#1E7B85]">
                          02 /
                        </span>
                        <p className="text-base sm:text-lg italic text-[#676E7E]">
                          Dinamika emiten &amp;{" "}
                          <strong className="text-[#1D1F23] font-semibold not-italic">
                            liputan pilihan redaksi
                          </strong>
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-[#848B99]">
                        Pilihan visual &amp; lintas sektor
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch">
                      {editorialBuckets.overlayStory && (
                        <EditorialReveal className="lg:col-span-4" y={18}>
                          <EditorialOverlayFeature
                            key={editorialBuckets.overlayStory.id}
                            story={editorialBuckets.overlayStory}
                            watchlistSet={watchlistSet}
                            todayWibKey={todayWibKey}
                            onSelectStockFromNews={onSelectStockFromNews}
                            onAskAiLiveNews={onAskAiLiveNews}
                            onOpenPreview={handleOpenPreview}
                            isBookmarked={bookmarkedIds.has(editorialBuckets.overlayStory.id)}
                            onToggleBookmark={handleToggleBookmark}
                          />
                        </EditorialReveal>
                      )}

                      {editorialBuckets.stackedStories.length > 0 && (
                        <div
                          className={`${
                            editorialBuckets.overlayStory
                              ? "lg:col-span-8 flex flex-col justify-between space-y-5"
                              : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
                          }`}
                        >
                          {editorialBuckets.stackedStories.map((story, idx) => (
                            <EditorialReveal key={story.id} delay={idx * 0.05} y={14}>
                              <EditorialStackedItem
                                story={story}
                                watchlistSet={watchlistSet}
                                todayWibKey={todayWibKey}
                                onSelectStockFromNews={onSelectStockFromNews}
                                onAskAiLiveNews={onAskAiLiveNews}
                                onOpenPreview={handleOpenPreview}
                                isBookmarked={bookmarkedIds.has(story.id)}
                                onToggleBookmark={handleToggleBookmark}
                              />
                            </EditorialReveal>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Band 3: 03 / KONTEKS PASAR — Split Accordion Tanya Jawab ala 08 / FAQ NewMinds */}
                {!onlyBookmarked && marketQaItems.length > 0 && (
                  <EditorialReveal y={14}>
                    <MarketQaAccordion
                      items={marketQaItems}
                      watchlistSet={watchlistSet}
                      onOpenStoryPreview={handleOpenPreview}
                      onSelectStockFromNews={onSelectStockFromNews}
                    />
                  </EditorialReveal>
                )}

                {/* Band 4: 04 / KAWAT PASAR — Indeks Editorial 4-Kolom ala NewMinds (Arsip Maks. 3 Hari) */}
                {editorialBuckets.compactStories.length > 0 && (
                  <section
                    className="space-y-4"
                    onMouseLeave={() => setHoveredWireStory(null)}
                  >
                    <div className="border-b-2 border-[#1D1F23] pb-2.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-mono text-[11px] font-bold tracking-[0.12em] text-[#1E7B85]">
                          04 /
                        </span>
                        <h2 className="text-base sm:text-lg font-serif font-bold text-[#1D1F23]">
                          Kawat pasar &amp; arsip terkini
                        </h2>
                        <span className="font-mono text-[11px] text-[#676E7E] tnum">
                          ({wirePool.length} berita)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={onlyWithImagesInWire}
                          onClick={() => {
                            setOnlyWithImagesInWire((prev) => !prev);
                            setShowAllCompactStories(false);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[11px] font-medium transition ${
                            onlyWithImagesInWire
                              ? "bg-[#1E7B85] text-white border-[#1E7B85]"
                              : "bg-[#F4F3EE] text-[#4E5563] hover:text-[#1D1F23] hover:border-[#1E7B85] border-[#D5D7DC]"
                          }`}
                        >
                          <ImageIcon className="w-3 h-3" aria-hidden="true" />
                          <span>Hanya bergambar</span>
                        </button>
                      </div>
                    </div>

                    {wirePool.length === 0 ? (
                      <div className="py-8 text-center text-xs text-[#676E7E] bg-[#F4F3EE] border border-[#E5E5DC]">
                        Tidak ada berita bergambar pada kawat pasar untuk filter ini.{" "}
                        <button
                          type="button"
                          onClick={() => setOnlyWithImagesInWire(false)}
                          className="font-semibold text-[#1E7B85] hover:underline"
                        >
                          Tampilkan semua
                        </button>
                      </div>
                    ) : (
                      <div>
                        {/* Header Kolom Desktop */}
                        <div className="hidden lg:grid lg:grid-cols-12 gap-5 px-0 pb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-[#848B99] border-b border-[#E5E5DC]">
                          <div className="col-span-2">Indeks / Waktu</div>
                          <div className="col-span-6">Berita &amp; Ringkasan</div>
                          <div className="col-span-2">Sumber / Emiten</div>
                          <div className="col-span-2 text-right">Tindakan</div>
                        </div>

                        <div className="divide-y divide-transparent">
                          {visibleWireStories.map((story, idx) => (
                            <EditorialReveal
                              key={story.id}
                              delay={idx < 6 ? idx * 0.035 : 0}
                              y={10}
                            >
                              <EditorialWireRow
                                index={idx}
                                story={story}
                                watchlistSet={watchlistSet}
                                todayWibKey={todayWibKey}
                                onSelectStockFromNews={onSelectStockFromNews}
                                onAskAiLiveNews={onAskAiLiveNews}
                                onOpenPreview={handleOpenPreview}
                                isBookmarked={bookmarkedIds.has(story.id)}
                                onToggleBookmark={handleToggleBookmark}
                                isKeyboardFocused={safeFocusedWireIndex === idx}
                                onHoverStart={setHoveredWireStory}
                                onHoverEnd={() =>
                                  setHoveredWireStory((prev) =>
                                    prev?.id === story.id ? null : prev
                                  )
                                }
                              />
                            </EditorialReveal>
                          ))}
                        </div>
                      </div>
                    )}

                    {(wirePool.length > INITIAL_WIRE_VISIBLE_COUNT ||
                      editorialBuckets.stackedStories.length > 0) && (
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                        {wirePool.length > INITIAL_WIRE_VISIBLE_COUNT && (
                          <MagneticButton
                            onClick={() => setShowAllCompactStories((prev) => !prev)}
                            className="px-6 py-2.5 border border-[#1D1F23] bg-[#FBFBFA] hover:bg-[#1D1F23] text-[#1D1F23] hover:text-white text-xs font-semibold tracking-wide transition"
                          >
                            {showAllCompactStories
                              ? "Ringkas daftar kawat pasar"
                              : `Tampilkan ${hiddenWireCount} berita lainnya (hingga 3 hari)`}
                          </MagneticButton>
                        )}
                        <button
                          type="button"
                          onClick={handleScrollToTop}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#D5D7DC] hover:border-[#1D1F23] bg-[#FBFBFA] text-[#1D1F23] hover:text-[#1E7B85] text-xs font-semibold transition"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Kembali ke atas</span>
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Unified Floating Quick-Action Pill Dock (menggabungkan Cari /, Hari ini, Tersimpan, Ringkasan, ↑ Atas) */}
          <NewsFloatingDock
            visible={showScrollTop && !previewStoryId}
            isTodayActive={selectedTimeRange === "TODAY"}
            todayCount={todayNewsCount}
            isSavedActive={onlyBookmarked}
            savedCount={bookmarkedItems.length}
            onFocusSearch={handleFocusSearch}
            onToggleToday={() => {
              setSelectedTimeRange((prev) => (prev === "TODAY" ? "ALL" : "TODAY"));
              setShowAllCompactStories(false);
              setFocusedWireIndex(null);
            }}
            onToggleSaved={() => {
              setOnlyBookmarked((prev) => !prev);
              setShowAllCompactStories(false);
              setFocusedWireIndex(null);
            }}
            onJumpToBrief={handleJumpToBrief}
            onScrollToTop={handleScrollToTop}
          />
        </div>
      </div>

      {/* Cursor-Following Floating Preview untuk 04 / Kawat Pasar (Desktop) */}
      <WireHoverPreview story={hoveredWireStory} disabled={Boolean(previewStoryId)} />

      {/* Right Slide-Over Quick-Reader Drawer */}
      <NewsReaderDrawer
        story={activePreviewStory}
        storyIndex={activePreviewIndex}
        totalStories={orderedPreviewList.length}
        watchlistSet={watchlistSet}
        todayWibKey={todayWibKey}
        onClose={handleClosePreview}
        onNavigateStory={handleNavigatePreview}
        onSelectStockFromNews={onSelectStockFromNews}
        onAskAiLiveNews={onAskAiLiveNews}
        isBookmarked={activePreviewStory ? bookmarkedIds.has(activePreviewStory.id) : false}
        onToggleBookmark={handleToggleBookmark}
      />
    </MotionConfig>
  );
};
