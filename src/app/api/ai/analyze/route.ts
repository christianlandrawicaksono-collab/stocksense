import { NextRequest, NextResponse, connection } from "next/server";
import { generateWithGeminiFallback } from "@/lib/gemini-client";
import {
  buildBuiltinSynthesis,
  buildContextSummary,
  type AiArticleContext,
  type AiMacroContextItem,
  type AiMarketContext,
  type AiPeerContextItem,
  type AiStockContext,
  type AiTurnInput,
} from "@/lib/ai-context";

export type {
  AiArticleContext,
  AiMacroContextItem,
  AiMarketContext,
  AiPeerContextItem,
  AiStockContext,
  AiTurnInput,
};

function buildGeminiContents(history: AiTurnInput[], latestPromptWithContext: string) {
  const normalized: { role: "user" | "model"; parts: { text: string }[] }[] = [];

  for (const turn of history) {
    const role = turn.role === "assistant" ? "model" : "user";
    if (normalized.length === 0 && role === "model") {
      continue;
    }
    if (normalized.length > 0 && normalized[normalized.length - 1].role === role) {
      normalized[normalized.length - 1].parts[0].text += `\n\n${turn.content}`;
    } else {
      normalized.push({ role, parts: [{ text: turn.content }] });
    }
  }

  if (normalized.length > 0 && normalized[normalized.length - 1].role === "user") {
    normalized[normalized.length - 1].parts[0].text += `\n\n${latestPromptWithContext}`;
  } else {
    normalized.push({ role: "user", parts: [{ text: latestPromptWithContext }] });
  }

  return normalized;
}

export async function POST(request: NextRequest) {
  await connection();

  try {
    const body = (await request.json()) as {
      prompt?: string;
      messages?: AiTurnInput[];
      customApiKey?: string;
      context?: AiMarketContext;
    };

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json(
        { error: "Pertanyaan analisis tidak boleh kosong." },
        { status: 400 }
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Pertanyaan terlalu panjang (maksimum 2.000 karakter)." },
        { status: 400 }
      );
    }

    const sanitizedHistory: AiTurnInput[] = Array.isArray(body.messages)
      ? body.messages
          .filter(
            (m): m is AiTurnInput =>
              Boolean(m) &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim().length > 0
          )
          .slice(-8)
          .map((m) => ({
            role: m.role,
            content: m.content.trim().slice(0, 2000),
          }))
      : [];

    const customApiKey = typeof body.customApiKey === "string" ? body.customApiKey.trim() : "";
    const serverApiKey = process.env.GEMINI_API_KEY?.trim() || "";
    const activeApiKey = customApiKey || serverApiKey;

    const contextBlock = buildContextSummary(body.context);

    if (activeApiKey) {
      const systemDirectives = `Kamu adalah Senior Macro & Equity Analyst untuk Pasar Modal Indonesia (IDX / IHSG) di panel samping StocksSense.
Aturan jawaban:
1. Jawab padat, objektif, dan langsung ke inti dalam bahasa Indonesia (maksimal 3-4 bagian singkat / ~180-230 kata).
2. Gunakan format Markdown sederhana (### untuk sub-judul, **tebal** untuk angka kunci, dan poin bullet *).
3. Selalu bedakan tegas mana angka DATA PASAR LIVE (Yahoo Finance & Berita RSS) dan mana angka DATA PROFIL ACUAN (Ilustrasi) bila keduanya dikutip; jangan mengarang angka lain.
4. JANGAN menulis paragraf Disclaimer atau Catatan Penutup panjang di akhir jawaban karena disclaimer permanen sudah terpasang di antarmuka aplikasi.`;

      const latestTurnText = `${systemDirectives}

${contextBlock || "(Tidak ada konteks saham spesifik yang dibuka saat ini.)"}

Pertanyaan pengguna saat ini: ${prompt}`;

      const contents = buildGeminiContents(sanitizedHistory, latestTurnText);
      const result = await generateWithGeminiFallback(contents, activeApiKey);

      if (result.ok) {
        return NextResponse.json(
          {
            reply: result.text,
            source: "gemini",
            model: result.model,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      console.warn(
        "[API /api/ai/analyze] Gemini API failed, using built-in synthesis:",
        result.error
      );
      const fallbackReply = buildBuiltinSynthesis(prompt, body.context);
      return NextResponse.json(
        {
          reply: fallbackReply,
          source: "builtin",
          warning: `Koneksi Gemini API (${result.error}) gagal; menampilkan analisis kontekstual bawaan.`,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const builtinReply = buildBuiltinSynthesis(prompt, body.context);
    return NextResponse.json(
      {
        reply: builtinReply,
        source: "builtin",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Invalid request payload";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
