"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQuotes,
  getMacroTickers,
  getIllustrativeQuotesMap,
  MarketQuote,
  MarketProvider,
  getActiveMarketProvider,
} from "@/lib/market-data";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";
import { STOCKS_DATA } from "@/data/stocksData";
import { MarketTickerItem } from "@/types/market";
import { getIdxMarketStatus, MarketStatus } from "@/lib/market-hours";

const DEFAULT_TICKERS = STOCKS_DATA.map((s) => s.ticker);

export function useMarketData(extraTickers: string[] = []) {
  const [provider, setProvider] = useState<MarketProvider>(() =>
    getActiveMarketProvider()
  );
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>(() =>
    getIllustrativeQuotesMap()
  );
  const [macroTickers, setMacroTickers] = useState<MarketTickerItem[]>(() =>
    getActiveMarketProvider() === "yahoo" ? [] : LIVE_MARKET_TICKERS
  );
  const [isMacroFallback, setIsMacroFallback] = useState<boolean>(
    () => getActiveMarketProvider() !== "yahoo"
  );
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(() =>
    getIdxMarketStatus()
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => getActiveMarketProvider() === "yahoo"
  );
  const [lastFetched, setLastFetched] = useState<string>("");

  const normalizedExtraKey = Array.from(
    new Set(
      extraTickers
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z]{4}$/.test(t) && !DEFAULT_TICKERS.includes(t))
    )
  )
    .sort()
    .join(",");

  const isFetchingRef = useRef(false);
  const prevIsOpenRef = useRef<boolean>(getIdxMarketStatus().isOpen);

  const buildActiveTickerList = useCallback(() => {
    const extra = normalizedExtraKey ? normalizedExtraKey.split(",") : [];
    return [...DEFAULT_TICKERS, ...extra];
  }, [normalizedExtraKey]);

  const fetchLatestMarketData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const activeList = buildActiveTickerList();
      const [quotesRes, macroRes] = await Promise.allSettled([
        getQuotes(activeList),
        getMacroTickers(),
      ]);

      if (quotesRes.status === "fulfilled" && quotesRes.value?.quotes) {
        const qData = quotesRes.value;
        setQuotes((prev) => ({ ...prev, ...qData.quotes }));
        setProvider(qData.provider);
        setMarketStatus(qData.marketStatus);
        setLastFetched(qData.marketStatus.timeWib);
      }

      if (macroRes.status === "fulfilled" && macroRes.value) {
        const mData = macroRes.value;
        setMacroTickers(mData.tickers);
        setIsMacroFallback(mData.isFallback);
      }
    } catch (err) {
      console.warn("[useMarketData] Polling fetch error:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [buildActiveTickerList]);

  useEffect(() => {
    let isMounted = true;
    const activeList = buildActiveTickerList();

    Promise.allSettled([getQuotes(activeList), getMacroTickers()])
      .then(([quotesRes, macroRes]) => {
        if (!isMounted) return;

        if (quotesRes.status === "fulfilled" && quotesRes.value?.quotes) {
          const qData = quotesRes.value;
          setQuotes((prev) => ({ ...prev, ...qData.quotes }));
          setProvider(qData.provider);
          setMarketStatus(qData.marketStatus);
          setLastFetched(qData.marketStatus.timeWib);
        }

        if (macroRes.status === "fulfilled" && macroRes.value) {
          const mData = macroRes.value;
          setMacroTickers(mData.tickers);
          setIsMacroFallback(mData.isFallback);
        }
      })
      .catch((err) => {
        console.warn("[useMarketData] Initial fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const intervalId = setInterval(() => {
      const currentStatus = getIdxMarketStatus();
      setMarketStatus(currentStatus);

      const wasOpen = prevIsOpenRef.current;
      prevIsOpenRef.current = currentStatus.isOpen;

      if (
        (currentStatus.isOpen || wasOpen) &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        fetchLatestMarketData();
      }
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentStatus = getIdxMarketStatus();
        setMarketStatus(currentStatus);
        prevIsOpenRef.current = currentStatus.isOpen;
        if (currentStatus.isOpen) {
          fetchLatestMarketData();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [buildActiveTickerList, fetchLatestMarketData]);

  return {
    quotes,
    macroTickers,
    isMacroFallback,
    provider,
    marketStatus,
    isLoading,
    lastFetched,
    refetch: fetchLatestMarketData,
  };
}
