import { STOCKS_DATA } from "@/data/stocksData";
import type { MarketProvider, MarketQuote } from "@/lib/market-data";
import {
  evaluateTargetBuyStatus,
  normalizeIdxTicker,
  type TargetBuyStatusKind,
  type WatchlistEntryMeta,
} from "@/lib/watchlist";

export interface OverviewStockItem {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  marketCapTrillion: number;
  peRatio: number;
  isInWatchlist: boolean;
  targetBuyPrice?: number;
  targetStatus: TargetBuyStatusKind;
  targetDiffPercent: number;
}

export interface SectorHeatmapTile {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  weightValue: number;
  peRatio: number;
  isInWatchlist: boolean;
  targetStatus: TargetBuyStatusKind;
}

export interface SectorHeatmapGroup {
  sector: string;
  totalWeight: number;
  avgChangePercent: number;
  tiles: SectorHeatmapTile[];
}

export interface MarketPulseSummary {
  totalStocks: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  buyZoneCount: number;
  strongestSector: { sector: string; avgChangePercent: number } | null;
}

export type MoverFilterMode = "gainers" | "losers" | "buy_zone";

const CURATED_BY_TICKER = new Map(STOCKS_DATA.map((s) => [s.ticker, s]));

/**
 * Combines curated stocks and active custom Watchlist tickers with live/fallback quotes
 * so Market Overview heatmap & movers stay grounded in real tracked IDX quotes.
 */
export function buildOverviewStockPool(params: {
  customWatchlist: string[];
  quotes: Record<string, MarketQuote>;
  provider: MarketProvider;
  watchlistNotes: Record<string, WatchlistEntryMeta>;
}): OverviewStockItem[] {
  const { customWatchlist, quotes, provider, watchlistNotes } = params;
  const watchSet = new Set(customWatchlist.map((t) => normalizeIdxTicker(t)).filter(Boolean));
  const combinedTickers = Array.from(
    new Set([
      ...STOCKS_DATA.map((s) => s.ticker),
      ...customWatchlist.map((t) => normalizeIdxTicker(t)).filter((t): t is string => Boolean(t)),
    ])
  );

  const pool: OverviewStockItem[] = [];
  for (const ticker of combinedTickers) {
    const curated = CURATED_BY_TICKER.get(ticker);
    const q = quotes[ticker];
    const isLive = Boolean(provider === "yahoo" && q && !q.isFallback);
    const price = q && q.price > 0 ? q.price : provider !== "yahoo" ? curated?.currentPrice ?? 0 : 0;
    if (price <= 0) continue;

    const changePercent = q ? q.changePercent : curated?.change1D ?? 0;
    const sector = curated?.sector || q?.sector || "Saham BEI";
    const name = curated?.name || q?.name || ticker;
    const marketCapTrillion =
      (isLive && q?.marketCapTrillion && q.marketCapTrillion > 0
        ? q.marketCapTrillion
        : curated?.marketCapTrillion) ?? 0;
    const peRatio = isLive && q?.peRatio && q.peRatio > 0 ? q.peRatio : curated?.peRatio ?? 0;
    const targetBuyPrice = watchlistNotes[ticker]?.targetBuyPrice;
    const targetEval = evaluateTargetBuyStatus(price, targetBuyPrice);

    pool.push({
      ticker,
      name,
      sector,
      price,
      changePercent,
      marketCapTrillion,
      peRatio,
      isInWatchlist: watchSet.has(ticker),
      targetBuyPrice,
      targetStatus: targetEval.status,
      targetDiffPercent: targetEval.diffPercent,
    });
  }

  return pool;
}

export function buildSectorHeatmap(pool: OverviewStockItem[]): SectorHeatmapGroup[] {
  if (pool.length === 0) return [];
  const sectorMap = new Map<string, SectorHeatmapTile[]>();

  for (const item of pool) {
    const list = sectorMap.get(item.sector) ?? [];
    // Ensure custom tickers without Yahoo market cap remain visibly proportioned
    const weightValue = item.marketCapTrillion > 0 ? Math.max(8, item.marketCapTrillion) : 25;
    list.push({
      ticker: item.ticker,
      name: item.name,
      price: item.price,
      changePercent: item.changePercent,
      weightValue,
      peRatio: item.peRatio,
      isInWatchlist: item.isInWatchlist,
      targetStatus: item.targetStatus,
    });
    sectorMap.set(item.sector, list);
  }

  return Array.from(sectorMap.entries())
    .map(([sector, tiles]) => {
      const sortedTiles = [...tiles].sort((a, b) => b.weightValue - a.weightValue);
      const totalWeight = sortedTiles.reduce((sum, t) => sum + t.weightValue, 0);
      const weightedChange =
        totalWeight > 0
          ? sortedTiles.reduce((sum, t) => sum + t.changePercent * t.weightValue, 0) / totalWeight
          : 0;
      return {
        sector,
        totalWeight,
        avgChangePercent: weightedChange,
        tiles: sortedTiles,
      };
    })
    .sort((a, b) => b.totalWeight - a.totalWeight);
}

export function buildTopMovers(
  pool: OverviewStockItem[],
  mode: MoverFilterMode,
  limit: number = 10
): OverviewStockItem[] {
  if (pool.length === 0) return [];

  if (mode === "gainers") {
    return [...pool]
      .sort((a, b) => b.changePercent - a.changePercent || b.marketCapTrillion - a.marketCapTrillion)
      .slice(0, limit);
  }

  if (mode === "losers") {
    return [...pool]
      .sort((a, b) => a.changePercent - b.changePercent || b.marketCapTrillion - a.marketCapTrillion)
      .slice(0, limit);
  }

  return pool
    .filter((item) => item.isInWatchlist && (item.targetStatus === "hit" || item.targetStatus === "near"))
    .sort((a, b) => a.targetDiffPercent - b.targetDiffPercent)
    .slice(0, limit);
}

export function buildMarketPulseSummary(pool: OverviewStockItem[]): MarketPulseSummary {
  let advancers = 0;
  let decliners = 0;
  let unchanged = 0;
  let buyZoneCount = 0;

  for (const item of pool) {
    if (item.changePercent > 0.05) advancers += 1;
    else if (item.changePercent < -0.05) decliners += 1;
    else unchanged += 1;

    if (item.isInWatchlist && (item.targetStatus === "hit" || item.targetStatus === "near")) {
      buyZoneCount += 1;
    }
  }

  const sectorGroups = buildSectorHeatmap(pool);
  const strongestSector =
    sectorGroups.length > 0
      ? [...sectorGroups]
          .sort((a, b) => b.avgChangePercent - a.avgChangePercent)
          .map((g) => ({ sector: g.sector, avgChangePercent: g.avgChangePercent }))[0]
      : null;

  return {
    totalStocks: pool.length,
    advancers,
    decliners,
    unchanged,
    buyZoneCount,
    strongestSector,
  };
}
