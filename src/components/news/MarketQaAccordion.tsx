"use client";

import React, { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Plus } from "lucide-react";
import type { LiveMarketNewsItem } from "@/types/market";
import type { MarketQaItem } from "@/lib/news-brief";
import { EASE_PREMIUM, SpotlightSurface } from "./newsMotion";

interface MarketQaAccordionProps {
  items: MarketQaItem[];
  watchlistSet: ReadonlySet<string>;
  onOpenStoryPreview: (story: LiveMarketNewsItem) => void;
  onSelectStockFromNews: (
    ticker: string,
    newsId: string,
    newsTitle: string,
    liveItem?: LiveMarketNewsItem
  ) => void;
}

/**
 * Split Accordion Editorial terinspirasi 08 / FAQ NewMinds Studio:
 * Kolom kiri (4 col) indeks & tajuk editorial, kolom kanan (8 col) daftar baris hairline
 * dengan ikon '+' berputar 45° dan default tertutup agar halaman tetap ringkas.
 */
export const MarketQaAccordion: React.FC<MarketQaAccordionProps> = ({
  items,
  watchlistSet,
  onOpenStoryPreview,
  onSelectStockFromNews,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <SpotlightSurface className="bg-[#FBFBFA]/88 backdrop-blur-[1px] border-y border-[#D5D7DC] py-7">
      <section
        aria-label="Konteks dan tanya jawab pasar"
        className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
      >
        {/* Kolom Kiri: Indeks & Tajuk Editorial */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.12em] text-[#1E7B85] uppercase">
            <span>03 /</span>
            <span className="text-[#676E7E] font-semibold">Konteks Pasar</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1D1F23] leading-snug">
            Tanya jawab singkat kondisi pasar hari ini
          </h2>
          <p className="text-xs text-[#676E7E] leading-relaxed">
            Sintesis cepat dari seluruh berita terpercaya dan indikator makro yang sedang aktif. Klik salah satu pertanyaan untuk membuka detailnya.
          </p>
        </div>

        {/* Kolom Kanan: Hairline-Ruled Interactive Accordion */}
        <div className="lg:col-span-8 divide-y divide-[#D5D7DC] border-t border-b border-[#D5D7DC]">
          {items.map((item, idx) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="group">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`qa-panel-${item.id}`}
                  onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                  className="w-full py-4 px-2 -mx-2 flex items-center justify-between gap-4 text-left hover:bg-[#F4F3EE]/80 transition-colors"
                >
                  <div className="min-w-0 flex items-baseline gap-3">
                    <span className="font-mono text-[11px] font-bold text-[#1E7B85] shrink-0 tnum">
                      0{idx + 1}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[#848B99]">
                        {item.eyebrow}
                      </span>
                      <span
                        className={`block text-sm sm:text-[15px] font-serif font-bold leading-snug transition-colors ${
                          isOpen
                            ? "text-[#1E7B85]"
                            : "text-[#1D1F23] group-hover:text-[#1E7B85]"
                        }`}
                      >
                        {item.question}
                      </span>
                    </div>
                  </div>

                  <motion.span
                    aria-hidden="true"
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.24, ease: EASE_PREMIUM }}
                    className={`w-8 h-8 rounded-full border inline-flex items-center justify-center shrink-0 transition-colors ${
                      isOpen
                        ? "bg-[#1E7B85] border-[#1E7B85] text-white"
                        : "bg-[#FBFBFA] border-[#C5C7CE] text-[#1D1F23] group-hover:border-[#1E7B85] group-hover:text-[#1E7B85]"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`qa-panel-${item.id}`}
                      key={`panel-${item.id}`}
                      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0.12 : 0.28, ease: EASE_PREMIUM }}
                      className="overflow-hidden"
                    >
                      <div className="pl-8 pr-2 pb-4 pt-1 space-y-3">
                        <p className="text-xs sm:text-[13.5px] text-[#4E5563] leading-[1.68]">
                          {item.answer}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {item.tickers && item.tickers.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 font-mono tnum">
                              {item.tickers.map((ticker) => {
                                const isWatched = watchlistSet.has(ticker);
                                return (
                                  <button
                                    key={ticker}
                                    type="button"
                                    onClick={() =>
                                      onSelectStockFromNews(
                                        ticker,
                                        "",
                                        item.relatedStory?.title || item.question,
                                        item.relatedStory
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[11px] font-semibold transition ${
                                      isWatched
                                        ? "bg-[#1E7B85] text-white border-[#1E7B85] hover:bg-[#166068]"
                                        : "bg-[#F4F3EE] hover:bg-[#1E7B85] text-[#1D1F23] hover:text-white border-[#D5D7DC] hover:border-[#1E7B85]"
                                    }`}
                                    title={`Buka ${ticker} di Terminal`}
                                  >
                                    <span>{ticker}</span>
                                    <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span />
                          )}

                          {item.relatedStory && (
                            <button
                              type="button"
                              onClick={() => onOpenStoryPreview(item.relatedStory!)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E7B85] hover:underline"
                            >
                              <span>Buka berita terkait</span>
                              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </SpotlightSurface>
  );
};
