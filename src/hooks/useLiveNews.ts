"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLiveMarketBriefAi,
  getLiveMarketNews,
  MarketProvider,
} from "@/lib/market-data";
import type { LiveMarketBrief } from "@/lib/news-brief";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";

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

export function useLiveNews(provider: MarketProvider) {
  const [newsState, setNewsState] = useState<{
    fetched: boolean;
    items: LiveMarketNewsItem[];
    updatedAtWib: string;
  }>({ fetched: false, items: [], updatedAtWib: "" });
  const [retryCount, setRetryCount] = useState<number>(0);

  const [aiBrief, setAiBrief] = useState<LiveMarketBrief | null>(null);
  const [aiBriefNotice, setAiBriefNotice] = useState<string | null>(null);
  const [isAiBriefLoading, setIsAiBriefLoading] = useState<boolean>(false);

  const isLoading = provider === "yahoo" && !newsState.fetched;

  useEffect(() => {
    if (provider !== "yahoo" || newsState.fetched) return;

    let cancelled = false;
    getLiveMarketNews()
      .then((res) => {
        if (!cancelled) {
          setNewsState({
            fetched: true,
            items: res.items,
            updatedAtWib: formatCurrentWibClock(),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewsState((prev) => ({
            fetched: true,
            items: prev.items,
            updatedAtWib: prev.updatedAtWib,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [provider, newsState.fetched, retryCount]);

  const refresh = useCallback(() => {
    setNewsState((prev) => ({ ...prev, fetched: false }));
    setAiBrief(null);
    setAiBriefNotice(null);
    setRetryCount((c) => c + 1);
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
    fetched: newsState.fetched,
    isLoading,
    updatedAtWib: newsState.updatedAtWib,
    refresh,
    aiBrief,
    aiBriefNotice,
    isAiBriefLoading,
    requestAiBrief,
  };
}
