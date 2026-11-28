"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Copy,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import type { LiveMarketNewsItem } from "@/types/market";
import { formatNewsCategoryLabel, formatNewsTimestamp } from "@/lib/format";
import { isNewsFromToday } from "@/lib/news-brief";
import { EASE_DRAWER, EASE_PREMIUM, MagneticButton } from "./newsMotion";

interface NewsReaderDrawerProps {
  story: LiveMarketNewsItem | null;
  storyIndex: number;
  totalStories: number;
  watchlistSet: ReadonlySet<string>;
  todayWibKey?: string;
  onClose: () => void;
  onNavigateStory: (direction: "prev" | "next") => void;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
  onAskAiLiveNews?: (item: LiveMarketNewsItem) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: (item: LiveMarketNewsItem) => void;
}

function getSentimentVisual(sentiment: LiveMarketNewsItem["sentiment"]) {
  if (sentiment === "BULLISH") {
    return {
      label: "Positif",
      textClass: "text-[#0D6343]",
      barClass: "bg-[#2EB886]",
      note: "Nada berita cenderung mendukung minat beli atau sentimen sektor terkait.",
    };
  }
  if (sentiment === "BEARISH") {
    return {
      label: "Negatif",
      textClass: "text-[#B91C1C]",
      barClass: "bg-[#B91C1C]",
      note: "Nada berita mengindikasikan tekanan harga, risiko, atau kehati-hatian pasar.",
    };
  }
  return {
    label: "Netral",
    textClass: "text-[#4E5563]",
    barClass: "bg-[#1E7B85]",
    note: "Informasi bersifat deskriptif atau masih menunggu konfirmasi pelaku pasar.",
  };
}

const emptySubscribe = () => () => {};

export const NewsReaderDrawer: React.FC<NewsReaderDrawerProps> = ({
  story,
  storyIndex,
  totalStories,
  watchlistSet,
  todayWibKey,
  onClose,
  onNavigateStory,
  onSelectStockFromNews,
  onAskAiLiveNews,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const shouldReduceMotion = useReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  // Kunci scroll latar belakang & tangkap pintasan keyboard Escape / Panah Kiri-Kanan
  useEffect(() => {
    if (!story) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 60);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && storyIndex > 0) {
        event.preventDefault();
        onNavigateStory("prev");
      } else if (event.key === "ArrowRight" && storyIndex >= 0 && storyIndex < totalStories - 1) {
        event.preventDefault();
        onNavigateStory("next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [story, storyIndex, totalStories, onClose, onNavigateStory]);

  const handleCopyLink = async () => {
    if (!story || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(story.link);
      setCopiedId(story.id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === story.id ? null : prev));
      }, 1800);
    } catch {
      // Abaikan jika clipboard diblokir browser
    }
  };

  const isWatchlistMatch =
    Boolean(story) &&
    watchlistSet.size > 0 &&
    story!.tickers.some((t) => watchlistSet.has(t));
  const isToday = story ? isNewsFromToday(story, todayWibKey) : false;
  const sentimentVisual = story ? getSentimentVisual(story.sentiment) : null;
  const formattedTime = story
    ? formatNewsTimestamp(story.publishedAt, story.publishedWib, todayWibKey)
    : "";
  const hasPrev = storyIndex > 0;
  const hasNext = storyIndex >= 0 && storyIndex < totalStories - 1;
  const canShowImage = Boolean(story?.imageUrl && failedImageUrl !== story.imageUrl);

  const drawerContent = (
    <AnimatePresence>
      {story && sentimentVisual && (
        <div
          className="fixed inset-0 z-[70] flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="news-reader-drawer-title"
        >
          {/* Backdrop buram ala NewMinds */}
          <motion.div
            key="news-reader-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1D1F23]/40 backdrop-blur-[3px]"
          />

          {/* Panel Slide-Over 540px dengan struktur 6 baris teratur */}
          <motion.aside
            key="news-reader-panel"
            initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%", opacity: 0.96 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%", opacity: 0.96 }}
            transition={{ duration: shouldReduceMotion ? 0.15 : 0.42, ease: EASE_DRAWER }}
            className="relative z-10 w-full max-w-[540px] h-full bg-[#FBFBFA] text-[#1D1F23] border-l border-[#D5D7DC] shadow-2xl flex flex-col"
          >
            {/* Baris 1: Header Status + Tutup */}
            <div className="px-5 py-3.5 border-b border-[#E5E5DC] bg-[#F4F3EE] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#1E7B85] shrink-0" aria-hidden="true" />
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] font-semibold text-[#1D1F23] truncate">
                  Pratinjau Redaksi &bull;{" "}
                  {storyIndex >= 0
                    ? `${String(storyIndex + 1).padStart(2, "0")} / ${String(totalStories).padStart(2, "0")}`
                    : "ARTIKEL"}
                </span>
                {isToday && (
                  <span className="px-1.5 py-0.5 bg-[#1E7B85]/12 text-[#1E7B85] border border-[#1E7B85]/30 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                    Hari ini
                  </span>
                )}
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Tutup panel pratinjau berita"
                className="w-8 h-8 inline-flex items-center justify-center border border-[#D5D7DC] bg-[#FBFBFA] hover:border-[#1D1F23] hover:bg-[#1D1F23] hover:text-white text-[#1D1F23] transition"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Baris 2: Strip Utilitas Sumber & Waktu */}
            <div className="px-5 py-2 border-b border-[#E5E5DC] bg-[#FBFBFA] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#676E7E] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[#1D1F23] truncate">{story.publisher}</span>
                {story.sourceDomain && (
                  <>
                    <span className="text-[#C5C7CE]">/</span>
                    <span className="text-[#848B99] truncate">{story.sourceDomain}</span>
                  </>
                )}
              </div>
              <span className="tnum shrink-0">{formattedTime}</span>
            </div>

            {/* Baris 3: Aksen 2px Indikator Sentimen */}
            <div className="h-[2px] w-full bg-[#E5E5DC] shrink-0 overflow-hidden" aria-hidden="true">
              <motion.div
                key={story.id}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, ease: EASE_PREMIUM }}
                className={`h-full w-full origin-left ${sentimentVisual.barClass}`}
              />
            </div>

            {/* Baris 4: Konten Artikel & Kartu Intelijen 3-Sel (Scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={story.id}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.24, ease: EASE_PREMIUM }}
                  className="space-y-5"
                >
                  {/* Kategori & Watchlist badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#676E7E]">
                      {formatNewsCategoryLabel(story.category)}
                    </span>
                    {isWatchlistMatch && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#1E7B85] text-white text-[10px] font-bold uppercase tracking-wider">
                        <Star className="w-2.5 h-2.5 fill-white" aria-hidden="true" />
                        <span>Ada di Watchlist</span>
                      </span>
                    )}
                  </div>

                  {/* Judul Serif Broadsheet */}
                  <h2
                    id="news-reader-drawer-title"
                    className="text-2xl sm:text-[27px] font-serif font-bold text-[#1D1F23] leading-[1.22]"
                    style={{ textWrap: "balance" }}
                  >
                    {story.title}
                  </h2>

                  {/* Foto Artikel */}
                  {canShowImage && story.imageUrl && (
                    <figure className="overflow-hidden border border-[#E5E5DC] bg-[#E9E8E2]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={story.imageUrl}
                        alt={story.title}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImageUrl(story.imageUrl || null)}
                        className="w-full aspect-[16/10] object-cover"
                      />
                      <figcaption className="px-3 py-1.5 bg-[#F4F3EE] border-t border-[#E5E5DC] text-[11px] text-[#676E7E] flex items-center justify-between gap-2">
                        <span>Foto redaksi: {story.publisher}</span>
                        {story.sourceDomain && (
                          <span className="font-mono text-[#848B99]">{story.sourceDomain}</span>
                        )}
                      </figcaption>
                    </figure>
                  )}

                  {/* Ringkasan */}
                  {story.summary ? (
                    <p className="text-[15px] text-[#4E5563] leading-[1.72] font-sans">
                      {story.summary}
                    </p>
                  ) : (
                    <p className="text-sm italic text-[#676E7E] leading-relaxed bg-[#F4F3EE] border border-[#E5E5DC] px-3.5 py-3">
                      Sumber RSS hanya menyediakan tajuk utama untuk berita ini. Klik &ldquo;Bedah AI&rdquo; untuk melihat transmisi dampak pasar atau buka artikel penuh pada media penerbit.
                    </p>
                  )}

                  {/* Kartu Intelijen Terstruktur 3-Sel ala 05 / AI Concierge NewMinds */}
                  <div className="border border-[#D5D7DC] bg-[#F4F3EE]">
                    <div className="px-3.5 py-2 border-b border-[#E5E5DC] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-[#676E7E]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1D1F23]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1E7B85]" aria-hidden="true" />
                        Sinyal Intelijen Berita
                      </span>
                      <span>Sintesis Otomatis</span>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-[#E5E5DC] bg-[#FBFBFA]">
                      <div className="p-3 space-y-1">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#848B99]">
                          Sentimen
                        </span>
                        <span className={`block text-xs font-bold ${sentimentVisual.textClass}`}>
                          {sentimentVisual.label}
                        </span>
                      </div>

                      <div className="p-3 space-y-1">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#848B99]">
                          Sektor / Kanal
                        </span>
                        <span className="block text-xs font-semibold text-[#1D1F23] truncate">
                          {formatNewsCategoryLabel(story.category)}
                        </span>
                      </div>

                      <div className="p-3 space-y-1">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-[#848B99]">
                          Emiten Terdeteksi
                        </span>
                        <span className="block font-mono text-xs font-semibold text-[#1D1F23] tnum">
                          {story.tickers.length > 0 ? `${story.tickers.length} saham` : "Makro / Umum"}
                        </span>
                      </div>
                    </div>

                    <div className="px-3.5 py-2.5 border-t border-[#E5E5DC] text-xs text-[#4E5563] leading-relaxed">
                      {sentimentVisual.note}
                    </div>
                  </div>

                  {/* Emiten Terkait -> Langsung ke Terminal */}
                  {story.tickers.length > 0 && (
                    <div className="space-y-2">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#676E7E]">
                        Buka langsung di Terminal Riset
                      </span>
                      <div className="flex flex-wrap items-center gap-2 font-mono tnum">
                        {story.tickers.map((ticker) => {
                          const isMatched = watchlistSet.has(ticker);
                          return (
                            <button
                              key={ticker}
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectStockFromNews(ticker, "", story.title, story);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-semibold transition ${
                                isMatched
                                  ? "bg-[#1E7B85] text-white border-[#1E7B85] hover:bg-[#166068]"
                                  : "bg-[#F4F3EE] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border-[#D5D7DC] hover:border-[#1E7B85]"
                              }`}
                            >
                              <span>{ticker}</span>
                              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Baris 5: Bar Aksi Utama */}
            <div className="px-5 py-3.5 border-t border-[#E5E5DC] bg-[#F4F3EE] flex flex-wrap items-center gap-2.5 shrink-0">
              {onAskAiLiveNews && (
                <MagneticButton
                  onClick={() => {
                    onClose();
                    onAskAiLiveNews(story);
                  }}
                  className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#1E7B85] hover:bg-[#166068] text-white text-xs font-semibold tracking-wide transition"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Bedah Dampak AI</span>
                </MagneticButton>
              )}

              <a
                href={story.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#FBFBFA] hover:bg-[#1D1F23] text-[#1D1F23] hover:text-white border border-[#1D1F23] text-xs font-semibold tracking-wide transition"
              >
                <span>Baca Artikel Asli</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>

              {onToggleBookmark && (
                <button
                  type="button"
                  onClick={() => onToggleBookmark(story)}
                  aria-pressed={isBookmarked}
                  title={isBookmarked ? "Hapus dari berita tersimpan" : "Simpan berita ini"}
                  aria-label={isBookmarked ? "Hapus dari berita tersimpan" : "Simpan berita ini"}
                  className={`h-[38px] px-3 inline-flex items-center justify-center gap-1.5 border text-xs font-medium transition ${
                    isBookmarked
                      ? "bg-[#1E7B85]/12 border-[#1E7B85] text-[#1E7B85]"
                      : "bg-[#FBFBFA] hover:bg-[#E5E5DC] text-[#676E7E] hover:text-[#1D1F23] border-[#D5D7DC]"
                  }`}
                >
                  <Bookmark
                    className={`w-3.5 h-3.5 ${isBookmarked ? "fill-[#1E7B85]" : ""}`}
                    aria-hidden="true"
                  />
                  <span className="hidden sm:inline">{isBookmarked ? "Tersimpan" : "Simpan"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyLink}
                title="Salin tautan berita"
                aria-label="Salin tautan berita"
                className="h-[38px] px-3 inline-flex items-center justify-center gap-1 bg-[#FBFBFA] hover:bg-[#E5E5DC] text-[#676E7E] hover:text-[#1D1F23] border border-[#D5D7DC] text-xs font-medium transition"
              >
                {copiedId === story.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0D6343]" aria-hidden="true" />
                    <span className="text-[#0D6343]">Disalin</span>
                  </>
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Baris 6: Footer Navigasi Antar Berita */}
            <div className="px-5 py-2.5 border-t border-[#E5E5DC] bg-[#FBFBFA] flex items-center justify-between text-[11px] shrink-0">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => onNavigateStory("prev")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#D5D7DC] text-[#1D1F23] hover:border-[#1E7B85] hover:text-[#1E7B85] disabled:opacity-35 disabled:pointer-events-none font-medium transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sebelumnya</span>
              </button>

              <span className="font-mono text-[10px] text-[#848B99] hidden sm:inline">
                Gunakan tombol &larr; / &rarr; atau Esc
              </span>

              <button
                type="button"
                disabled={!hasNext}
                onClick={() => onNavigateStory("next")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#D5D7DC] text-[#1D1F23] hover:border-[#1E7B85] hover:text-[#1E7B85] disabled:opacity-35 disabled:pointer-events-none font-medium transition"
              >
                <span>Berikutnya</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );

  if (!isClient) return null;
  return createPortal(drawerContent, document.body);
};
