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
import { MarketTickerItem } from "@/types/market";
import { getIdxMarketStatus, MarketStatus } from "@/lib/market-hours";

export function useMarketData() {
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

  const isFetchingRef = useRef(false);
  const prevIsOpenRef = useRef<boolean>(getIdxMarketStatus().isOpen);

  const fetchLatestMarketData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const [quotesRes, macroRes] = await Promise.allSettled([
        getQuotes(),
        getMacroTickers(),
      ]);

      if (quotesRes.status === "fulfilled" && quotesRes.value?.quotes) {
        const qData = quotesRes.value;
        setQuotes(qData.quotes);
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Ambil data quotes & indikator makro saat mount secara paralel
    Promise.allSettled([getQuotes(), getMacroTickers()])
      .then(([quotesRes, macroRes]) => {
        if (!isMounted) return;

        if (quotesRes.status === "fulfilled" && quotesRes.value?.quotes) {
          const qData = quotesRes.value;
          setQuotes(qData.quotes);
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

    // 2. Interval pengecekan status setiap 60 detik:
    //    Selalu perbarui status jam bursa di UI; hanya fetch Yahoo saat bursa buka atau saat transisi tutup.
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

    // 3. Listener visibilitychange: saat tab kembali aktif, segarkan status bursa & data jika pasar buka
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
  }, [fetchLatestMarketData]);

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
