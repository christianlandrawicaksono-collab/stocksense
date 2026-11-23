import { NextRequest, NextResponse, connection } from "next/server";
import {
  SUPPORTED_TICKERS,
  ServerQuoteItem,
  getBatchQuotesServer,
  getIllustrativeQuote,
} from "@/lib/market-server";
import { getIdxMarketStatus } from "@/lib/market-hours";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const { searchParams } = new URL(request.url);
    const rawTickers = searchParams.get("tickers");

    let tickers: string[] = [];
    if (rawTickers) {
      tickers = rawTickers
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => (SUPPORTED_TICKERS as readonly string[]).includes(t));
    }

    if (tickers.length === 0) {
      tickers = [...SUPPORTED_TICKERS];
    }

    const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";
    const marketStatus = getIdxMarketStatus();

    let quotes: Record<string, ServerQuoteItem> = {};
    let activeProvider = "illustrative";

    if (providerEnv === "yahoo") {
      activeProvider = "yahoo";
      quotes = await getBatchQuotesServer(tickers);
    } else {
      // Mode ilustrasi (statis)
      for (const t of tickers) {
        quotes[t] = getIllustrativeQuote(t);
      }
    }

    return NextResponse.json(
      {
        provider: activeProvider,
        marketStatus,
        quotes,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[API /api/quotes] Error:", errorMsg);
    // Fallback darurat ke data ilustrasi jika terjadi pengecualian total
    const fallbackQuotes: Record<string, ServerQuoteItem> = {};
    for (const t of SUPPORTED_TICKERS) {
      fallbackQuotes[t] = getIllustrativeQuote(t);
    }

    return NextResponse.json(
      {
        provider: "illustrative",
        error: errorMsg,
        marketStatus: getIdxMarketStatus(),
        quotes: fallbackQuotes,
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
