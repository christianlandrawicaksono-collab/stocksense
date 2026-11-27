"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Bookmark, Quote, Search } from "lucide-react";
import { EASE_PREMIUM } from "./newsMotion";

interface NewsFloatingDockProps {
  visible: boolean;
  isTodayActive: boolean;
  todayCount: number;
  isSavedActive: boolean;
  savedCount: number;
  onFocusSearch: () => void;
  onToggleToday: () => void;
  onToggleSaved: () => void;
  onJumpToBrief: () => void;
  onScrollToTop: () => void;
}

/**
 * Floating Quick-Action Pill Dock yang muncul saat scroll jauh (menggabungkan
 * tombol Kembali ke atas + Cari (/) + Hari ini + Tersimpan + Ringkasan dalam satu bar ringkas).
 */
export const NewsFloatingDock: React.FC<NewsFloatingDockProps> = ({
  visible,
  isTodayActive,
  todayCount,
  isSavedActive,
  savedCount,
  onFocusSearch,
  onToggleToday,
  onToggleSaved,
  onJumpToBrief,
  onScrollToTop,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="news-floating-dock"
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.24, ease: EASE_PREMIUM }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-3 max-w-[96vw]"
        >
          <nav
            aria-label="Aksi cepat berita"
            className="pointer-events-auto inline-flex items-center gap-1 p-1.5 rounded-full bg-[#1D1F23]/92 backdrop-blur-md text-white border border-white/15 shadow-xl text-[11px]"
          >
            <button
              type="button"
              onClick={onFocusSearch}
              title="Fokus pencarian berita (pintasan /)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-white/10 text-white/90 hover:text-white font-medium transition"
            >
              <Search className="w-3.5 h-3.5 text-[#5EEAD4]" aria-hidden="true" />
              <span className="hidden sm:inline">Cari</span>
              <kbd className="hidden md:inline-block px-1 py-0.2 bg-white/10 text-[9px] font-mono text-white/75 rounded">
                /
              </kbd>
            </button>

            <span className="w-px h-4 bg-white/15" aria-hidden="true" />

            <button
              type="button"
              aria-pressed={isTodayActive}
              onClick={onToggleToday}
              title="Saring berita hari ini (WIB)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-medium transition ${
                isTodayActive
                  ? "bg-[#1E7B85] text-white font-semibold"
                  : "hover:bg-white/10 text-white/85 hover:text-white"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  isTodayActive ? "bg-[#5EEAD4]" : "bg-[#2EB886]"
                }`}
              />
              <span>Hari ini</span>
              <span className="font-mono text-[10px] text-white/75 tnum">({todayCount})</span>
            </button>

            <button
              type="button"
              aria-pressed={isSavedActive}
              onClick={onToggleSaved}
              title="Tampilkan berita tersimpan"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-medium transition ${
                isSavedActive
                  ? "bg-[#1E7B85] text-white font-semibold"
                  : "hover:bg-white/10 text-white/85 hover:text-white"
              }`}
            >
              <Bookmark
                className={`w-3 h-3 ${isSavedActive ? "fill-white" : ""}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Tersimpan</span>
              <span className="font-mono text-[10px] text-white/75 tnum">({savedCount})</span>
            </button>

            <button
              type="button"
              onClick={onJumpToBrief}
              title="Lompat ke Ringkasan Pasar Hari Ini"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-white/10 text-white/85 hover:text-white font-medium transition"
            >
              <Quote className="w-3 h-3 text-[#5EEAD4]" aria-hidden="true" />
              <span>Ringkasan</span>
            </button>

            <span className="w-px h-4 bg-white/15" aria-hidden="true" />

            <button
              type="button"
              onClick={onScrollToTop}
              aria-label="Kembali ke atas"
              title="Kembali ke atas"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-[#1E7B85] text-white font-semibold transition"
            >
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Atas</span>
            </button>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
