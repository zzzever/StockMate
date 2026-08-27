import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 OBV (On-Balance Volume) ───
// 公式:
//   若 C > C(1), OBV = OBV(1) + VOL
//   若 C < C(1), OBV = OBV(1) - VOL
//   若 C = C(1), OBV = OBV(1)
// 用途: 量价背离检测，OBV 趋势与价格趋势背离时预警

const obv: SubIndicator = {
  id: 'obv',
  label: 'OBV',
  description: '能量潮 OBV：量价同步验证——OBV 上升确认涨势，OBV 下降确认跌势；OBV 与价格背离预示趋势反转。',
  category: 'volume',
  complexity: 'basic',
  tags: ['trend-following'],
  params: [
    { key: 'ma', label: 'OBV均线', type: 'number', default: 20, min: 5, max: 60, step: 1 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const maN = Number(params.ma) || 20;
    const len = bars.length;
    if (len === 0) return { series: [] };

    const obvData: number[] = [0];
    for (let i = 1; i < len; i++) {
      const prev = obvData[i - 1];
      if (bars[i].close > bars[i - 1].close) {
        obvData.push(prev + bars[i].volume);
      } else if (bars[i].close < bars[i - 1].close) {
        obvData.push(prev - bars[i].volume);
      } else {
        obvData.push(prev);
      }
    }

    // OBV MA
    const maData: (number | null)[] = new Array(len).fill(null);
    for (let i = maN - 1; i < len; i++) {
      let sum = 0;
      for (let j = i - maN + 1; j <= i; j++) sum += obvData[j];
      maData[i] = sum / maN;
    }

    return {
      series: [
        { name: 'OBV', color: '#58a6ff', type: 'line', data: obvData, lineWidth: 1 },
        { name: 'OBVMA', color: '#f0ad4e', type: 'line', data: maData, lineWidth: 1 },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    const val = series[0].data[series[0].data.length - 1];
    return [{ label: 'OBV', value: val ?? null, color: '#58a6ff' }];
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const v = series[0].data[series[0].data.length - 1];
    return v != null ? `OBV ${(v / 1e4).toFixed(0)}万` : null;
  },
};

registerIndicator(obv);
