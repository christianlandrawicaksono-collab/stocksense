/**
 * Client-side persistence helpers for StocksSense AI Assistant:
 * - Chat conversation history is stored in localStorage (capped at 30 messages).
 * - Optional personal Gemini API key is kept in sessionStorage (cleared when tab closes).
 */

export const AI_CHAT_STORAGE_KEY = "stocksense:ai-chat-history:v1";
export const AI_API_KEY_SESSION_KEY = "stocksense:gemini-api-key:v1";
export const MAX_AI_CHAT_MESSAGES = 30;
export const MAX_AI_MESSAGE_CHARS = 6000;

export interface StoredAiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "gemini" | "builtin";
  model?: string | null;
}

export function sanitizeAiMessages(raw: unknown): StoredAiChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const clean: StoredAiChatMessage[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const obj = item as Record<string, unknown>;

    const role = obj.role === "user" || obj.role === "assistant" ? obj.role : null;
    const content =
      typeof obj.content === "string"
        ? obj.content.trim().slice(0, MAX_AI_MESSAGE_CHARS)
        : "";
    if (!role || !content) continue;

    let id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : `${role[0]}-restored-${i}`;
    while (seenIds.has(id)) {
      id = `${id}-${i}`;
    }
    seenIds.add(id);

    const source =
      obj.source === "gemini" || obj.source === "builtin" ? obj.source : undefined;
    const model =
      typeof obj.model === "string" && obj.model.trim()
        ? obj.model.trim().slice(0, 80)
        : obj.model === null
        ? null
        : undefined;

    clean.push({
      id,
      role,
      content,
      ...(source !== undefined ? { source } : {}),
      ...(model !== undefined ? { model } : {}),
    });
  }

  return clean.slice(-MAX_AI_CHAT_MESSAGES);
}

export function parseAiChatHistoryJson(rawJson: string | null | undefined): StoredAiChatMessage[] {
  if (!rawJson) return [];
  try {
    return sanitizeAiMessages(JSON.parse(rawJson));
  } catch {
    return [];
  }
}

const chatListeners = new Set<() => void>();

function notifyChatListeners() {
  for (const listener of chatListeners) {
    listener();
  }
}

export function readAiChatStorageSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(AI_CHAT_STORAGE_KEY) || "[]";
  } catch {
    return "[]";
  }
}

export function getAiChatServerSnapshot(): string {
  return "[]";
}

export function subscribeAiChatStorage(listener: () => void): () => void {
  chatListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === AI_CHAT_STORAGE_KEY) {
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    chatListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function writeAiChatStorage(messages: StoredAiChatMessage[]): StoredAiChatMessage[] {
  const sanitized = sanitizeAiMessages(messages);
  if (typeof window !== "undefined") {
    try {
      if (sanitized.length === 0) {
        window.localStorage.removeItem(AI_CHAT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(sanitized));
      }
    } catch {
      // Ignore quota / private-mode storage errors
    }
  }
  notifyChatListeners();
  return sanitized;
}

const sessionKeyListeners = new Set<() => void>();

function notifySessionKeyListeners() {
  for (const listener of sessionKeyListeners) {
    listener();
  }
}

export function readSessionApiKeySnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(AI_API_KEY_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export function getSessionApiKeyServerSnapshot(): string {
  return "";
}

export function subscribeSessionApiKey(listener: () => void): () => void {
  sessionKeyListeners.add(listener);
  return () => {
    sessionKeyListeners.delete(listener);
  };
}

export function writeSessionApiKey(rawKey: string): string {
  const clean = typeof rawKey === "string" ? rawKey.slice(0, 256) : "";
  if (typeof window !== "undefined") {
    try {
      if (!clean.trim()) {
        window.sessionStorage.removeItem(AI_API_KEY_SESSION_KEY);
      } else {
        window.sessionStorage.setItem(AI_API_KEY_SESSION_KEY, clean);
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }
  notifySessionKeyListeners();
  return clean;
}
