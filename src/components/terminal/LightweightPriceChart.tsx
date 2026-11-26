"use client";

import React, { useEffect, useRef, useState, useMemo, useSyncExternalStore } from "react";
import {
  createChart,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
} from "lightweight-charts";
import { MarketHistoryPoint, HistoryRange, HISTORY_RANGES, MarketProvider } from "@/lib/market-data";
import {
  getChartPrefsServerSnapshot,
  parseChartPreferencesJson,
  readChartPrefsStorageSnapshot,
  subscribeChartPrefsStorage,
  updateChartPreferencesStorage,
} from "@/lib/chart-prefs";
import { formatNumber, formatDesimal, formatRupiah, formatPersen } from "@/lib/format";
import { TrendingUp, BarChart2, AlertCircle, AlertTriangle, RotateCcw } from "lucide-react";

interface LightweightPriceChartProps {
  ticker?: string;
  points: MarketHistoryPoint[];
  timeframe: HistoryRange;
  onTimeframeChange: (tf: HistoryRange) => void;
  provider: MarketProvider;
  isFallback?: boolean;
  isLoading?: boolean;
  currentPrice?: number;
  changePercent?: number;
  lastUpdated?: string;
  fairValuePrice?: number;
  targetBuyPrice?: number;
  error?: string | null;
  onRetry?: () => void;
}

function computeSMA(points: MarketHistoryPoint[], period: number): { time: Time; value: number }[] {
  if (points.length < period) return [];
  const res: { time: Time; value: number }[] = [];
  let rollingSum = 0;

  for (let i = 0; i < points.length; i++) {
    rollingSum += points[i].close;
    if (i >= period) {
      rollingSum -= points[i - period].close;
    }
    if (i >= period - 1) {
      res.push({
        time: points[i].time as Time,
        value: rollingSum / period,
      });
    }
  }
  return res;
}

function formatCompactVolume(vol: number): string {
  if (!vol || vol <= 0) return "0";
  if (vol >= 1e9) return `${formatDesimal(vol / 1e9, 2)} M`;
  if (vol >= 1e6) return `${formatDesimal(vol / 1e6, 2)} jt`;
  if (vol >= 1e3) return `${formatDesimal(vol / 1e3, 1)} rb`;
  return formatNumber(vol);
}

export const LightweightPriceChart: React.FC<LightweightPriceChartProps> = ({
  points,
  timeframe,
  onTimeframeChange,
  provider,
  isFallback = false,
  isLoading = false,
  currentPrice,
  lastUpdated,
  fairValuePrice,
  targetBuyPrice,
  error,
  onRetry,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const chartPrefsJson = useSyncExternalStore(
    subscribeChartPrefsStorage,
    readChartPrefsStorageSnapshot,
    getChartPrefsServerSnapshot
  );
  const chartPrefs = useMemo(
    () => parseChartPreferencesJson(chartPrefsJson),
    [chartPrefsJson]
  );
  const { chartType, showVolume, showMa20, showMa50, showFairValue, showTargetBuy } = chartPrefs;
  const isWeeklyTimeframe = timeframe === "5Th" || timeframe === "Semua";
  const [hoverData, setHoverData] = useState<{
    time: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    dividend?: number;
  } | null>(null);

  // Cek apakah data memiliki variasi OHLC asli (bukan ilustrasi flat)
  const hasValidOHLC = useMemo(() => {
    return points.some((p) => p.open !== p.close || p.high !== p.low);
  }, [points]);

  // Siapkan data yang terurut menaik berdasarkan time (syarat mutlak lightweight-charts)
  const sortedPoints = useMemo(() => {
    const list = [...points];
    list.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    // Hilangkan duplikasi tanggal jika ada
    const unique: MarketHistoryPoint[] = [];
    const seen = new Set<string>();
    for (const p of list) {
      if (!seen.has(p.time)) {
        seen.add(p.time);
        unique.push({ ...p });
      }
    }
    return unique;
  }, [points]);

  const hasValidVolume = useMemo(() => {
    return hasValidOHLC && sortedPoints.some((p) => p.volume > 0);
  }, [hasValidOHLC, sortedPoints]);

  const pointByTime = useMemo(() => {
    const map = new Map<string, MarketHistoryPoint>();
    for (const p of sortedPoints) {
      map.set(p.time, p);
    }
    return map;
  }, [sortedPoints]);

  // Pemeriksaan konsistensi harga antara bar terakhir riwayat dan quote live di header
  const priceConsistency = useMemo(() => {
    if (!currentPrice || currentPrice <= 0 || sortedPoints.length === 0) {
      return { isConsistent: true, isNoticeable: false, diffPct: 0, lastClose: 0 };
    }
    const lastClose = sortedPoints[sortedPoints.length - 1].close;
    if (!lastClose || lastClose <= 0) {
      return { isConsistent: true, isNoticeable: false, diffPct: 0, lastClose: 0 };
    }
    const diffPct = Math.abs((lastClose - currentPrice) / currentPrice) * 100;
    const isSevereMismatch = diffPct > 20; // Selisih ekstrem (misal data ilustrasi 10.450 vs live 5.800)
    const isNoticeableMismatch = diffPct > 5;

    return {
      isConsistent: !isSevereMismatch,
      isNoticeable: isNoticeableMismatch,
      diffPct,
      lastClose,
    };
  }, [currentPrice, sortedPoints]);

  useEffect(() => {
    if (!containerRef.current || sortedPoints.length === 0 || !priceConsistency.isConsistent) return;

    // Bersihkan chart sebelumnya jika ada
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height: 280,
      layout: {
        background: { type: ColorType.Solid, color: "#111622" },
        textColor: "#94A3B8",
        fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
        fontSize: 11,
      },
      localization: {
        priceFormatter: (price: number) => formatNumber(price),
      },
      grid: {
        vertLines: { color: "#1E2736", style: 2 },
        horzLines: { color: "#1E2736", style: 2 },
      },
      rightPriceScale: {
        borderColor: "#1E2736",
        scaleMargins: hasValidVolume && showVolume
          ? { top: 0.1, bottom: 0.24 }
          : { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "#1E2736",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#475569",
          width: 1,
          style: 3,
          labelBackgroundColor: "#1E293B",
        },
        horzLine: {
          color: "#475569",
          width: 1,
          style: 3,
          labelBackgroundColor: "#1E293B",
        },
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
      },
    });

    chartRef.current = chart;

    let series: ISeriesApi<"Line"> | ISeriesApi<"Candlestick">;

    if (chartType === "candle" && hasValidOHLC) {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#2EB886",
        downColor: "#DC525F",
        borderVisible: false,
        wickUpColor: "#2EB886",
        wickDownColor: "#DC525F",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => formatNumber(price),
        },
      });

      const candleData = sortedPoints.map((p) => ({
        time: p.time as Time,
        open: p.open ?? p.close,
        high: p.high ?? p.close,
        low: p.low ?? p.close,
        close: p.close,
      }));
      candleSeries.setData(candleData);
      series = candleSeries;
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: "#1E7B85",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#1E7B85",
        crosshairMarkerBackgroundColor: "#FFFFFF",
        priceFormat: {
          type: "custom",
          formatter: (price: number) => formatNumber(price),
        },
      });

      const lineData = sortedPoints.map((p) => ({
        time: p.time as Time,
        value: p.close,
      }));
      lineSeries.setData(lineData);
      series = lineSeries;
    }

    // Pasang Histogram Volume di bawah grafik harga bila tersedia volume nyata
    if (hasValidVolume && showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });
      volumeSeries.setData(
        sortedPoints.map((p) => ({
          time: p.time as Time,
          value: p.volume,
          color:
            p.close >= (p.open ?? p.close)
              ? "rgba(46, 184, 134, 0.35)"
              : "rgba(220, 82, 95, 0.35)",
        }))
      );
    }

    // Overlay Moving Average (MA20 / MA50)
    const maConfigs = [
      { enabled: showMa20, period: 20, color: "#F59E0B" },
      { enabled: showMa50, period: 50, color: "#A855F7" },
    ];
    for (const ma of maConfigs) {
      if (!ma.enabled) continue;
      const maData = computeSMA(sortedPoints, ma.period);
      if (maData.length > 0) {
        const maSeries = chart.addSeries(LineSeries, {
          color: ma.color,
          lineWidth: 1,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });
        maSeries.setData(maData);
      }
    }

    // Garis horizontal Target Harga Wajar (P/E Mean)
    if (showFairValue && fairValuePrice && fairValuePrice > 0) {
      series.createPriceLine({
        price: fairValuePrice,
        color: "#2DD4BF",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Wajar Mean",
      });
    }

    // Garis horizontal Target Harga Beli Pribadi (Watchlist)
    if (showTargetBuy && targetBuyPrice && targetBuyPrice > 0) {
      series.createPriceLine({
        price: targetBuyPrice,
        color: "#2EB886",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Target Beli",
      });
    }

    // Pasang penanda dividen (markers) titik oranye tanpa teks di atas grafik
    const dividendMarkers: SeriesMarker<Time>[] = [];
    for (const p of sortedPoints) {
      if (p.dividend && p.dividend > 0) {
        dividendMarkers.push({
          time: p.time as Time,
          position: "aboveBar",
          color: "#F59E0B",
          shape: "circle",
          size: 1,
        });
      }
    }

    if (dividendMarkers.length > 0) {
      createSeriesMarkers(series, dividendMarkers);
    }

    chart.timeScale().fitContent();

    // Subscribe ke perpindahan crosshair untuk tooltip interaktif (O(1) lookup via Map)
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > 280
      ) {
        setHoverData(null);
      } else {
        const timeStr = typeof param.time === "string" ? param.time : "";
        const matched = pointByTime.get(timeStr);
        if (matched) {
          setHoverData({
            time: matched.time,
            close: matched.close,
            open: matched.open,
            high: matched.high,
            low: matched.low,
            volume: matched.volume,
            dividend: matched.dividend,
          });
        }
      }
    });

    // ResizeObserver responsif untuk menyesuaikan lebar grafik secara otomatis
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !entries[0].contentRect) return;
      const newWidth = entries[0].contentRect.width;
      if (newWidth > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: newWidth });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [
    sortedPoints,
    pointByTime,
    chartType,
    hasValidOHLC,
    hasValidVolume,
    showVolume,
    showMa20,
    showMa50,
    showFairValue,
    showTargetBuy,
    fairValuePrice,
    targetBuyPrice,
    priceConsistency.isConsistent,
  ]);

  // Format tanggal Indonesia untuk tooltip
  const formatTooltipDate = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="flex flex-col bg-[#111622] rounded-xl overflow-hidden font-sans">
      {/* Sub-Header: Kontrol Tampilan, Indikator & Timeframe */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#0C1017] border-b border-[#1E2736] text-xs">
        {/* Kiri: Tipe Grafik, Toggle Indikator & Penanda Dividen Info */}
        <div className="flex flex-wrap items-center gap-2">
          {hasValidOHLC && (
            <div className="flex items-center bg-[#080B10] p-0.5 rounded border border-[#1E2736]">
              <button
                type="button"
                onClick={() => updateChartPreferencesStorage({ chartType: "line" })}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition ${
                  chartType === "line"
                    ? "bg-[#1E7B85] text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Grafik Garis"
              >
                <TrendingUp className="w-3 h-3" />
                <span>Garis</span>
              </button>
              <button
                type="button"
                onClick={() => updateChartPreferencesStorage({ chartType: "candle" })}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition ${
                  chartType === "candle"
                    ? "bg-[#1E7B85] text-white font-medium"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Grafik Lilin (Candlestick OHLC)"
              >
                <BarChart2 className="w-3 h-3" />
                <span>Lilin</span>
              </button>
            </div>
          )}

          {/* Toggle Indikator Teknikal & Garis Wajar */}
          <div className="flex items-center flex-wrap gap-1">
            {hasValidVolume && (
              <button
                type="button"
                onClick={() => updateChartPreferencesStorage({ showVolume: !showVolume })}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                  showVolume
                    ? "bg-[#1E7B85]/20 border-[#1E7B85] text-slate-100"
                    : "bg-[#080B10] border-[#1E2736] text-slate-400 hover:text-slate-200"
                }`}
                title="Tampilkan / sembunyikan histogram volume"
              >
                Vol
              </button>
            )}
            <button
              type="button"
              onClick={() => updateChartPreferencesStorage({ showMa20: !showMa20 })}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition flex items-center space-x-1 ${
                showMa20
                  ? "bg-[#F59E0B]/15 border-[#F59E0B]/60 text-[#FCD34D]"
                  : "bg-[#080B10] border-[#1E2736] text-slate-400 hover:text-slate-200"
              }`}
              title={`Moving Average 20 bar (${isWeeklyTimeframe ? "20 minggu" : "20 hari"})`}
            >
              <span>MA20</span>
            </button>
            <button
              type="button"
              onClick={() => updateChartPreferencesStorage({ showMa50: !showMa50 })}
              className={`px-2 py-1 rounded text-[11px] font-mono border transition flex items-center space-x-1 ${
                showMa50
                  ? "bg-[#A855F7]/15 border-[#A855F7]/60 text-[#D8B4FE]"
                  : "bg-[#080B10] border-[#1E2736] text-slate-400 hover:text-slate-200"
              }`}
              title={`Moving Average 50 bar (${isWeeklyTimeframe ? "50 minggu" : "50 hari"})`}
            >
              <span>MA50</span>
            </button>
            {fairValuePrice && fairValuePrice > 0 && (
              <button
                type="button"
                onClick={() => updateChartPreferencesStorage({ showFairValue: !showFairValue })}
                className={`px-2 py-1 rounded text-[11px] font-sans border transition ${
                  showFairValue
                    ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/60 text-[#2DD4BF]"
                    : "bg-[#080B10] border-[#1E2736] text-slate-400 hover:text-slate-200"
                }`}
                title={`Garis target harga wajar P/E Mean (${formatRupiah(fairValuePrice)})`}
              >
                Wajar
              </button>
            )}
            {targetBuyPrice && targetBuyPrice > 0 && (
              <button
                type="button"
                onClick={() => updateChartPreferencesStorage({ showTargetBuy: !showTargetBuy })}
                className={`px-2 py-1 rounded text-[11px] font-sans border transition ${
                  showTargetBuy
                    ? "bg-[#2EB886]/15 border-[#2EB886]/60 text-[#2EB886]"
                    : "bg-[#080B10] border-[#1E2736] text-slate-400 hover:text-slate-200"
                }`}
                title={`Garis Target Harga Beli pribadi (${formatRupiah(targetBuyPrice)})`}
              >
                Target
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
            <span>Dividen</span>
          </div>
        </div>

        {/* Kanan: Timeframe selector (1Bl, 3Bl, 6Bl, 1Th, 3Th, 5Th, Semua) */}
        <div className="flex flex-wrap items-center gap-1 bg-[#080B10] p-1 rounded-lg border border-[#1E2736]">
          {HISTORY_RANGES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={`px-2 py-1 rounded text-[11px] sm:text-xs font-sans transition ${
                timeframe === tf
                  ? "bg-[#1E7B85] text-white font-medium shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip Bar di atas kanvas: Nilai saat crosshair aktif atau data terbaru */}
      <div className="px-4 py-1.5 bg-[#0A0E16] border-b border-[#1A2230] min-h-[34px] flex items-center justify-between text-xs text-slate-300 font-mono tnum">
        {hoverData ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-slate-400 font-sans text-[11px]">
              {formatTooltipDate(hoverData.time)}
            </span>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400 font-sans text-[11px]">Tutup:</span>
              <span className="font-semibold text-white">
                {formatRupiah(hoverData.close)}
              </span>
            </div>
            {hasValidOHLC && hoverData.open !== undefined && (
              <>
                <span className="text-slate-400 text-[11px]">
                  B: {formatNumber(hoverData.open)}
                </span>
                <span className="text-slate-400 text-[11px]">
                  T: {formatNumber(hoverData.high || hoverData.close)}
                </span>
                <span className="text-slate-400 text-[11px]">
                  R: {formatNumber(hoverData.low || hoverData.close)}
                </span>
              </>
            )}
            {hasValidVolume && hoverData.volume !== undefined && hoverData.volume > 0 && (
              <span className="text-slate-400 text-[11px]">
                Vol: {formatCompactVolume(hoverData.volume)}
              </span>
            )}
            {hoverData.dividend !== undefined && hoverData.dividend > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-semibold text-[11px]">
                Dividen: {formatRupiah(hoverData.dividend)} per lembar
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-slate-400 text-[11px] font-sans">
            <span>Arahkan kursor atau sentuh grafik untuk rincian tanggal dan harga</span>
          </div>
        )}

        {isLoading && (
          <span className="text-[11px] text-[#2DD4BF] animate-pulse font-sans">
            Memperbarui...
          </span>
        )}
      </div>

      {/* Peringatan jika terdeteksi selisih wajar antara bar riwayat dan harga live */}
      {priceConsistency.isNoticeable && priceConsistency.isConsistent && (
        <div className="bg-[#451A03]/80 border-b border-[#78350F] px-4 py-1.5 flex items-center justify-between text-[11px] text-[#FDE047] font-sans">
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#F59E0B]" />
            <span>
              Perhatian: Harga bar terakhir riwayat ({formatRupiah(priceConsistency.lastClose)}) berselisih {formatPersen(priceConsistency.diffPct, 1)} dari harga quote ({formatRupiah(currentPrice || 0)}).
            </span>
          </div>
        </div>
      )}

      {/* Area Kanvas Lightweight Chart */}
      <div className="relative w-full h-[280px] bg-[#111622]">
        {error || !priceConsistency.isConsistent || (points.length === 0 && !isLoading) ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#111622]">
            {!priceConsistency.isConsistent ? (
              <>
                <AlertTriangle className="w-7 h-7 text-[#EF4444] mb-2" />
                <p className="text-sm font-semibold text-slate-100 font-sans">
                  Inkonsistensi Data Riwayat Terdeteksi
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md font-sans">
                  Harga penutupan riwayat ({formatRupiah(priceConsistency.lastClose)}) berselisih {formatPersen(priceConsistency.diffPct, 1)} dari harga live ({formatRupiah(currentPrice || 0)}). Grafik ditangguhkan demi akurasi tampilan.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-7 h-7 text-[#EAB308] mb-2" />
                <p className="text-sm font-semibold text-slate-100 font-sans">
                  {error || "Riwayat harga tidak tersedia saat ini"}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm font-sans">
                  Gagal memuat data riwayat dari penyedia data. Header tetap menampilkan harga pasar terkini.
                </p>
              </>
            )}

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3.5 flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#1E2736] hover:bg-[#2A374A] border border-[#2E3B52] text-xs font-sans text-slate-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#1E7B85]" />
                <span>Coba Lagi</span>
              </button>
            )}
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}
      </div>

      {/* Catatan Kaki Sumber Data */}
      <div className="px-4 py-2 bg-[#0C1017] border-t border-[#1E2736] flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-1 font-sans">
        <div>
          {provider === "yahoo" && !isFallback && priceConsistency.isConsistent && points.length > 0 ? (
            <span className="text-slate-300">
              Sumber: <strong className="text-slate-200">Yahoo Finance (tidak resmi)</strong>. Tertunda sekitar 10 menit.
            </span>
          ) : provider === "yahoo" && (isFallback || !priceConsistency.isConsistent || points.length === 0) ? (
            <span className="text-amber-400">
              *Data riwayat Yahoo Finance sedang tidak tersedia untuk periode ini.
            </span>
          ) : (
            <span>
              *Data historis ilustrasi untuk riset tampilan grafik dan pengujian strategi.
            </span>
          )}
        </div>
        {lastUpdated && (
          <div className="font-mono text-slate-400 tnum">
            Diperbarui: {lastUpdated}
          </div>
        )}
      </div>
    </div>
  );
};
