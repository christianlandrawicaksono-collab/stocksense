"use client";

import React, { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

interface AmbientNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  isAccent: boolean;
}

const PAPER_GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

/**
 * Lapisan latar belakang interaktif khusus halaman Berita (terinspirasi NewMinds Studio):
 * 1. Interactive constellation canvas yang bereaksi (repel + sorotan teal) terhadap kursor.
 * 2. Soft radial pointer glow 520px dengan spring inertia Framer Motion.
 * 3. Lapisan grain kertas editorial ultra-halus agar kanvas #FBFBFA terasa bertekstur.
 *
 * Seluruh animasi otomatis nonaktif pada perangkat touch atau prefers-reduced-motion,
 * serta di-pause otomatis saat tab disembunyikan.
 */
interface NewsAmbientBackgroundProps {
  contained?: boolean;
}

export const NewsAmbientBackground: React.FC<NewsAmbientBackgroundProps> = ({
  contained = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const pointerX = useMotionValue(-600);
  const pointerY = useMotionValue(-600);
  const orbOpacity = useMotionValue(0);

  const smoothX = useSpring(pointerX, { stiffness: 115, damping: 24, mass: 0.65 });
  const smoothY = useSpring(pointerY, { stiffness: 115, damping: 24, mass: 0.65 });
  const smoothOpacity = useSpring(orbOpacity, { stiffness: 120, damping: 26 });

  useEffect(() => {
    if (shouldReduceMotion || typeof window === "undefined") return;
    const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isFinePointer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let isPaused = document.hidden;

    const mouse = { x: -9999, y: -9999, active: false };
    let nodes: AmbientNode[] = [];

    const createNodes = () => {
      const area = width * height;
      const count = Math.max(28, Math.min(54, Math.round(area / 28000)));
      nodes = Array.from({ length: count }, (_, idx) => {
        const angle = (idx * 2.399963) % (Math.PI * 2);
        const speed = 0.16 + ((idx * 17) % 10) * 0.022;
        return {
          x: ((idx * 197.3) % Math.max(1, width)),
          y: ((idx * 131.7) % Math.max(1, height)),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          baseRadius: idx % 3 === 0 ? 2.1 : 1.5,
          isAccent: idx % 3 === 0,
        };
      });
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createNodes();
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      pointerX.set(e.clientX - 260);
      pointerY.set(e.clientY - 260);
      orbOpacity.set(1);
    };

    const handlePointerLeave = () => {
      mouse.active = false;
      orbOpacity.set(0);
    };

    const handleVisibilityChange = () => {
      isPaused = document.hidden;
      if (!isPaused && rafId === 0) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    const REPEL_RADIUS = 165;
    const LINK_DISTANCE = 150;
    const POINTER_LINK_DISTANCE = 135;

    const render = () => {
      if (isPaused) {
        rafId = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Interaksi repel lembut saat kursor mendekati node
        if (mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0.01 && distSq < REPEL_RADIUS * REPEL_RADIUS) {
            const dist = Math.sqrt(distSq);
            const force = ((REPEL_RADIUS - dist) / REPEL_RADIUS) * 0.42;
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        }

        // Redam kecepatan agar gerakan tetap kalem & editorial
        node.vx *= 0.985;
        node.vy *= 0.985;

        const speed = Math.hypot(node.vx, node.vy);
        if (speed < 0.14) {
          node.vx += (Math.random() - 0.5) * 0.04;
          node.vy += (Math.random() - 0.5) * 0.04;
        } else if (speed > 2.2) {
          node.vx = (node.vx / speed) * 2.2;
          node.vy = (node.vy / speed) * 2.2;
        }

        node.x += node.vx;
        node.y += node.vy;

        // Wrap mulus di tepi viewport
        if (node.x < -20) node.x = width + 20;
        else if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        else if (node.y > height + 20) node.y = -20;
      }

      // Garis penghubung antar node terdekat
      ctx.lineWidth = 0.85;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DISTANCE) {
            const proximity = 1 - dist / LINK_DISTANCE;
            const nearCursor =
              mouse.active &&
              (Math.hypot(a.x - mouse.x, a.y - mouse.y) < REPEL_RADIUS ||
                Math.hypot(b.x - mouse.x, b.y - mouse.y) < REPEL_RADIUS);
            ctx.strokeStyle = nearCursor
              ? `rgba(30, 123, 133, ${(proximity * 0.24).toFixed(3)})`
              : `rgba(29, 31, 35, ${(proximity * 0.085).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Garis tipis penghubung kursor ke node terdekat + gambar titik node
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        let nearFactor = 0;

        if (mouse.active) {
          const distToCursor = Math.hypot(node.x - mouse.x, node.y - mouse.y);
          if (distToCursor < POINTER_LINK_DISTANCE) {
            nearFactor = 1 - distToCursor / POINTER_LINK_DISTANCE;
            ctx.strokeStyle = `rgba(30, 123, 133, ${(nearFactor * 0.22).toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(node.x, node.y);
            ctx.stroke();
          }
        }

        const radius = node.baseRadius + nearFactor * 1.1;
        ctx.fillStyle =
          nearFactor > 0.05 || node.isAccent
            ? `rgba(30, 123, 133, ${(0.24 + nearFactor * 0.42).toFixed(3)})`
            : `rgba(29, 31, 35, 0.18)`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (!isPaused) {
      rafId = window.requestAnimationFrame(render);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [shouldReduceMotion, pointerX, pointerY, orbOpacity]);

  return (
    <div
      aria-hidden="true"
      data-testid="news-ambient-background"
      className={`${
        contained ? "absolute" : "fixed"
      } inset-0 z-0 pointer-events-none overflow-hidden select-none`}
    >
      {/* 1. Ambient Constellation Canvas */}
      {!shouldReduceMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full opacity-90"
        />
      )}

      {/* 2. Soft Radial Pointer Glow (Framer Motion Spring Inertia) */}
      {!shouldReduceMotion && (
        <motion.div
          style={{
            x: smoothX,
            y: smoothY,
            opacity: smoothOpacity,
            background:
              "radial-gradient(circle, rgba(30, 123, 133, 0.115) 0%, rgba(30, 123, 133, 0.04) 40%, rgba(30, 123, 133, 0) 72%)",
          }}
          className="hidden md:block absolute top-0 left-0 w-[520px] h-[520px] rounded-full will-change-transform"
        />
      )}

      {/* 3. Fine Editorial Paper-Grain Texture Overlay */}
      <div
        className="absolute inset-0 opacity-[0.032] mix-blend-multiply"
        style={{ backgroundImage: PAPER_GRAIN_SVG }}
      />
    </div>
  );
};
