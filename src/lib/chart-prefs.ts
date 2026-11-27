import { HistoryRange, MarketProvider, normalizeHistoryRange } from "./market-data";

export type ChartType = "line" | "candle";

export interface ChartPreferences {
  chartType: ChartType;
  showVolume: boolean;
  showMa20: boolean;
  showMa50: boolean;
  showRsi: boolean;
  showFairValue: boolean;
  showTargetBuy: boolean;
  timeframe: HistoryRange | null;
}

export const CHART_PREFS_STORAGE_KEY = "stocksense:chart-prefs:v1";

export const DEFAULT_CHART_PREFS: ChartPreferences = {
  chartType: "candle",
  showVolume: true,
  showMa20: false,
  showMa50: false,
  showRsi: false,
  showFairValue: false,
  showTargetBuy: true,
  timeframe: null,
};

export function sanitizeChartPreferences(raw: unknown): ChartPreferences {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CHART_PREFS };
  }
  const obj = raw as Record<string, unknown>;
  const chartType: ChartType = obj.chartType === "line" ? "line" : "candle";
  const showVolume = typeof obj.showVolume === "boolean" ? obj.showVolume : DEFAULT_CHART_PREFS.showVolume;
  const showMa20 = typeof obj.showMa20 === "boolean" ? obj.showMa20 : DEFAULT_CHART_PREFS.showMa20;
  const showMa50 = typeof obj.showMa50 === "boolean" ? obj.showMa50 : DEFAULT_CHART_PREFS.showMa50;
  const showRsi = typeof obj.showRsi === "boolean" ? obj.showRsi : DEFAULT_CHART_PREFS.showRsi;
  const showFairValue =
    typeof obj.showFairValue === "boolean" ? obj.showFairValue : DEFAULT_CHART_PREFS.showFairValue;
  const showTargetBuy =
    typeof obj.showTargetBuy === "boolean" ? obj.showTargetBuy : DEFAULT_CHART_PREFS.showTargetBuy;
  const rawTf = typeof obj.timeframe === "string" ? obj.timeframe : null;
  const timeframe = rawTf ? normalizeHistoryRange(rawTf, "3Bl") : null;

  return {
    chartType,
    showVolume,
    showMa20,
    showMa50,
    showRsi,
    showFairValue,
    showTargetBuy,
    timeframe:
      rawTf && timeframe === rawTf ? timeframe : null,
  };
}

export function parseChartPreferencesJson(rawJson: string | null | undefined): ChartPreferences {
  if (!rawJson) return { ...DEFAULT_CHART_PREFS };
  try {
    return sanitizeChartPreferences(JSON.parse(rawJson));
  } catch {
    return { ...DEFAULT_CHART_PREFS };
  }
}

export function resolveEffectiveTimeframe(
  prefs: ChartPreferences,
  provider: MarketProvider
): HistoryRange {
  if (prefs.timeframe) return prefs.timeframe;
  return provider === "yahoo" ? "3Bl" : "Semua";
}

// --- Client-side localStorage store compatible with React useSyncExternalStore ---
const chartPrefsListeners = new Set<() => void>();

function notifyChartPrefsListeners() {
  for (const listener of chartPrefsListeners) {
    listener();
  }
}

export function readChartPrefsStorageSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(CHART_PREFS_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function getChartPrefsServerSnapshot(): string {
  return "";
}

export function subscribeChartPrefsStorage(listener: () => void): () => void {
  chartPrefsListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CHART_PREFS_STORAGE_KEY) {
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    chartPrefsListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function updateChartPreferencesStorage(
  patch: Partial<ChartPreferences>
): ChartPreferences {
  const current = parseChartPreferencesJson(readChartPrefsStorageSnapshot());
  const next = sanitizeChartPreferences({ ...current, ...patch });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CHART_PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }
  notifyChartPrefsListeners();
  return next;
}
