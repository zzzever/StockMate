import type { SubIndicator, BarData, LegendItem, ComputeResult } from '../types';
import { registerIndicator } from '../registry';

function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const r = [data[0]];
  for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k));
  return r;
}

const macd: SubIndicator = {
  id: 'macd',
  label: 'MACD',
  description: 'MACD 动量趋势：DIF 上穿 DEA 金叉看多，下穿死叉看空；红柱转绿柱预示动能切换。',
  category: 'trend',
  complexity: 'basic',
  tags: ['momentum', 'trend-following'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: 'DIF = EMA(CLOSE, FAST) - EMA(CLOSE, SLOW)\nDEA = EMA(DIF, SIGNAL)\nMACD = (DIF - DEA) × 2',
    references: [
      'Appel, G. (1979). "Technical Analysis: Power Tools for Active Investors"',
    ],
  },
  params: [
    { key: 'fast', label: '快线', type: 'number', default: 12, min: 2, max: 50, step: 1 },
    { key: 'slow', label: '慢线', type: 'number', default: 26, min: 5, max: 100, step: 1 },
    { key: 'signal', label: '信号线', type: 'number', default: 9, min: 2, max: 30, step: 1 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const fast = Number(params.fast) || 12;
    const slow = Number(params.slow) || 26;
    const sig = Number(params.signal) || 9;
    const closes = bars.map(b => b.close);

    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    const dif = emaFast.map((v, i) => v - emaSlow[i]);
    const dea = ema(dif, sig);
    const histData: (number | null)[] = dif.map((v, i) => (v - dea[i]) * 2);
    const histColors: string[] = dif.map((v, i) => (v - dea[i]) >= 0 ? '#d0314e' : '#1a8a4a');

    return {
      series: [
        { name: 'DIF', color: '#f0f6fc', type: 'line', data: dif, lineWidth: 1 },
        { name: 'DEA', color: '#f0ad4e', type: 'line', data: dea, lineWidth: 1 },
        { name: 'MACD', color: '#d0314e', type: 'histogram', data: histData, colors: histColors, priceScaleId: 'left' },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    return series.map(s => ({
      label: s.name,
      value: s.data.length > 0 ? s.data[s.data.length - 1] : null,
      color: s.color,
    }));
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    if (series.length < 3) return null;
    const dif = series[0].data;
    const dea = series[1].data;
    const lastDif = dif[dif.length - 1];
    const lastDea = dea[dea.length - 1];
    if (lastDif == null || lastDea == null) return null;
    return `DIF ${lastDif.toFixed(2)}  DEA ${lastDea.toFixed(2)}`;
  },
};

registerIndicator(macd);
