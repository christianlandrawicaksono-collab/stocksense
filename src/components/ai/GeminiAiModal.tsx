"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Sparkles,
  Send,
  Key,
  Terminal,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import type { AiMarketContext } from "@/app/api/ai/analyze/route";
import { formatMultiple, formatPersen, formatRupiah } from "@/lib/format";
import { MarkdownMessage } from "./MarkdownMessage";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "gemini" | "builtin";
  model?: string | null;
}

interface GeminiAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: AiMarketContext;
  messages: AiChatMessage[];
  isLoading: boolean;
  warningMsg: string | null;
  customApiKey: string;
  onCustomApiKeyChange: (key: string) => void;
  onSendMessage: (prompt: string) => void;
  onClearMessages: () => void;
}

export const GeminiAiModal: React.FC<GeminiAiModalProps> = ({
  isOpen,
  onClose,
  context,
  messages,
  isLoading,
  warningMsg,
  customApiKey,
  onCustomApiKeyChange,
  onSendMessage,
  onClearMessages,
}) => {
  const [query, setQuery] = useState<string>("");
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages.length, isLoading]);

  const presetQueries = useMemo(() => {
    const items: string[] = [];
    const customPeers = (context?.watchlistPeers || []).filter(
      (p) => p.isInCustomWatchlist && p.price > 0
    );

    if (context?.stock) {
      const otherCustomPeer = customPeers.find((p) => p.ticker !== context.stock?.ticker);
      const sameSectorPeer =
        otherCustomPeer ||
        context.watchlistPeers?.find(
          (p) => p.sector === context.stock?.sector && p.ticker !== context.stock?.ticker
        );
      items.push(
        `Evaluasi valuasi & risiko ${context.stock.ticker} pada harga ${formatRupiah(context.stock.price)} saat ini.`
      );
      if (context.stock.targetBuyPrice && context.stock.targetBuyPrice > 0) {
        items.push(
          `Apakah Target Beli ${formatRupiah(context.stock.targetBuyPrice)} untuk ${context.stock.ticker} sudah ideal dibanding nilai wajarnya?`
        );
      }
      if (sameSectorPeer) {
        items.push(
          `Bandingkan ${context.stock.ticker} dengan ${sameSectorPeer.ticker} dari sisi P/E, PBV, dan Dividend Yield.`
        );
      } else {
        items.push(
          `Bagaimana pengaruh posisi IHSG & kurs USD/IDR terkini terhadap kinerja ${context.stock.ticker}?`
        );
      }
    }
    if (customPeers.length >= 2) {
      items.push("Bandingkan valuasi dan potensi saham di Watchlist Saya saat ini.");
    }
    if (context?.article) {
      items.push(
        context.article.isLive
          ? `Bedah dampak pasar & saham terkait dari berita: "${context.article.title}"`
          : `Jelaskan mekanisme transmisi dan sektor pemenang dari skenario: "${context.article.title}"`
      );
    }
    items.push(
      "Apa dampak kenaikan PPN terhadap saham ritel (ACES, MAPI) vs perbankan (BBCA, BBRI)?",
      "Analisis transmisi lonjakan harga minyak mentah dunia (Brent) ke emiten energi (MEDC) dan konsumer (ICBP)."
    );
    return items.slice(0, 4);
  }, [context]);

  const followUpChips = useMemo(() => {
    const customPeers = (context?.watchlistPeers || []).filter(
      (p) => p.isInCustomWatchlist && p.price > 0
    );
    if (context?.stock) {
      const peerCandidate =
        customPeers.find((p) => p.ticker !== context.stock?.ticker) ||
        context.watchlistPeers?.find(
          (p) => p.sector === context.stock?.sector && p.ticker !== context.stock?.ticker
        );
      const chips = [
        `Risiko utama ${context.stock.ticker} saat ini?`,
        `Pengaruh makro & kurs ke ${context.stock.ticker}?`,
      ];
      if (peerCandidate) {
        chips.unshift(`Bandingkan dengan ${peerCandidate.ticker}`);
      }
      return chips.slice(0, 3);
    }
    if (context?.article) {
      const firstTicker = context.article.tickers?.[0];
      const chips = [
        "Sektor apa saja yang paling terdampak?",
        "Risiko jangka pendek yang perlu dicermati?",
      ];
      if (firstTicker) {
        chips.unshift(`Bagaimana prospek ${firstTicker} dari berita ini?`);
      }
      return chips.slice(0, 3);
    }
    return [];
  }, [context]);

  if (!isOpen) return null;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 2000);
    } catch {
      // Clipboard API tidak tersedia di beberapa lingkungan terbatas
    }
  };

  const handleAsk = (userPrompt: string) => {
    const trimmed = userPrompt.trim();
    if (!trimmed || isLoading) return;
    setQuery("");
    onSendMessage(trimmed);
  };

  return (
    <>
      {/* Overlay backdrop di mobile hingga laptop (<1280px); di layar xl non-blocking */}
      <div
        className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] xl:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="complementary"
        aria-label="StocksSense AI Assistant"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] lg:w-[400px] xl:w-[440px] bg-[#090D16] border-l border-slate-800 shadow-2xl flex flex-col"
      >
        {/* Side Panel Header */}
        <div className="p-3.5 md:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/70 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
                <span className="truncate">StocksSense AI</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-sans shrink-0">
                  Side Panel
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Diskusi multi-turn kontekstual &amp; perbandingan emiten
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onClearMessages}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition"
                title="Mulai percakapan baru"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className={`p-1.5 rounded-lg border transition ${
                showKeyInput
                  ? "text-emerald-400 bg-emerald-950/50 border-emerald-700/60"
                  : "text-slate-400 hover:text-white bg-slate-800 border-slate-700"
              }`}
              title="Gunakan API Key Gemini Sendiri (Opsional)"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 border border-slate-700 transition"
              title="Tutup panel AI (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Konteks Pasar yang Sedang Dibuka (otomatis update saat user klik emiten lain di Watchlist) */}
        {(context?.stock || context?.article) && (
          <div className="px-3.5 py-2 bg-[#0E1622] border-b border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300 font-sans shrink-0">
            <span className="text-slate-400">Konteks:</span>
            {context?.stock && (
              <span className="px-2 py-0.5 rounded bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-[#2DD4BF] font-mono tnum">
                {context.stock.ticker} &bull; {formatRupiah(context.stock.price)} ({formatPersen(context.stock.changePercent, 1, true)}) &bull; P/E {formatMultiple(context.stock.peRatio, 1)}
              </span>
            )}
            {context?.stock?.targetBuyPrice && context.stock.targetBuyPrice > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-mono tnum">
                Target {formatRupiah(context.stock.targetBuyPrice)}
              </span>
            )}
            {context?.article && (
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 truncate max-w-[260px]">
                {context.article.isLive ? "Berita:" : "Skenario:"} {context.article.title}
              </span>
            )}
          </div>
        )}

        {/* Optional Custom Gemini API Key Drawer */}
        {showKeyInput && (
          <div className="p-3 bg-slate-900 border-b border-slate-800 text-xs shrink-0">
            <label
              htmlFor="gemini-custom-api-key"
              className="block text-slate-400 mb-1 font-mono text-[11px]"
            >
              Gemini API Key Pribadi (disimpan hanya di sesi tab ini, hilang saat tab ditutup):
            </label>
            <div className="flex space-x-2">
              <input
                id="gemini-custom-api-key"
                name="customApiKey"
                type="password"
                autoComplete="off"
                placeholder="Masukkan API Key Google AI Studio..."
                value={customApiKey}
                onChange={(e) => onCustomApiKeyChange(e.target.value)}
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

        {/* Body / Conversation Area */}
        <div className="flex-1 overflow-y-auto terminal-scroll p-3.5 md:p-4 space-y-3.5 text-xs font-sans">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-300 leading-relaxed">
                Pilih pertanyaan contoh di bawah atau ajukan pertanyaan apa saja. Di desktop, Anda tetap bisa klik saham lain di Watchlist sambil panel ini terbuka.
              </div>
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
                  Rekomendasi Pertanyaan Kontekstual:
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {presetQueries.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAsk(p)}
                      className="p-2.5 text-left rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-emerald-300 transition text-[11px] leading-snug font-sans"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[88%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-[#1E7B85]/20 border border-[#1E7B85]/40 text-slate-100 leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-xl bg-[#0c1322] border border-emerald-900/40 text-slate-200 shadow-inner space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-mono text-[11px] font-semibold">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Analisis AI</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {msg.source === "gemini"
                            ? `Gemini (${msg.model || "flash"})`
                            : "Analis Bawaan"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          title="Salin jawaban"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <MarkdownMessage content={msg.content} />
                  </div>
                )
              )}

              {/* Pertanyaan lanjutan ringkas saat percakapan aktif */}
              {!isLoading && followUpChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {followUpChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleAsk(chip)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-300 transition"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {warningMsg && (
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/50 text-amber-200 flex items-start space-x-2 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{warningMsg}</span>
            </div>
          )}

          {isLoading && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center space-x-3 text-slate-300">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
              <span className="font-mono text-xs">Menganalisis konteks pasar &amp; memformat jawaban...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer / Input Form + Permanent Concise Disclaimer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/70 space-y-2 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="flex items-center space-x-2"
          >
            <input
              id="ai-chat-query"
              name="aiQuery"
              type="text"
              aria-label="Pertanyaan analisis saham atau perbandingan"
              placeholder="Tanyakan analisis atau perbandingan saham..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold transition shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-slate-500 leading-tight text-center font-sans">
            Riwayat chat tersimpan lokal di browser &bull; Analisis bersifat informatif, bukan saran investasi.
          </p>
        </div>
      </aside>
    </>
  );
};
