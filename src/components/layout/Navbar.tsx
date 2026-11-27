"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Newspaper, Bot, Target, ChevronDown } from "lucide-react";
import { formatPersen, formatRupiah } from "@/lib/format";
import type { WatchlistTargetSummary } from "@/lib/watchlist";

export type AppMode = "berita" | "terminal";

interface NavbarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onOpenAiModal?: () => void;
  watchlistBuySummary?: WatchlistTargetSummary;
  onSelectBuySignalTicker?: (ticker: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onModeChange,
  onOpenAiModal,
  watchlistBuySummary,
  onSelectBuySignalTicker,
}) => {
  const isLight = currentMode === "berita";
  const [isBuyMenuOpen, setIsBuyMenuOpen] = useState(false);
  const buyMenuRef = useRef<HTMLDivElement>(null);

  const hitItems = watchlistBuySummary?.hitItems ?? [];
  const nearItems = watchlistBuySummary?.nearItems ?? [];
  const totalActionable = watchlistBuySummary?.totalActionable ?? 0;
  const hasHit = hitItems.length > 0;
  const isBuyPopoverVisible = isBuyMenuOpen && totalActionable > 0;

  useEffect(() => {
    if (!isBuyPopoverVisible) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (buyMenuRef.current && !buyMenuRef.current.contains(e.target as Node)) {
        setIsBuyMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsBuyMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isBuyPopoverVisible]);

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors border-b ${isLight
          ? "bg-[#FBFBFA]/95 border-[#E5E5DC] text-[#1A1C1E]"
          : "bg-[#0A0D14]/95 border-[#1A2230] text-slate-100"
        } backdrop-blur-md`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-14">
          {/* Logo 'StocksSense' satu kali saja */}
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            <div
              className={`flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded shrink-0 ${isLight
                  ? "bg-[#1E7B85]/10 border border-[#1E7B85]/30 text-[#1E7B85]"
                  : "bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-[#1E7B85]"
                }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline space-x-2 min-w-0">
              <span
                className={`font-mono font-bold text-sm sm:text-base tracking-tight shrink-0 ${isLight ? "text-[#1A1C1E]" : "text-white"
                  }`}
              >
                StocksSense
              </span>
              <span
                className={`hidden xl:inline-block truncate text-xs font-sans ${isLight ? "text-[#5A6068]" : "text-slate-400"
                  }`}
              >
                Riset pasar modal Indonesia
              </span>
            </div>
          </div>

          {/* Right section: Indikator Area Beli + 'Konsultasi AI' + Toggle Berita/Terminal */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {totalActionable > 0 && (
              <div ref={buyMenuRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setIsBuyMenuOpen((prev) => !prev)}
                  aria-expanded={isBuyPopoverVisible}
                  aria-haspopup="menu"
                  className={`min-h-[40px] sm:min-h-[44px] inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-sans font-semibold border transition ${
                    hasHit
                      ? isLight
                        ? "bg-[#2EB886]/12 hover:bg-[#2EB886]/20 text-[#0D6343] border-[#2EB886]/45"
                        : "bg-[#2EB886]/15 hover:bg-[#2EB886]/25 text-[#2EB886] border-[#2EB886]/40"
                      : isLight
                      ? "bg-amber-500/12 hover:bg-amber-500/20 text-amber-800 border-amber-500/45"
                      : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40"
                  }`}
                  title="Daftar saham Watchlist yang masuk atau mendekati Target Harga Beli"
                >
                  <Target className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {hasHit
                      ? `${hitItems.length} Area Beli`
                      : `${totalActionable} Dekat Target`}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${
                      isBuyPopoverVisible ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isBuyPopoverVisible && (
                  <div
                    role="menu"
                    aria-label="Sinyal Target Beli Watchlist"
                    className={`absolute right-0 mt-2 w-72 z-50 rounded-lg border shadow-xl overflow-hidden text-xs ${
                      isLight
                        ? "bg-[#FBFBFA] border-[#D5D7DC] text-[#1D1F23]"
                        : "bg-[#111622] border-[#232F42] text-slate-100"
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2 border-b flex items-center justify-between ${
                        isLight
                          ? "bg-[#F4F3EE] border-[#E5E5DC]"
                          : "bg-[#0C1017] border-[#1E2736]"
                      }`}
                    >
                      <span className="font-semibold">Sinyal Watchlist</span>
                      <span
                        className={`text-[11px] font-mono tnum ${
                          isLight ? "text-[#676E7E]" : "text-slate-400"
                        }`}
                      >
                        {totalActionable} saham siap pantau
                      </span>
                    </div>

                    <div
                      className={`max-h-72 overflow-y-auto divide-y ${
                        isLight ? "divide-[#E5E5DC]" : "divide-[#1E2736]"
                      }`}
                    >
                      {hitItems.length > 0 && (
                        <div>
                          <div
                            className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                              isLight
                                ? "bg-[#2EB886]/10 text-[#0D6343]"
                                : "bg-[#2EB886]/10 text-[#2EB886]"
                            }`}
                          >
                            Masuk Area Beli (&le; Target)
                          </div>
                          {hitItems.map((item) => (
                            <button
                              key={item.ticker}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setIsBuyMenuOpen(false);
                                onSelectBuySignalTicker?.(item.ticker);
                              }}
                              className={`w-full px-3.5 py-2 flex items-center justify-between text-left transition ${
                                isLight ? "hover:bg-[#F4F3EE]" : "hover:bg-[#172030]"
                              }`}
                            >
                              <div>
                                <div className="font-mono font-bold text-xs">{item.ticker}</div>
                                <div
                                  className={`text-[11px] font-mono tnum ${
                                    isLight ? "text-[#676E7E]" : "text-slate-400"
                                  }`}
                                >
                                  Target {formatRupiah(item.targetBuyPrice)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-semibold tnum">
                                  {formatRupiah(item.price)}
                                </div>
                                <div
                                  className={`text-[10px] font-mono tnum font-semibold ${
                                    isLight ? "text-[#0D6343]" : "text-[#2EB886]"
                                  }`}
                                >
                                  {formatPersen(item.diffPercent, 1, true)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {nearItems.length > 0 && (
                        <div>
                          <div
                            className={`px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                              isLight
                                ? "bg-amber-500/10 text-amber-800"
                                : "bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            Mendekati Target (+5%)
                          </div>
                          {nearItems.map((item) => (
                            <button
                              key={item.ticker}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setIsBuyMenuOpen(false);
                                onSelectBuySignalTicker?.(item.ticker);
                              }}
                              className={`w-full px-3.5 py-2 flex items-center justify-between text-left transition ${
                                isLight ? "hover:bg-[#F4F3EE]" : "hover:bg-[#172030]"
                              }`}
                            >
                              <div>
                                <div className="font-mono font-bold text-xs">{item.ticker}</div>
                                <div
                                  className={`text-[11px] font-mono tnum ${
                                    isLight ? "text-[#676E7E]" : "text-slate-400"
                                  }`}
                                >
                                  Target {formatRupiah(item.targetBuyPrice)}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-semibold tnum">
                                  {formatRupiah(item.price)}
                                </div>
                                <div
                                  className={`text-[10px] font-mono tnum font-semibold ${
                                    isLight ? "text-amber-700" : "text-amber-400"
                                  }`}
                                >
                                  {formatPersen(item.diffPercent, 1, true)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {onOpenAiModal && (
              <button
                type="button"
                onClick={onOpenAiModal}
                className={`min-h-[38px] sm:min-h-[44px] flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs font-sans transition ${isLight
                    ? "text-[#2D3339] bg-[#EFEFEA] hover:bg-[#E5E5DC] border border-[#D5D5CA]"
                    : "text-slate-300 bg-[#111622] hover:bg-[#1A2230] border border-[#1E2736]"
                  }`}
                title="Buka asisten konsultasi AI"
              >
                <Bot className="w-3.5 h-3.5 text-[#1E7B85]" />
                <span className="hidden sm:inline">Konsultasi AI</span>
                <span className="sm:hidden">AI</span>
              </button>
            )}

            {/* Toggle Berita / Terminal permanen */}
            <div
              className={`flex items-center p-0.5 rounded border ${isLight
                  ? "bg-[#EFEFEA] border-[#D8D8CF]"
                  : "bg-[#111622] border-[#1E2736]"
                }`}
            >
              <button
                type="button"
                onClick={() => onModeChange("berita")}
                className={`min-h-[36px] sm:min-h-[40px] flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded text-xs font-sans font-medium transition ${currentMode === "berita"
                    ? "bg-[#1E7B85] text-white shadow-sm"
                    : isLight
                      ? "text-[#5A6068] hover:text-[#1A1C1E]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Berita</span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("terminal")}
                className={`relative min-h-[36px] sm:min-h-[40px] flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded text-xs font-sans font-medium transition ${currentMode === "terminal"
                    ? "bg-[#1E7B85] text-white shadow-sm"
                    : isLight
                      ? "text-[#5A6068] hover:text-[#1A1C1E]"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Terminal</span>
                {totalActionable > 0 && currentMode === "berita" && (
                  <span
                    className={`sm:hidden absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-[#FBFBFA] ${
                      hasHit ? "bg-[#2EB886]" : "bg-amber-400"
                    }`}
                    aria-label="Ada saham watchlist mendekati atau masuk Area Beli"
                  />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
