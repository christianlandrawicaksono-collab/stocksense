import { NextResponse, connection } from "next/server";
import { buildFallbackGlobalMarkets } from "@/lib/global-markets";
import { getGlobalMarketsServer } from "@/lib/global-markets-server";

export async function GET() {
  await connection();
  const providerEnv = process.env.MARKET_DATA_PROVIDER || "illustrative";

  try {
    if (providerEnv === "yahoo") {
      const result = await getGlobalMarketsServer();
      return NextResponse.json(
        {
          provider: "yahoo",
          isFallback: result.isFallback,
          hubs: result.hubs,
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
        hubs: buildFallbackGlobalMarkets(),
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Failed to load global markets";
    console.error("[API /api/global-markets] Error:", errorMsg);

    return NextResponse.json(
      {
        provider: providerEnv === "yahoo" ? "yahoo" : "illustrative",
        isFallback: true,
        hubs: buildFallbackGlobalMarkets(),
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
