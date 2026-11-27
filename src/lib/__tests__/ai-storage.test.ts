import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  AI_API_KEY_SESSION_KEY,
  AI_CHAT_STORAGE_KEY,
  MAX_AI_CHAT_MESSAGES,
  parseAiChatHistoryJson,
  readAiChatStorageSnapshot,
  readSessionApiKeySnapshot,
  sanitizeAiMessages,
  writeAiChatStorage,
  writeSessionApiKey,
} from "@/lib/ai-storage";

describe("ai-storage helpers", () => {
  beforeEach(() => {
    const localMap = new Map<string, string>();
    const sessionMap = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => localMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          localMap.set(k, v);
        },
        removeItem: (k: string) => {
          localMap.delete(k);
        },
      },
      sessionStorage: {
        getItem: (k: string) => sessionMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          sessionMap.set(k, v);
        },
        removeItem: (k: string) => {
          sessionMap.delete(k);
        },
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  });

  it("sanitizes corrupted chat payloads and keeps only newest MAX_AI_CHAT_MESSAGES items", () => {
    const tooMany = Array.from({ length: MAX_AI_CHAT_MESSAGES + 5 }, (_, idx) => ({
      id: `m-${idx}`,
      role: idx % 2 === 0 ? "user" : "assistant",
      content: `Pesan ke-${idx}`,
      source: idx % 2 === 1 ? "gemini" : undefined,
    }));

    const cleaned = sanitizeAiMessages([
      { role: "system", content: "invalid role" },
      { role: "user", content: "   " },
      ...tooMany,
    ]);

    expect(cleaned).toHaveLength(MAX_AI_CHAT_MESSAGES);
    expect(cleaned[0].id).toBe("m-5");
    expect(cleaned[cleaned.length - 1].id).toBe(`m-${MAX_AI_CHAT_MESSAGES + 4}`);
  });

  it("persists chat history in localStorage and clears storage key when emptied", () => {
    const saved = writeAiChatStorage([
      { id: "u-1", role: "user", content: "Cek BBCA" },
      { id: "a-1", role: "assistant", content: "Valuasi wajar.", source: "builtin", model: null },
    ]);
    expect(saved).toHaveLength(2);
    expect(window.localStorage.getItem(AI_CHAT_STORAGE_KEY)).toContain("Cek BBCA");
    expect(readAiChatStorageSnapshot()).toContain("Cek BBCA");

    const parsed = parseAiChatHistoryJson(readAiChatStorageSnapshot());
    expect(parsed).toHaveLength(2);
    expect(parsed[1].source).toBe("builtin");

    writeAiChatStorage([]);
    expect(readAiChatStorageSnapshot()).toBe("[]");
    expect(parseAiChatHistoryJson("{bad-json")).toEqual([]);
  });

  it("stores optional custom API key in sessionStorage only", () => {
    writeSessionApiKey("AIzaTest123");
    expect(readSessionApiKeySnapshot()).toBe("AIzaTest123");
    expect(window.localStorage.getItem(AI_API_KEY_SESSION_KEY)).toBeNull();

    writeSessionApiKey("   ");
    expect(readSessionApiKeySnapshot()).toBe("");
  });
});
