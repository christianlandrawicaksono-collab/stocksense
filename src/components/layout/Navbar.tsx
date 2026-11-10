"use client";

import React from "react";
import { 
  Globe2, 
  BarChart3, 
  Layers, 
  Search, 
  Sparkles, 
  Terminal,
  GitBranch
} from "lucide-react";

export type ActiveTab = "macro" | "simulator" | "valuation" | "screener";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenAiModal: () => void;
  selectedTicker?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAiModal,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#090D16]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent border border-emerald-500/30 text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-white font-mono">
                  Stocks<span className="text-emerald-400">Sense</span>
                </span>
                <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  IDX TERMINAL v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans hidden sm:block">
                Indonesian Market & Macro Intelligence
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab("macro")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "macro"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Globe2 className="w-4 h-4" />
              <span>Macro & Geo Radar</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </button>

            <button
              onClick={() => setActiveTab("simulator")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "simulator"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Strategy Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab("valuation")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "valuation"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Valuation Bands</span>
            </button>

            <button
              onClick={() => setActiveTab("screener")}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "screener"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Search className="w-4 h-4" />
              <span>IDX Screener</span>
            </button>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={onOpenAiModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 hover:brightness-110 transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
              <span className="hidden sm:inline">AI Market Assistant</span>
              <span className="sm:hidden">AI</span>
            </button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-900 border border-slate-800 hover:text-white hover:border-slate-700 transition"
              title="View on GitHub"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex lg:hidden overflow-x-auto no-scrollbar py-2 space-x-2 border-t border-slate-800/60">
          <button
            onClick={() => setActiveTab("macro")}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
              activeTab === "macro"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 bg-slate-900"
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Macro Radar</span>
          </button>
          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
              activeTab === "simulator"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 bg-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>DCA Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab("valuation")}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
              activeTab === "valuation"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 bg-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Valuation</span>
          </button>
          <button
            onClick={() => setActiveTab("screener")}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
              activeTab === "screener"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 bg-slate-900"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Screener</span>
          </button>
        </div>
      </div>
    </header>
  );
};
