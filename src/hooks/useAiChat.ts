"use client";

import { useState, useCallback, useRef } from "react";
import type { AiMarketContext, AiTurnInput } from "@/app/api/ai/analyze/route";
import type { AiChatMessage } from "@/components/ai/GeminiAiModal";

let messageSeq = 0;
function createMessageId(prefix: "u" | "a"): string {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

export function useAiChat() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isLoadingRef = useRef(false);

  const sendMessage = useCallback(
    async (userPrompt: string, context: AiMarketContext) => {
      const trimmed = userPrompt.trim();
      if (!trimmed || isLoadingRef.current) return;

      const historyPayload: AiTurnInput[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const userMsg: AiChatMessage = {
        id: createMessageId("u"),
        role: "user",
        content: trimmed,
      };

      isLoadingRef.current = true;
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setWarningMsg(null);

      try {
        const res = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            messages: historyPayload,
            customApiKey: customApiKey.trim() || undefined,
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

        const assistantMsg: AiChatMessage = {
          id: createMessageId("a"),
          role: "assistant",
          content: data.reply || "Tidak ada respons yang dihasilkan.",
          source: data.source || "builtin",
          model: data.model || null,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setWarningMsg(data.warning || null);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setWarningMsg(`Gagal menghubungi layanan AI: ${errMsg}`);
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [customApiKey, messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setWarningMsg(null);
  }, []);

  return {
    messages,
    customApiKey,
    setCustomApiKey,
    warningMsg,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
