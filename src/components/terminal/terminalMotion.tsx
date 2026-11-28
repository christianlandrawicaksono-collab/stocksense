"use client";

import React, { useEffect, useRef } from "react";
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
 * Dual-Layer Cursor Telemetry System khusus mode Terminal (desktop fine-pointer):
 * 1) Ambient background spotlight 420px yang menyalakan grid di sekitar pointer
 * 2) Precision orbital reticle ring (tetap mempertahankan kursor native OS agar klik trading presisi!)
 * 0 React re-render per pointer move (murni GPU MotionValue + spring).
 */
export const TerminalCursorField: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const rawX = useMotionValue(-200);
  const rawY = useMotionValue(-200);
  const ringX = useSpring(rawX, { stiffness: 460, damping: 34, mass: 0.45 });
  const ringY = useSpring(rawY, { stiffness: 460, damping: 34, mass: 0.45 });
  const fieldOpacity = useMotionValue(0);
  const smoothOpacity = useSpring(fieldOpacity, { stiffness: 220, damping: 28 });

  const ringElRef = useRef<HTMLDivElement | null>(null);
  const hintElRef = useRef<HTMLSpanElement | null>(null);

  const ambientSpot = useMotionTemplate`radial-gradient(440px circle at ${ringX}px ${ringY}px, rgba(45, 212, 191, 0.068), transparent 72%)`;

  useEffect(() => {
    if (shouldReduceMotion || !isFinePointer()) return;

    const handleMove = (e: PointerEvent) => {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
      fieldOpacity.set(1);

      const target = e.target as HTMLElement | null;
      const interactive = target?.closest(
        'button, a, input, select, [role="button"], [data-cursor-hint]'
      ) as HTMLElement | null;
      const hint = interactive?.getAttribute("data-cursor-hint") || "";

      if (ringElRef.current) {
        if (interactive) {
          ringElRef.current.dataset.state = "interactive";
        } else {
          ringElRef.current.dataset.state = "idle";
        }
      }

      if (hintElRef.current) {
        if (hint) {
          hintElRef.current.textContent = hint;
          hintElRef.current.style.opacity = "1";
        } else {
          hintElRef.current.style.opacity = "0";
        }
      }
    };

    const handleDown = () => {
      if (ringElRef.current) ringElRef.current.dataset.pressed = "true";
    };

    const handleUp = () => {
      if (ringElRef.current) ringElRef.current.dataset.pressed = "false";
    };

    const handleLeave = () => {
      fieldOpacity.set(0);
      if (hintElRef.current) hintElRef.current.style.opacity = "0";
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleDown, { passive: true });
    window.addEventListener("pointerup", handleUp, { passive: true });
    document.addEventListener("mouseleave", handleLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [shouldReduceMotion, rawX, rawY, fieldOpacity]);

  if (shouldReduceMotion) return null;

  return (
    <>
      {/* Layer 1: Ambient background cursor glow */}
      <motion.div
        aria-hidden="true"
        data-testid="terminal-cursor-glow"
        style={{ background: ambientSpot, opacity: smoothOpacity }}
        className="pointer-events-none fixed inset-0 z-[1] hidden lg:block"
      />

      {/* Layer 2: Precision Orbital Reticle Ring (non-blocking, kursor asli tetap utuh) */}
      <motion.div
        aria-hidden="true"
        data-testid="terminal-cursor-reticle"
        style={{ x: ringX, y: ringY, opacity: smoothOpacity }}
        className="pointer-events-none fixed top-0 left-0 z-[60] hidden lg:block"
      >
        <div
          ref={ringElRef}
          data-state="idle"
          data-pressed="false"
          className="-translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-[#2DD4BF]/30 transition-[width,height,border-color,background-color,transform] duration-150 ease-out data-[state=interactive]:w-8 data-[state=interactive]:h-8 data-[state=interactive]:border-[#2DD4BF]/70 data-[state=interactive]:bg-[#2DD4BF]/[0.06] data-[pressed=true]:scale-75"
        />
        <span
          ref={hintElRef}
          style={{ opacity: 0 }}
          className="absolute left-4 top-3 px-1.5 py-0.5 rounded bg-[#0B0E15]/92 border border-[#2DD4BF]/45 text-[9.5px] font-mono text-[#5EEAD4] whitespace-nowrap shadow-lg transition-opacity duration-150"
        />
      </motion.div>
    </>
  );
};

/**
 * Permukaan kartu Matte Obsidian v2 dengan:
 * 1) Pointer-tracking interior teal spotlight
 * 2) Glowing 1px Border-Beam mengikuti kursor di pinggir kartu (ala Raycast / Linear)
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
  const borderBeamBg = useMotionTemplate`radial-gradient(220px circle at ${mouseX}px ${mouseY}px, rgba(45, 212, 191, 0.55), transparent 70%)`;

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
        <>
          {/* Interior cursor spotlight */}
          <motion.div
            aria-hidden="true"
            style={{
              background: spotlightBg,
              opacity: smoothOpacity,
            }}
            className="pointer-events-none absolute inset-0 z-[1]"
          />
          {/* 1px Border-Beam following cursor along edges */}
          <motion.div
            aria-hidden="true"
            style={{
              background: borderBeamBg,
              opacity: smoothOpacity,
              padding: "1px",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
            className="pointer-events-none absolute -inset-px rounded-[inherit] z-[2]"
          />
        </>
      )}
      {children}
    </div>
  );
};

/**
 * Efek tarikan magnetik halus (±3.5px) ala Fey / Raycast untuk tombol aksi utama.
 */
interface MagneticHoverProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export const MagneticHover: React.FC<MagneticHoverProps> = ({
  children,
  className = "",
  strength = 4,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 360, damping: 24, mass: 0.45 });
  const springY = useSpring(y, { stiffness: 360, damping: 24, mass: 0.45 });

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !isFinePointer() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const relY = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    x.set(Math.max(-1, Math.min(1, relX)) * strength);
    y.set(Math.max(-1, Math.min(1, relY)) * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{ x: springX, y: springY }}
      whileTap={{ scale: 0.97 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Angka telemetri bergulir halus berbasis spring (0 React re-render per frame).
 */
interface AnimatedNumberProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const formatRef = useRef(format);
  const motionVal = useMotionValue(Number.isFinite(value) ? value : 0);
  const springVal = useSpring(motionVal, { stiffness: 210, damping: 26, mass: 0.7 });

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    const safe = Number.isFinite(value) ? value : 0;
    if (shouldReduceMotion) {
      if (spanRef.current) spanRef.current.textContent = formatRef.current(safe);
      return;
    }
    motionVal.set(safe);
  }, [value, shouldReduceMotion, motionVal]);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const unsubscribe = springVal.on("change", (latest) => {
      if (spanRef.current) {
        spanRef.current.textContent = formatRef.current(latest);
      }
    });
    return unsubscribe;
  }, [springVal, shouldReduceMotion]);

  return (
    <span ref={spanRef} className={className}>
      {format(Number.isFinite(value) ? value : 0)}
    </span>
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
          opacity: 0.65,
          y: isPositive ? 4 : -4,
          textShadow: isPositive
            ? "0 0 14px rgba(34, 197, 94, 0.55)"
            : "0 0 14px rgba(239, 68, 68, 0.55)",
        }}
        animate={{
          opacity: 1,
          y: 0,
          textShadow: "0 0 0px rgba(0, 0, 0, 0)",
        }}
        transition={{ duration: 0.35, ease: EASE_TERMINAL }}
        className={`inline-block ${className}`}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
};
