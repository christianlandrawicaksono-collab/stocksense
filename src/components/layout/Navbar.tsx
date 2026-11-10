"use client";

import React from "react";
import { Terminal as TerminalIcon, Newspaper, GitBranch } from "lucide-react";

export type AppMode = "berita" | "terminal";

interface NavbarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onModeChange,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1A2230] bg-[#0A0D14]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-[#5CE1E6]">
              <TerminalIcon className="w-4 h-4" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-mono font-bold text-lg tracking-tight text-white">
                Stocks<span className="text-[#5CE1E6]">Sense</span>
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400">
                / IDX Analytics
              </span>
            </div>
          </div>

          {/* Mode Switcher: Berita vs Terminal */}
          <div className="flex items-center bg-[#111622] p-1 rounded-lg border border-[#1E2736]">
            <button
              onClick={() => onModeChange("terminal")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition ${
                currentMode === "terminal"
                  ? "bg-[#1E7B85] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>

            <button
              onClick={() => onModeChange("berita")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition ${
                currentMode === "berita"
                  ? "bg-[#1E7B85] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Berita</span>
            </button>
          </div>

          {/* Right Status */}
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="hidden md:inline-block text-[11px] text-slate-400 border border-[#1E2736] px-2 py-1 rounded bg-[#0E131C]">
              Branch: redesign
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
