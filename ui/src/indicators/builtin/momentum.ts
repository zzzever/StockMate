import type { SubIndicator, BarData, LegendItem, ComputeResult, MarkerPoint } from '../types';
import { registerIndicator } from '../registry';

const EMA = (data: number[], period: number): number[] => {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const r = [data[0]];
  for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k));
  return r;
};

const SMA = (data: number[], period: number): (number | null)[] =>
  period < 1 ? data.map(() => null) : data.map((_, i) =>
    i < period - 1 ? null : data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );

function calcMomentumRaw(bars: BarData[]): { gr: (number | null)[]; bars: ({ time: string; value: number; color: string } | null)[] } {
  const n = bars.length;
  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);

  const llv = (p: number, i: number) => Math.min(...lows.slice(Math.max(0, i - p + 1), i + 1));
  const hhv = (p: number, i: number) => Math.max(...highs.slice(Math.max(0, i - p + 1), i + 1));

  const raw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < 19) continue;
    const lo = llv(20, i), hi = hhv(20, i);
    const width = Math.max(hi - lo, 0.01);
    raw[i] = Math.max(0, Math.min(100, (100 * (closes[i] - lo)) / width));
  }
  const validRaw = raw.filter((v): v is number => v != null);
  const ema = validRaw.length ? EMA(validRaw, 4) : [];
  const gr: (number | null)[] = new Array(n).fill(null);
  for (let i = 19, j = 0; i < n; i++) { gr[i] = ema[j++] ?? null; }

  const barResult: ({ time: string; value: number; color: string } | null)[] = new Array(n).fill(null);
  for (let i = 20; i < n; i++) {
    const cur = gr[i]!, prev = gr[i - 1];
    if (prev == null) continue;
    barResult[i] = {
      time: bars[i].time,
      value: cur - prev,
      color: cur >= prev ? 'rgba(208,49,78,0.5)' : 'rgba(26,138,74,0.5)',
    };
  }

  return { gr, bars: barResult };
}

function calcMomentumMarkers(bars: BarData[], gr: (number | null)[]): MarkerPoint[] {
  const n = bars.length;
  const closes = bars.map(b => b.close);
  const volume = bars.map(b => b.volume);
  const ma20 = SMA(closes, 20);
  const ma60 = SMA(closes, 60);
  const vol5 = SMA(volume, 5);
  const trArr: (number | null)[] = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    trArr[i] = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - closes[i - 1]), Math.abs(bars[i].low - closes[i - 1]));
  }
  const atr = SMA(trArr as number[], 14);
  const hhvC20 = (i: number) => Math.max(...closes.slice(Math.max(0, i - 19), i + 1));

  const markers: MarkerPoint[] = [];
  let lastBuy = -99, lastSell = -99;
  for (let i = 20; i < n; i++) {
    const cur = gr[i]!, prev = gr[i - 1];
    if (prev == null || ma20[i] == null) continue;
    const m20 = ma20[i]!;
    const uptrend = ma20[i - 1] != null && m20 > ma20[i - 1]!;
    const midTrend = ma60[i] != null && m20 > ma60[i]!;
    const volOk = (vol5[i] ?? 0) > 0 && volume[i] > (vol5[i] ?? 0);

    if (prev < 15 && cur >= 15 && cur < 30) {
      if (i - lastBuy >= 20) { markers.push({ time: bars[i].time, position: 'belowBar', color: '#0ea5e9', shape: 'arrowUp', text: '底', size: 2 }); lastBuy = i; }
    }
    if (prev < 30 && cur >= 30 && midTrend && uptrend && volOk) {
      if (i - lastBuy >= 20) { markers.push({ time: bars[i].time, position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: '买', size: 2 }); lastBuy = i; }
    }
    if (prev >= 80 && cur <= 80 && !uptrend) {
      if (i - lastSell >= 20) { markers.push({ time: bars[i].time, position: 'aboveBar', color: '#f59e0b', shape: 'arrowDown', text: '卖', size: 2 }); lastSell = i; }
    }
    if (prev >= 70 && cur <= 70 && !midTrend && !uptrend) {
      if (i - lastSell >= 20) { markers.push({ time: bars[i].time, position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: '清', size: 2 }); lastSell = i; }
    }
    const at14 = atr[i] ?? 0;
    const stop = at14 > 0 ? hhvC20(i) - 2.5 * at14 : 0;
    if (i > 0 && stop > 0 && closes[i - 1] > stop && closes[i] <= stop) {
      if (i - lastSell >= 20) { markers.push({ time: bars[i].time, position: 'aboveBar', color: '#eab308', shape: 'arrowDown', text: '损', size: 2 }); lastSell = i; }
    }
  }
  return markers;
}

const momentum: SubIndicator = {
  id: 'gr',
  label: '动力',
  description: '动力线·0~100（N20）：EMA(100×(C−LLV(L,20))/(HHV(H,20)−LLV(L,20)),4)。红柱=动力线上升、绿柱=下降。',
  category: 'oscillator',
  complexity: 'intermediate',
  tags: ['momentum'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: 'RAW = 100×(CLOSE-LLV(LOW,20))/(HHV(HIGH,20)-LLV(LOW,20))\n动力线 = EMA(RAW, 4)',
    references: [
      '自研指标，基于价格位置归一化+EMA平滑',
    ],
  },
  params: [
    { key: 'period', label: '周期', type: 'number', default: 20, min: 5, max: 60, step: 1 },
    { key: 'emaPeriod', label: 'EMA平滑', type: 'number', default: 4, min: 1, max: 20, step: 1 },
  ],

  compute(bars: BarData[], _params: Record<string, number | string>): ComputeResult {
    const { gr, bars: barData } = calcMomentumRaw(bars);
    const markers = calcMomentumMarkers(bars, gr);

    const grLine = gr.map((v, i) => ({ time: bars[i].time, value: v ?? undefined }));

    const constLine = (val: number) => bars.map(b => ({ time: b.time, value: val }));

    return {
      series: [
        { name: '动力线', color: '#f0f6fc', type: 'line', data: gr, lineWidth: 1 },
        { name: '清仓', color: '#ef4444', type: 'line', data: constLine(90).map(d => d.value), lineStyle: 'dashed', lineWidth: 1 },
        { name: '阶段', color: '#22c55e', type: 'line', data: constLine(80).map(d => d.value), lineStyle: 'dashed', lineWidth: 1 },
        { name: '强弱', color: '#9ca3af', type: 'line', data: constLine(50).map(d => d.value), lineStyle: 'solid', lineWidth: 1 },
        { name: '关注', color: '#facc15', type: 'line', data: constLine(30).map(d => d.value), lineStyle: 'dashed', lineWidth: 1 },
        { name: '底部', color: '#3b82f6', type: 'line', data: constLine(15).map(d => d.value), lineStyle: 'dashed', lineWidth: 1 },
        { name: '柱', color: 'rgba(208,49,78,0.5)', type: 'histogram', data: barData.map(b => b?.value ?? null), priceScaleId: 'left' },
      ],
      markers,
    };
  },

  legends(bars: BarData[], _params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, _params);
    const mainLine = series[0];
    const lastVal = mainLine.data[mainLine.data.length - 1];
    return [{ label: '动力线', value: lastVal ?? null, color: '#f0f6fc' }];
  },

  currentValue(bars: BarData[], _params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, _params);
    const mainLine = series[0];
    const lastVal = mainLine.data[mainLine.data.length - 1];
    if (lastVal == null) return null;
    return `动力线 ${lastVal.toFixed(1)}`;
  },
};

registerIndicator(momentum);
