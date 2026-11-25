import { NextResponse, connection } from "next/server";
import { getLiveMarketNewsServer } from "@/lib/news-server";

export async function GET() {
  await connection();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

  if (providerEnv !== "yahoo") {
    return NextResponse.json(
      {
        provider: "illustrative",
        items: [],
        isFallback: true,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const items = await getLiveMarketNewsServer();
    return NextResponse.json(
      {
        provider: "yahoo",
        items,
        isFallback: items.length === 0,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch RSS news";
    return NextResponse.json(
      {
        provider: "yahoo",
        items: [],
        isFallback: true,
        error: msg,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
