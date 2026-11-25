import { NextRequest, NextResponse, connection } from "next/server";
import { getStockProfileServer, isValidIdxTickerFormat } from "@/lib/market-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  await connection();
  const { ticker: rawTicker } = await params;
  const ticker = (rawTicker || "").trim().toUpperCase();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

  if (!isValidIdxTickerFormat(ticker)) {
    return NextResponse.json(
      { error: `Format kode emiten IDX tidak valid: ${ticker}` },
      { status: 400 }
    );
  }

  try {
    const profile = await getStockProfileServer(ticker, providerEnv);
    if (!profile) {
      return NextResponse.json(
        { error: `Profil emiten ${ticker} tidak ditemukan di penyedia data saat ini.` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        provider: providerEnv,
        profile,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
