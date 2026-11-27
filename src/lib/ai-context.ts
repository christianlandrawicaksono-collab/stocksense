import { formatMultiple, formatNewsCategoryLabel, formatPersen, formatRupiah } from "@/lib/format";
import { evaluateTargetBuyStatus } from "@/lib/watchlist";

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
  roe?: number;
  der?: number;
  isLive?: boolean;
  isCurated?: boolean;
  isInWatchlist?: boolean;
  targetBuyPrice?: number;
  watchlistNote?: string;
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
  isInCustomWatchlist?: boolean;
  targetBuyPrice?: number;
  watchlistNote?: string;
}

export interface AiArticleContext {
  title: string;
  category: string;
  catalyst: string;
  summary: string;
  overallImpact: string;
  isLive?: boolean;
  publisher?: string;
  publishedWib?: string;
  link?: string;
  tickers?: string[];
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
  customWatchlist?: string[];
  article?: AiArticleContext;
  macroTickers?: AiMacroContextItem[];
}

export interface AiTurnInput {
  role: "user" | "assistant";
  content: string;
}

export function buildContextSummary(context?: AiMarketContext): string {
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
        `Saham Aktif (${s.ticker} - ${s.name}, ${s.sector}): Harga ${formatRupiah(s.price)} (${formatPersen(s.changePercent, 2, true)}), P/E TTM ${formatMultiple(s.peRatio, 1)}, PBV ${formatMultiple(s.pbvRatio, 2)}, Dividend Yield ${formatPersen(s.dividendYield, 1)}${s.targetMeanPrice ? `, Target Harga Wajar (${s.isCurated === false ? "Estimasi 5Th" : "P/E Mean Historis"}) ${formatRupiah(s.targetMeanPrice)}` : ""}.`
      );
      if (s.isCurated === false && s.historicalPeMean > 0) {
        liveLines.push(
          `Estimasi Band 5Th ${s.ticker}: Rerata historis ${formatMultiple(s.historicalPeMean, 1)}${s.roe !== undefined ? `, ROE ${formatPersen(s.roe, 1)}` : ""}${s.der !== undefined ? `, DER ${formatMultiple(s.der, 2)}` : ""}.`
        );
      }
    } else {
      illustrativeLines.push(
        `Saham Aktif (${s.ticker} - ${s.name}, ${s.sector}): Harga acuan ${formatRupiah(s.price)} (${formatPersen(s.changePercent, 2, true)}), P/E ${formatMultiple(s.peRatio, 1)}, PBV ${formatMultiple(s.pbvRatio, 2)}, Div Yield ${formatPersen(s.dividendYield, 1)}${s.targetMeanPrice ? `, Target P/E Mean ${formatRupiah(s.targetMeanPrice)}` : ""}.`
      );
    }

    if (s.isCurated !== false) {
      const profileFragments: string[] = [];
      if (s.historicalPeMean > 0) {
        profileFragments.push(`Rerata P/E historis 5th ${formatMultiple(s.historicalPeMean, 1)}`);
      }
      if (s.roe !== undefined) profileFragments.push(`ROE ${formatPersen(s.roe, 1)}`);
      if (s.der !== undefined) profileFragments.push(`DER ${formatMultiple(s.der, 2)}`);
      if (profileFragments.length > 0) {
        illustrativeLines.push(`Profil Acuan Riset ${s.ticker}: ${profileFragments.join(", ")}.`);
      }
    }
    if (s.strengths && s.strengths.length > 0) {
      illustrativeLines.push(`Kekuatan profil: ${s.strengths.join("; ")}`);
    }
    if (s.risks && s.risks.length > 0) {
      illustrativeLines.push(`Risiko profil: ${s.risks.join("; ")}`);
    }

    if ((s.targetBuyPrice && s.targetBuyPrice > 0) || s.watchlistNote) {
      const noteDest = s.isLive ? liveLines : illustrativeLines;
      const fragments: string[] = [];
      if (s.targetBuyPrice && s.targetBuyPrice > 0) {
        const evalRes = evaluateTargetBuyStatus(s.price, s.targetBuyPrice);
        const statusDesc =
          evalRes.status === "hit"
            ? `SUDAH MASUK AREA BELI (${formatPersen(evalRes.diffPercent, 1, true)} dari target)`
            : evalRes.status === "near"
            ? `MENDEKATI TARGET (+${formatPersen(evalRes.diffPercent, 1)})`
            : evalRes.status === "above"
            ? `${formatPersen(evalRes.diffPercent, 1, true)} di atas target`
            : "status menunggu harga";
        fragments.push(`Target Harga Beli ${formatRupiah(s.targetBuyPrice)} — ${statusDesc}`);
      }
      if (s.watchlistNote) {
        fragments.push(`Catatan riset: "${s.watchlistNote}"`);
      }
      noteDest.push(`Rencana Watchlist Pengguna (${s.ticker}): ${fragments.join(" | ")}.`);
    }
  }

  if (context.watchlistPeers && context.watchlistPeers.length > 0) {
    const formatPeer = (p: AiPeerContextItem) =>
      `${p.ticker} (${p.sector}): ${formatRupiah(p.price)}, P/E ${formatMultiple(p.peRatio, 1)}, PBV ${formatMultiple(p.pbvRatio, 2)}, Div ${formatPersen(p.dividendYield, 1)}${p.targetBuyPrice && p.targetBuyPrice > 0 ? `, Target Beli ${formatRupiah(p.targetBuyPrice)}` : ""}`;

    const customPeers = context.watchlistPeers.filter((p) => p.isInCustomWatchlist);
    const curatedOnlyPeers = context.watchlistPeers.filter((p) => !p.isInCustomWatchlist);

    if (customPeers.length > 0) {
      const targetCustom = customPeers.some((p) => p.isLive) ? liveLines : illustrativeLines;
      targetCustom.push(
        `Watchlist Custom Pengguna (${customPeers.length} emiten): ${customPeers.map(formatPeer).join(" | ")}`
      );
    }

    if (curatedOnlyPeers.length > 0) {
      const targetCurated = curatedOnlyPeers.some((p) => p.isLive) ? liveLines : illustrativeLines;
      targetCurated.push(
        `Emiten Kurasi Lainnya: ${curatedOnlyPeers.map(formatPeer).join(" | ")}`
      );
    }
  } else if (context.customWatchlist && context.customWatchlist.length > 0) {
    const targetArr = context.provider === "yahoo" ? liveLines : illustrativeLines;
    targetArr.push(`Watchlist Custom Pengguna: ${context.customWatchlist.join(", ")}`);
  }

  if (context.article) {
    const a = context.article;
    if (a.isLive) {
      const metaParts = [a.publisher, a.publishedWib, formatNewsCategoryLabel(a.category)]
        .filter(Boolean)
        .join(" • ");
      const tickerInfo =
        a.tickers && a.tickers.length > 0 ? ` Emiten disebut: ${a.tickers.join(", ")}.` : "";
      const summaryInfo = a.summary ? ` Ringkasan: ${a.summary}` : "";
      liveLines.push(
        `Berita Pasar Terkini (RSS Live): "${a.title}" (${metaParts}).${tickerInfo}${summaryInfo}`
      );
    } else {
      illustrativeLines.push(
        `Artikel Skenario Terbuka (Contoh): "${a.title}" (${formatNewsCategoryLabel(a.category)}). Katalis: ${a.catalyst}. Implikasi: ${a.overallImpact}. Ringkasan: ${a.summary}`
      );
    }
  }

  const sections: string[] = [];
  if (liveLines.length > 0) {
    sections.push(`DATA PASAR LIVE (Yahoo Finance & Berita RSS):\n${liveLines.join("\n")}`);
  }
  if (illustrativeLines.length > 0) {
    sections.push(`DATA PROFIL & ACUAN RISET (Ilustrasi):\n${illustrativeLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function buildBuiltinSynthesis(prompt: string, context?: AiMarketContext): string {
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

  // 1. Cek perbandingan beberapa ticker atau permintaan evaluasi Watchlist Saya
  const customWatchlistPeers = peers.filter((p) => p.isInCustomWatchlist && p.price > 0);
  const mentionedPeers = peers.filter((p) => q.includes(p.ticker.toLowerCase()));
  const wantsCustomWatchlistReview =
    (q.includes("watchlist") || q.includes("daftar pantau")) && customWatchlistPeers.length >= 2;

  if (
    wantsCustomWatchlistReview ||
    mentionedPeers.length >= 2 ||
    (mentionedPeers.length === 1 && s && mentionedPeers[0].ticker !== s.ticker && (q.includes("banding") || q.includes("vs") || q.includes("mana")))
  ) {
    const listToCompare = wantsCustomWatchlistReview
      ? customWatchlistPeers.slice(0, 4)
      : mentionedPeers.length >= 2
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
          `* **${p.ticker}** (${p.isLive ? "Live" : "Ilustrasi"}): Harga **${formatRupiah(p.price)}**, P/E **${p.peRatio > 0 ? formatMultiple(p.peRatio, 1) : "-"}**, PBV **${p.pbvRatio > 0 ? formatMultiple(p.pbvRatio, 2) : "-"}**, Div Yield **${formatPersen(p.dividendYield, 1)}**.`
      )
      .join("\n");

    const validPePeers = listToCompare.filter((p) => p.peRatio > 0);
    const lowestPe =
      validPePeers.length > 0
        ? [...validPePeers].sort((x, y) => x.peRatio - y.peRatio)[0]
        : null;
    const highestDiv = [...listToCompare].sort((x, y) => y.dividendYield - x.dividendYield)[0];

    return `### ${wantsCustomWatchlistReview ? "Ringkasan Komparasi Watchlist Saya" : "Perbandingan Valuasi Emiten"}
${rows}

${lowestPe ? `* **P/E paling rendah:** **${lowestPe.ticker}** (${formatMultiple(lowestPe.peRatio, 1)}).\n` : ""}* **Imbal hasil dividen tertinggi:** **${highestDiv.ticker}** (${formatPersen(highestDiv.dividendYield, 1)}).${macroLine ? `\n* **Latar makro:** ${macroLine}.` : ""}`;
  }

  // 2. Prioritaskan analisis artikel apabila pertanyaan merujuk ke berita atau mode berita aktif
  if (a && (q.includes("artikel") || q.includes("berita") || q.includes("skenario") || q.includes("dampak") || context?.mode === "berita")) {
    if (a.isLive) {
      const tickerText =
        a.tickers && a.tickers.length > 0
          ? a.tickers.join(", ")
          : "emiten sektoral terkait di IHSG";
      const categoryLabel = formatNewsCategoryLabel(a.category);
      return `### Bedah Berita Pasar: ${a.title}

1. **Sumber & Konteks:** ${a.publisher || "Media Pasar Modal"}${a.publishedWib ? ` (${a.publishedWib})` : ""}.${a.summary ? ` ${a.summary}` : ""}
2. **Emiten & Sektor Sorotan:** Fokus utama tertuju pada **${tickerText}** pada kategori *${categoryLabel}*.${macroLine ? ` (Indikator makro terkini: ${macroLine}).` : ""}
3. **Tindak Lanjut Riset:** Klik badge emiten atau buka saham terkait di **Terminal** untuk meninjau grafik harga, rasio valuasi P/E-PBV, serta simulasi DCA.`;
    }

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
    const hasBandRef = s.historicalPeMean > 0 && s.peRatio > 0;
    const peDiffPct = hasBandRef
      ? ((s.peRatio - s.historicalPeMean) / s.historicalPeMean) * 100
      : 0;
    const valPosText = hasBandRef
      ? peDiffPct <= -15
        ? `${formatPersen(Math.abs(peDiffPct), 1)} di bawah rerata historis (${formatMultiple(s.historicalPeMean, 1)})`
        : peDiffPct >= 15
        ? `${formatPersen(peDiffPct, 1)} di atas rerata historis (${formatMultiple(s.historicalPeMean, 1)})`
        : `mendekati rerata historis (${formatMultiple(s.historicalPeMean, 1)})`
      : null;

    const metricExtras: string[] = [];
    if (s.roe !== undefined && (s.isCurated !== false || s.roe > 0)) {
      metricExtras.push(`**ROE ${formatPersen(s.roe, 1)}**`);
    }
    if (s.der !== undefined && (s.isCurated !== false || s.der > 0)) {
      metricExtras.push(`**DER ${formatMultiple(s.der, 2)}**`);
    }

    const targetEval =
      s.targetBuyPrice && s.targetBuyPrice > 0
        ? evaluateTargetBuyStatus(s.price, s.targetBuyPrice)
        : null;
    const watchlistLine =
      targetEval && s.targetBuyPrice
        ? `\n* *Target Beli Watchlist:* **${formatRupiah(s.targetBuyPrice)}** — ${
            targetEval.status === "hit"
              ? `**SUDAH MASUK AREA BELI** (${formatPersen(targetEval.diffPercent, 1, true)})`
              : targetEval.status === "near"
              ? `**Mendekati target** (${formatPersen(targetEval.diffPercent, 1, true)})`
              : `${formatPersen(targetEval.diffPercent, 1, true)} di atas target`
          }.${s.watchlistNote ? ` *Catatan pribadi:* "${s.watchlistNote}".` : ""}`
        : s.watchlistNote
        ? `\n* *Catatan riset Watchlist:* "${s.watchlistNote}".`
        : "";

    return `### Ringkasan Kontekstual ${s.ticker} (${s.name})

1. **Valuasi (${s.isLive ? "Harga & Rasio Live Yahoo" : "Data Ilustrasi"}):**
* Harga **${formatRupiah(s.price)}** (${formatPersen(s.changePercent, 2, true)}), **P/E ${s.peRatio > 0 ? formatMultiple(s.peRatio, 1) : "-"}**${valPosText ? ` (${valPosText}${s.targetMeanPrice ? `, target wajar Mean ${formatRupiah(s.targetMeanPrice)}` : ""})` : ""}.
* **PBV ${s.pbvRatio > 0 ? formatMultiple(s.pbvRatio, 2) : "-"}** | **Dividend Yield ${formatPersen(s.dividendYield, 1)}**.${metricExtras.length > 0 ? `\n* *${s.isCurated !== false ? "Profil acuan ilustrasi" : "Metrik profil"}:* ${metricExtras.join(", ")}.` : ""}${watchlistLine}${macroLine ? `\n* *Latar makro:* ${macroLine}.` : ""}
2. **Kekuatan Utama:** ${s.strengths?.[0] || "Fundamental operasional terpantau pada metrik TTM terkini."}
3. **Risiko Dicermati:** ${s.risks?.[0] || "Volatilitas pasar dan arah suku bunga."}`;
  }

  return `### Sintesis Pasar Modal IDX
${macroLine ? `* **Indikator terkini:** ${macroLine}.\n` : ""}* Fokuskan riset pada perbandingan rasio **P/E vs pita historis**, **PBV**, serta **ketahanan imbal hasil dividen** di tab Daftar Pantau dan Valuasi Terminal.`;
}
