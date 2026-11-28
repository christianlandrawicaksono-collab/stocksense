"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GlobalNewsApiResponse,
  GlobalNewsItem,
  buildFallbackGlobalNewsItems,
} from "@/lib/global-news";
import type { MarketProvider } from "@/lib/market-data";

const INITIAL_FALLBACK_ITEMS = buildFallbackGlobalNewsItems();

function formatWibClock(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date);
  return `${formatted.replace(":", ".")} WIB`;
}

export function useGlobalNews(provider: MarketProvider, enabled: boolean) {
  const [state, setState] = useState<{
    items: GlobalNewsItem[];
    isFallback: boolean;
    isLoading: boolean;
    updatedAtWib: string;
  }>({
    items: INITIAL_FALLBACK_ITEMS,
    isFallback: true,
    isLoading: enabled,
    updatedAtWib: "",
  });

  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let activeController: AbortController | null = null;

    async function load() {
      if (activeController) {
        activeController.abort();
      }
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), 11_000);

      try {
        const res = await fetch("/api/news/global", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as GlobalNewsApiResponse;
        if (cancelled) return;
        if (Array.isArray(json.items) && json.items.length > 0) {
          setState({
            items: json.items,
            isFallback: Boolean(json.isFallback),
            isLoading: false,
            updatedAtWib: json.timestamp ? formatWibClock(json.timestamp) : "",
          });
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError" && activeController !== controller) {
          return;
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (activeController === controller) {
          activeController = null;
        }
      }

      if (!cancelled) {
        setState((prev) => ({
          items: prev.items.length > 0 ? prev.items : buildFallbackGlobalNewsItems(),
          isFallback: prev.isFallback,
          isLoading: false,
          updatedAtWib: prev.updatedAtWib,
        }));
      }
    }

    void load();

    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    }, 300_000);

    return () => {
      cancelled = true;
      activeController?.abort();
      window.clearInterval(timer);
    };
  }, [provider, enabled, refreshTick]);

  return {
    items: state.items,
    isFallback: state.isFallback,
    isLoading: state.isLoading,
    updatedAtWib: state.updatedAtWib,
    refresh,
  };
}
