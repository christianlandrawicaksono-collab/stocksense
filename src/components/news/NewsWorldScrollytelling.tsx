"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Compass,
  ExternalLink,
  Eye,
  Globe2,
  Radio,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus as MinusIcon,
} from "lucide-react";
import {
  buildGlobalNewsChaptersAndPins,
  type GlobalNewsChapterData,
  type GlobalNewsChapterId,
  type GlobalNewsItem,
  type GlobalNewsPinId,
  type GlobeNewsPin,
} from "@/lib/global-news";
import type { GlobeVisualTheme } from "@/components/terminal/WorldGlobe3D";
import type { LiveMarketNewsItem, SentimentType } from "@/types/market";

const WorldGlobe3D = dynamic(
  () => import("@/components/terminal/WorldGlobe3D").then((m) => m.WorldGlobe3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center bg-transparent text-[#5A6068] text-xs gap-2.5">
        <span className="w-5 h-5 rounded-full border-2 border-[#0D7680]/25 border-t-[#0D7680] animate-spin" />
        <span className="font-mono text-[11px] tracking-wide">
          Menyiapkan 3D Global Atlas...
        </span>
      </div>
    ),
  }
);

const EASE_CINEMATIC: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface NewsChapterJumpRequest {
  chapterId: GlobalNewsChapterId;
  nonce: number;
}

interface NewsWorldScrollytellingProps {
  globalItems: GlobalNewsItem[];
  domesticItems: LiveMarketNewsItem[];
  isLoading: boolean;
  isFallback: boolean;
  updatedAtWib: string;
  onRefresh: () => void;
  onSelectBeiStock: (ticker: string) => void;
  onAskAiGlobalNews: (item: GlobalNewsItem, chapter: GlobalNewsChapterData) => void;
  onJumpToEditorial: () => void;
  jumpRequest?: NewsChapterJumpRequest | null;
}

function getEditorialSentimentMeta(sentiment: SentimentType) {
  if (sentiment === "BULLISH") {
    return {
      label: "Sentimen Positif",
      shortLabel: "Positif",
      textClass: "text-[#0D6343]",
      badgeClass: "text-[#0D6343] border-[#0D6343]/30 bg-[#0D6343]/[0.06]",
      dotClass: "bg-[#0D6343]",
      Icon: TrendingUp,
    };
  }
  if (sentiment === "BEARISH") {
    return {
      label: "Sentimen Waspada",
      shortLabel: "Negatif",
      textClass: "text-[#990F3D]",
      badgeClass: "text-[#990F3D] border-[#990F3D]/30 bg-[#990F3D]/[0.06]",
      dotClass: "bg-[#990F3D]",
      Icon: TrendingDown,
    };
  }
  return {
    label: "Sentimen Campuran",
    shortLabel: "Netral",
    textClass: "text-[#0F5499]",
    badgeClass: "text-[#0F5499] border-[#0F5499]/30 bg-[#0F5499]/[0.06]",
    dotClass: "bg-[#0F5499]",
    Icon: MinusIcon,
  };
}

interface ChapterStoryCardProps {
  chapter: GlobalNewsChapterData;
  isActive: boolean;
  reducedMotion: boolean;
  onBecomeActive: (chapterId: GlobalNewsChapterId) => void;
  onSelectBeiStock: (ticker: string) => void;
  onAskAiGlobalNews: (item: GlobalNewsItem, chapter: GlobalNewsChapterData) => void;
  activePinId: GlobalNewsPinId;
  onSelectSubPin?: (pinId: GlobalNewsPinId) => void;
}

/**
 * Kartu Bab Gaya Financial Times Broadsheet Modern:
 * - Zero nested boxes: 1 lembaran editorial tipis + hairline dividers (`divide-y`) antar berita
 * - Pull-quote Impact BEI ber-garis kiri 3px (tanpa box abu-abu)
 * - Tipografi Literata serif lega + nomor urut italic editorial
 */
const ChapterStoryCard: React.FC<ChapterStoryCardProps> = ({
  chapter,
  isActive,
  reducedMotion,
  onBecomeActive,
  onSelectBeiStock,
  onAskAiGlobalNews,
  activePinId,
  onSelectSubPin,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const titleWrapRef = useRef<HTMLDivElement>(null);
  const isInReadingBand = useInView(sectionRef, {
    margin: "-32% 0px -42% 0px",
    amount: "some",
  });
  const isTitleVisible = useInView(titleWrapRef, {
    once: true,
    amount: 0.1,
  });

  useEffect(() => {
    if (isInReadingBand) {
      onBecomeActive(chapter.id);
    }
  }, [isInReadingBand, chapter.id, onBecomeActive]);

  const { scrollYProgress: cardScroll } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const watermarkY = useTransform(cardScroll, [0, 1], reducedMotion ? [0, 0] : [-22, 22]);
  const sentiment = getEditorialSentimentMeta(chapter.dominantSentiment);
  const SentimentIcon = sentiment.Icon;

  return (
    <section
      ref={sectionRef}
      id={`news-chapter-${chapter.id}`}
      data-news-chapter={chapter.id}
      aria-label={`Region ${chapter.numberLabel}: ${chapter.title}`}
      className={`pointer-events-auto relative scroll-mt-24 border-t-2 border-x border-b px-5 sm:px-7 py-6 transition-all duration-300 overflow-hidden backdrop-blur-md ${
        isActive
          ? "bg-[#FBFBFA]/92 border-t-[#1D1F23] border-x-[#E5E1D8]/85 border-b-[#E5E1D8] shadow-[0_22px_54px_rgba(29,31,35,0.08)]"
          : "bg-[#FBFBFA]/78 border-t-[#CFCAC0] border-x-[#EAE6DD]/70 border-b-[#EAE6DD] hover:bg-[#FBFBFA]/90"
      }`}
    >
      {/* Asymmetrical Parallax Watermark Numeral */}
      <motion.span
        aria-hidden="true"
        style={{ y: watermarkY }}
        className="pointer-events-none select-none absolute -top-2 right-4 font-serif italic font-bold text-[96px] sm:text-[112px] leading-none tracking-tighter text-[#1D1F23]/[0.04]"
      >
        {chapter.numberLabel}
      </motion.span>

      {/* Header Bab — Editorial FT Kicker + Serif Headline */}
      <div className="relative z-10 space-y-2 pb-4 border-b border-[#E3DFD5]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
            <span className="font-bold" style={{ color: chapter.accentHex }}>
              {chapter.numberLabel} · {chapter.shortLabel}
            </span>
            <span className="text-[#C6C1B7]">/</span>
            <span className="text-[#676E7E]">{chapter.cityLabel}</span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-medium ${sentiment.badgeClass}`}
          >
            <SentimentIcon className="w-3 h-3" aria-hidden="true" />
            <span>{sentiment.label}</span>
          </span>
        </div>

        {/* Kinetic Masked Typography */}
        <div ref={titleWrapRef} className="overflow-hidden">
          <motion.h2
            initial={reducedMotion ? false : { y: "100%", opacity: 0 }}
            animate={
              reducedMotion || isTitleVisible || isActive
                ? { y: "0%", opacity: 1 }
                : { y: "100%", opacity: 0 }
            }
            transition={{ duration: 0.55, ease: EASE_CINEMATIC }}
            className="text-2xl sm:text-[28px] font-serif font-bold tracking-tight text-[#1D1F23] leading-[1.15]"
          >
            {chapter.title}
          </motion.h2>
        </div>

        <p className="text-[12.5px] sm:text-[13px] text-[#555B66] leading-relaxed max-w-xl">
          {chapter.subtitle}
        </p>

        {/* Sub-pin Asia (Shanghai / Tokyo) */}
        {chapter.id === "ASIA" && onSelectSubPin && (
          <div className="flex items-center gap-2 pt-1 text-[10.5px] font-mono">
            <span className="text-[#787F8D]">Fokus pin:</span>
            {(["CN", "JP"] as const).map((subPin) => (
              <button
                key={subPin}
                type="button"
                data-cursor-hint="Fokus Pin"
                onClick={() => onSelectSubPin(subPin)}
                className={`px-2 py-0.5 border-b-2 transition ${
                  activePinId === subPin
                    ? "border-[#0D6343] text-[#0D6343] font-bold"
                    : "border-transparent text-[#676E7E] hover:text-[#1D1F23]"
                }`}
              >
                {subPin === "CN" ? "Shanghai" : "Tokyo"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pull-Quote Impact BEI ala FT (Zero Grey Box — Garis Kiri 3px FT Teal!) */}
      <div
        className="relative z-10 mt-4 pl-3.5 py-0.5 border-l-[3px] space-y-2"
        style={{ borderLeftColor: chapter.accentHex }}
      >
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.12em]">
          <span className="inline-flex items-center gap-1.5 text-[#0D7680] font-bold">
            <Radio className="w-3 h-3" aria-hidden="true" />
            <span>Impact ke IHSG &amp; Saham BEI</span>
          </span>
          <span className="text-[#848B99] hidden sm:inline">Klik ticker → Terminal</span>
        </div>
        <p className="text-[12.5px] text-[#353A44] leading-relaxed">
          {chapter.transmissionNote}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {chapter.sensitiveBeiTickers.map((ticker) => (
            <button
              key={`${chapter.id}-${ticker}`}
              type="button"
              data-cursor-hint="Buka Terminal"
              onClick={() => onSelectBeiStock(ticker)}
              className="group/pill inline-flex items-center gap-1 px-2 py-0.5 bg-[#F3F0E9] hover:bg-[#1D1F23] text-[11px] font-mono font-semibold text-[#1D1F23] hover:text-white transition active:scale-95"
              title={`Buka analisis saham ${ticker} di Terminal`}
            >
              <span>{ticker}</span>
              <ArrowUpRight
                className="w-3 h-3 text-[#0D7680] group-hover/pill:text-[#5EEAD4] transition-transform group-hover/pill:translate-x-0.5 group-hover/pill:-translate-y-0.5"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Daftar Berita Kawasan — Hairline Broadsheet Stream (ZERO Nested Boxes!) */}
      <div className="relative z-10 mt-5 divide-y divide-[#E4E0D6] border-t border-[#E4E0D6]">
        {chapter.items.map((item, idx) => {
          const itemSent = getEditorialSentimentMeta(item.sentiment);
          const isEnglish = item.language === "EN";
          return (
            <article key={item.id} className="group py-4 first:pt-3.5 last:pb-1">
              <div className="flex items-start gap-3">
                {/* Nomor Urut Italic Serif Editorial */}
                <span className="font-serif italic text-sm font-semibold text-[#9A958A] pt-0.5 shrink-0 select-none tnum">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`font-bold uppercase tracking-[0.1em] ${
                          isEnglish ? "text-[#0F5499]" : "text-[#0D7680]"
                        }`}
                      >
                        {isEnglish ? "Global EN" : "Domestik ID"}
                      </span>
                      <span className="text-[#C6C1B7]">&bull;</span>
                      <span className="text-[#1D1F23] font-semibold">{item.publisher}</span>
                      <span className="text-[#C6C1B7]">&bull;</span>
                      <span className="text-[#676E7E]">{item.publishedWib}</span>
                    </div>

                    <span className={`inline-flex items-center gap-1 font-medium ${itemSent.textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${itemSent.dotClass}`} />
                      <span>{itemSent.shortLabel}</span>
                    </span>
                  </div>

                  <h3 className="text-[15.5px] sm:text-[16.5px] font-serif font-bold text-[#1D1F23] leading-[1.3]">
                    {item.link && item.link !== "#" ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-cursor-hint="Baca Sumber"
                        className="editorial-link-sweep hover:text-[#0D7680] transition-colors"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span>{item.title}</span>
                    )}
                  </h3>

                  {item.summary && (
                    <p className="text-xs text-[#5A6068] leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                  )}

                  {/* Baris Aksi Ringan Tanpa Box Berat */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <button
                      type="button"
                      data-cursor-hint="Bedah AI"
                      onClick={() => onAskAiGlobalNews(item, chapter)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0D7680]/[0.09] hover:bg-[#0D7680] text-[#0D7680] hover:text-white font-semibold transition active:scale-[0.98]"
                    >
                      <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>
                        {isEnglish
                          ? "Translate & Bedah Impact (AI)"
                          : "Bedah Impact ke IHSG (AI)"}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      {item.impactTickers.slice(0, 2).map((t) => (
                        <button
                          key={`${item.id}-${t}`}
                          type="button"
                          data-cursor-hint="Buka Terminal"
                          onClick={() => onSelectBeiStock(t)}
                          className="font-mono text-[10.5px] font-semibold text-[#4E5563] hover:text-[#0D7680] underline decoration-[#D4CFC5] underline-offset-4 hover:decoration-[#0D7680] transition"
                        >
                          {t}
                        </button>
                      ))}
                      {item.link && item.link !== "#" && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-cursor-hint="Baca Sumber"
                          aria-label={`Baca sumber asli: ${item.title}`}
                          className="inline-flex items-center gap-1 text-[#676E7E] hover:text-[#1D1F23] transition pl-1"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export const NewsWorldScrollytelling: React.FC<NewsWorldScrollytellingProps> = ({
  globalItems,
  domesticItems,
  isLoading,
  isFallback,
  updatedAtWib,
  onRefresh,
  onSelectBeiStock,
  onAskAiGlobalNews,
  onJumpToEditorial,
  jumpRequest = null,
}) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { chapters, pins } = useMemo(
    () => buildGlobalNewsChaptersAndPins(globalItems, domesticItems),
    [globalItems, domesticItems]
  );

  const [activeChapterId, setActiveChapterId] = useState<GlobalNewsChapterId>("US");
  const [selectedPinOverride, setSelectedPinOverride] = useState<GlobalNewsPinId | null>(null);
  const [globeStyle, setGlobeStyle] = useState<Exclude<GlobeVisualTheme, "dark-orbital">>(
    "editorial-atlas"
  );
  const [isExploreMode, setIsExploreMode] = useState<boolean>(false);
  const [isPastOpeningHero, setIsPastOpeningHero] = useState<boolean>(false);
  const [isGlobeDockVisible, setIsGlobeDockVisible] = useState<boolean>(true);
  const programmaticScrollUntilRef = useRef<number>(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef<number>(0);
  const viewOffsetXRef = useRef<number>(0);

  const { scrollYProgress: stageProgress } = useScroll({
    target: stageRef,
    offset: ["start start", "end end"],
  });

  // Garis progres vertikal 1A Timeline Rail
  const railFillHeight = useTransform(stageProgress, [0, 1], ["10%", "100%"]);

  const computeOffsetFromProgress = useCallback(
    (progress: number, explore: boolean): number => {
      if (explore) return 0;
      const t = Math.max(0, Math.min(1, (progress - 0.05) / 0.13));
      const smoothStep = t * t * (3 - 2 * t);
      return smoothStep * 0.195;
    },
    []
  );

  useMotionValueEvent(stageProgress, "change", (latest) => {
    scrollProgressRef.current = latest;
    viewOffsetXRef.current = computeOffsetFromProgress(latest, isExploreMode);
    const pastHero = latest > 0.08;
    setIsPastOpeningHero((prev) => (prev === pastHero ? prev : pastHero));
  });

  useEffect(() => {
    viewOffsetXRef.current = computeOffsetFromProgress(scrollProgressRef.current, isExploreMode);
  }, [isExploreMode, computeOffsetFromProgress]);

  useEffect(() => {
    const updateDockVisibility = () => {
      const editorialEl = document.getElementById("editorial-paper-section");
      if (!editorialEl) {
        setIsGlobeDockVisible(true);
        return;
      }
      // Sembunyikan 2A Globe Dock secara mulus begitu Edisi Domestik BEI masuk separuh layar
      const rect = editorialEl.getBoundingClientRect();
      setIsGlobeDockVisible(rect.top > window.innerHeight * 0.55);
    };
    updateDockVisibility();
    window.addEventListener("scroll", updateDockVisibility, { passive: true });
    window.addEventListener("resize", updateDockVisibility, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateDockVisibility);
      window.removeEventListener("resize", updateDockVisibility);
    };
  }, []);

  // Pintasan keyboard 'H' untuk toggle Mode Jelajah Bumi Bebas UI
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (e.key === "h" || e.key === "H") {
        setIsExploreMode((prev) => !prev);
      } else if (e.key === "Escape" && isExploreMode) {
        setIsExploreMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isExploreMode]);

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === activeChapterId) ?? chapters[0],
    [chapters, activeChapterId]
  );

  const activePinId: GlobalNewsPinId = useMemo(() => {
    if (selectedPinOverride) {
      const matched = pins.find((p) => p.id === selectedPinOverride);
      if (matched && matched.chapterId === activeChapterId) {
        return selectedPinOverride;
      }
    }
    return activeChapter?.pinId ?? "US";
  }, [selectedPinOverride, pins, activeChapterId, activeChapter]);

  const jumpToChapter = useCallback(
    (chapterId: GlobalNewsChapterId, pinOverride?: GlobalNewsPinId) => {
      setIsExploreMode(false);
      programmaticScrollUntilRef.current = Date.now() + 850;
      setActiveChapterId(chapterId);
      setSelectedPinOverride(pinOverride ?? null);

      const el = document.getElementById(`news-chapter-${chapterId}`);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    if (!jumpRequest) return;
    const timer = window.setTimeout(() => {
      jumpToChapter(jumpRequest.chapterId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [jumpRequest, jumpToChapter]);

  const handleScrollChapterBecomeActive = useCallback((chapterId: GlobalNewsChapterId) => {
    if (Date.now() < programmaticScrollUntilRef.current) return;
    setActiveChapterId(chapterId);
    setSelectedPinOverride(null);
  }, []);

  const handleSelectNewsPin = useCallback(
    (pin: GlobeNewsPin) => {
      if (isExploreMode) {
        setActiveChapterId(pin.chapterId);
        setSelectedPinOverride(pin.id);
        return;
      }
      jumpToChapter(pin.chapterId, pin.id);
    },
    [isExploreMode, jumpToChapter]
  );

  const handleToggleGlobeStyle = useCallback(() => {
    setGlobeStyle((prev) =>
      prev === "editorial-atlas" ? "editorial-cartography" : "editorial-atlas"
    );
  }, []);

  const handleToggleExploreMode = useCallback(() => {
    setIsExploreMode((prev) => !prev);
  }, []);

  const totalStoriesTracked = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.items.length, 0),
    [chapters]
  );

  const activeSentiment = getEditorialSentimentMeta(activeChapter?.dominantSentiment ?? "NEUTRAL");

  return (
    <div
      ref={stageRef}
      id="news-world-hero"
      className="relative w-full bg-[#FBFBFA] text-[#1D1F23] overflow-x-clip"
    >
      {/* Dynamic Regional Editorial Pastel Wash */}
      <motion.div
        aria-hidden="true"
        animate={{
          background: `radial-gradient(58% 48% at 32% 38%, ${
            activeChapter?.ambientRgba ?? "rgba(15, 84, 153, 0.08)"
          }, rgba(251, 251, 250, 0) 74%)`,
        }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.85, ease: "easeOut" }}
        className="pointer-events-none fixed inset-0 z-0"
      />

      {/* LAYER 0 (STICKY FULL-BLEED): BUMI 3D + 1A VERTICAL TIMELINE RAIL + 2A UNIFIED BOTTOM-LEFT DOCK */}
      <div className="sticky top-14 h-[calc(100dvh-3.5rem)] w-full">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 48%, rgba(244, 242, 236, 0.25) 0%, rgba(251, 251, 250, 0.92) 76%)",
          }}
        />

        <WorldGlobe3D
          newsPins={pins}
          selectedNewsPinId={activePinId}
          onSelectNewsPin={handleSelectNewsPin}
          cameraZoomBias={-0.16}
          scrollBehavior="scrollytelling"
          scrollProgressRef={scrollProgressRef}
          viewOffsetXRatioRef={viewOffsetXRef}
          visualTheme={globeStyle}
          seamless
          onToggleEditorialStyle={handleToggleGlobeStyle}
          isExploreMode={isExploreMode}
          onToggleExploreMode={handleToggleExploreMode}
          showFixedDock={isGlobeDockVisible}
          reducedMotion={prefersReducedMotion}
        />

        {/* 1A: VERTICAL EDITORIAL TIMELINE RAIL (Sticky di Tepi Kiri dengan backing kaca tipis agar selalu kontras tajam) */}
        <AnimatePresence>
          {!isExploreMode && (
            <motion.aside
              key="vertical-timeline-rail"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
              aria-label="Navigasi Timeline 5 Region"
              className="pointer-events-auto hidden lg:flex flex-col gap-3 absolute left-5 top-[56%] -translate-y-1/2 z-20 px-3 py-2.5 bg-[#FBFBFA]/82 backdrop-blur-md border border-[#E3DFD5]/80 shadow-[0_6px_22px_rgba(29,31,35,0.06)]"
            >
              <div className="relative pl-5 py-1 space-y-3">
                {/* Rel 1px vertikal + progress fill FT Teal */}
                <div
                  aria-hidden="true"
                  className="absolute left-[5px] top-2 bottom-2 w-[1.5px] bg-[#DCD7CC]"
                >
                  <motion.div
                    style={{ height: railFillHeight }}
                    className="w-full bg-[#0D7680] origin-top"
                  />
                </div>

                {chapters.map((chapter) => {
                  const isSel = chapter.id === activeChapterId;
                  return (
                    <button
                      key={`rail-${chapter.id}`}
                      type="button"
                      onClick={() => jumpToChapter(chapter.id)}
                      aria-current={isSel ? "step" : undefined}
                      data-cursor-hint="Pindah Region"
                      className="group relative flex items-center gap-2 text-left transition-colors"
                    >
                      {/* Node dot pada garis rel */}
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[20px] rounded-full border transition-all duration-200 ${
                          isSel
                            ? "w-3 h-3 -ml-[0.5px] border-white shadow-sm"
                            : "w-2 h-2 ml-[1.5px] bg-[#FBFBFA] border-[#9A958A] group-hover:border-[#0D7680]"
                        }`}
                        style={isSel ? { backgroundColor: chapter.accentHex } : undefined}
                      />

                      <span
                        className={`font-mono text-[10px] tnum transition-colors ${
                          isSel ? "font-bold text-[#0D7680]" : "text-[#848B99] group-hover:text-[#1D1F23]"
                        }`}
                      >
                        {chapter.numberLabel}
                      </span>
                      <span
                        className={`text-[11.5px] transition-all whitespace-nowrap ${
                          isSel
                            ? "font-serif font-bold text-[#1D1F23] translate-x-0.5"
                            : "font-sans text-[#676E7E] group-hover:text-[#1D1F23]"
                        }`}
                      >
                        {chapter.shortLabel}
                      </span>
                      <span
                        className={`font-mono text-[9.5px] transition-opacity ${
                          isSel ? "text-[#676E7E] opacity-100" : "text-[#9A958A] opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        ({chapter.items.length})
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onJumpToEditorial}
                data-cursor-hint="Berita BEI"
                className="inline-flex items-center gap-1.5 pl-1 text-[10.5px] font-mono uppercase tracking-[0.1em] text-[#0D7680] hover:text-[#1D1F23] font-semibold transition"
              >
                <ArrowDown className="w-3 h-3" aria-hidden="true" />
                <span>Berita BEI</span>
              </button>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Floating Region Focus Pill (kiri-atas saat scroll Bab 01–05) */}
        <AnimatePresence>
          {!isExploreMode && isPastOpeningHero && (
            <motion.div
              key="globe-focus-pill"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="pointer-events-none hidden lg:flex items-center gap-2.5 absolute top-4 left-5 z-20 px-3 py-1.5 bg-[#FBFBFA]/88 backdrop-blur-md border border-[#DCD7CC] shadow-sm text-[11px]"
            >
              <Globe2 className="w-3.5 h-3.5 text-[#0D7680]" aria-hidden="true" />
              <span className="font-mono font-bold text-[#1D1F23]">
                {activeChapter?.numberLabel ?? "01"}/05
              </span>
              <span className="text-[#B7B2A7]">&bull;</span>
              <span className="font-serif font-semibold text-[#1D1F23]">
                {activeChapter?.title}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 border text-[10px] font-medium ${activeSentiment.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeSentiment.dotClass}`} />
                <span>{activeSentiment.shortLabel}</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explore Mode Floating Status Pill */}
        <AnimatePresence>
          {isExploreMode && (
            <motion.div
              key="explore-mode-bar"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 bg-[#1D1F23]/92 backdrop-blur-md text-[#FBFBFA] border border-white/15 shadow-lg text-xs max-w-[94vw]"
            >
              <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-[#5EEAD4]">
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>EXPLORE MODE</span>
              </span>
              <span className="text-white/30 hidden sm:inline">|</span>
              <span className="hidden sm:inline text-white/85">
                Fokus: <strong className="text-white">{activeChapter?.title}</strong> — putar Bumi bebas atau klik hotspot
              </span>
              <button
                type="button"
                onClick={() => setIsExploreMode(false)}
                data-cursor-hint="Tampilkan Berita"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#FBFBFA] hover:bg-white text-[#1D1F23] font-semibold text-[11px] transition"
              >
                <Eye className="w-3 h-3" aria-hidden="true" />
                <span>Tampilkan Berita (H)</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* LAYER 1 (POINTER-EVENTS PASS-THROUGH): BORDERLESS HERO + 5 BAB FT HAIRLINE EDITORIAL CARDS */}
      <div
        className={`relative z-10 -mt-[calc(100dvh-3.5rem)] pointer-events-none transition-opacity duration-300 ${
          isExploreMode ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* STAGE 0: BORDERLESS OPENING HERO (100vh) — TANPA KOTAK PERSEGI & TANPA BAR PEMOTONG BUMI */}
        <section
          aria-label="Global Market Pulse 3D Hero"
          className="min-h-[calc(100dvh-3.5rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 flex flex-col justify-between"
        >
          {/* Kiri-Atas: Tipografi FT Murni Tanpa Kotak Kaku (feathered radial ivory wash halus di belakang teks) */}
          <div
            className="pointer-events-auto relative max-w-[410px] py-2 pr-4 space-y-2.5"
            style={{
              background:
                "radial-gradient(ellipse 95% 95% at 30% 42%, rgba(251, 251, 250, 0.88) 42%, rgba(251, 251, 250, 0) 100%)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.13em] text-[#676E7E]">
              <span className="inline-flex items-center gap-1.5 text-[#0D7680] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0D7680] animate-pulse" />
                <span>Global Market Pulse</span>
              </span>
              <span>&bull;</span>
              <span>5 Region · {totalStoriesTracked} berita</span>
              {updatedAtWib && (
                <span className="hidden sm:inline text-[#848B99]">
                  &bull; {isFallback ? "Kurasi" : `Live ${updatedAtWib}`}
                </span>
              )}
            </div>

            <div className="overflow-hidden">
              <motion.h1
                initial={prefersReducedMotion ? false : { y: "105%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{ duration: 0.65, ease: EASE_CINEMATIC }}
                className="text-[28px] sm:text-[36px] font-serif font-bold tracking-tight text-[#1D1F23] leading-[1.1]"
              >
                Global Market Pulse &amp; Dampaknya ke{" "}
                <span className="italic text-[#0D7680]">IHSG</span>
              </motion.h1>
            </div>

            <p className="text-xs sm:text-[13px] text-[#4E5563] leading-relaxed max-w-[360px]">
              Putar 3D Globe bebas di layar ini, atau scroll ke bawah buat cek isu global yang
              gerakin saham BEI.
            </p>

            {/* Aksi Editorial Ringkas (tanpa duplikasi kontrol Atlas/Explore yg sudah di 2A Dock!) */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11.5px]">
              <button
                type="button"
                onClick={onJumpToEditorial}
                data-cursor-hint="Berita BEI"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D1F23] hover:bg-[#0D7680] text-[#FBFBFA] font-semibold transition active:scale-[0.98]"
              >
                <span>Langsung ke Berita BEI</span>
                <ArrowDown className="w-3 h-3" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                data-cursor-hint="Muat Ulang"
                className="inline-flex items-center gap-1 text-[#4E5563] hover:text-[#0D7680] font-medium transition disabled:opacity-50"
                title="Muat ulang berita global RSS"
              >
                <RotateCcw
                  className={`w-3 h-3 text-[#0D7680] ${isLoading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Refresh</span>
              </button>
            </div>

            {/* Mobile-only Region Jump Strip (rapi tepat di bawah masthead, tidak memotong tengah Bumi!) */}
            <nav
              aria-label="Pilih Region Berita Global Mobile"
              className="lg:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-2"
            >
              {chapters.map((chapter) => {
                const isSel = chapter.id === activeChapterId;
                return (
                  <button
                    key={`mob-${chapter.id}`}
                    type="button"
                    onClick={() => jumpToChapter(chapter.id)}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] border transition ${
                      isSel
                        ? "bg-[#1D1F23] border-[#1D1F23] text-white font-semibold"
                        : "bg-[#FBFBFA]/90 border-[#DCD7CC] text-[#4E5563]"
                    }`}
                  >
                    <span className="font-mono text-[9.5px] opacity-80">{chapter.numberLabel}</span>
                    <span>{chapter.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tengah & Bawah Hero: 100% Bebas Halangan — hanya scroll cue mungil di kanan-bawah pada Desktop */}
          <div className="hidden lg:flex justify-end items-end">
            <button
              type="button"
              onClick={() => jumpToChapter("US")}
              data-cursor-hint="Mulai Tur"
              className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 bg-[#FBFBFA]/82 backdrop-blur-md border border-[#DCD7CC] hover:border-[#0D7680] text-[11px] font-mono text-[#4E5563] hover:text-[#1D1F23] transition"
            >
              <span>Scroll tur 5 region</span>
              <ArrowDown className="w-3 h-3 text-[#0D7680] animate-bounce" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* STAGE 1-5: 5 BAB FT HAIRLINE EDITORIAL CARDS DI KANAN (KIRI 100% BEBAS PUTAR BUMI!) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20">
          <div className="w-full lg:w-[46%] xl:w-[44%] lg:ml-auto space-y-8 sm:space-y-12 lg:space-y-16">
            {chapters.map((chapter) => (
              <ChapterStoryCard
                key={chapter.id}
                chapter={chapter}
                isActive={chapter.id === activeChapterId}
                reducedMotion={prefersReducedMotion}
                onBecomeActive={handleScrollChapterBecomeActive}
                onSelectBeiStock={onSelectBeiStock}
                onAskAiGlobalNews={onAskAiGlobalNews}
                activePinId={activePinId}
                onSelectSubPin={(subPin) => setSelectedPinOverride(subPin)}
              />
            ))}

            {/* Penutup Tur 3D Global → Lanjut ke Feed Domestik BEI */}
            <div className="pointer-events-auto border-t-2 border-t-[#0D7680] border-x border-b border-[#E3DFD5] bg-[#FBFBFA]/92 backdrop-blur-md p-6 shadow-[0_14px_38px_rgba(29,31,35,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-[#0D7680] font-bold">
                  Selesai Tur 5 Region · Lanjut ke Domestik
                </p>
                <h3 className="text-lg font-serif font-bold text-[#1D1F23]">
                  Masuk ke Headline Pasar &amp; Berita BEI Hari Ini
                </h3>
                <p className="text-xs text-[#5A6068]">
                  Market Brief AI, filter media domestik, kawat pasar, &amp; bacaan tersimpan.
                </p>
              </div>
              <button
                type="button"
                onClick={onJumpToEditorial}
                data-cursor-hint="Berita BEI"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#1D1F23] hover:bg-[#0D7680] text-white text-xs font-semibold transition active:scale-95"
              >
                <span>Buka Berita BEI</span>
                <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EditorialPaperCurtainProps {
  children: React.ReactNode;
  onBackToGlobe: () => void;
}

/**
 * Transisi mulus sesama kertas FT (#FBFBFA) yang menutup penuh kanvas sticky 3D Globe
 * (sehingga IntersectionObserver pada WorldGlobe3D otomatis mem-pause GPU 0%) tanpa memutus
 * stacking-context portal NewsReaderDrawer maupun NewsFloatingDock.
 */
export const EditorialPaperCurtain: React.FC<EditorialPaperCurtainProps> = ({
  children,
  onBackToGlobe,
}) => {
  return (
    <div
      id="editorial-paper-section"
      className="relative z-20 w-full bg-[#FBFBFA] text-[#1D1F23] border-t-2 border-[#1D1F23] shadow-[0_-18px_46px_rgba(29,31,35,0.07)] scroll-mt-14"
    >
      {/* Strip Jembatan Editorial FT: Kembali ke 3D Globe */}
      <div className="bg-[#F4F2EC] border-b border-[#E3DFD5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#676E7E]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0D7680]" aria-hidden="true" />
            <span className="uppercase tracking-[0.11em] font-bold text-[#1D1F23]">
              Edisi Domestik BEI
            </span>
            <span className="hidden sm:inline text-[#787F8D]">
              &bull; Lanjutan setelah 3D Global Market Pulse
            </span>
          </div>

          <button
            type="button"
            onClick={onBackToGlobe}
            data-cursor-hint="Ke 3D Globe"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FBFBFA] hover:bg-[#1D1F23] text-[#1D1F23] hover:text-white border border-[#D4CFC5] hover:border-[#1D1F23] text-[10.5px] font-sans font-medium transition"
          >
            <ArrowUp className="w-3 h-3" aria-hidden="true" />
            <span>Kembali ke 3D Globe</span>
          </button>
        </div>
      </div>

      {/* Konten NewsView Editorial Terang Penuh */}
      <div className="relative overflow-x-clip">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">{children}</div>
      </div>
    </div>
  );
};
