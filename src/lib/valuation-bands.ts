export interface HistoricalPeBands {
  historicalPeMean: number;
  peSd1Plus: number;
  peSd1Minus: number;
  peSd2Plus: number;
  peSd2Minus: number;
  targetMeanPrice: number;
  targetSd1PlusPrice: number;
  targetSd1MinusPrice: number;
  targetSd2PlusPrice: number;
  targetSd2MinusPrice: number;
  sampleCount: number;
}

const MIN_SAMPLE_BARS = 26;
const MIN_LOG_STDDEV = 0.01;
const MAX_REASONABLE_PE_MEAN = 200;

/**
 * Computes log-normal historical P/E deviation bands (-2 SD to +2 SD) and fair-value target prices
 * from historical closing prices and current TTM EPS. Returns null when data is insufficient,
 * flat, or EPS produces distorted multiples.
 */
export function computeHistoricalPeBands(
  points: readonly { close: number }[],
  epsTtm: number
): HistoricalPeBands | null {
  if (!Number.isFinite(epsTtm) || epsTtm <= 0) return null;

  const validCloses = points
    .map((p) => p.close)
    .filter((c) => Number.isFinite(c) && c > 0);

  if (validCloses.length < MIN_SAMPLE_BARS) return null;

  const logs = validCloses.map((c) => Math.log(c));
  const meanLog = logs.reduce((acc, v) => acc + v, 0) / logs.length;
  const variance =
    logs.reduce((acc, v) => {
      const diff = v - meanLog;
      return acc + diff * diff;
    }, 0) / logs.length;
  const sdLog = Math.sqrt(variance);

  if (!Number.isFinite(sdLog) || sdLog < MIN_LOG_STDDEV) return null;

  const targetMeanPrice = Math.round(Math.exp(meanLog));
  const targetSd1PlusPrice = Math.round(Math.exp(meanLog + sdLog));
  const targetSd2PlusPrice = Math.round(Math.exp(meanLog + 2 * sdLog));
  const targetSd1MinusPrice = Math.round(Math.exp(meanLog - sdLog));
  const targetSd2MinusPrice = Math.round(Math.exp(meanLog - 2 * sdLog));

  if (targetMeanPrice <= 0) return null;

  const historicalPeMean = targetMeanPrice / epsTtm;
  if (!Number.isFinite(historicalPeMean) || historicalPeMean <= 0 || historicalPeMean >= MAX_REASONABLE_PE_MEAN) {
    return null;
  }

  return {
    historicalPeMean,
    peSd1Plus: targetSd1PlusPrice / epsTtm,
    peSd1Minus: targetSd1MinusPrice / epsTtm,
    peSd2Plus: targetSd2PlusPrice / epsTtm,
    peSd2Minus: targetSd2MinusPrice / epsTtm,
    targetMeanPrice,
    targetSd1PlusPrice,
    targetSd1MinusPrice,
    targetSd2PlusPrice,
    targetSd2MinusPrice,
    sampleCount: validCloses.length,
  };
}
