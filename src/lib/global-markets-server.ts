/**
 * Server-side fetcher & cache untuk 10 pusat pasar global + 40 saham unggulan via Yahoo Finance.
 * Hanya digunakan di server route handler (/api/global-markets).
 */

import {
  GLOBAL_MARKET_HUBS,
  GlobalMarketHubSnapshot,
  buildFallbackGlobalMarkets,
  evaluateGlobalMarketSession,
} from "./global-markets";
import { fetchYahooQuotesCached } from "./yahoo-cache";

interface GlobalCacheEntry {
  hubs: GlobalMarketHubSnapshot[];
  isFallback: boolean;
  cachedAt: number;
}

const GLOBAL_MARKETS_CACHE_TTL_MS = 5 * 60 * 1000;
let globalMarketsCache: GlobalCacheEntry | null = null;

function extractRawQuoteMap(
  batches: PromiseSettledResult<Record<string, unknown>[]>[]
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const res of batches) {
    if (res.status !== "fulfilled") continue;
    for (const raw of res.value) {
      const sym = typeof raw.symbol === "string" ? raw.symbol.toUpperCase() : "";
      if (sym) {
        map.set(sym, raw);
      }
    }
  }
  return map;
}

function parseYahooNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function normalizePriceForHubCurrency(
  rawPrice: number,
  rawYahooCurrency: unknown,
  hubCurrency: string
): number {
  // LSE (London) saham sering dikutip Yahoo dalam GBp (pence, 1/100 GBP)
  if (
    hubCurrency === "GBP" &&
    typeof rawYahooCurrency === "string" &&
    rawYahooCurrency === "GBp"
  ) {
    return rawPrice / 100;
  }
  return rawPrice;
}

export async function getGlobalMarketsServer(): Promise<{
  hubs: GlobalMarketHubSnapshot[];
  isFallback: boolean;
}> {
  const now = Date.now();
  const nowDate = new Date(now);

  if (
    globalMarketsCache &&
    now - globalMarketsCache.cachedAt < GLOBAL_MARKETS_CACHE_TTL_MS
  ) {
    // Segarkan jam sesi lokal tiap request agar status Buka/Tutup selalu real-time
    const refreshedHubs = globalMarketsCache.hubs.map((hub) => {
      const def = GLOBAL_MARKET_HUBS.find((d) => d.id === hub.id);
      return def
        ? { ...hub, session: evaluateGlobalMarketSession(def, nowDate) }
        : hub;
    });
    return { hubs: refreshedHubs, isFallback: globalMarketsCache.isFallback };
  }

  // Kumpulkan seluruh simbol unik (indeks + saham unggulan)
  const indexSymbols: string[] = [];
  const equitySymbols: string[] = [];
  for (const hub of GLOBAL_MARKET_HUBS) {
    indexSymbols.push(hub.indexSymbol);
    if (hub.secondaryIndexSymbol) indexSymbols.push(hub.secondaryIndexSymbol);
    for (const stock of hub.stocks) {
      equitySymbols.push(stock.symbol);
    }
  }

  // Bagi ke 3 batch paralel agar kencang & tangguh di Vercel serverless
  const mid = Math.ceil(equitySymbols.length / 2);
  const batchKeys = [
    Array.from(new Set(indexSymbols)).sort().join(","),
    Array.from(new Set(equitySymbols.slice(0, mid))).sort().join(","),
    Array.from(new Set(equitySymbols.slice(mid))).sort().join(","),
  ].filter(Boolean);

  const settled = await Promise.allSettled(
    batchKeys.map((key) => fetchYahooQuotesCached(key))
  );
  const rawMap = extractRawQuoteMap(settled);

  if (rawMap.size === 0) {
    const fallbackHubs = buildFallbackGlobalMarkets(nowDate);
    return { hubs: fallbackHubs, isFallback: true };
  }

  let liveMatches = 0;

  const hubs: GlobalMarketHubSnapshot[] = GLOBAL_MARKET_HUBS.map((hub) => {
    const idxRaw = rawMap.get(hub.indexSymbol.toUpperCase());
    const idxPrice = parseYahooNumber(idxRaw?.regularMarketPrice);
    const idxChangePct = parseYahooNumber(idxRaw?.regularMarketChangePercent);
    const hasLiveIndex = idxPrice !== null && idxPrice > 0;
    if (hasLiveIndex) liveMatches += 1;

    const secRaw = hub.secondaryIndexSymbol
      ? rawMap.get(hub.secondaryIndexSymbol.toUpperCase())
      : undefined;
    const secPrice = parseYahooNumber(secRaw?.regularMarketPrice);
    const secChangePct = parseYahooNumber(secRaw?.regularMarketChangePercent);
    const hasLiveSec = secPrice !== null && secPrice > 0;

    const stocks = hub.stocks.map((s) => {
      const qRaw = rawMap.get(s.symbol.toUpperCase());
      const rawPrice = parseYahooNumber(qRaw?.regularMarketPrice);
      const rawChg = parseYahooNumber(qRaw?.regularMarketChangePercent);
      const hasLiveStock = rawPrice !== null && rawPrice > 0;
      if (hasLiveStock) liveMatches += 1;

      const normalizedPrice = hasLiveStock
        ? normalizePriceForHubCurrency(rawPrice, qRaw?.currency, hub.currency)
        : s.fallbackPrice;

      return {
        symbol: s.symbol,
        displayTicker: s.displayTicker,
        name: s.name,
        sector: s.sector,
        price: normalizedPrice,
        changePercent:
          hasLiveStock && rawChg !== null ? rawChg : s.fallbackChangePercent,
        currency: hub.currency,
        isFallback: !hasLiveStock,
        ...(s.idxTicker ? { idxTicker: s.idxTicker } : {}),
      };
    });

    return {
      id: hub.id,
      countryName: hub.countryName,
      city: hub.city,
      exchange: hub.exchange,
      region: hub.region,
      lat: hub.lat,
      lon: hub.lon,
      isoNumeric: hub.isoNumeric,
      currency: hub.currency,
      session: evaluateGlobalMarketSession(hub, nowDate),
      primaryIndex: {
        symbol: hub.indexSymbol,
        name: hub.indexName,
        value: hasLiveIndex ? idxPrice : hub.fallbackIndexValue,
        changePercent:
          hasLiveIndex && idxChangePct !== null
            ? idxChangePct
            : hub.fallbackIndexChangePercent,
        isFallback: !hasLiveIndex,
      },
      ...(hub.secondaryIndexSymbol && hub.secondaryIndexName
        ? {
            secondaryIndex: {
              symbol: hub.secondaryIndexSymbol,
              name: hub.secondaryIndexName,
              value: hasLiveSec ? secPrice : hub.fallbackSecondaryValue ?? 0,
              changePercent:
                hasLiveSec && secChangePct !== null
                  ? secChangePct
                  : hub.fallbackSecondaryChangePercent ?? 0,
              isFallback: !hasLiveSec,
            },
          }
        : {}),
      stocks,
    };
  });

  const isFallback = liveMatches === 0;
  if (!isFallback) {
    globalMarketsCache = {
      hubs,
      isFallback: false,
      cachedAt: now,
    };
  }

  return { hubs, isFallback };
}
