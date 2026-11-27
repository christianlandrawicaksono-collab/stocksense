"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { LiveMarketNewsItem } from "@/types/market";
import { EASE_PREMIUM } from "./newsMotion";

interface WireHoverPreviewProps {
  story: LiveMarketNewsItem | null;
  disabled?: boolean;
}

const CARD_WIDTH = 272;
const CARD_EST_HEIGHT = 240;
const OFFSET_X = 22;
const OFFSET_Y = 18;

/**
 * Kartu pratinjau melayang yang mengikuti kursor dengan spring physics
 * saat hover baris berita di 04 / Kawat pasar (khusus desktop pointer halus).
 */
export const WireHoverPreview: React.FC<WireHoverPreviewProps> = ({
  story,
  disabled = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const targetX = useMotionValue(-500);
  const targetY = useMotionValue(-500);

  const smoothX = useSpring(targetX, { stiffness: 280, damping: 28, mass: 0.45 });
  const smoothY = useSpring(targetY, { stiffness: 280, damping: 28, mass: 0.45 });

  useEffect(() => {
    if (disabled || shouldReduceMotion || typeof window === "undefined") return;
    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isFinePointer) return;

    const handlePointerMove = (e: PointerEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nextX =
        e.clientX + OFFSET_X + CARD_WIDTH > vw - 16
          ? Math.max(12, e.clientX - CARD_WIDTH - OFFSET_X)
          : e.clientX + OFFSET_X;
      const nextY =
        e.clientY + OFFSET_Y + CARD_EST_HEIGHT > vh - 16
          ? Math.max(12, e.clientY - CARD_EST_HEIGHT - 12)
          : e.clientY + OFFSET_Y;

      targetX.set(nextX);
      targetY.set(nextY);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [disabled, shouldReduceMotion, targetX, targetY]);

  if (disabled || shouldReduceMotion) return null;

  return (
    <AnimatePresence>
      {story && (
        <motion.div
          key="wire-hover-preview"
          aria-hidden="true"
          style={{ x: smoothX, y: smoothY }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.16, ease: EASE_PREMIUM }}
          className="hidden lg:block fixed top-0 left-0 z-40 w-[272px] pointer-events-none bg-[#FBFBFA] border border-[#1D1F23] shadow-xl overflow-hidden will-change-transform"
        >
          {story.imageUrl && (
            <div className="w-full aspect-[16/10] bg-[#E9E8E2] overflow-hidden border-b border-[#E5E5DC]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-[#676E7E]">
              <span className="font-semibold text-[#1D1F23] truncate">{story.publisher}</span>
              <span
                className={`shrink-0 font-bold ${
                  story.sentiment === "BULLISH"
                    ? "text-[#0D6343]"
                    : story.sentiment === "BEARISH"
                    ? "text-[#B91C1C]"
                    : "text-[#676E7E]"
                }`}
              >
                {story.sentiment === "BULLISH"
                  ? "Positif"
                  : story.sentiment === "BEARISH"
                  ? "Negatif"
                  : "Netral"}
              </span>
            </div>

            <p className="font-serif font-bold text-[13px] text-[#1D1F23] leading-snug line-clamp-2">
              {story.title}
            </p>

            {story.summary && (
              <p className="text-[11px] text-[#676E7E] leading-relaxed line-clamp-2">
                {story.summary}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
