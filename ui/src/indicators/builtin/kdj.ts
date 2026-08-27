import type { SubIndicator, BarData, LegendItem, ComputeResult } from '../types';
import { registerIndicator } from '../registry';

const kdj: SubIndicator = {
  id: 'kdj',
  label: 'KDJ',
  description: 'KDJ 随机指标(9)：K/D/J 三线低位<20 金叉→底部买点；高位>80 死叉→顶部卖点；J 值极值常预示短线拐点。',
  category: 'oscillator',
  complexity: 'basic',
  tags: ['reversal', 'momentum'],
  params: [
    { key: 'period', label: '周期', type: 'number', default: 9, min: 2, max: 50, step: 1 },
    { key: 'kSmooth', label: 'K平滑', type: 'number', default: 3, min: 1, max: 10, step: 1 },
    { key: 'dSmooth', label: 'D平滑', type: 'number', default: 3, min: 1, max: 10, step: 1 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const period = Number(params.period) || 9;
    const kSmooth = Number(params.kSmooth) || 3;
    const dSmooth = Number(params.dSmooth) || 3;

    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    const closes = bars.map(b => b.close);

    const kData: (number | null)[] = new Array(bars.length).fill(null);
    const dData: (number | null)[] = new Array(bars.length).fill(null);
    const jData: (number | null)[] = new Array(bars.length).fill(null);

    let k = 50, d = 50;
    for (let i = period - 1; i < bars.length; i++) {
      let highest = highs[i];
      let lowest = lows[i];
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > highest) highest = highs[j];
        if (lows[j] < lowest) lowest = lows[j];
      }
      const range = highest - lowest;
      const rsv = range < 1e-9 ? 50 : ((closes[i] - lowest) / range) * 100;
      k = k * (kSmooth - 1) / kSmooth + rsv / kSmooth;
      d = d * (dSmooth - 1) / dSmooth + k / dSmooth;
      const j = 3 * k - 2 * d;
      kData[i] = Math.round(k * 100) / 100;
      dData[i] = Math.round(d * 100) / 100;
      jData[i] = Math.round(j * 100) / 100;
    }

    return {
      series: [
        { name: 'K', color: '#f0ad4e', type: 'line', data: kData, lineWidth: 1 },
        { name: 'D', color: '#4a90d9', type: 'line', data: dData, lineWidth: 1 },
        { name: 'J', color: '#9b59b6', type: 'line', data: jData, lineWidth: 1 },
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
    const lk = series[0].data[series[0].data.length - 1];
    const ld = series[1].data[series[1].data.length - 1];
    const lj = series[2].data[series[2].data.length - 1];
    if (lk == null || ld == null || lj == null) return null;
    return `K ${lk.toFixed(1)}  D ${ld.toFixed(1)}  J ${lj.toFixed(1)}`;
  },
};

registerIndicator(kdj);
