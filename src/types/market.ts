export interface MarketTickerItem {
  symbol: string;
  name: string;
  value: string;
  change: number;
  isPositive: boolean;
}

export type TimeframeType = "1W" | "1M" | "3M" | "1Y";

export type MacroCategory = 
  | "ALL"
  | "GLOBAL_MACRO"
  | "DOMESTIC_POLITICS"
  | "MONETARY_CURRENCY"
  | "COMMODITIES";

export type SentimentType = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface SectorImpact {
  sector: string;
  sentiment: SentimentType;
  tickers: string[];
  impactDescription: string;
}

export interface MacroNewsItem {
  id: string;
  title: string;
  period: "1W" | "1M";
  date: string;
  category: "GLOBAL_MACRO" | "DOMESTIC_POLITICS" | "MONETARY_CURRENCY" | "COMMODITIES";
  source: string;
  summary: string;
  catalyst: string;
  marketSentiment: SentimentType;
  overallImpact: string;
  sectorImpacts: SectorImpact[];
}

export interface StockFundamental {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
  currentPrice: number;
  change1D: number;
  marketCapTrillion: number;
  peRatio: number;
  historicalPeMean: number;
  peSd1Plus: number;
  peSd1Minus: number;
  peSd2Plus: number;
  peSd2Minus: number;
  pbvRatio: number;
  historicalPbvMean: number;
  roe: number;
  der: number;
  dividendYield: number;
  payoutRatio: number;
  description: string;
  strengths: string[];
  risks: string[];
}

export interface HistoricalDataPoint {
  date: string;
  price: number;
  dividend?: number;
}
