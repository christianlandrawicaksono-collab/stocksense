import { NextRequest, NextResponse, connection } from "next/server";
import { formatMultiple, formatPersen, formatRupiah } from "@/lib/format";

export interface AiStockContext {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  peRatio: number;
  historicalPeMean: number;
  targetMeanPrice?: number;
  pbvRatio: number;
  dividendYield: number;
  roe: number;
  der: number;
  isLive?: boolean;
  strengths?: string[];
  risks?: string[];
}

export interface AiPeerContextItem {
  ticker: string;
  sector: string;
  price: number;
  changePercent: number;
  peRatio: number;
  pbvRatio: number;
  dividendYield: number;
  isLive?: boolean;
}

export interface AiArticleContext {
  title: string;
  category: string;
  catalyst: string;
  summary: string;
  overallImpact: string;
}

export interface AiMacroContextItem {
  symbol: string;
  value: string;
  change: number;
}

export interface AiMarketContext {
  mode?: "berita" | "terminal";
  provider?: "illustrative" | "yahoo";
  stock?: AiStockContext;
  watchlistPeers?: AiPeerContextItem[];
  article?: AiArticleContext;
  macroTickers?: AiMacroContextItem[];
}

export interface AiTurnInput {
  role: "user" | "assistant";
  content: string;
}

function buildContextSummary(context?: AiMarketContext): string {
  if (!context) return "";
  const liveLines: string[] = [];
  const illustrativeLines: string[] = [];

  if (context.macroTickers && context.macroTickers.length > 0) {
    const macroList = context.macroTickers
      .map((m) => `${m.symbol}: ${m.value} (${formatPersen(m.change, 2, true)})`)
      .join(" | ");
    const targetArr = context.provider === "yahoo" ? liveLines : illustrativeLines;
    targetArr.push(`Indikator Makro: ${macroList}`);
  }

  if (context.stock) {
    const s = context.stock;
    if (s.isLive) {
      liveLines.push(
        `Saham Aktif (${s.ticker} - ${s.name}, ${s.sector}): Harga ${formatRupiah(s.price)} (${formatPersen(s.changePercent, 2, true)}), P/E TTM ${formatMultiple(s.peRatio, 1)}, PBV ${formatMultiple(s.pbvRatio, 2)}, Dividend Yield ${formatPersen(s.dividendYield, 1)}${s.targetMeanPrice ? `, Target P/E Mean Historis ${formatRupiah(s.targetMeanPrice)}` : ""}.`
      );
    } else {
      illustrativeLines.push(
        `Saham Aktif (${s.ticker} - ${s.name}, ${s.sector}): Harga acuan ${formatRupiah(s.price)} (${formatPersen(s.changePercent, 2, true)}), P/E ${formatMultiple(s.peRatio, 1)}, PBV ${formatMultiple(s.pbvRatio, 2)}, Div Yield ${formatPersen(s.dividendYield, 1)}${s.targetMeanPrice ? `, Target P/E Mean ${formatRupiah(s.targetMeanPrice)}` : ""}.`
      );
    }

    illustrativeLines.push(
      `Profil Acuan Riset ${s.ticker}: Rerata P/E historis 5th ${formatMultiple(s.historicalPeMean, 1)}, ROE ${formatPersen(s.roe, 1)}, DER ${formatMultiple(s.der, 2)}.`
    );
    if (s.strengths && s.strengths.length > 0) {
      illustrativeLines.push(`Kekuatan profil: ${s.strengths.join("; ")}`);
    }
    if (s.risks && s.risks.length > 0) {
      illustrativeLines.push(`Risiko profil: ${s.risks.join("; ")}`);
    }
  }

  if (context.watchlistPeers && context.watchlistPeers.length > 0) {
    const peerList = context.watchlistPeers
      .map(
        (p) =>
          `${p.ticker} (${p.sector}): ${formatRupiah(p.price)}, P/E ${formatMultiple(p.peRatio, 1)}, PBV ${formatMultiple(p.pbvRatio, 2)}, Div ${formatPersen(p.dividendYield, 1)}`
      )
      .join(" | ");
    const hasAnyLivePeer = context.watchlistPeers.some((p) => p.isLive);
    const targetArr = hasAnyLivePeer ? liveLines : illustrativeLines;
    targetArr.push(`Ringkasan 9 Emiten Watchlist: ${peerList}`);
  }

  if (context.article) {
    const a = context.article;
    illustrativeLines.push(
      `Artikel Skenario Terbuka: "${a.title}" (${a.category}). Katalis: ${a.catalyst}. Implikasi: ${a.overallImpact}. Ringkasan: ${a.summary}`
    );
  }

  const sections: string[] = [];
  if (liveLines.length > 0) {
    sections.push(`DATA PASAR LIVE (Yahoo Finance):\n${liveLines.join("\n")}`);
  }
  if (illustrativeLines.length > 0) {
    sections.push(`DATA PROFIL & ACUAN RISET (Ilustrasi):\n${illustrativeLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

function buildBuiltinSynthesis(prompt: string, context?: AiMarketContext): string {
  const q = prompt.toLowerCase();
  const s = context?.stock;
  const a = context?.article;
  const peers = context?.watchlistPeers || [];
  const macroLine =
    context?.macroTickers && context.macroTickers.length > 0
      ? context.macroTickers
          .slice(0, 4)
          .map((m) => `${m.symbol} ${m.value} (${formatPersen(m.change, 2, true)})`)
          .join(" • ")
      : null;

  // 1. Cek perbandingan beberapa ticker apabila pengguna meminta komparasi
  const mentionedPeers = peers.filter((p) => q.includes(p.ticker.toLowerCase()));
  if (
    mentionedPeers.length >= 2 ||
    (mentionedPeers.length === 1 && s && mentionedPeers[0].ticker !== s.ticker && (q.includes("banding") || q.includes("vs") || q.includes("mana")))
  ) {
    const listToCompare =
      mentionedPeers.length >= 2
        ? mentionedPeers.slice(0, 3)
        : [
            {
              ticker: s!.ticker,
              sector: s!.sector,
              price: s!.price,
              changePercent: s!.changePercent,
              peRatio: s!.peRatio,
              pbvRatio: s!.pbvRatio,
              dividendYield: s!.dividendYield,
              isLive: s!.isLive,
            },
            mentionedPeers[0],
          ];

    const rows = listToCompare
      .map(
        (p) =>
          `* **${p.ticker}** (${p.isLive ? "Live" : "Ilustrasi"}): Harga **${formatRupiah(p.price)}**, P/E **${formatMultiple(p.peRatio, 1)}**, PBV **${formatMultiple(p.pbvRatio, 2)}**, Div Yield **${formatPersen(p.dividendYield, 1)}**.`
      )
      .join("\n");

    const lowestPe = [...listToCompare].sort((x, y) => x.peRatio - y.peRatio)[0];
    const highestDiv = [...listToCompare].sort((x, y) => y.dividendYield - x.dividendYield)[0];

    return `### Perbandingan Valuasi Emiten
${rows}

* **P/E paling rendah:** **${lowestPe.ticker}** (${formatMultiple(lowestPe.peRatio, 1)}).
* **Imbal hasil dividen tertinggi:** **${highestDiv.ticker}** (${formatPersen(highestDiv.dividendYield, 1)}).${macroLine ? `\n* **Latar makro:** ${macroLine}.` : ""}`;
  }

  // 2. Prioritaskan analisis artikel apabila pertanyaan merujuk ke berita atau mode berita aktif
  if (a && (q.includes("artikel") || q.includes("berita") || q.includes("skenario") || q.includes("dampak") || context?.mode === "berita")) {
    return `### Analisis Transmisi: ${a.title}

1. **Katalis Utama:** ${a.catalyst}. ${a.summary}
2. **Dampak ke Pasar:** ${a.overallImpact}${macroLine ? ` (Konteks terkini: ${macroLine}).` : ""}
3. **Tindak Lanjut Riset:** Buka emiten terkait di halaman **Terminal** untuk meninjau P/E Band dan ketahanan dividennya.`;
  }

  // 3. Skenario tematik spesifik
  if (q.includes("ppn") || q.includes("ritel") || q.includes("pajak")) {
    return `### Analisis Transmisi Kebijakan PPN Terhadap Saham IDX

1. **Mekanisme:** Kenaikan PPN menekan daya beli kelas menengah pada belanja sekunder & gaya hidup.
2. **Dampak Sektor:**
* **Ritel & Otomotif (ASII, ACES, MAPI):** Rentan perlambatan volume jangka pendek.
* **Konsumer Primer (ICBP, INDF, AMRT):** Relatif defensif karena permintaan kebutuhan pokok.
* **Perbankan (BBCA, BBRI, BMRI):** Dampak terkelola selama CASA dan kualitas kredit korporasi solid.`;
  }

  if (q.includes("minyak") || q.includes("energi") || q.includes("geopolitik") || q.includes("brent")) {
    return `### Analisis Dampak Harga Minyak Mentah (Brent) ke IHSG

1. **Mekanisme:** Kenaikan minyak mentah mendongkrak margin produsen energi hulu, namun menambah biaya logistik manufaktur serta beban impor migas.${macroLine ? `\n* **Acuan terkini:** ${macroLine}.` : ""}
2. **Sektor Terdampak:**
* **Hulu Migas & Energi (MEDC, ADRO):** Diuntungkan kenaikan rata-rata harga jual.
* **Manufaktur Konsumer (ICBP, MYOR):** Perlu mencermati tekanan biaya kemasan & distribusi.`;
  }

  // 4. Default kontekstual saham aktif
  if (s) {
    const peDiffPct = ((s.peRatio - s.historicalPeMean) / s.historicalPeMean) * 100;
    const valPosText =
      peDiffPct <= -15
        ? `${formatPersen(Math.abs(peDiffPct), 1)} di bawah rerata historis profil (${formatMultiple(s.historicalPeMean, 1)})`
        : peDiffPct >= 15
        ? `${formatPersen(peDiffPct, 1)} di atas rerata historis profil (${formatMultiple(s.historicalPeMean, 1)})`
        : `mendekati rerata historis profil (${formatMultiple(s.historicalPeMean, 1)})`;

    return `### Ringkasan Kontekstual ${s.ticker} (${s.name})

1. **Valuasi (${s.isLive ? "Harga & Rasio Live Yahoo" : "Data Ilustrasi"}):**
* Harga **${formatRupiah(s.price)}** (${formatPersen(s.changePercent, 2, true)}), **P/E ${formatMultiple(s.peRatio, 1)}** (${valPosText}${s.targetMeanPrice ? `, target wajar P/E Mean ${formatRupiah(s.targetMeanPrice)}` : ""}).
* **PBV ${formatMultiple(s.pbvRatio, 2)}** | **Dividend Yield ${formatPersen(s.dividendYield, 1)}**.
* *Profil acuan ilustrasi:* **ROE ${formatPersen(s.roe, 1)}**, **DER ${formatMultiple(s.der, 2)}**.${macroLine ? `\n* *Latar makro:* ${macroLine}.` : ""}
2. **Kekuatan Utama:** ${s.strengths?.[0] || "Fundamental operasional stabil."}
3. **Risiko Dicermati:** ${s.risks?.[0] || "Volatilitas pasar dan arah suku bunga."}`;
  }

  return `### Sintesis Pasar Modal IDX
${macroLine ? `* **Indikator terkini:** ${macroLine}.\n` : ""}* Fokuskan riset pada perbandingan rasio **P/E vs pita historis**, **PBV**, serta **ketahanan imbal hasil dividen** di tab Daftar Pantau dan Valuasi Terminal.`;
}

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
    const configuredModel = process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
    const candidateModels = Array.from(
      new Set([configuredModel, "gemini-3-flash-preview", "gemini-3.1-flash-lite"])
    );

    const contextBlock = buildContextSummary(body.context);

    if (activeApiKey) {
      const systemDirectives = `Kamu adalah Senior Macro & Equity Analyst untuk Pasar Modal Indonesia (IDX / IHSG) di panel samping StocksSense.
Aturan jawaban:
1. Jawab padat, objektif, dan langsung ke inti dalam bahasa Indonesia (maksimal 3-4 bagian singkat / ~180-230 kata).
2. Gunakan format Markdown sederhana (### untuk sub-judul, **tebal** untuk angka kunci, dan poin bullet *).
3. Selalu bedakan tegas mana angka DATA PASAR LIVE (Yahoo Finance) dan mana angka DATA PROFIL ACUAN (Ilustrasi) bila keduanya dikutip; jangan mengarang angka lain.
4. JANGAN menulis paragraf Disclaimer atau Catatan Penutup panjang di akhir jawaban karena disclaimer permanen sudah terpasang di antarmuka aplikasi.`;

      const latestTurnText = `${systemDirectives}

${contextBlock || "(Tidak ada konteks saham spesifik yang dibuka saat ini.)"}

Pertanyaan pengguna saat ini: ${prompt}`;

      const contents = buildGeminiContents(sanitizedHistory, latestTurnText);
      let lastErrMsg = "Gemini API error";

      for (const model of candidateModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": activeApiKey,
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
            return NextResponse.json(
              {
                reply: text.trim(),
                source: "gemini",
                model,
              },
              { headers: { "Cache-Control": "no-store" } }
            );
          }

          lastErrMsg = `Respons kosong dari model ${model}`;
        } catch (apiErr: unknown) {
          lastErrMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        }
      }

      console.warn("[API /api/ai/analyze] Gemini API failed, using built-in synthesis:", lastErrMsg);
      const fallbackReply = buildBuiltinSynthesis(prompt, body.context);
      return NextResponse.json(
        {
          reply: fallbackReply,
          source: "builtin",
          warning: `Koneksi Gemini API (${lastErrMsg}) gagal; menampilkan analisis kontekstual bawaan.`,
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
