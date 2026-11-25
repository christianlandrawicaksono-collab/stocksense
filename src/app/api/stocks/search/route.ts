import { NextRequest, NextResponse, connection } from "next/server";
import { searchIdxStocksServer } from "@/lib/market-server";

export async function GET(request: NextRequest) {
  await connection();
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

  if (!query) {
    return NextResponse.json({ provider: providerEnv, results: [] });
  }

  try {
    const results = await searchIdxStocksServer(query, providerEnv);
    return NextResponse.json(
      {
        provider: providerEnv,
        results,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ provider: providerEnv, results: [], error: msg }, { status: 200 });
  }
}
