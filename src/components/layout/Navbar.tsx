"use client";

import React from "react";
import { Terminal as TerminalIcon, Newspaper, Bot } from "lucide-react";

export type AppMode = "berita" | "terminal";

interface NavbarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onOpenAiModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onModeChange,
  onOpenAiModal,
}) => {
  const isLight = currentMode === "berita";

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-colors border-b ${
        isLight
          ? "bg-[#FBFBFA]/95 border-[#E5E5DC] text-[#1A1C1E]"
          : "bg-[#0A0D14]/95 border-[#1A2230] text-slate-100"
      } backdrop-blur-md`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo 'StocksSense' satu kali saja */}
          <div className="flex items-center space-x-2.5">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded ${
                isLight
                  ? "bg-[#1E7B85]/10 border border-[#1E7B85]/30 text-[#1E7B85]"
                  : "bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-[#1E7B85]"
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span
                className={`font-mono font-bold text-base tracking-tight ${
                  isLight ? "text-[#1A1C1E]" : "text-white"
                }`}
              >
                StocksSense
              </span>
              <span
                className={`hidden sm:inline-block text-xs font-sans ${
                  isLight ? "text-[#5A6068]" : "text-slate-400"
                }`}
              >
                Riset pasar modal Indonesia
              </span>
            </div>
          </div>

          {/* Right section: Tombol teks 'Konsultasi AI' + Toggle Berita/Terminal */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {onOpenAiModal && (
              <button
                type="button"
                onClick={onOpenAiModal}
                className={`min-h-[44px] flex items-center space-x-1.5 px-3 py-2 rounded text-xs font-sans transition ${
                  isLight
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

            {/* Toggle Berita / Terminal permanen (min 44px tap target) */}
            <div
              className={`flex items-center p-0.5 rounded border ${
                isLight
                  ? "bg-[#EFEFEA] border-[#D8D8CF]"
                  : "bg-[#111622] border-[#1E2736]"
              }`}
            >
              <button
                type="button"
                onClick={() => onModeChange("berita")}
                className={`min-h-[40px] sm:min-h-[44px] flex items-center space-x-1.5 px-3 sm:px-3.5 py-2 rounded text-xs font-sans font-medium transition ${
                  currentMode === "berita"
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
                className={`min-h-[40px] sm:min-h-[44px] flex items-center space-x-1.5 px-3 sm:px-3.5 py-2 rounded text-xs font-sans font-medium transition ${
                  currentMode === "terminal"
                    ? "bg-[#1E7B85] text-white shadow-sm"
                    : isLight
                    ? "text-[#5A6068] hover:text-[#1A1C1E]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Terminal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
