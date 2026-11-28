"use client";

import React, { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

interface TrailPoint {
  x: number;
  y: number;
  bornAt: number;
  isPressed: boolean;
}

const TRAIL_LIFETIME_MS = 260;
const MAX_TRAIL_POINTS = 22;
const RIPPLE_POOL_SIZE = 5;

function isFinePointerDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Interactive FT Editorial Cursor System khusus Halaman Berita (desktop fine-pointer):
 * 1) Calligraphic Ink Trail: pita kurva kuadratik tipis (FT Teal / FT Claret) saat roaming,
 *    dengan auto-idle 0% CPU saat kursor berhenti bergerak.
 * 2) Roaming Editorial Ink Ring: cincin tipis ber-inersia (mempertahankan kursor OS asli!).
 * 3) Contextual Micro-Pill: label mungil otomatis dari `data-cursor-hint` ("Drag · Putar", "Bedah AI", dll.).
 * 4) Dual Click Ink-Ripple: riak tinta konsentris saat klik menggunakan DOM pool imperatif (0 React re-render).
 */
export const EditorialCursorField: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  const rawX = useMotionValue(-200);
  const rawY = useMotionValue(-200);
  const ringX = useSpring(rawX, { stiffness: 420, damping: 32, mass: 0.45 });
  const ringY = useSpring(rawY, { stiffness: 420, damping: 32, mass: 0.45 });
  const fieldOpacity = useMotionValue(0);
  const smoothOpacity = useSpring(fieldOpacity, { stiffness: 220, damping: 28 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringElRef = useRef<HTMLDivElement | null>(null);
  const hintElRef = useRef<HTMLSpanElement | null>(null);
  const rippleLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldReduceMotion || !isFinePointerDevice()) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let rafId = 0;
    let isPressed = false;
    let rippleCursor = 0;

    const trail: TrailPoint[] = [];

    // Siapkan pool DOM ringan untuk click ink-ripple (zero React re-render)
    const rippleNodes: HTMLSpanElement[] = [];
    if (rippleLayerRef.current) {
      rippleLayerRef.current.innerHTML = "";
      for (let i = 0; i < RIPPLE_POOL_SIZE; i += 1) {
        const span = document.createElement("span");
        span.className =
          "fixed top-0 left-0 w-7 h-7 rounded-full border border-[#0D7680] pointer-events-none opacity-0 will-change-transform";
        span.style.transform = "translate3d(-100px, -100px, 0)";
        rippleLayerRef.current.appendChild(span);
        rippleNodes.push(span);
      }
    }

    const resizeCanvas = () => {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawTrail = () => {
      if (!ctx) {
        rafId = 0;
        return;
      }

      const now = performance.now();
      while (trail.length > 0 && now - trail[0].bornAt > TRAIL_LIFETIME_MS) {
        trail.shift();
      }

      ctx.clearRect(0, 0, width, height);

      if (trail.length >= 2) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 1; i < trail.length; i += 1) {
          const prev = trail[i - 1];
          const curr = trail[i];
          const ageNorm = 1 - (now - curr.bornAt) / TRAIL_LIFETIME_MS;
          const progress = i / (trail.length - 1);
          const alpha = Math.max(0, Math.min(1, ageNorm * progress));
          if (alpha <= 0.01) continue;

          const midX = (prev.x + curr.x) * 0.5;
          const midY = (prev.y + curr.y) * 0.5;
          const prevMidX = i > 1 ? (trail[i - 2].x + prev.x) * 0.5 : prev.x;
          const prevMidY = i > 1 ? (trail[i - 2].y + prev.y) * 0.5 : prev.y;

          // Tapered calligraphic stroke (0.6px ekor → 3.1px kepala)
          const strokeW = 0.6 + progress * progress * (curr.isPressed ? 3.2 : 2.4);
          ctx.beginPath();
          ctx.moveTo(prevMidX, prevMidY);
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          ctx.lineWidth = strokeW;
          ctx.strokeStyle = curr.isPressed
            ? `rgba(153, 15, 61, ${(alpha * 0.48).toFixed(3)})` // FT Claret saat drag/klik
            : `rgba(13, 118, 128, ${(alpha * 0.38).toFixed(3)})`; // FT Teal saat roaming
          ctx.stroke();
        }
      }

      // Auto-idle: hentikan loop rAF (0% CPU) segera setelah seluruh jejak tinta memudar!
      if (trail.length > 0) {
        rafId = window.requestAnimationFrame(drawTrail);
      } else {
        rafId = 0;
      }
    };

    const ensureTrailLoop = () => {
      if (rafId === 0 && ctx) {
        rafId = window.requestAnimationFrame(drawTrail);
      }
    };

    const spawnClickRipple = (x: number, y: number) => {
      const node = rippleNodes[rippleCursor % rippleNodes.length];
      rippleCursor += 1;
      if (!node || typeof node.animate !== "function") return;

      node.getAnimations().forEach((anim) => anim.cancel());
      node.style.borderColor = isPressed ? "#990F3D" : "#0D7680";
      node.animate(
        [
          {
            transform: `translate3d(${x - 14}px, ${y - 14}px, 0) scale(0.35)`,
            opacity: 0.62,
          },
          {
            transform: `translate3d(${x - 14}px, ${y - 14}px, 0) scale(2.35)`,
            opacity: 0,
          },
        ],
        {
          duration: 440,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "forwards",
        }
      );
    };

    const handleMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      rawX.set(x);
      rawY.set(y);
      fieldOpacity.set(1);

      const last = trail[trail.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) >= 3) {
        trail.push({ x, y, bornAt: performance.now(), isPressed });
        if (trail.length > MAX_TRAIL_POINTS) {
          trail.shift();
        }
        ensureTrailLoop();
      }

      const target = e.target as HTMLElement | null;
      const isTextInput = Boolean(target?.closest("input, textarea, select"));
      const interactive = target?.closest(
        'button, a, [role="button"], [data-cursor-hint]'
      ) as HTMLElement | null;
      const hint = !isTextInput ? interactive?.getAttribute("data-cursor-hint") || "" : "";

      if (ringElRef.current) {
        if (isTextInput) {
          ringElRef.current.dataset.state = "hidden";
        } else if (interactive) {
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

    const handleDown = (e: PointerEvent) => {
      isPressed = true;
      if (ringElRef.current) ringElRef.current.dataset.pressed = "true";
      spawnClickRipple(e.clientX, e.clientY);
    };

    const handleUp = () => {
      isPressed = false;
      if (ringElRef.current) ringElRef.current.dataset.pressed = "false";
    };

    const handleLeave = () => {
      isPressed = false;
      fieldOpacity.set(0);
      if (hintElRef.current) hintElRef.current.style.opacity = "0";
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointerdown", handleDown, { passive: true });
    window.addEventListener("pointerup", handleUp, { passive: true });
    document.addEventListener("mouseleave", handleLeave, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerdown", handleDown);
      window.removeEventListener("pointerup", handleUp);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [shouldReduceMotion, rawX, rawY, fieldOpacity]);

  if (shouldReduceMotion) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="editorial-cursor-field"
      className="pointer-events-none fixed inset-0 z-[60] hidden lg:block overflow-hidden select-none"
    >
      {/* 1. Calligraphic Ink Trail Canvas (auto-idle 0% CPU saat kursor diam) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 2. Click Ink-Ripple DOM Pool */}
      <div ref={rippleLayerRef} className="absolute inset-0" />

      {/* 3. Roaming Editorial Ink Ring + Contextual Micro-Pill */}
      <motion.div
        style={{
          x: ringX,
          y: ringY,
          opacity: smoothOpacity,
        }}
        className="fixed top-0 left-0 -translate-x-1/2 -translate-y-1/2 will-change-transform"
      >
        <div
          ref={ringElRef}
          data-state="idle"
          data-pressed="false"
          className="w-6 h-6 rounded-full border-[1.5px] border-[#1D1F23]/35 bg-[#0D7680]/[0.03] transition-[width,height,border-color,background-color,transform,opacity] duration-150 ease-out data-[state=interactive]:w-9 data-[state=interactive]:h-9 data-[state=interactive]:border-[#0D7680]/80 data-[state=interactive]:bg-[#0D7680]/[0.07] data-[state=hidden]:opacity-0 data-[pressed=true]:scale-75 data-[pressed=true]:border-[#990F3D]"
        />
        <span
          ref={hintElRef}
          style={{ opacity: 0 }}
          className="absolute left-5 top-4 whitespace-nowrap px-2 py-0.5 bg-[#1D1F23]/92 text-[#FBFBFA] border border-[#1D1F23] font-mono text-[9.5px] tracking-wide shadow-md transition-opacity duration-150"
        />
      </motion.div>
    </div>
  );
};
