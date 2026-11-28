"use client";

import React, { useRef } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

/**
 * Kurva & spring fisika cepat ala trading terminal modern (Rax Trade / Fey / Koyfin):
 * respons instan, damping tinggi, tanpa pantulan berlebih.
 */
export const EASE_TERMINAL = [0.16, 1, 0.3, 1] as const;

export const SPRING_SNAP = {
  type: "spring" as const,
  stiffness: 440,
  damping: 34,
  mass: 0.65,
};

export const SPRING_GAUGE = {
  type: "spring" as const,
  stiffness: 180,
  damping: 22,
  mass: 0.85,
};

function isFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Latar belakang ambient khusus mode Terminal:
 * Obsidian horizon glow teal ultra-halus + micro telemetry grid yang tetap
 * menjaga kontras tinggi pada seluruh tabel dan angka finansial.
 */
export const TerminalAmbientBackdrop: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      data-testid="terminal-ambient-backdrop"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Horizon Teal Ambient Glow */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[420px] rounded-full opacity-[0.16] blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(45, 212, 191, 0.28) 0%, rgba(30, 123, 133, 0.14) 45%, transparent 72%)",
        }}
      />

      {/* Micro Telemetry Grid */}
      {!shouldReduceMotion && (
        <div
          className="absolute inset-0 opacity-[0.032]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 100%)",
          }}
        />
      )}
    </div>
  );
};

/**
 * Permukaan kartu Matte Obsidian dengan pointer-tracking teal spotlight
 * murni GPU (MotionValue + useMotionTemplate, 0 React re-render).
 */
interface TerminalSpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  spotlightSize?: number;
}

export const TerminalSpotlightCard: React.FC<TerminalSpotlightCardProps> = ({
  children,
  className = "",
  spotlightSize = 300,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(-400);
  const mouseY = useMotionValue(-400);
  const glowOpacity = useMotionValue(0);
  const smoothOpacity = useSpring(glowOpacity, { stiffness: 240, damping: 28 });

  const spotlightBg = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, rgba(45, 212, 191, 0.085), transparent 74%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !isFinePointer() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
    glowOpacity.set(1);
  };

  const handlePointerLeave = () => {
    glowOpacity.set(0);
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative bg-[#0F131C] border border-white/[0.07] hover:border-[#1E7B85]/45 transition-colors duration-200 ${className}`}
    >
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          style={{
            background: spotlightBg,
            opacity: smoothOpacity,
          }}
          className="pointer-events-none absolute inset-0 z-[1]"
        />
      )}
      {children}
    </div>
  );
};

/**
 * Transisi mikro untuk angka harga / KPI saat ganti emiten atau harga ter-update
 * dengan flash tipis semantik Emerald/Coral ala Fey/Koyfin.
 */
interface PriceTickFlashProps {
  valueKey: string | number;
  isPositive?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PriceTickFlash: React.FC<PriceTickFlashProps> = ({
  valueKey,
  isPositive = true,
  children,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={String(valueKey)}
        initial={{
          opacity: 0.6,
          y: isPositive ? 4 : -4,
          backgroundColor: isPositive
            ? "rgba(34, 197, 94, 0.16)"
            : "rgba(239, 68, 68, 0.16)",
        }}
        animate={{
          opacity: 1,
          y: 0,
          backgroundColor: "rgba(0, 0, 0, 0)",
        }}
        exit={{ opacity: 0.35 }}
        transition={{ duration: 0.28, ease: EASE_TERMINAL }}
        className={`inline-block rounded px-0.5 -mx-0.5 ${className}`}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
};
