export interface RsiPoint {
  time: string;
  value: number;
}

/**
 * Computes Wilder's Relative Strength Index (RSI) from sorted OHLC close points.
 * Standard default period is 14 bars. Returns points aligned from index `period` onward.
 */
export function computeRSI(
  points: { time: string; close: number }[],
  period: number = 14
): RsiPoint[] {
  const safePeriod = Math.max(2, Math.floor(period));
  if (!points || points.length <= safePeriod) return [];

  const valid = points.filter(
    (p) => typeof p.time === "string" && p.time.length > 0 && Number.isFinite(p.close) && p.close > 0
  );
  if (valid.length <= safePeriod) return [];

  const toRsi = (avgGain: number, avgLoss: number): number => {
    if (avgLoss === 0 && avgGain === 0) return 50;
    if (avgLoss === 0) return 100;
    if (avgGain === 0) return 0;
    const rs = avgGain / avgLoss;
    return Math.min(100, Math.max(0, 100 - 100 / (1 + rs)));
  };

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= safePeriod; i += 1) {
    const diff = valid[i].close - valid[i - 1].close;
    if (diff > 0) gainSum += diff;
    else if (diff < 0) lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / safePeriod;
  let avgLoss = lossSum / safePeriod;

  const result: RsiPoint[] = [
    {
      time: valid[safePeriod].time,
      value: Number(toRsi(avgGain, avgLoss).toFixed(2)),
    },
  ];

  for (let i = safePeriod + 1; i < valid.length; i += 1) {
    const diff = valid[i].close - valid[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (safePeriod - 1) + gain) / safePeriod;
    avgLoss = (avgLoss * (safePeriod - 1) + loss) / safePeriod;
    result.push({
      time: valid[i].time,
      value: Number(toRsi(avgGain, avgLoss).toFixed(2)),
    });
  }

  return result;
}
