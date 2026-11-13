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
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1A2230] bg-[#0A0D14]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-[#1E7B85]">
              <TerminalIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <span className="font-mono font-bold text-base tracking-tight text-white">
                StocksSense
              </span>
              <span className="hidden sm:inline-block text-xs text-slate-400 font-sans">
                Riset & transmisi kebijakan
              </span>
            </div>
          </div>

          {/* Right section: AI Assistant text button + Mode Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Simple text button for Gemini AI Modal */}
            {onOpenAiModal && (
              <button
                type="button"
                onClick={onOpenAiModal}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-sans text-slate-300 hover:text-white bg-[#111622] hover:bg-[#1A2230] border border-[#1E2736] transition"
                title="Buka asisten analisis AI"
              >
                <Bot className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="hidden sm:inline">Konsultasi AI</span>
                <span className="sm:hidden">AI</span>
              </button>
            )}

            {/* Mode Switcher: Berita vs Terminal (Sentence case) */}
            <div className="flex items-center bg-[#111622] p-1 rounded-lg border border-[#1E2736]">
              <button
                type="button"
                onClick={() => onModeChange("berita")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium transition ${
                  currentMode === "berita"
                    ? "bg-[#1E7B85] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Berita</span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange("terminal")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-sans font-medium transition ${
                  currentMode === "terminal"
                    ? "bg-[#1E7B85] text-white shadow-sm"
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
