import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 WR (Williams %R) ───
// 公式: WR = (HHV(HIGH,N) - CLOSE) / (HHV(HIGH,N) - LLV(LOW,N)) × 100
// 经典参数: N=10, N2=6
// 用法:
//   WR < 20: 超买区（顶部）
//   WR > 80: 超卖区（底部）
//   与 RSI 互补，更敏感

const wr: SubIndicator = {
  id: 'wr',
  label: 'WR',
  description: '威廉指标 WR(10)：WR<20 超买警惕回调，WR>80 超卖关注反弹；比 RSI 更灵敏，适合短线。',
  category: 'oscillator',
  complexity: 'basic',
  tags: ['reversal'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: 'WR = (HHV(HIGH,N) - CLOSE) / (HHV(HIGH,N) - LLV(LOW,N)) × 100',
    references: [
      'Williams, L. (1966). "I\'ve Been Making Money in Commodities"',
    ],
  },
  params: [
    { key: 'period', label: '周期', type: 'number', default: 10, min: 5, max: 50, step: 1 },
    { key: 'period2', label: '周期2', type: 'number', default: 6, min: 3, max: 30, step: 1 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const n = Number(params.period) || 10;
    const n2 = Number(params.period2) || 6;
    const len = bars.length;

    const wr1: (number | null)[] = new Array(len).fill(null);
    const wr2: (number | null)[] = new Array(len).fill(null);

    for (let i = n - 1; i < len; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - n + 1; j <= i; j++) {
        if (bars[j].high > hh) hh = bars[j].high;
        if (bars[j].low < ll) ll = bars[j].low;
      }
      const range = hh - ll;
      wr1[i] = range < 1e-10 ? 50 : ((hh - bars[i].close) / range) * 100;
    }

    for (let i = n2 - 1; i < len; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - n2 + 1; j <= i; j++) {
        if (bars[j].high > hh) hh = bars[j].high;
        if (bars[j].low < ll) ll = bars[j].low;
      }
      const range = hh - ll;
      wr2[i] = range < 1e-10 ? 50 : ((hh - bars[i].close) / range) * 100;
    }

    return {
      series: [
        { name: `WR(${n})`, color: '#e879f9', type: 'line', data: wr1, lineWidth: 1 },
        { name: `WR(${n2})`, color: '#58a6ff', type: 'line', data: wr2, lineWidth: 1 },
        { name: '80', color: '#1a8a4a', type: 'line', data: new Array(len).fill(80), lineStyle: 'dashed', lineWidth: 1 },
        { name: '20', color: '#d0314e', type: 'line', data: new Array(len).fill(20), lineStyle: 'dashed', lineWidth: 1 },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    return series.slice(0, 2).map(s => ({
      label: s.name,
      value: s.data[s.data.length - 1] ?? null,
      color: s.color,
    }));
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const v = series[0].data[series[0].data.length - 1];
    return v != null ? `WR ${v.toFixed(1)}` : null;
  },
};

registerIndicator(wr);
