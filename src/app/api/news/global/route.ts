import { NextResponse, connection } from "next/server";
import { buildFallbackGlobalNewsItems } from "@/lib/global-news";
import { getGlobalNewsServer } from "@/lib/global-news-server";

export async function GET() {
  await connection();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

  try {
    if (providerEnv === "yahoo") {
      const result = await getGlobalNewsServer();
      return NextResponse.json(
        {
          provider: "yahoo",
          isFallback: result.isFallback,
          items: result.items,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        provider: "illustrative",
        isFallback: true,
        items: buildFallbackGlobalNewsItems(),
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load global news";
    console.error("[API /api/news/global] Error:", msg);
    return NextResponse.json(
      {
        provider: providerEnv === "yahoo" ? "yahoo" : "illustrative",
        isFallback: true,
        items: buildFallbackGlobalNewsItems(),
        error: msg,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
