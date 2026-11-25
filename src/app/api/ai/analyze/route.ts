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
  pbvRatio: number;
  dividendYield: number;
  roe: number;
  der: number;
  isLive?: boolean;
  strengths?: string[];
  risks?: string[];
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
  article?: AiArticleContext;
  macroTickers?: AiMacroContextItem[];
}

function buildContextSummary(context?: AiMarketContext): string {
  if (!context) return "";
  const lines: string[] = [];

  if (context.macroTickers && context.macroTickers.length > 0) {
    const macroList = context.macroTickers
      .map((m) => `${m.symbol}: ${m.value} (${formatPersen(m.change, 2, true)})`)
      .join(" | ");
    lines.push(`Indikator Makro (${context.provider === "yahoo" ? "Yahoo Live" : "Ilustrasi"}): ${macroList}`);
  }

  if (context.stock) {
    const s = context.stock;
    lines.push(
      `Saham Aktif: ${s.ticker} (${s.name}, sektor ${s.sector}) — Harga ${formatRupiah(s.price)} (${formatPersen(s.changePercent, 2, true)}, sumber: ${s.isLive ? "Yahoo Finance live" : "data ilustrasi"}), P/E ${formatMultiple(s.peRatio, 1)} (rerata historis ${formatMultiple(s.historicalPeMean, 1)}), PBV ${formatMultiple(s.pbvRatio, 2)}, Div Yield ${formatPersen(s.dividendYield, 1)}, ROE (profil) ${formatPersen(s.roe, 1)}, DER (profil) ${formatMultiple(s.der, 2)}.`
    );
    if (s.strengths && s.strengths.length > 0) {
      lines.push(`Kekuatan profil: ${s.strengths.join("; ")}`);
    }
    if (s.risks && s.risks.length > 0) {
      lines.push(`Risiko profil: ${s.risks.join("; ")}`);
    }
  }

  if (context.article) {
    const a = context.article;
    lines.push(
      `Artikel Berita Terbuka: "${a.title}" (${a.category}). Katalis: ${a.catalyst}. Implikasi: ${a.overallImpact}. Ringkasan: ${a.summary}`
    );
  }

  return lines.join("\n");
}

function buildBuiltinSynthesis(prompt: string, context?: AiMarketContext): string {
  const q = prompt.toLowerCase();
  const s = context?.stock;
  const a = context?.article;
  const macroLine =
    context?.macroTickers && context.macroTickers.length > 0
      ? context.macroTickers
          .slice(0, 4)
          .map((m) => `${m.symbol} ${m.value} (${formatPersen(m.change, 2, true)})`)
          .join(" • ")
      : null;

  // 1. Prioritaskan analisis mendalam jika pertanyaan merujuk langsung pada artikel berita aktif
  if (a && (q.includes("artikel") || q.includes("berita") || q.includes("skenario") || q.includes("dampak") || context?.mode === "berita")) {
    return `### 📰 Analisis Transmisi Skenario: ${a.title}

1. **Katalis & Konteks Utama:**
${a.catalyst}. ${a.summary}

2. **Mekanisme Transmisi ke Pasar:**
${a.overallImpact}${macroLine ? `\n* Konteks indikator terkini: ${macroLine}.` : ""}

3. **Catatan Evaluasi Investor:**
Pantau sensitivitas margin emiten terdampak serta likuiditas pasar sebelum mengambil posisi agresif. Gunakan halaman **Terminal** untuk meninjau rasio P/E, PBV, dan batas deviasi historis emiten terkait.`;
  }

  // 2. Skenario tematik spesifik bila pengguna bertanya tentang isu makro umum
  if (q.includes("ppn") || q.includes("ritel") || q.includes("pajak")) {
    return `### 📊 Analisis Transmisi Kebijakan PPN Terhadap Saham IDX:

1. **Mekanisme Transmisi Ekonomi:**
Kenaikan tarif PPN memengaruhi daya beli konsumen kelas menengah sehingga konsumen cenderung menunda belanja barang sekunder & gaya hidup.

2. **Dampak Sektor:**
* **Ritel Modern & Otomotif (ASII, ACES, MAPI):** Tekanan pada volume penjualan jangka pendek.
* **Konsumer Primer / FMCG (ICBP, INDF, AMRT):** Relatif defensif karena permintaan kebutuhan pokok.
* **Perbankan Besar (BBCA, BBRI, BMRI):** Dampak terkelola selama CASA dan kualitas kredit korporasi terjaga.

3. **Sikap Investor:**
Fokus pada emiten berneraca solid dan akumulasi bertahap saat valuasi P/E berada di zona diskon historis (-1 SD s/d -2 SD).`;
  }

  if (q.includes("minyak") || q.includes("energi") || q.includes("geopolitik") || q.includes("brent")) {
    return `### 🛢️ Analisis Dampak Harga Energi Dunia (Brent) Terhadap IHSG:

1. **Mekanisme Transmisi:**
Lonjakan harga minyak mentah mengerek pendapatan emiten eksplorasi hulu migas, namun dapat menekan biaya logistik/bahan baku emiten konsumer manufaktur serta memperlebar kebutuhan impor migas.${macroLine ? `\n* Posisi acuan saat ini: ${macroLine}.` : ""}

2. **Sektor Terdampak:**
* **Hulu Migas & Energi (MEDC, ADRO):** Diuntungkan langsung dari kenaikan rata-rata harga jual komoditas.
* **Barang Konsumsi (ICBP, MYOR):** Perlu mencermati tekanan margin bahan baku turunan petrokimia.

3. **Sikap Investor:**
Manfaatkan pendekatan selektif dengan manajemen risiko disiplin pada saham siklikal energi.`;
  }

  // 3. Default kontekstual berbasis angka nyata saham aktif (jika tersedia di layar)
  if (s) {
    const peDiffPct = ((s.peRatio - s.historicalPeMean) / s.historicalPeMean) * 100;
    const valPosText =
      peDiffPct <= -15
        ? `berada ${formatPersen(Math.abs(peDiffPct), 1)} di bawah rerata historis (${formatMultiple(s.historicalPeMean, 1)}) — area diskon valuasi komparatif`
        : peDiffPct >= 15
        ? `berada ${formatPersen(peDiffPct, 1)} di atas rerata historis (${formatMultiple(s.historicalPeMean, 1)}) — tergolong cukup premium`
        : `mendekati rerata historisnya (${formatMultiple(s.historicalPeMean, 1)}) — area valuasi wajar`;

    const strengthsBlock =
      s.strengths && s.strengths.length > 0
        ? s.strengths.map((item) => `* ${item}`).join("\n")
        : "* Fundamental operasional tercatat stabil pada sektornya.";
    const risksBlock =
      s.risks && s.risks.length > 0
        ? s.risks.map((item) => `* ${item}`).join("\n")
        : "* Perhatikan volatilitas pasar dan sensitivitas suku bunga.";

    return `### 📈 Ringkasan Kontekstual ${s.ticker} (${s.name})

1. **Posisi Harga & Valuasi (${s.isLive ? "Yahoo Finance" : "Data Ilustrasi"}):**
* Harga saat ini: **${formatRupiah(s.price)}** (${formatPersen(s.changePercent, 2, true)})
* Rasio **P/E ${formatMultiple(s.peRatio, 1)}** — ${valPosText}.
* **PBV ${formatMultiple(s.pbvRatio, 2)}** | **Dividend Yield ${formatPersen(s.dividendYield, 1)}** | **ROE (profil) ${formatPersen(s.roe, 1)}** | **DER (profil) ${formatMultiple(s.der, 2)}**.${macroLine ? `\n* Latar makro aktif: ${macroLine}.` : ""}

2. **Faktor Pendukung Utama:**
${strengthsBlock}

3. **Faktor Risiko yang Perlu Dicermati:**
${risksBlock}

4. **Catatan Strategi:**
Untuk horizon jangka menengah-panjang, bandingkan posisi harga terhadap batas -1 SD pada tab **Valuasi dan P/E band** dan uji ketahanan imbal hasilnya melalui tab **Simulasi strategi DCA**.`;
  }

  return `### 📈 Sintesis Intelijen Pasar IDX:

1. **Kondisi Umum:**
${macroLine ? `Pergerakan acuan terkini: ${macroLine}. ` : ""}Pasar saham domestik cenderung bergerak selektif dengan fokus utama pada kualitas laba emiten berkapitalisasi besar, ketahanan rasio dividen, dan stabilitas nilai tukar Rupiah.

2. **Pendekatan Riset di StocksSense:**
* Gunakan tab **Daftar Pantau** untuk menyaring emiten dengan P/E terjangkau atau Dividend Yield tinggi.
* Cek tab **Valuasi & Simulasi DCA** untuk melihat imbal hasil historis beserta pengaruh reinvestasi dividen.`;
}

export async function POST(request: NextRequest) {
  await connection();

  try {
    const body = (await request.json()) as {
      prompt?: string;
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

    const customApiKey = typeof body.customApiKey === "string" ? body.customApiKey.trim() : "";
    const serverApiKey = process.env.GEMINI_API_KEY?.trim() || "";
    const activeApiKey = customApiKey || serverApiKey;
    const configuredModel = process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
    const candidateModels = Array.from(
      new Set([configuredModel, "gemini-3-flash-preview", "gemini-3.1-flash-lite"])
    );

    const contextBlock = buildContextSummary(body.context);

    if (activeApiKey) {
      const fullPrompt = `Kamu adalah Senior Macro & Equity Analyst untuk Pasar Modal Indonesia (IDX / IHSG).
Jawab pertanyaan pengguna dalam bahasa Indonesia yang jernih, objektif, dan terstruktur (poin bernomor singkat, sertakan catatan risiko dan disclaimer bahwa analisis bukan nasihat investasi mengikat).
Jangan mengarang angka yang tidak diberikan di konteks; gunakan data konteks berikut apa adanya:

${contextBlock || "(Tidak ada konteks saham spesifik yang dibuka saat ini.)"}

Pertanyaan pengguna: ${prompt}`;

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
              body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
              }),
            }
          );

          if (!res.ok) {
            lastErrMsg = `Gemini API (${model}) HTTP ${res.status}`;
            // Jangan coba model lain jika kesalahan otentikasi atau payload
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

    // Mode zero-config built-in contextual synthesis (tidak ada GEMINI_API_KEY di server/modal)
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
