"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GlobalMarketHubSnapshot,
  GlobalMarketsResponse,
  buildFallbackGlobalMarkets,
} from "@/lib/global-markets";
import type { MarketProvider } from "@/lib/market-data";

const INITIAL_FALLBACK_HUBS: GlobalMarketHubSnapshot[] = buildFallbackGlobalMarkets(
  new Date("2026-01-01T00:00:00Z")
);

export function useGlobalMarkets(provider: MarketProvider, enabled: boolean) {
  const [state, setState] = useState<{
    hubs: GlobalMarketHubSnapshot[];
    isFallback: boolean;
    isLoading: boolean;
    updatedAt: string | null;
  }>({
    hubs: INITIAL_FALLBACK_HUBS,
    isFallback: true,
    isLoading: enabled,
    updatedAt: null,
  });

  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadGlobalMarkets() {
      try {
        const res = await fetch("/api/global-markets", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GlobalMarketsResponse;
        if (cancelled) return;
        if (Array.isArray(json.hubs) && json.hubs.length > 0) {
          setState({
            hubs: json.hubs,
            isFallback: Boolean(json.isFallback),
            isLoading: false,
            updatedAt: json.timestamp || null,
          });
          return;
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
      }

      if (!cancelled) {
        setState({
          hubs: buildFallbackGlobalMarkets(new Date()),
          isFallback: true,
          isLoading: false,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    void loadGlobalMarkets();

    // Auto-refresh setiap 3 menit saat panel aktif
    const timer = window.setInterval(() => {
      void loadGlobalMarkets();
    }, 180_000);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [provider, enabled, refreshTick]);

  return {
    hubs: state.hubs,
    isFallback: state.isFallback,
    isLoading: state.isLoading,
    updatedAt: state.updatedAt,
    refresh,
  };
}
