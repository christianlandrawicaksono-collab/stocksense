"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { formatDesimal, formatNumber, formatPersen, formatRupiah } from "@/lib/format";
import {
  IDX_BUY_FEE_RATE,
  IDX_SELL_FEE_RATE,
  createDefaultPaperPortfolio,
  evaluatePaperPortfolio,
  executePaperBuy,
  executePaperSell,
  getPaperPortfolioServerSnapshot,
  parsePaperPortfolioJson,
  readPaperPortfolioStorageSnapshot,
  subscribePaperPortfolioStorage,
  writePaperPortfolioStorage,
} from "@/lib/paper-trading";
import {
  IDX_LOT_SIZE,
  computeRiskRewardPlan,
  snapToIdxTick,
} from "@/lib/trading-tools";
import type { MarketQuote } from "@/lib/market-data";
import { STOCKS_DATA } from "@/data/stocksData";
import {
  AnimatedNumber,
  EASE_TERMINAL,
  MagneticHover,
  SPRING_GAUGE,
  SPRING_SNAP,
  TerminalSpotlightCard,
} from "./terminalMotion";

interface RightTradingDeskDockProps {
  ticker: string;
  currentPrice: number;
  fairValuePrice?: number;
  quotes: Record<string, MarketQuote>;
  onSelectTicker: (ticker: string) => void;
}

const RISK_PCT_PRESETS = [0.5, 1, 2, 3] as const;

function parseNumericInput(raw: string): number {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Kolom Kanan Bawah (di bawah QuickResearchRail):
 * 1) Pro Risk / Reward & Position Sizing Simulator khusus lot & fraksi BEI
 * 2) IDX Paper Trading Virtual Portfolio (Saldo Rp 100 Jt di localStorage + Live Floating P/L)
 */
export const RightTradingDeskDock: React.FC<RightTradingDeskDockProps> = ({
  ticker,
  currentPrice,
  fairValuePrice,
  quotes,
  onSelectTicker,
}) => {
  const shouldReduceMotion = useReducedMotion();

  // --- 1. Risk / Reward Position Sizer State ---
  const [capitalStr, setCapitalStr] = useState("50.000.000");
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [customPlan, setCustomPlan] = useState<{
    ticker: string;
    entryStr: string;
    slStr: string;
    tpStr: string;
  } | null>(null);

  const defaultEntry = useMemo(
    () => (currentPrice > 0 ? snapToIdxTick(currentPrice) : 0),
    [currentPrice]
  );
  const defaultSl = useMemo(
    () => (defaultEntry > 0 ? snapToIdxTick(defaultEntry * 0.94, "floor") : 0),
    [defaultEntry]
  );
  const defaultTp = useMemo(() => {
    if (fairValuePrice && fairValuePrice > defaultEntry * 1.04) {
      return snapToIdxTick(fairValuePrice, "nearest");
    }
    return defaultEntry > 0 ? snapToIdxTick(defaultEntry * 1.14, "ceil") : 0;
  }, [defaultEntry, fairValuePrice]);

  const activeEntryStr =
    customPlan && customPlan.ticker === ticker
      ? customPlan.entryStr
      : defaultEntry > 0
      ? formatNumber(defaultEntry)
      : "";
  const activeSlStr =
    customPlan && customPlan.ticker === ticker
      ? customPlan.slStr
      : defaultSl > 0
      ? formatNumber(defaultSl)
      : "";
  const activeTpStr =
    customPlan && customPlan.ticker === ticker
      ? customPlan.tpStr
      : defaultTp > 0
      ? formatNumber(defaultTp)
      : "";

  const updatePlanField = (field: "entryStr" | "slStr" | "tpStr", rawVal: string) => {
    const clean = rawVal.replace(/[^0-9]/g, "");
    const formatted = clean ? formatNumber(parseInt(clean, 10)) : "";
    setCustomPlan({
      ticker,
      entryStr: field === "entryStr" ? formatted : activeEntryStr,
      slStr: field === "slStr" ? formatted : activeSlStr,
      tpStr: field === "tpStr" ? formatted : activeTpStr,
    });
  };

  const rrPlan = useMemo(
    () =>
      computeRiskRewardPlan({
        capitalRp: parseNumericInput(capitalStr),
        riskPercent,
        entryPrice: parseNumericInput(activeEntryStr),
        stopLossPrice: parseNumericInput(activeSlStr),
        takeProfitPrice: parseNumericInput(activeTpStr),
      }),
    [capitalStr, riskPercent, activeEntryStr, activeSlStr, activeTpStr]
  );

  // --- 2. IDX Paper Trading Virtual Portfolio State (useSyncExternalStore) ---
  const paperJson = useSyncExternalStore(
    subscribePaperPortfolioStorage,
    readPaperPortfolioStorageSnapshot,
    getPaperPortfolioServerSnapshot
  );
  const paperState = useMemo(() => parsePaperPortfolioJson(paperJson), [paperJson]);

  const livePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of STOCKS_DATA) map[s.ticker] = s.currentPrice;
    for (const [t, q] of Object.entries(quotes)) {
      if (q && q.price > 0) map[t] = q.price;
    }
    if (currentPrice > 0) map[ticker] = currentPrice;
    return map;
  }, [quotes, ticker, currentPrice]);

  const evaluatedPortfolio = useMemo(
    () => evaluatePaperPortfolio(paperState, livePriceMap),
    [paperState, livePriceMap]
  );

  const [paperLotsStr, setPaperLotsStr] = useState("5");
  const [paperTab, setPaperTab] = useState<"positions" | "history">("positions");
  const [paperFeedback, setPaperFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const activeHolding = paperState.positions[ticker];
  const paperLots = Math.max(0, parseNumericInput(paperLotsStr));
  const maxBuyLots =
    currentPrice > 0
      ? Math.floor(
          paperState.cashRp / (currentPrice * IDX_LOT_SIZE * (1 + IDX_BUY_FEE_RATE))
        )
      : 0;

  const showToast = (kind: "ok" | "err", text: string) => {
    setPaperFeedback({ kind, text });
    window.setTimeout(() => {
      setPaperFeedback((cur) => (cur?.text === text ? null : cur));
    }, 3200);
  };

  const handlePaperBuy = () => {
    const res = executePaperBuy(paperState, {
      ticker,
      price: currentPrice,
      lots: paperLots,
    });
    if (!res.ok) {
      showToast("err", res.error || "Gagal eksekusi beli.");
      return;
    }
    writePaperPortfolioStorage(res.state);
    showToast("ok", `Beli ${paperLots} lot ${ticker} @ ${formatRupiah(currentPrice)}`);
  };

  const handlePaperSell = () => {
    const lotsToSell = Math.min(paperLots, activeHolding?.lots ?? 0);
    const res = executePaperSell(paperState, {
      ticker,
      price: currentPrice,
      lots: lotsToSell > 0 ? lotsToSell : paperLots,
    });
    if (!res.ok) {
      showToast("err", res.error || "Gagal eksekusi jual.");
      return;
    }
    writePaperPortfolioStorage(res.state);
    showToast(
      "ok",
      `Jual ${lotsToSell > 0 ? lotsToSell : paperLots} lot ${ticker} @ ${formatRupiah(currentPrice)}`
    );
  };

  const handleResetPaper = () => {
    writePaperPortfolioStorage(createDefaultPaperPortfolio());
    showToast("ok", "Saldo virtual di-reset ke Rp 100.000.000");
  };

  const qualityBadgeClass =
    rrPlan.qualityTone === "emerald"
      ? "bg-[#22C55E]/15 border-[#22C55E]/35 text-[#22C55E]"
      : rrPlan.qualityTone === "teal"
      ? "bg-[#1E7B85]/20 border-[#2DD4BF]/35 text-[#2DD4BF]"
      : rrPlan.qualityTone === "amber"
      ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
      : "bg-[#EF4444]/15 border-[#EF4444]/35 text-[#EF4444]";

  const estBuyOrderRp =
    currentPrice > 0
      ? Math.round(paperLots * IDX_LOT_SIZE * currentPrice * (1 + IDX_BUY_FEE_RATE))
      : 0;

  return (
    <div className="flex flex-col gap-1.5 w-full text-xs font-sans">
      {/* KARTU 1: PRO RISK / REWARD & POSITION SIZER */}
      <TerminalSpotlightCard className="rounded-lg overflow-hidden">
        <div className="relative z-10 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#2DD4BF]" aria-hidden="true" />
              <span>Risk / Reward ({ticker})</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-semibold ${qualityBadgeClass}`}>
              {rrPlan.qualityLabel}
            </span>
          </div>

          {/* Modal & Risiko % */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <label htmlFor="rr-capital" className="text-[10px] text-slate-400">
                Modal (Rp)
              </label>
              <input
                id="rr-capital"
                name="rrCapital"
                type="text"
                value={capitalStr}
                onChange={(e) => {
                  const d = e.target.value.replace(/[^0-9]/g, "");
                  setCapitalStr(d ? formatNumber(parseInt(d, 10)) : "");
                }}
                className="w-28 px-2 py-1 rounded bg-[#080A0F] border border-white/[0.08] text-right font-mono text-[11px] text-slate-100 tnum focus:outline-none focus:border-[#2DD4BF]"
              />
            </div>

            <div className="grid grid-cols-4 gap-1">
              {RISK_PCT_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setRiskPercent(pct)}
                  className={`py-1 rounded text-[10px] font-mono border transition ${
                    riskPercent === pct
                      ? "bg-[#1E7B85] border-[#2DD4BF]/50 text-white font-semibold"
                      : "bg-[#080A0F] border-white/[0.07] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Risk {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Grid Entry / Stop Loss / Take Profit */}
          <div className="grid grid-cols-3 gap-1.5 font-mono tnum">
            <div>
              <label htmlFor="rr-entry" className="block text-[9.5px] font-sans text-slate-400 mb-0.5">
                Entry
              </label>
              <input
                id="rr-entry"
                name="rrEntry"
                type="text"
                value={activeEntryStr}
                onChange={(e) => updatePlanField("entryStr", e.target.value)}
                className="w-full px-1.5 py-1 rounded bg-[#080A0F] border border-white/[0.08] text-[11px] text-white focus:outline-none focus:border-[#2DD4BF]"
              />
            </div>
            <div>
              <label htmlFor="rr-sl" className="block text-[9.5px] font-sans text-[#EF4444] mb-0.5">
                Stop Loss
              </label>
              <input
                id="rr-sl"
                name="rrSl"
                type="text"
                value={activeSlStr}
                onChange={(e) => updatePlanField("slStr", e.target.value)}
                className="w-full px-1.5 py-1 rounded bg-[#080A0F] border border-[#EF4444]/35 text-[11px] text-slate-100 focus:outline-none focus:border-[#EF4444]"
              />
            </div>
            <div>
              <label htmlFor="rr-tp" className="block text-[9.5px] font-sans text-[#22C55E] mb-0.5">
                Take Profit
              </label>
              <input
                id="rr-tp"
                name="rrTp"
                type="text"
                value={activeTpStr}
                onChange={(e) => updatePlanField("tpStr", e.target.value)}
                className="w-full px-1.5 py-1 rounded bg-[#080A0F] border border-[#22C55E]/35 text-[11px] text-slate-100 focus:outline-none focus:border-[#22C55E]"
              />
            </div>
          </div>

          {/* Animated Risk vs Reward Visual Bar */}
          <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-mono tnum">
              <span className="text-slate-400 font-sans">Rasio R : R</span>
              <span className="font-bold text-white">
                {rrPlan.isValid ? (
                  <>
                    1 :{" "}
                    <AnimatedNumber
                      value={rrPlan.rrRatio}
                      format={(n) => formatDesimal(n, 2)}
                      className={rrPlan.rrRatio >= 2 ? "text-[#22C55E]" : "text-[#2DD4BF]"}
                    />
                  </>
                ) : (
                  <span className="text-[#EF4444]">SL &lt; Entry &lt; TP</span>
                )}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-white/[0.05] overflow-hidden flex">
              <motion.div
                initial={false}
                animate={{ width: `${rrPlan.riskBarSharePct}%` }}
                transition={SPRING_GAUGE}
                className="h-full bg-[#EF4444]/80"
              />
              <motion.div
                initial={false}
                animate={{ width: `${rrPlan.rewardBarSharePct}%` }}
                transition={SPRING_GAUGE}
                className="h-full bg-[#22C55E]/85"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 pt-0.5 text-[10px] font-mono tnum">
              <div>
                <span className="block text-[9px] font-sans text-slate-500">Lot Aman</span>
                <AnimatedNumber
                  value={rrPlan.recommendedLots}
                  format={(n) => `${Math.round(n)} lot`}
                  className="font-bold text-[#2DD4BF]"
                />
              </div>
              <div>
                <span className="block text-[9px] font-sans text-slate-500">Max Rugi</span>
                <span className="font-semibold text-[#EF4444] truncate block">
                  -{formatNumber(rrPlan.actualRiskRp)}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-sans text-slate-500">Est. Profit</span>
                <span className="font-semibold text-[#22C55E] truncate block">
                  +{formatNumber(rrPlan.potentialProfitRp)}
                </span>
              </div>
            </div>
          </div>

          {rrPlan.isValid && rrPlan.recommendedLots > 0 && (
            <MagneticHover strength={3}>
              <button
                type="button"
                data-cursor-hint="Kirim ke Paper"
                onClick={() => setPaperLotsStr(String(rrPlan.recommendedLots))}
                className="w-full py-1.5 px-2.5 rounded-md bg-[#161C29] hover:bg-[#1E7B85] border border-white/[0.08] hover:border-[#2DD4BF]/50 text-[11px] font-medium text-slate-200 hover:text-white transition flex items-center justify-center gap-1"
              >
                <TrendingUp className="w-3 h-3 text-[#2DD4BF]" aria-hidden="true" />
                <span>Pakai {rrPlan.recommendedLots} Lot di Paper Trade ↓</span>
              </button>
            </MagneticHover>
          )}
        </div>
      </TerminalSpotlightCard>

      {/* KARTU 2: IDX PAPER TRADING VIRTUAL PORTFOLIO */}
      <TerminalSpotlightCard className="rounded-lg overflow-hidden">
        <div className="relative z-10 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-[#22C55E]" aria-hidden="true" />
              <span>Paper Trading BEI</span>
            </span>
            <button
              type="button"
              onClick={handleResetPaper}
              title="Reset saldo virtual ke Rp 100 Jt"
              aria-label="Reset saldo virtual"
              className="p-1 rounded bg-[#080A0F] hover:bg-[#161C29] border border-white/[0.07] text-slate-400 hover:text-slate-100 transition"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Ringkasan Ekuitas & Floating P/L Live */}
          <div className="p-2 rounded-md bg-[#0B0E15] border border-white/[0.06] space-y-1.5 font-mono tnum">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-sans text-slate-400">Total Ekuitas</span>
              <AnimatedNumber
                value={evaluatedPortfolio.totalEquityRp}
                format={(n) => formatRupiah(Math.round(n))}
                className="text-xs font-bold text-white"
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-sans text-slate-500">Kas Bebas</span>
              <span className="text-slate-300">{formatRupiah(evaluatedPortfolio.cashRp)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/[0.05]">
              <span className="font-sans text-slate-400">Total P/L</span>
              <span
                className={`font-semibold ${
                  evaluatedPortfolio.totalReturnRp >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                }`}
              >
                {evaluatedPortfolio.totalReturnRp >= 0 ? "+" : "-"}
                {formatRupiah(Math.abs(evaluatedPortfolio.totalReturnRp))} (
                {formatPersen(evaluatedPortfolio.totalReturnPct, 2, true)})
              </span>
            </div>
          </div>

          {/* Kontrol Eksekusi Beli / Jual Virtual */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <label htmlFor="paper-lots-input" className="text-[10px] text-slate-400">
                Order {ticker} (Lot)
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="paper-lots-input"
                  name="paperLotsInput"
                  type="text"
                  value={paperLotsStr}
                  onChange={(e) => setPaperLotsStr(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-16 px-2 py-1 rounded bg-[#080A0F] border border-white/[0.08] text-right font-mono text-[11px] text-white tnum focus:outline-none focus:border-[#2DD4BF]"
                />
                <button
                  type="button"
                  onClick={() => setPaperLotsStr(String(Math.max(1, Math.min(20, maxBuyLots))))}
                  className="px-1.5 py-1 rounded bg-[#080A0F] hover:bg-[#161C29] border border-white/[0.07] font-mono text-[9.5px] text-slate-300"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9.5px] text-slate-500 font-mono tnum">
              <span>Est. {formatRupiah(estBuyOrderRp)}</span>
              <span>
                Fee {(IDX_BUY_FEE_RATE * 100).toFixed(2)}%/{(IDX_SELL_FEE_RATE * 100).toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <MagneticHover strength={3}>
                <button
                  type="button"
                  data-cursor-hint={`Beli ${ticker}`}
                  onClick={handlePaperBuy}
                  disabled={currentPrice <= 0 || paperLots <= 0}
                  className="w-full py-1.5 px-2 rounded-md bg-[#22C55E] hover:bg-[#16A34A] text-[#052E16] font-bold text-[11px] transition flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Beli</span>
                </button>
              </MagneticHover>
              <MagneticHover strength={3}>
                <button
                  type="button"
                  data-cursor-hint={`Jual ${ticker}`}
                  onClick={handlePaperSell}
                  disabled={!activeHolding || activeHolding.lots <= 0}
                  className="w-full py-1.5 px-2 rounded-md bg-[#EF4444]/18 hover:bg-[#EF4444] border border-[#EF4444]/45 text-[#FCA5A5] hover:text-white font-bold text-[11px] transition flex items-center justify-center gap-1 disabled:opacity-35"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Jual ({activeHolding?.lots ?? 0})</span>
                </button>
              </MagneticHover>
            </div>

            <AnimatePresence>
              {paperFeedback && (
                <motion.div
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: EASE_TERMINAL }}
                  className={`px-2 py-1 rounded border text-[10px] ${
                    paperFeedback.kind === "ok"
                      ? "bg-[#22C55E]/15 border-[#22C55E]/35 text-[#22C55E]"
                      : "bg-[#EF4444]/15 border-[#EF4444]/35 text-[#FCA5A5]"
                  }`}
                >
                  {paperFeedback.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sub-tab Posisi Aktif vs Riwayat */}
          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
            <div className="grid grid-cols-2 gap-0.5 bg-[#080A0F] p-0.5 rounded-md border border-white/[0.06] text-[10px]">
              {(
                [
                  { id: "positions" as const, label: `Posisi (${evaluatedPortfolio.positions.length})` },
                  { id: "history" as const, label: `Riwayat (${paperState.history.length})` },
                ] as const
              ).map((tab) => {
                const isSel = paperTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaperTab(tab.id)}
                    className={`relative z-10 py-1 rounded transition-colors ${
                      isSel ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {isSel && (
                      <motion.span
                        layoutId="paper-portfolio-tab"
                        transition={SPRING_SNAP}
                        aria-hidden="true"
                        className="absolute inset-0 rounded bg-[#161C29] border border-white/[0.08] -z-10"
                      />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-white/[0.05] max-h-[155px] overflow-y-auto terminal-scroll rounded-md bg-[#0B0E15] border border-white/[0.06]">
              {paperTab === "positions" ? (
                evaluatedPortfolio.positions.length === 0 ? (
                  <div className="p-3 text-center text-[10.5px] text-slate-500">
                    Belum ada posisi virtual. Klik <strong className="text-slate-300">Beli</strong> untuk simulasi.
                  </div>
                ) : (
                  evaluatedPortfolio.positions.map((pos) => (
                    <button
                      key={pos.ticker}
                      type="button"
                      onClick={() => onSelectTicker(pos.ticker)}
                      className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-[#161C29] text-left transition font-mono tnum"
                    >
                      <div>
                        <span className="font-bold text-slate-100">{pos.ticker}</span>
                        <span className="text-[9.5px] text-slate-500 block">
                          {pos.lots} lot &bull; Avg {formatNumber(Math.round(pos.avgPrice))}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10.5px] text-slate-200 block">
                          {formatRupiah(pos.marketValueRp)}
                        </span>
                        <span
                          className={`text-[9.5px] font-semibold ${
                            pos.unrealizedPnlRp >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {formatPersen(pos.unrealizedPnlPct, 1, true)}
                        </span>
                      </div>
                    </button>
                  ))
                )
              ) : paperState.history.length === 0 ? (
                <div className="p-3 text-center text-[10.5px] text-slate-500">
                  Belum ada riwayat transaksi simulasi.
                </div>
              ) : (
                paperState.history.slice(0, 6).map((tr) => (
                  <div
                    key={tr.id}
                    className="px-2.5 py-1.5 flex items-center justify-between gap-2 font-mono tnum text-[10px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1 rounded text-[9px] font-bold ${
                          tr.side === "BUY"
                            ? "bg-[#22C55E]/15 text-[#22C55E]"
                            : "bg-[#EF4444]/15 text-[#EF4444]"
                        }`}
                      >
                        {tr.side === "BUY" ? "B" : "J"}
                      </span>
                      <span className="text-slate-200 font-semibold">{tr.ticker}</span>
                      <span className="text-slate-500">{tr.lots}L</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-300">@ {formatNumber(tr.price)}</span>
                      {tr.realizedPnlRp !== undefined && (
                        <span
                          className={`block text-[9px] ${
                            tr.realizedPnlRp >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                          }`}
                        >
                          {tr.realizedPnlRp >= 0 ? "+" : "-"}
                          {formatNumber(Math.abs(tr.realizedPnlRp))}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </TerminalSpotlightCard>
    </div>
  );
};
