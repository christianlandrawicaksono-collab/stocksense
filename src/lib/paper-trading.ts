import { IDX_LOT_SIZE } from "./trading-tools";
import { normalizeIdxTicker } from "./watchlist";

export const PAPER_TRADING_STORAGE_KEY = "stocksense:paper-trading:v1";
export const DEFAULT_PAPER_CASH_RP = 100_000_000;
export const IDX_BUY_FEE_RATE = 0.0015; // 0,15% fee beli sekuritas BEI
export const IDX_SELL_FEE_RATE = 0.0025; // 0,25% fee jual + PPh final BEI
export const MAX_PAPER_HISTORY = 25;

export interface PaperPosition {
  ticker: string;
  lots: number;
  avgPrice: number;
  updatedAt: string;
}

export interface PaperTradeRecord {
  id: string;
  side: "BUY" | "SELL";
  ticker: string;
  lots: number;
  price: number;
  grossRp: number;
  feeRp: number;
  realizedPnlRp?: number;
  timestamp: string;
}

export interface PaperPortfolioState {
  initialCashRp: number;
  cashRp: number;
  realizedPnlRp: number;
  positions: Record<string, PaperPosition>;
  history: PaperTradeRecord[];
}

export interface PaperTradeOutcome {
  ok: boolean;
  state: PaperPortfolioState;
  error?: string;
}

export interface EvaluatedPaperPosition {
  ticker: string;
  lots: number;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  marketValueRp: number;
  costBasisRp: number;
  unrealizedPnlRp: number;
  unrealizedPnlPct: number;
}

export interface EvaluatedPaperPortfolio {
  initialCashRp: number;
  cashRp: number;
  holdingsValueRp: number;
  totalEquityRp: number;
  unrealizedPnlRp: number;
  realizedPnlRp: number;
  totalReturnRp: number;
  totalReturnPct: number;
  positions: EvaluatedPaperPosition[];
}

export function createDefaultPaperPortfolio(): PaperPortfolioState {
  return {
    initialCashRp: DEFAULT_PAPER_CASH_RP,
    cashRp: DEFAULT_PAPER_CASH_RP,
    realizedPnlRp: 0,
    positions: {},
    history: [],
  };
}

const DEFAULT_SNAPSHOT_JSON = JSON.stringify(createDefaultPaperPortfolio());

export function parsePaperPortfolioJson(rawJson: string | null | undefined): PaperPortfolioState {
  if (!rawJson) return createDefaultPaperPortfolio();
  try {
    const parsed = JSON.parse(rawJson) as Partial<PaperPortfolioState>;
    const initialCashRp =
      typeof parsed.initialCashRp === "number" &&
      Number.isFinite(parsed.initialCashRp) &&
      parsed.initialCashRp > 0
        ? Math.round(parsed.initialCashRp)
        : DEFAULT_PAPER_CASH_RP;
    const cashRp =
      typeof parsed.cashRp === "number" && Number.isFinite(parsed.cashRp) && parsed.cashRp >= 0
        ? Math.round(parsed.cashRp)
        : initialCashRp;
    const realizedPnlRp =
      typeof parsed.realizedPnlRp === "number" && Number.isFinite(parsed.realizedPnlRp)
        ? Math.round(parsed.realizedPnlRp)
        : 0;

    const cleanPositions: Record<string, PaperPosition> = {};
    if (parsed.positions && typeof parsed.positions === "object") {
      for (const [rawKey, pos] of Object.entries(parsed.positions)) {
        const ticker = normalizeIdxTicker(rawKey);
        if (!ticker || !pos || typeof pos !== "object") continue;
        const lots = Math.floor(Number(pos.lots));
        const avgPrice = Number(pos.avgPrice);
        if (lots > 0 && Number.isFinite(avgPrice) && avgPrice > 0) {
          cleanPositions[ticker] = {
            ticker,
            lots,
            avgPrice,
            updatedAt: typeof pos.updatedAt === "string" ? pos.updatedAt : "",
          };
        }
      }
    }

    const cleanHistory: PaperTradeRecord[] = Array.isArray(parsed.history)
      ? parsed.history
          .filter(
            (h): h is PaperTradeRecord =>
              Boolean(h) &&
              (h.side === "BUY" || h.side === "SELL") &&
              typeof h.ticker === "string" &&
              Number.isFinite(h.lots) &&
              h.lots > 0 &&
              Number.isFinite(h.price) &&
              h.price > 0
          )
          .slice(0, MAX_PAPER_HISTORY)
      : [];

    return {
      initialCashRp,
      cashRp,
      realizedPnlRp,
      positions: cleanPositions,
      history: cleanHistory,
    };
  } catch {
    return createDefaultPaperPortfolio();
  }
}

export function executePaperBuy(
  state: PaperPortfolioState,
  params: { ticker: string; price: number; lots: number; timestamp?: string }
): PaperTradeOutcome {
  const ticker = normalizeIdxTicker(params.ticker);
  const lots = Math.floor(params.lots);
  const price = params.price;
  if (!ticker) return { ok: false, state, error: "Kode emiten tidak valid." };
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, state, error: "Harga pasar belum tersedia." };
  }
  if (!Number.isFinite(lots) || lots <= 0) {
    return { ok: false, state, error: "Jumlah lot minimal 1 lot." };
  }

  const grossRp = Math.round(lots * IDX_LOT_SIZE * price);
  const feeRp = Math.round(grossRp * IDX_BUY_FEE_RATE);
  const totalDebitRp = grossRp + feeRp;

  if (totalDebitRp > state.cashRp) {
    return {
      ok: false,
      state,
      error: "Kas virtual tidak mencukupi untuk jumlah lot & fee beli 0,15%.",
    };
  }

  const timestamp = params.timestamp || new Date().toISOString();
  const existing = state.positions[ticker];
  const nextLots = (existing?.lots ?? 0) + lots;
  const prevCost = (existing?.lots ?? 0) * IDX_LOT_SIZE * (existing?.avgPrice ?? 0);
  const nextAvgPrice = (prevCost + grossRp) / (nextLots * IDX_LOT_SIZE);

  const nextPositions: Record<string, PaperPosition> = {
    ...state.positions,
    [ticker]: {
      ticker,
      lots: nextLots,
      avgPrice: nextAvgPrice,
      updatedAt: timestamp,
    },
  };

  const trade: PaperTradeRecord = {
    id: `${ticker}-B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    side: "BUY",
    ticker,
    lots,
    price,
    grossRp,
    feeRp,
    timestamp,
  };

  return {
    ok: true,
    state: {
      ...state,
      cashRp: state.cashRp - totalDebitRp,
      positions: nextPositions,
      history: [trade, ...state.history].slice(0, MAX_PAPER_HISTORY),
    },
  };
}

export function executePaperSell(
  state: PaperPortfolioState,
  params: { ticker: string; price: number; lots: number; timestamp?: string }
): PaperTradeOutcome {
  const ticker = normalizeIdxTicker(params.ticker);
  const lots = Math.floor(params.lots);
  const price = params.price;
  if (!ticker) return { ok: false, state, error: "Kode emiten tidak valid." };
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, state, error: "Harga pasar belum tersedia." };
  }
  const existing = state.positions[ticker];
  if (!existing || existing.lots <= 0) {
    return { ok: false, state, error: `Anda belum memiliki posisi ${ticker}.` };
  }
  if (!Number.isFinite(lots) || lots <= 0 || lots > existing.lots) {
    return {
      ok: false,
      state,
      error: `Jumlah jual harus antara 1 s.d. ${existing.lots} lot.`,
    };
  }

  const grossRp = Math.round(lots * IDX_LOT_SIZE * price);
  const feeRp = Math.round(grossRp * IDX_SELL_FEE_RATE);
  const netProceedsRp = grossRp - feeRp;
  const costSoldRp = Math.round(lots * IDX_LOT_SIZE * existing.avgPrice);
  const realizedPnlRp = netProceedsRp - costSoldRp;
  const timestamp = params.timestamp || new Date().toISOString();

  const nextPositions = { ...state.positions };
  const remainingLots = existing.lots - lots;
  if (remainingLots <= 0) {
    delete nextPositions[ticker];
  } else {
    nextPositions[ticker] = {
      ...existing,
      lots: remainingLots,
      updatedAt: timestamp,
    };
  }

  const trade: PaperTradeRecord = {
    id: `${ticker}-S-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    side: "SELL",
    ticker,
    lots,
    price,
    grossRp,
    feeRp,
    realizedPnlRp,
    timestamp,
  };

  return {
    ok: true,
    state: {
      ...state,
      cashRp: state.cashRp + netProceedsRp,
      realizedPnlRp: state.realizedPnlRp + realizedPnlRp,
      positions: nextPositions,
      history: [trade, ...state.history].slice(0, MAX_PAPER_HISTORY),
    },
  };
}

export function evaluatePaperPortfolio(
  state: PaperPortfolioState,
  livePriceByTicker: Record<string, number>
): EvaluatedPaperPortfolio {
  const positions: EvaluatedPaperPosition[] = [];
  let holdingsValueRp = 0;
  let unrealizedPnlRp = 0;

  for (const pos of Object.values(state.positions)) {
    const shares = pos.lots * IDX_LOT_SIZE;
    const live = livePriceByTicker[pos.ticker];
    const currentPrice = Number.isFinite(live) && live > 0 ? live : pos.avgPrice;
    const marketValueRp = Math.round(shares * currentPrice);
    const costBasisRp = Math.round(shares * pos.avgPrice);
    const pnlRp = marketValueRp - costBasisRp;
    const pnlPct = costBasisRp > 0 ? (pnlRp / costBasisRp) * 100 : 0;

    holdingsValueRp += marketValueRp;
    unrealizedPnlRp += pnlRp;

    positions.push({
      ticker: pos.ticker,
      lots: pos.lots,
      shares,
      avgPrice: pos.avgPrice,
      currentPrice,
      marketValueRp,
      costBasisRp,
      unrealizedPnlRp: pnlRp,
      unrealizedPnlPct: pnlPct,
    });
  }

  positions.sort((a, b) => b.marketValueRp - a.marketValueRp);

  const totalEquityRp = state.cashRp + holdingsValueRp;
  const totalReturnRp = totalEquityRp - state.initialCashRp;
  const totalReturnPct =
    state.initialCashRp > 0 ? (totalReturnRp / state.initialCashRp) * 100 : 0;

  return {
    initialCashRp: state.initialCashRp,
    cashRp: state.cashRp,
    holdingsValueRp,
    totalEquityRp,
    unrealizedPnlRp,
    realizedPnlRp: state.realizedPnlRp,
    totalReturnRp,
    totalReturnPct,
    positions,
  };
}

// --- SSR-safe useSyncExternalStore localStorage helpers ---
const paperListeners = new Set<() => void>();

function notifyPaperListeners() {
  for (const listener of paperListeners) listener();
}

export function subscribePaperPortfolioStorage(callback: () => void): () => void {
  paperListeners.add(callback);
  if (typeof window === "undefined") {
    return () => {
      paperListeners.delete(callback);
    };
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === PAPER_TRADING_STORAGE_KEY || e.key === null) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    paperListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function readPaperPortfolioStorageSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_SNAPSHOT_JSON;
  try {
    return window.localStorage.getItem(PAPER_TRADING_STORAGE_KEY) || DEFAULT_SNAPSHOT_JSON;
  } catch {
    return DEFAULT_SNAPSHOT_JSON;
  }
}

export function getPaperPortfolioServerSnapshot(): string {
  return DEFAULT_SNAPSHOT_JSON;
}

export function writePaperPortfolioStorage(state: PaperPortfolioState): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PAPER_TRADING_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore private-mode / quota errors
    }
  }
  notifyPaperListeners();
}
