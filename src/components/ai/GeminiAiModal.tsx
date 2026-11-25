"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Send,
  Key,
  Terminal,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { AiMarketContext } from "@/app/api/ai/analyze/route";
import { formatPersen, formatRupiah } from "@/lib/format";

interface GeminiAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  context?: AiMarketContext;
}

export const GeminiAiModal: React.FC<GeminiAiModalProps> = ({
  isOpen,
  onClose,
  initialQuery = "",
  context,
}) => {
  const [apiKey, setApiKey] = useState<string>("");
  const [query, setQuery] = useState<string>(initialQuery);
  const [response, setResponse] = useState<string | null>(null);
  const [responseSource, setResponseSource] = useState<"gemini" | "builtin" | null>(null);
  const [responseModel, setResponseModel] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  const presetQueries = useMemo(() => {
    const items: string[] = [];
    if (context?.stock) {
      items.push(
        `Evaluasi valuasi & risiko ${context.stock.ticker} pada harga ${formatRupiah(context.stock.price)} saat ini.`
      );
      items.push(
        `Bagaimana pengaruh posisi IHSG & kurs USD/IDR terkini terhadap kinerja ${context.stock.ticker}?`
      );
    }
    if (context?.article) {
      items.push(
        `Jelaskan mekanisme transmisi dan sektor pemenang dari berita: "${context.article.title}"`
      );
    }
    items.push(
      "Apa dampak kenaikan PPN terhadap saham ritel (ACES, MAPI) vs perbankan (BBCA, BBRI)?",
      "Analisis transmisi lonjakan harga minyak mentah dunia (Brent) ke emiten energi (MEDC) dan konsumer (ICBP)."
    );
    return items.slice(0, 4);
  }, [context]);

  if (!isOpen) return null;

  const handleAsk = async (userPrompt: string) => {
    const trimmed = userPrompt.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setResponse(null);
    setWarningMsg(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          customApiKey: apiKey.trim() || undefined,
          context,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        source?: "gemini" | "builtin";
        model?: string;
        warning?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResponse(data.reply || "Tidak ada respons yang dihasilkan.");
      setResponseSource(data.source || "builtin");
      setResponseModel(data.model || null);
      setWarningMsg(data.warning || null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setWarningMsg(`Gagal menghubungi layanan AI: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#090D16] border border-slate-700/80 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
                <span>StocksSense AI Assistant</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-sans">
                  Server-Side Gemini
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Analisis transmisi makroekonomi, sentimen berita, dan valuasi saham aktif
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition"
              title="Gunakan API Key Gemini Sendiri (Opsional)"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Konteks Pasar yang Sedang Dibuka */}
        {(context?.stock || context?.article) && (
          <div className="px-4 py-2 bg-[#0E1622] border-b border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-sans">
            <span className="text-slate-400">Konteks aktif:</span>
            {context?.stock && (
              <span className="px-2 py-0.5 rounded bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-[#2DD4BF] font-mono tnum">
                {context.stock.ticker} &bull; {formatRupiah(context.stock.price)} ({formatPersen(context.stock.changePercent, 1, true)})
              </span>
            )}
            {context?.article && (
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 truncate max-w-xs">
                Artikel: {context.article.title}
              </span>
            )}
          </div>
        )}

        {/* Optional Custom Gemini API Key Drawer */}
        {showKeyInput && (
          <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs">
            <label className="block text-slate-400 mb-1 font-mono text-[11px]">
              Google Gemini API Key Pribadi (Opsional — bila server sudah memiliki GEMINI_API_KEY, biarkan kosong):
            </label>
            <div className="flex space-x-2">
              <input
                type="password"
                placeholder="Masukkan API Key dari Google AI Studio (opsional)..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKeyInput(false)}
                className="px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-lg font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Modal Body / Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 text-xs font-sans">
          {/* Preset Prompts */}
          <div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
              Rekomendasi Pertanyaan Kontekstual:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presetQueries.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(p);
                    handleAsk(p);
                  }}
                  className="p-2.5 text-left rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-emerald-300 transition text-[11px] leading-snug font-sans"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {warningMsg && (
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/50 text-amber-200 flex items-start space-x-2 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{warningMsg}</span>
            </div>
          )}

          {/* AI Response Output */}
          {isLoading && (
            <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-center space-x-3 text-slate-300">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="font-mono text-xs">Menganalisis konteks pasar & transmisi saham...</span>
            </div>
          )}

          {response && (
            <div className="p-4 md:p-5 rounded-xl bg-[#0c1322] border border-emerald-900/40 text-slate-200 leading-relaxed font-sans shadow-inner space-y-2 whitespace-pre-line">
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-mono text-xs font-semibold">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Analisis Intelijen Pasar:</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {responseSource === "gemini"
                    ? `Gemini (${responseModel || "flash"})`
                    : "Analis Kontekstual Bawaan"}
                </span>
              </div>
              <div className="text-xs text-slate-300 space-y-2 pt-1">
                {response}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Input Form */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              placeholder="Tanyakan analisis saham atau dampak isu politik/makro..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold transition shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
