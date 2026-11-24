"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQuotes,
  getIllustrativeQuotesMap,
  MarketQuote,
  MarketProvider,
  getActiveMarketProvider,
} from "@/lib/market-data";
import { getIdxMarketStatus, MarketStatus } from "@/lib/market-hours";

export function useMarketData() {
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>(() =>
    getIllustrativeQuotesMap()
  );
  const [provider, setProvider] = useState<MarketProvider>(() =>
    getActiveMarketProvider()
  );
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(() =>
    getIdxMarketStatus()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastFetched, setLastFetched] = useState<string>("");

  const isFetchingRef = useRef(false);

  const fetchLatestQuotes = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const data = await getQuotes();
      if (data && data.quotes) {
        setQuotes(data.quotes);
        setProvider(data.provider);
        setMarketStatus(data.marketStatus);
        setLastFetched(data.marketStatus.timeWib);
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

    // 1. Ambil data pertama kali saat mount secara asinkron (tanpa synchronous setState dalam effect body)
    getQuotes()
      .then((data) => {
        if (isMounted && data && data.quotes) {
          setQuotes(data.quotes);
          setProvider(data.provider);
          setMarketStatus(data.marketStatus);
          setLastFetched(data.marketStatus.timeWib);
        }
      })
      .catch((err) => {
        console.warn("[useMarketData] Initial fetch error:", err);
      });

    // 2. Pasang interval polling ~60 detik HANYA saat jam bursa buka
    let intervalId: NodeJS.Timeout | null = null;

    const setupPolling = () => {
      if (intervalId) clearInterval(intervalId);

      const currentStatus = getIdxMarketStatus();
      if (!currentStatus.isOpen) {
        // Jangan polling jika pasar tutup
        return;
      }

      intervalId = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          fetchLatestQuotes();
        }
      }, 60000);
    };

    setupPolling();

    // 3. Listener visibilitychange: saat tab kembali aktif, refresh jika pasar sedang buka
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentStatus = getIdxMarketStatus();
        if (currentStatus.isOpen) {
          fetchLatestQuotes();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchLatestQuotes]);

  return {
    quotes,
    provider,
    marketStatus,
    isLoading,
    lastFetched,
    refetch: fetchLatestQuotes,
  };
}
