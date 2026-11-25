import { NextResponse, connection } from "next/server";
import { getMacroTickersServer } from "@/lib/market-server";
import { LIVE_MARKET_TICKERS } from "@/data/macroData";
import { getIdxMarketStatus } from "@/lib/market-hours";

export async function GET() {
  await connection();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";
  const marketStatus = getIdxMarketStatus();

  try {
    if (providerEnv === "yahoo") {
      const result = await getMacroTickersServer();
      return NextResponse.json(
        {
          provider: "yahoo",
          tickers: result.tickers,
          isFallback: result.isFallback,
          marketStatus,
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
        tickers: LIVE_MARKET_TICKERS,
        isFallback: true,
        marketStatus,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Failed to load macro tickers";
    console.error("[API /api/macro] Error:", errorMsg);

    if (providerEnv === "yahoo") {
      return NextResponse.json(
        {
          provider: "yahoo",
          tickers: [],
          isFallback: true,
          marketStatus,
          error: errorMsg,
          timestamp: new Date().toISOString(),
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        provider: "illustrative",
        tickers: LIVE_MARKET_TICKERS,
        isFallback: true,
        marketStatus,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
