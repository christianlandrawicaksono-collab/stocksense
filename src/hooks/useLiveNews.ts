"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getLiveMarketBriefAi,
  getLiveMarketNews,
  MarketProvider,
} from "@/lib/market-data";
import { MAX_NEWS_WATCHLIST_ENRICHMENT, sanitizeWatchlistTickers } from "@/lib/watchlist";
import type { LiveMarketBrief } from "@/lib/news-brief";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";

const AUTO_REFRESH_INTERVAL_MS = 3 * 60 * 1000; // 3 menit
const VISIBILITY_STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 menit

function formatCurrentWibClock(): string {
  const clock = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).format(new Date());
  return `${clock} WIB`;
}

export function useLiveNews(
  provider: MarketProvider,
  watchlistTickers: string[] = [],
  isWatchlistReady: boolean = true
) {
  const enrichedWatchlist = useMemo(
    () => sanitizeWatchlistTickers(watchlistTickers, MAX_NEWS_WATCHLIST_ENRICHMENT),
    [watchlistTickers]
  );
  const watchlistKey = enrichedWatchlist.join(",");

  const [newsState, setNewsState] = useState<{
    fetchedKey: string | null;
    items: LiveMarketNewsItem[];
    updatedAtWib: string;
  }>({ fetchedKey: null, items: [], updatedAtWib: "" });
  const [refreshNonce, setRefreshNonce] = useState<number>(0);
  const lastFetchedAtRef = useRef<number>(0);

  const [aiBrief, setAiBrief] = useState<LiveMarketBrief | null>(null);
  const [aiBriefNotice, setAiBriefNotice] = useState<string | null>(null);
  const [isAiBriefLoading, setIsAiBriefLoading] = useState<boolean>(false);

  const requestKey = `${watchlistKey}#${refreshNonce}`;
  const isLoading =
    provider === "yahoo" && (!isWatchlistReady || newsState.fetchedKey !== requestKey);

  useEffect(() => {
    if (provider !== "yahoo" || !isWatchlistReady || newsState.fetchedKey === requestKey) {
      return;
    }

    let cancelled = false;
    getLiveMarketNews(undefined, enrichedWatchlist)
      .then((res) => {
        if (!cancelled) {
          lastFetchedAtRef.current = Date.now();
          setNewsState({
            fetchedKey: requestKey,
            items: res.items,
            updatedAtWib: formatCurrentWibClock(),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          lastFetchedAtRef.current = Date.now();
          setNewsState((prev) => ({
            fetchedKey: requestKey,
            items: prev.items,
            updatedAtWib: prev.updatedAtWib,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [provider, isWatchlistReady, requestKey, newsState.fetchedKey, enrichedWatchlist]);

  // Auto-refresh berkala saat tab aktif agar berita terbaru masuk tanpa reload manual
  useEffect(() => {
    if (provider !== "yahoo" || !isWatchlistReady) return;

    const triggerBackgroundRefresh = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      setRefreshNonce((c) => c + 1);
    };

    const intervalId = window.setInterval(triggerBackgroundRefresh, AUTO_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - lastFetchedAtRef.current;
      if (lastFetchedAtRef.current > 0 && elapsed >= VISIBILITY_STALE_THRESHOLD_MS) {
        setRefreshNonce((c) => c + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [provider, isWatchlistReady]);

  const refresh = useCallback(() => {
    setAiBrief(null);
    setAiBriefNotice(null);
    setRefreshNonce((c) => c + 1);
  }, []);

  const requestAiBrief = useCallback(
    async (
      items: LiveMarketNewsItem[],
      macroTickers: MarketTickerItem[],
      customApiKey?: string
    ) => {
      if (isAiBriefLoading || items.length === 0) return;
      setIsAiBriefLoading(true);
      setAiBriefNotice(null);

      try {
        const res = await getLiveMarketBriefAi(items, macroTickers, customApiKey);
        if (res.brief) {
          setAiBrief(res.brief);
        }
        if (res.warning) {
          setAiBriefNotice(res.warning);
        }
      } finally {
        setIsAiBriefLoading(false);
      }
    },
    [isAiBriefLoading]
  );

  return {
    items: newsState.items,
    fetched: isWatchlistReady && newsState.fetchedKey === requestKey,
    isLoading,
    updatedAtWib: newsState.updatedAtWib,
    refresh,
    aiBrief,
    aiBriefNotice,
    isAiBriefLoading,
    requestAiBrief,
  };
}
