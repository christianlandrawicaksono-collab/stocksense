import { NextRequest, NextResponse, connection } from "next/server";
import {
  SUPPORTED_TICKERS,
  ServerHistoryPoint,
  getHistoryServer,
  getIllustrativeHistory,
  isSupportedBenchmarkTicker,
  isValidIdxTickerFormat,
} from "@/lib/market-server";
import { normalizeHistoryRange } from "@/lib/market-data";
import { getIdxMarketStatus } from "@/lib/market-hours";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  await connection();
  try {
    const { ticker: rawTicker } = await params;
    const ticker = (rawTicker || "").toUpperCase();
    const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

    const isBenchmark = isSupportedBenchmarkTicker(ticker);
    const isCurated =
      (SUPPORTED_TICKERS as readonly string[]).includes(ticker) || ticker === "IHSG";
    const isAllowed =
      isCurated ||
      (providerEnv === "yahoo" && (isBenchmark || isValidIdxTickerFormat(ticker)));

    if (!isAllowed) {
      return NextResponse.json(
        { error: `Ticker ${ticker} tidak didukung pada mode ${providerEnv}` },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = normalizeHistoryRange(searchParams.get("range"), "Semua");
    const marketStatus = getIdxMarketStatus();

    let points: ServerHistoryPoint[] = [];
    let isFallback = false;
    let activeProvider = "illustrative";

    if (providerEnv === "yahoo") {
      activeProvider = "yahoo";
      const result = await getHistoryServer(ticker, range);
      points = result.points;
      isFallback = result.isFallback;
    } else {
      points = getIllustrativeHistory(ticker, range);
      isFallback = true;
    }

    return NextResponse.json(
      {
        provider: activeProvider,
        ticker,
        range,
        points,
        isFallback,
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
    const errorMsg = error instanceof Error ? error.message : "Failed to load history";
    console.error("[API /api/history] Error:", errorMsg);
    const { ticker: rawTicker } = await params;
    const ticker = (rawTicker || "BBCA").toUpperCase();
    const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

    if (providerEnv === "yahoo") {
      return NextResponse.json(
        {
          provider: "yahoo",
          ticker,
          range: "Semua",
          points: [],
          isFallback: true,
          marketStatus: getIdxMarketStatus(),
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
        ticker,
        range: "Semua",
        points: getIllustrativeHistory(ticker, "Semua"),
        isFallback: true,
        marketStatus: getIdxMarketStatus(),
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
