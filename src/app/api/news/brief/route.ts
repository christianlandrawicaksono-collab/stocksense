import { NextRequest, NextResponse, connection } from "next/server";
import { formatPersen } from "@/lib/format";
import { generateWithGeminiFallback } from "@/lib/gemini-client";
import { buildLiveMarketBrief, buildMarketBriefPrompt } from "@/lib/news-brief";
import { getLiveMarketNewsServer } from "@/lib/news-server";
import { fetchGeminiMarketBriefCached } from "@/lib/yahoo-cache";
import type { LiveMarketNewsItem, MarketTickerItem } from "@/types/market";

export async function POST(request: NextRequest) {
  await connection();

  try {
    const body = (await request.json().catch(() => ({}))) as {
      items?: LiveMarketNewsItem[];
      macroTickers?: MarketTickerItem[];
      customApiKey?: string;
    };

    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 12) : [];
    const items = rawItems.length > 0 ? rawItems : await getLiveMarketNewsServer();
    const macroTickers = Array.isArray(body.macroTickers) ? body.macroTickers : [];

    const baseBrief = buildLiveMarketBrief(items, macroTickers);
    if (items.length === 0) {
      return NextResponse.json({ brief: baseBrief }, { headers: { "Cache-Control": "no-store" } });
    }

    const customApiKey = typeof body.customApiKey === "string" ? body.customApiKey.trim() : "";
    const serverApiKey = process.env.GEMINI_API_KEY?.trim() || "";

    if (!customApiKey && !serverApiKey) {
      return NextResponse.json(
        {
          brief: baseBrief,
          warning:
            "GEMINI_API_KEY server belum tersedia; menampilkan ringkasan statistik langsung dari feed berita.",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const headlinesDigest = items
      .slice(0, 8)
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.publisher} | ${item.sentiment}] ${item.title}${
            item.tickers.length > 0 ? ` (${item.tickers.join(", ")})` : ""
          }`
      )
      .join("\n");

    const macroDigest = macroTickers
      .slice(0, 5)
      .map((m) => `${m.symbol}: ${m.value} (${formatPersen(m.change, 2, true)})`)
      .join(" | ");

    try {
      if (customApiKey) {
        const prompt = buildMarketBriefPrompt(headlinesDigest, macroDigest);

        const directResult = await generateWithGeminiFallback(
          [{ role: "user", parts: [{ text: prompt }] }],
          customApiKey
        );
        if (!directResult.ok) {
          throw new Error(directResult.error);
        }

        return NextResponse.json(
          {
            brief: {
              ...baseBrief,
              summary: directResult.text,
              source: "gemini",
              model: directResult.model,
            },
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }

      const cachedResult = await fetchGeminiMarketBriefCached(headlinesDigest, macroDigest);
      return NextResponse.json(
        {
          brief: {
            ...baseBrief,
            summary: cachedResult.summary,
            source: "gemini",
            model: cachedResult.model,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      return NextResponse.json(
        {
          brief: baseBrief,
          warning: `Ringkasan AI belum tersedia (${msg}); menampilkan sintesis langsung.`,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Invalid request payload";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
