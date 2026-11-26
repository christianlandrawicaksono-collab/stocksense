import { NextRequest, NextResponse, connection } from "next/server";
import { getLiveMarketNewsServer, getTickerNewsServer } from "@/lib/news-server";

export async function GET(request: NextRequest) {
  await connection();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";
  const rawTicker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() || "";

  if (rawTicker && !/^[A-Z]{4}$/.test(rawTicker)) {
    return NextResponse.json(
      { error: "Kode saham IDX harus terdiri dari 4 huruf kapital." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

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
    const items = rawTicker
      ? await getTickerNewsServer(rawTicker)
      : await getLiveMarketNewsServer();
    return NextResponse.json(
      {
        provider: "yahoo",
        ticker: rawTicker || undefined,
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
