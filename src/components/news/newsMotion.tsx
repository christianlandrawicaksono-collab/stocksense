"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/**
 * Kurva easing premium terinspirasi referensi NewMinds Studio, disesuaikan untuk keterbacaan editorial finansial.
 */
export const EASE_PREMIUM = [0.16, 1, 0.3, 1] as const;
export const EASE_REVEAL = [0.2, 0.65, 0.2, 1] as const;
export const EASE_DRAWER = [0.2, 0.8, 0.2, 1] as const;

export const SPRING_INDICATOR = {
  type: "spring" as const,
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

export const SPRING_TACTILE = {
  type: "spring" as const,
  stiffness: 320,
  damping: 26,
  mass: 0.65,
};

function isFinePointerDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Garis progres baca tipis 2px di atas viewport yang bergerak mulus mengikuti scroll halaman berita.
 */
export const NewsScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const shouldReduceMotion = useReducedMotion();
  const smoothScaleX = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  if (shouldReduceMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 h-[2px] pointer-events-none bg-transparent"
    >
      <motion.div
        className="h-full w-full origin-left bg-[#1E7B85]"
        style={{ scaleX: smoothScaleX }}
      />
    </div>
  );
};

/**
 * Animasi count-up angka halus dengan cubic ease-out saat pertama masuk viewport.
 * Mematuhi prefers-reduced-motion secara penuh.
 */
interface CountUpNumberProps {
  value: number;
  durationMs?: number;
  className?: string;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  durationMs = 680,
  className = "",
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const shouldReduceMotion = useReducedMotion();
  const renderedValueRef = useRef<number>(0);
  const [display, setDisplay] = useState<number>(value);

  useEffect(() => {
    if (shouldReduceMotion || !isInView) {
      return;
    }

    const startValue = renderedValueRef.current;
    const endValue = value;
    if (startValue === endValue) {
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = Math.max(0, now - startTime);
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.max(0, Math.round(startValue + (endValue - startValue) * eased));
      renderedValueRef.current = current;
      setDisplay(current);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        renderedValueRef.current = endValue;
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [value, durationMs, isInView, shouldReduceMotion]);

  const rendered = shouldReduceMotion || !isInView ? value : display;

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {rendered}
    </span>
  );
};

/**
 * Reveal masuk viewport ringan berbasis transform + opacity saja (compositor-friendly).
 */
interface EditorialRevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

export const EditorialReveal: React.FC<EditorialRevealProps> = ({
  children,
  delay = 0,
  y = 18,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.52, delay: Math.min(delay, 0.36), ease: EASE_REVEAL }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Tombol aksi utama dengan micro-magnetic drift terbatas (hanya pada desktop pointer halus).
 */
interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  strength?: number;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  strength = 0.14,
  className = "",
  disabled,
  onClick,
  type = "button",
  title,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  "aria-expanded": ariaExpanded,
}) => {
  const ref = useRef<HTMLButtonElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const smoothX = useSpring(x, SPRING_TACTILE);
  const smoothY = useSpring(y, SPRING_TACTILE);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || shouldReduceMotion || !isFinePointerDevice() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) * strength;
    const dy = (e.clientY - rect.top - rect.height / 2) * strength;
    x.set(Math.max(-6, Math.min(6, dx)));
    y.set(Math.max(-4, Math.min(4, dy)));
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={shouldReduceMotion ? undefined : { x: smoothX, y: smoothY }}
      whileHover={disabled || shouldReduceMotion ? undefined : { y: -1.5 }}
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.22, ease: EASE_PREMIUM }}
      className={className}
    >
      {children}
    </motion.button>
  );
};

/**
 * Bingkai micro-3D tilt sangat halus (±2.8deg) untuk foto sorotan utama, aktif hanya pada fine pointer desktop.
 */
interface EditorialTiltFrameProps {
  children: React.ReactNode;
  className?: string;
}

export const EditorialTiltFrame: React.FC<EditorialTiltFrameProps> = ({
  children,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [2.8, -2.8]), SPRING_TACTILE);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-2.8, 2.8]), SPRING_TACTILE);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !isFinePointerDevice() || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(nx);
    pointerY.set(ny);
  };

  const handlePointerLeave = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div style={{ perspective: 1000 }} className={className}>
      <motion.div
        ref={ref}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={
          shouldReduceMotion
            ? undefined
            : {
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
              }
        }
        className="h-full will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
};

/**
 * Permukaan kartu dengan pendar spotlight teal halus yang mengikuti koordinat kursor
 * tanpa memicu React re-render (murni MotionValue + useMotionTemplate).
 */
interface SpotlightSurfaceProps {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}

export const SpotlightSurface: React.FC<SpotlightSurfaceProps> = ({
  children,
  className = "",
  tone = "light",
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(-400);
  const mouseY = useMotionValue(-400);
  const glowOpacity = useMotionValue(0);
  const smoothOpacity = useSpring(glowOpacity, { stiffness: 220, damping: 28 });

  const spotlightBg = useMotionTemplate`radial-gradient(320px circle at ${mouseX}px ${mouseY}px, ${
    tone === "dark" ? "rgba(94, 234, 212, 0.16)" : "rgba(30, 123, 133, 0.105)"
  }, transparent 74%)`;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !isFinePointerDevice() || !ref.current) return;
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
      className={`relative ${className}`}
    >
      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          style={{
            background: spotlightBg,
            opacity: smoothOpacity,
          }}
          className="pointer-events-none absolute inset-0 z-[1] transition-opacity"
        />
      )}
      {children}
    </div>
  );
};

/**
 * Bingkai parallax vertikal lembut berbasis useScroll + useTransform khusus untuk media gambar.
 * Tidak diterapkan ke teks atau tombol kontrol; terpotong rapi di dalam overflow-hidden.
 */
interface ParallaxMediaFrameProps {
  children: React.ReactNode;
  offsetPx?: number;
  className?: string;
}

export const ParallaxMediaFrame: React.FC<ParallaxMediaFrameProps> = ({
  children,
  offsetPx = 14,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const rawY = useTransform(scrollYProgress, [0, 1], [-offsetPx, offsetPx]);
  const smoothY = useSpring(rawY, { stiffness: 180, damping: 28, mass: 0.4 });

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <motion.div
        style={shouldReduceMotion ? undefined : { y: smoothY, scale: 1.09 }}
        className="w-full h-full will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
};

