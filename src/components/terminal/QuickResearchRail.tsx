"use client";

import React, { useMemo, useState } from "react";
import {
  formatNumber,
  formatPersen,
  formatRupiah,
  parseFormattedNumber,
} from "@/lib/format";
import { IDX_LOT_SIZE } from "@/lib/portfolio-allocator";
import { filterNewsByTicker } from "@/lib/news-brief";
import {
  evaluateTargetBuyStatus,
  MAX_WATCHLIST_NOTE_LENGTH,
  type WatchlistEntryMeta,
  type WatchlistTargetSummary,
} from "@/lib/watchlist";
import type { LiveMarketNewsItem } from "@/types/market";
import {
  Calculator,
  ExternalLink,
  Newspaper,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react";

interface QuickResearchRailProps {
  ticker: string;
  companyName: string;
  currentPrice: number;
  dividendYield: number;
  targetBuyPrice?: number;
  note?: string;
  isInWatchlist: boolean;
  isWatchlistFull: boolean;
  watchlistBuySummary?: WatchlistTargetSummary;
  liveNewsItems?: LiveMarketNewsItem[];
  onToggleWatchlist?: (ticker: string) => void;
  onSaveWatchlistMeta?: (ticker: string, meta: WatchlistEntryMeta | null) => void;
  onSelectTicker?: (ticker: string) => void;
  onAskAiStock?: (ticker: string) => void;
  onClose?: () => void;
}

const QUICK_BUDGET_PRESETS = [
  { label: "2 Jt", value: 2_000_000 },
  { label: "5 Jt", value: 5_000_000 },
  { label: "10 Jt", value: 10_000_000 },
  { label: "25 Jt", value: 25_000_000 },
];

export const QuickResearchRail: React.FC<QuickResearchRailProps> = ({
  ticker,
  companyName,
  currentPrice,
  dividendYield,
  targetBuyPrice,
  note,
  isInWatchlist,
  isWatchlistFull,
  watchlistBuySummary,
  liveNewsItems = [],
  onToggleWatchlist,
  onSaveWatchlistMeta,
  onSelectTicker,
  onAskAiStock,
  onClose,
}) => {
  const [topTab, setTopTab] = useState<"lot" | "target">("lot");
  const [bottomTab, setBottomTab] = useState<"signals" | "news">("signals");
  const [budgetStr, setBudgetStr] = useState<string>("5.000.000");

  // Key drafts by ticker so switching stocks resets cleanly without effect-driven setState
  const [targetDraft, setTargetDraft] = useState<{
    ticker: string;
    priceStr: string;
    noteStr: string;
  }>({
    ticker,
    priceStr: targetBuyPrice ? formatNumber(targetBuyPrice) : "",
    noteStr: note || "",
  });

  const activePriceStr =
    targetDraft.ticker === ticker
      ? targetDraft.priceStr
      : targetBuyPrice
      ? formatNumber(targetBuyPrice)
      : "";
  const activeNoteStr =
    targetDraft.ticker === ticker ? targetDraft.noteStr : note || "";

  const budgetRp = useMemo(() => Math.max(0, parseFormattedNumber(budgetStr)), [budgetStr]);
  const costPerLot = currentPrice > 0 ? currentPrice * IDX_LOT_SIZE : 0;
  const lots = costPerLot > 0 ? Math.floor(budgetRp / costPerLot) : 0;
  const allocatedRp = lots * costPerLot;
  const remainingCash = Math.max(0, budgetRp - allocatedRp);
  const estAnnualDiv = dividendYield > 0 ? allocatedRp * (dividendYield / 100) : 0;

  const targetEval = evaluateTargetBuyStatus(currentPrice, targetBuyPrice);

  const actionableSignals = useMemo(() => {
    if (!watchlistBuySummary) return [];
    return [...watchlistBuySummary.hitItems, ...watchlistBuySummary.nearItems].slice(0, 6);
  }, [watchlistBuySummary]);

  const relatedNews = useMemo(() => {
    const matched = filterNewsByTicker(liveNewsItems, ticker, companyName);
    return (matched.length > 0 ? matched : liveNewsItems).slice(0, 5);
  }, [liveNewsItems, ticker, companyName]);

  const handleBudgetChange = (raw: string) => {
    const num = parseFormattedNumber(raw);
    setBudgetStr(num > 0 ? formatNumber(num) : raw.trim() === "" ? "" : "0");
  };

  const handleTargetPriceInput = (raw: string) => {
    const num = parseFormattedNumber(raw);
    setTargetDraft({
      ticker,
      priceStr: num > 0 ? formatNumber(num) : raw.trim() === "" ? "" : "0",
      noteStr: activeNoteStr,
    });
  };

  const handleSaveTarget = () => {
    if (!onSaveWatchlistMeta) return;
    const parsedPrice = parseFormattedNumber(activePriceStr);
    const cleanedNote = activeNoteStr.trim();
    if (parsedPrice <= 0 && cleanedNote.length === 0) {
      onSaveWatchlistMeta(ticker, null);
    } else {
      onSaveWatchlistMeta(ticker, {
        ...(parsedPrice > 0 ? { targetBuyPrice: parsedPrice } : {}),
        ...(cleanedNote.length > 0 ? { note: cleanedNote } : {}),
      });
    }
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Kartu Atas: Kalkulator Lot Cepat & Target Harga Beli (Pengganti Ticket Broker) */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
        <div className="px-3.5 py-2.5 border-b border-[#1E2736] bg-[#0E131C] flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 font-semibold text-slate-200">
            <Calculator className="w-3.5 h-3.5 text-[#2DD4BF]" />
            <span>Aksi &amp; Hitung Lot</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Sembunyikan panel kanan"
              title="Sembunyikan panel kanan"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#171F2C] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Switcher Hitung Lot vs Target Beli */}
        <div className="grid grid-cols-2 border-b border-[#1E2736] bg-[#0A0E16]">
          <button
            type="button"
            onClick={() => setTopTab("lot")}
            className={`py-2 text-center text-[11px] font-medium border-b-2 transition ${
              topTab === "lot"
                ? "border-[#2EB886] text-[#2EB886] bg-[#2EB886]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Hitung Lot ({ticker})
          </button>
          <button
            type="button"
            onClick={() => setTopTab("target")}
            className={`py-2 text-center text-[11px] font-medium border-b-2 transition ${
              topTab === "target"
                ? "border-[#1E7B85] text-[#2DD4BF] bg-[#1E7B85]/15"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Target Beli
          </button>
        </div>

        <div className="p-3.5 space-y-3">
          {topTab === "lot" ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="quick-rail-budget" className="text-[11px] text-slate-400 block">
                  Anggaran Dana (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                    Rp
                  </span>
                  <input
                    id="quick-rail-budget"
                    name="quickRailBudget"
                    type="text"
                    value={budgetStr}
                    onChange={(e) => handleBudgetChange(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {QUICK_BUDGET_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setBudgetStr(formatNumber(p.value))}
                      className={`py-1 rounded text-[11px] font-mono border transition ${
                        budgetRp === p.value
                          ? "bg-[#1E7B85] border-[#1E7B85] text-white"
                          : "bg-[#0C1017] border-[#20293A] text-slate-300 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0A0E16] border border-[#1E2736] space-y-1.5 font-mono text-[11px] tnum">
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Harga / Lot (100 lbr)</span>
                  <span className="text-slate-200">
                    {costPerLot > 0 ? formatRupiah(costPerLot) : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Dapat Dibeli</span>
                  <span className="text-[#2DD4BF] font-bold">
                    {lots} lot ({formatNumber(lots * IDX_LOT_SIZE)} lbr)
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Total Alokasi</span>
                  <span className="text-slate-100">{formatRupiah(allocatedRp)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Sisa Kas</span>
                  <span className="text-slate-300">{formatRupiah(remainingCash)}</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-[#182030]">
                  <span className="font-sans">Est. Dividen/Th</span>
                  <span className="text-[#2EB886]">
                    {estAnnualDiv > 0 ? formatRupiah(estAnnualDiv) : "-"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {onAskAiStock && (
                  <button
                    type="button"
                    onClick={() => onAskAiStock(ticker)}
                    className="w-full py-2 px-3 rounded-lg bg-[#2EB886] hover:bg-[#27a376] text-[#07130E] font-semibold transition flex items-center justify-center space-x-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bedah {ticker} dengan AI</span>
                  </button>
                )}
                {onToggleWatchlist && (
                  <button
                    type="button"
                    disabled={!isInWatchlist && isWatchlistFull}
                    onClick={() => onToggleWatchlist(ticker)}
                    className={`w-full py-1.5 px-3 rounded-lg border text-[11px] font-medium transition flex items-center justify-center space-x-1.5 disabled:opacity-45 ${
                      isInWatchlist
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-[#171F2C] border-[#25354A] text-slate-200 hover:text-white"
                    }`}
                  >
                    <Star className={`w-3 h-3 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`} />
                    <span>{isInWatchlist ? "Tersimpan di Watchlist" : "+ Simpan ke Watchlist"}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              {targetBuyPrice && currentPrice > 0 && (
                <div
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between ${
                    targetEval.status === "hit"
                      ? "bg-[#2EB886]/15 border-[#2EB886]/40 text-[#2EB886]"
                      : targetEval.status === "near"
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                      : "bg-[#0A0E16] border-[#1E2736] text-slate-300"
                  }`}
                >
                  <span className="inline-flex items-center space-x-1">
                    <Target className="w-3 h-3" />
                    <span>
                      {targetEval.status === "hit"
                        ? "Area Beli"
                        : targetEval.status === "near"
                        ? "Mendekati Target"
                        : "Di atas Target"}
                    </span>
                  </span>
                  <span className="font-mono tnum font-semibold">
                    {formatPersen(targetEval.diffPercent, 1, true)}
                  </span>
                </div>
              )}

              <div>
                <label htmlFor="quick-rail-target" className="text-[11px] text-slate-400 block mb-1">
                  Target Harga Beli (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">
                    Rp
                  </span>
                  <input
                    id="quick-rail-target"
                    name="quickRailTarget"
                    type="text"
                    value={activePriceStr}
                    onChange={(e) => handleTargetPriceInput(e.target.value)}
                    placeholder="cth. 8.500"
                    className="w-full pl-8 pr-2.5 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-slate-100 font-mono tnum focus:outline-none focus:border-[#1E7B85]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="quick-rail-note" className="text-[11px] text-slate-400 block mb-1">
                  Catatan Riset
                </label>
                <input
                  id="quick-rail-note"
                  name="quickRailNote"
                  type="text"
                  maxLength={MAX_WATCHLIST_NOTE_LENGTH}
                  value={activeNoteStr}
                  onChange={(e) =>
                    setTargetDraft({
                      ticker,
                      priceStr: activePriceStr,
                      noteStr: e.target.value,
                    })
                  }
                  placeholder="Tesis akumulasi..."
                  className="w-full px-2.5 py-1.5 bg-[#080B10] border border-[#20293A] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#1E7B85]"
                />
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleSaveTarget}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#1E7B85] hover:bg-[#1E7B85]/85 text-white font-medium transition"
                >
                  Simpan Target
                </button>
                {(targetBuyPrice || note) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveWatchlistMeta?.(ticker, null);
                      setTargetDraft({ ticker, priceStr: "", noteStr: "" });
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-[#171F2C] hover:bg-red-950/50 text-slate-300 hover:text-red-300 border border-[#232F42] transition"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Kartu Bawah: Sinyal Watchlist & Berita Terkait (Pengganti Time & Sales Fiktif) */}
      <div className="bg-[#111622] border border-[#1E2736] rounded-xl overflow-hidden shadow-lg">
        <div className="grid grid-cols-2 border-b border-[#1E2736] bg-[#0E131C]">
          <button
            type="button"
            onClick={() => setBottomTab("signals")}
            className={`py-2 px-2 text-[11px] font-medium flex items-center justify-center space-x-1 border-b-2 transition ${
              bottomTab === "signals"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Target className="w-3 h-3 text-[#2EB886]" />
            <span>Sinyal ({actionableSignals.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setBottomTab("news")}
            className={`py-2 px-2 text-[11px] font-medium flex items-center justify-center space-x-1 border-b-2 transition ${
              bottomTab === "news"
                ? "border-[#1E7B85] text-white bg-[#1E7B85]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Newspaper className="w-3 h-3 text-[#2DD4BF]" />
            <span>Berita ({relatedNews.length})</span>
          </button>
        </div>

        <div className="divide-y divide-[#1A2230]/80 max-h-[300px] overflow-y-auto terminal-scroll">
          {bottomTab === "signals" ? (
            actionableSignals.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400 leading-relaxed">
                Belum ada saham Watchlist yang masuk <span className="text-slate-200">Area Beli</span> atau dalam +5% target.
              </div>
            ) : (
              actionableSignals.map((sig) => (
                <button
                  key={sig.ticker}
                  type="button"
                  onClick={() => onSelectTicker?.(sig.ticker)}
                  className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#172030] text-left transition"
                >
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-slate-100">{sig.ticker}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          sig.status === "hit"
                            ? "bg-[#2EB886]/20 text-[#2EB886]"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {sig.status === "hit" ? "Area Beli" : "Dekat"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono tnum block">
                      Target {formatRupiah(sig.targetBuyPrice)}
                    </span>
                  </div>
                  <div className="text-right font-mono tnum">
                    <span className="text-slate-100 font-semibold block">
                      {formatRupiah(sig.price)}
                    </span>
                    <span
                      className={`text-[10px] ${
                        sig.status === "hit" ? "text-[#2EB886]" : "text-amber-300"
                      }`}
                    >
                      {formatPersen(sig.diffPercent, 1, true)}
                    </span>
                  </div>
                </button>
              ))
            )
          ) : relatedNews.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-slate-400">
              Belum ada berita RSS terbaru saat ini.
            </div>
          ) : (
            relatedNews.map((item) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2.5 hover:bg-[#172030] transition space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-[#2DD4BF] font-medium truncate">{item.publisher}</span>
                  <span className="shrink-0 ml-2">{item.publishedWib}</span>
                </div>
                <p className="text-[11px] text-slate-200 line-clamp-2 leading-snug font-medium">
                  {item.title}
                </p>
                <span className="inline-flex items-center space-x-1 text-[10px] text-slate-400">
                  <span>Buka sumber</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
