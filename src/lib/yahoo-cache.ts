/**
 * Lapisan cache lintas-instance menggunakan Next.js 16 Cache Components ("use cache" + cacheLife).
 * Memastikan panggilan ke Yahoo Finance dan RSS berita terbagi antar pemanggilan Vercel Serverless.
 * Catatan penting: fungsi di modul ini melempar Error bila gagal agar hasil kosong/error TIDAK ikut ter-cache.
 */

import { cacheLife } from "next/cache";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function fetchYahooQuotesCached(symbolsKey: string): Promise<Record<string, unknown>[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const symbols = symbolsKey.split(",").filter(Boolean);
  if (symbols.length === 0) {
    throw new Error("Empty symbols list");
  }

  const quotes = await yf.quote(symbols);
  const list = Array.isArray(quotes) ? quotes : [quotes];
  if (!list || list.length === 0) {
    throw new Error(`No quotes returned for ${symbolsKey}`);
  }

  return JSON.parse(JSON.stringify(list)) as Record<string, unknown>[];
}

export async function fetchYahooChartCached(
  symbol: string,
  period1: string,
  interval: "1d" | "1wk",
  includeDividends: boolean,
  todayWib: string
): Promise<{
  quotes: Record<string, unknown>[];
  dividends: { date: string; amount: number }[];
  metaPrice: number | null;
  metaTime: string | null;
}> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  void todayWib; // Menjamin kunci cache terikat ke tanggal WIB hari ini

  const chartResult = await yf.chart(
    symbol,
    includeDividends ? { period1, interval, events: "div" } : { period1, interval }
  );

  if (!chartResult || !chartResult.quotes || chartResult.quotes.length === 0) {
    throw new Error(`No chart data returned for ${symbol}`);
  }

  const dividends =
    includeDividends && chartResult.events?.dividends
      ? chartResult.events.dividends.map((d) => ({
          date: new Date(d.date).toISOString(),
          amount: d.amount,
        }))
      : [];

  const metaPrice =
    typeof chartResult.meta?.regularMarketPrice === "number" &&
    chartResult.meta.regularMarketPrice > 0
      ? chartResult.meta.regularMarketPrice
      : null;

  const metaTime = chartResult.meta?.regularMarketTime
    ? new Date(chartResult.meta.regularMarketTime).toISOString()
    : null;

  return {
    quotes: JSON.parse(JSON.stringify(chartResult.quotes)) as Record<string, unknown>[],
    dividends,
    metaPrice,
    metaTime,
  };
}

export async function fetchYahooProfileCached(symbol: string): Promise<{
  sector?: string;
  industry?: string;
  description?: string;
  roe?: number;
  der?: number;
}> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

  const qs = await yf.quoteSummary(symbol, {
    modules: ["assetProfile", "financialData"],
  });

  if (!qs) {
    throw new Error(`No profile returned for ${symbol}`);
  }

  const rawRoe = qs.financialData?.returnOnEquity;
  const rawDer = qs.financialData?.debtToEquity;

  return {
    sector: typeof qs.assetProfile?.sector === "string" ? qs.assetProfile.sector : undefined,
    industry: typeof qs.assetProfile?.industry === "string" ? qs.assetProfile.industry : undefined,
    description:
      typeof qs.assetProfile?.longBusinessSummary === "string"
        ? qs.assetProfile.longBusinessSummary
        : undefined,
    roe: typeof rawRoe === "number" && isFinite(rawRoe) ? rawRoe * 100 : undefined,
    der: typeof rawDer === "number" && isFinite(rawDer) ? rawDer / 100 : undefined,
  };
}

export async function fetchYahooSearchCached(query: string): Promise<
  {
    symbol: string;
    name: string;
    sector?: string;
  }[]
> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });

  const res = await yf.search(query, { quotesCount: 12, newsCount: 0 });
  const list = Array.isArray(res?.quotes) ? res.quotes : [];
  const items: { symbol: string; name: string; sector?: string }[] = [];

  for (const raw of list) {
    const rec = raw as unknown as Record<string, unknown>;
    const sym = typeof rec.symbol === "string" ? rec.symbol.toUpperCase() : "";
    if (!sym.endsWith(".JK")) continue;
    const clean = sym.replace(/\.JK$/, "");
    if (!/^[A-Z]{4}$/.test(clean)) continue;

    const name =
      (typeof rec.shortname === "string" && rec.shortname) ||
      (typeof rec.longname === "string" && rec.longname) ||
      clean;
    const sector = typeof rec.sector === "string" ? rec.sector : undefined;
    items.push({ symbol: clean, name, sector });
  }

  return items;
}

export async function fetchRssTextCached(url: string): Promise<string> {
  "use cache";
  cacheLife({ stale: 120, revalidate: 300, expire: 1800 });

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StocksSense/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!res.ok) {
    throw new Error(`RSS HTTP ${res.status} for ${url}`);
  }

  const text = await res.text();
  if (!text || text.length < 50) {
    throw new Error(`Empty RSS body for ${url}`);
  }
  return text;
}
