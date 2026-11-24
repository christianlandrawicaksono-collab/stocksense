"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  LineSeries,
  CandlestickSeries,
  createSeriesMarkers,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
} from "lightweight-charts";
import { MarketHistoryPoint, HistoryRange, MarketProvider } from "@/lib/market-data";
import { formatNumber, formatRupiah } from "@/lib/format";
import { TrendingUp, BarChart2 } from "lucide-react";

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
}

type ChartType = "line" | "candle";

export const LightweightPriceChart: React.FC<LightweightPriceChartProps> = ({
  points,
  timeframe,
  onTimeframeChange,
  provider,
  isFallback = false,
  isLoading = false,
  lastUpdated,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoverData, setHoverData] = useState<{
    time: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
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

  useEffect(() => {
    if (!containerRef.current || sortedPoints.length === 0) return;

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
        scaleMargins: { top: 0.12, bottom: 0.12 },
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

    // Subscribe ke perpindahan crosshair untuk tooltip interaktif
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
        const matched = sortedPoints.find((p) => p.time === timeStr);
        if (matched) {
          setHoverData({
            time: matched.time,
            close: matched.close,
            open: matched.open,
            high: matched.high,
            low: matched.low,
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
  }, [sortedPoints, chartType, hasValidOHLC]);

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
      {/* Sub-Header: Kontrol Tampilan & Timeframe */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#0C1017] border-b border-[#1E2736] text-xs">
        {/* Kiri: Tipe Grafik & Penanda Dividen Info */}
        <div className="flex items-center space-x-2">
          {hasValidOHLC && (
            <div className="flex items-center bg-[#080B10] p-0.5 rounded border border-[#1E2736]">
              <button
                type="button"
                onClick={() => setChartType("line")}
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
                onClick={() => setChartType("candle")}
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

          <div className="hidden sm:flex items-center space-x-1.5 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
            <span>Penanda dividen</span>
          </div>
        </div>

        {/* Kanan: Timeframe selector (1Th, 3Th, 5Th, Semua) */}
        <div className="flex items-center space-x-1 bg-[#080B10] p-1 rounded-lg border border-[#1E2736]">
          {(["1Th", "3Th", "5Th", "Semua"] as HistoryRange[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded text-xs font-sans transition ${
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

      {/* Area Kanvas Lightweight Chart */}
      <div className="relative w-full h-[280px] bg-[#111622]">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Catatan Kaki Sumber Data */}
      <div className="px-4 py-2 bg-[#0C1017] border-t border-[#1E2736] flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-1 font-sans">
        <div>
          {provider === "yahoo" && !isFallback ? (
            <span className="text-slate-300">
              Sumber: <strong className="text-slate-200">Yahoo Finance (tidak resmi)</strong>. Tertunda sekitar 10 menit.
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
