export interface GeminiContentTurn {
  role: "user" | "model";
  parts: { text: string }[];
}

export type GeminiGenerateResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string };

/**
 * Memanggil Google Gemini API dengan fallback otomatis antar model yang dikonfigurasi.
 */
export async function generateWithGeminiFallback(
  contents: GeminiContentTurn[],
  apiKey: string
): Promise<GeminiGenerateResult> {
  const configuredModel = process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
  const candidateModels = Array.from(
    new Set([configuredModel, "gemini-3-flash-preview", "gemini-3.1-flash-lite"])
  );

  let lastErrMsg = "Gemini API error";

  for (const model of candidateModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": apiKey,
          },
          body: JSON.stringify({ contents }),
        }
      );

      if (!res.ok) {
        lastErrMsg = `Gemini API (${model}) HTTP ${res.status}`;
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          break;
        }
        continue;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text && text.trim()) {
        return { ok: true, text: text.trim(), model };
      }

      lastErrMsg = `Respons kosong dari model ${model}`;
    } catch (apiErr: unknown) {
      lastErrMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    }
  }

  return { ok: false, error: lastErrMsg };
}
