// Technical indicator computation utilities
// Pure functions — no React or chart library dependencies

export interface MACDData {
  time: string;
  dif: number | null;
  dea: number | null;
  histogram: number | null;
}

export interface KDJData {
  time: string;
  k: number;
  d: number;
  j: number;
}

export interface RSIData {
  time: string;
  rsi: number;
}

export interface BBData {
  time: string;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    result.push(sum / period);
  }
  return result;
}

function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  // First valid SMA as seed
  let seedSum = 0;
  for (let i = 0; i < period && i < data.length; i++) {
    seedSum += data[i];
    if (i < period - 1) {
      result.push(null);
    } else {
      result.push(seedSum / period);
    }
  }
  // EMA from there
  for (let i = period; i < data.length; i++) {
    const prev = result[i - 1];
    if (prev === null) {
      result.push(null);
      continue;
    }
    result.push((data[i] - prev) * multiplier + prev);
  }
  return result;
}

/** Bollinger Bands: middle=SMA20, upper/lower=middle ± 2*stddev */
export function computeBollinger(
  closes: number[],
  dates: string[],
  period: number = 20,
  multiplier: number = 2
): BBData[] {
  const middle = sma(closes, period);
  const result: BBData[] = [];

  for (let i = 0; i < closes.length; i++) {
    const m = middle[i];
    if (m === null || i < period - 1) {
      result.push({ time: dates[i], upper: null, middle: null, lower: null });
      continue;
    }
    // Compute stddev over the window
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (closes[j] - m) ** 2;
    }
    const stddev = Math.sqrt(sumSq / (period - 1));
    result.push({
      time: dates[i],
      upper: m + multiplier * stddev,
      middle: m,
      lower: m - multiplier * stddev,
    });
  }
  return result;
}

/** MACD: EMA12, EMA26, DIF=EMA12-EMA26, DEA=EMA9(DIF), histogram=2*(DIF-DEA) */
export function computeMACD(
  closes: number[],
  dates: string[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MACDData[] {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const result: MACDData[] = [];

  // Compute DIF for each point (null when EMA not ready)
  const dif: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    dif.push(f !== null && s !== null ? f - s : null);
  }

  // Collect valid DIF values in timeline order
  const validDifValues: number[] = [];
  for (let i = 0; i < dif.length; i++) {
    if (dif[i] !== null) {
      validDifValues.push(dif[i]!);
    }
  }

  // Compute DEA on valid DIF values only (keeps timeline order)
  const validDea = validDifValues.length > 0 ? ema(validDifValues, signal) : [];

  // Build final result aligned to original timeline
  let deaIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    const d = dif[i];
    if (d === null) {
      result.push({ time: dates[i], dif: null, dea: null, histogram: null });
    } else {
      const e = validDea[deaIdx];
      deaIdx++;
      if (e === null) {
        // DIF available but DEA not yet ready (need signal periods)
        result.push({ time: dates[i], dif: d, dea: null, histogram: null });
      } else {
        result.push({
          time: dates[i],
          dif: d,
          dea: e,
          histogram: (d - e) * 2,
        });
      }
    }
  }

  return result;
}

/** KDJ: 9-period RSV, K=2/3*prevK+1/3*RSV, D=2/3*prevD+1/3*K, J=3*K-2*D */
export function computeKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  dates: string[],
  period: number = 9
): KDJData[] {
  const result: KDJData[] = [];
  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < closes.length; i++) {
    // Find highest high and lowest low in window
    const start = Math.max(0, i - period + 1);
    let highest = highs[start];
    let lowest = lows[start];
    for (let j = start; j <= i; j++) {
      if (highs[j] > highest) highest = highs[j];
      if (lows[j] < lowest) lowest = lows[j];
    }

    const range = highest - lowest;
    let rsv: number;
    if (range < 1e-9) {
      rsv = 50;
    } else {
      rsv = ((closes[i] - lowest) / range) * 100;
    }

    const k = (2 / 3) * prevK + (1 / 3) * rsv;
    const d = (2 / 3) * prevD + (1 / 3) * k;
    const j = 3 * k - 2 * d;

    result.push({
      time: dates[i],
      k: Math.round(k * 100) / 100,
      d: Math.round(d * 100) / 100,
      j: Math.round(j * 100) / 100,
    });

    prevK = k;
    prevD = d;
  }

  return result;
}

/** RSI: 14-period Wilder's RSI */
export function computeRSI(
  closes: number[],
  dates: string[],
  period: number = 14
): RSIData[] {
  const result: RSIData[] = [];

  if (closes.length < period + 1) {
    for (let i = 0; i < closes.length; i++) {
      result.push({ time: dates[i], rsi: 50 });
    }
    return result;
  }

  // First average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i <= period; i++) {
    result.push({ time: dates[i], rsi: 50 });
  }

  if (avgLoss < 1e-9 && avgGain < 1e-9) {
    // Flat market: RSI = 50 (neutral)
    result[period] = { time: dates[period], rsi: 50 };
  } else if (avgLoss < 1e-9) {
    result[period] = { time: dates[period], rsi: 100 };
  } else {
    const firstRSI = 100 - 100 / (1 + avgGain / avgLoss);
    result[period] = { time: dates[period], rsi: Math.round(firstRSI * 100) / 100 };
  }

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    let rsi: number;
    if (avgLoss < 1e-9 && avgGain < 1e-9) {
      // Flat market (no price movement): RSI = 50 (neutral)
      rsi = 50;
    } else if (avgLoss < 1e-9) {
      // All gains, no losses: RSI = 100 (overbought)
      rsi = 100;
    } else {
      rsi = 100 - 100 / (1 + avgGain / avgLoss);
    }

    result.push({
      time: dates[i],
      rsi: Math.round(rsi * 100) / 100,
    });
  }

  return result;
}
