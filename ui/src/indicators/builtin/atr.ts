import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 ATR (Average True Range) ───
// 公式: TR = MAX(ABS(HIGH-LOW), ABS(HIGH-REF(C,1)), ABS(LOW-REF(C,1)))
//       ATR = MA(TR, N)
// 经典参数: N=14
// 用途: 衡量波动率，用于止损设定、仓位管理

const atr: SubIndicator = {
  id: 'atr',
  label: 'ATR',
  description: '平均真实波幅 ATR(14)：衡量波动率，值越大波动越剧烈；常用于设置止损位（如 2.5×ATR）和仓位管理。',
  category: 'volatility',
  complexity: 'intermediate',
  tags: ['breakout'],
  params: [
    { key: 'period', label: '周期', type: 'number', default: 14, min: 5, max: 50, step: 1 },
    { key: 'mul', label: '止损倍数', type: 'number', default: 2.5, min: 1.0, max: 5.0, step: 0.5 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const n = Number(params.period) || 14;
    const mul = Number(params.mul) || 2.5;
    const len = bars.length;

    // True Range
    const tr: number[] = [bars[0].high - bars[0].low];
    for (let i = 1; i < len; i++) {
      const hl = bars[i].high - bars[i].low;
      const hc = Math.abs(bars[i].high - bars[i - 1].close);
      const lc = Math.abs(bars[i].low - bars[i - 1].close);
      tr.push(Math.max(hl, hc, lc));
    }

    // ATR = Wilder's smoothing MA(TR, n)
    const atrData: (number | null)[] = new Array(len).fill(null);
    const stopData: (number | null)[] = new Array(len).fill(null);
    if (n > len) return { series: [{ name: 'ATR', color: '#f0ad4e', type: 'line', data: atrData }] };

    // Seed: SMA of first n TR values
    let atrVal = 0;
    for (let i = 0; i < n; i++) atrVal += tr[i];
    atrVal /= n;
    atrData[n - 1] = atrVal;
    stopData[n - 1] = bars[n - 1].high - mul * atrVal;

    for (let i = n; i < len; i++) {
      atrVal = (atrVal * (n - 1) + tr[i]) / n;
      atrData[i] = atrVal;
      stopData[i] = bars[i].high - mul * atrVal;
    }

    return {
      series: [
        { name: 'ATR', color: '#f0ad4e', type: 'line', data: atrData, lineWidth: 1 },
        { name: '止损线', color: '#d0314e', type: 'line', data: stopData, lineWidth: 1, lineStyle: 'dashed' },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    const val = series[0].data[series[0].data.length - 1];
    return [{ label: 'ATR', value: val ?? null, color: '#f0ad4e' }];
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const v = series[0].data[series[0].data.length - 1];
    return v != null ? `ATR ${v.toFixed(2)}` : null;
  },
};

registerIndicator(atr);
