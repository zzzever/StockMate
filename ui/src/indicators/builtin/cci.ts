import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 CCI (Commodity Channel Index) ───
// 公式: CCI = (TP - MA(TP,N)) / (0.015 * MD(TP,N))
// TP = (HIGH + LOW + CLOSE) / 3
// MD = 平均偏差 (Mean Deviation)
// 经典参数: N=14
// 用法:
//   CCI > 100: 超买区，可能见顶
//   CCI < -100: 超卖区，可能见底
//   CCI 从下向上穿越 ±100: 趋势确认信号

const cci: SubIndicator = {
  id: 'cci',
  label: 'CCI',
  description: '顺势指标 CCI(14)：CCI>100 超买警惕回调，CCI<-100 超卖关注反弹；±100 穿越为趋势确认信号。',
  category: 'oscillator',
  complexity: 'intermediate',
  tags: ['trend-following', 'breakout'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: 'TP = (HIGH + LOW + CLOSE) / 3\nCCI = (TP - MA(TP,N)) / (0.015 × MD(TP,N))',
    references: [
      'Donald Lambert (1980). "Techniques of Commodity Channel Index"',
    ],
  },
  params: [
    { key: 'period', label: '周期', type: 'number', default: 14, min: 5, max: 100, step: 1 },
    { key: 'overbought', label: '超买线', type: 'number', default: 100, min: 50, max: 300, step: 10 },
    { key: 'oversold', label: '超卖线', type: 'number', default: -100, min: -300, max: -50, step: 10 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const n = Number(params.period) || 14;
    const overbought = Number(params.overbought) || 100;
    const oversold = Number(params.oversold) || -100;
    const len = bars.length;

    // TP = (H + L + C) / 3
    const tp = bars.map(b => (b.high + b.low + b.close) / 3);
    const cciData: (number | null)[] = new Array(len).fill(null);

    for (let i = n - 1; i < len; i++) {
      // MA(TP, N)
      let sum = 0;
      for (let j = i - n + 1; j <= i; j++) sum += tp[j];
      const ma = sum / n;

      // MD = 平均偏差
      let mdSum = 0;
      for (let j = i - n + 1; j <= i; j++) mdSum += Math.abs(tp[j] - ma);
      const md = mdSum / n;

      // CCI
      if (md < 1e-10) {
        cciData[i] = 0;
      } else {
        cciData[i] = (tp[i] - ma) / (0.015 * md);
      }
    }

    return {
      series: [
        { name: 'CCI', color: '#e879f9', type: 'line', data: cciData, lineWidth: 1 },
        { name: '+100', color: '#d0314e', type: 'line', data: new Array(len).fill(overbought), lineStyle: 'dashed', lineWidth: 1 },
        { name: '-100', color: '#1a8a4a', type: 'line', data: new Array(len).fill(oversold), lineStyle: 'dashed', lineWidth: 1 },
        { name: '0轴', color: '#8b949e', type: 'line', data: new Array(len).fill(0), lineStyle: 'solid', lineWidth: 1 },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    const val = series[0].data[series[0].data.length - 1];
    return [{ label: 'CCI', value: val ?? null, color: '#e879f9' }];
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const v = series[0].data[series[0].data.length - 1];
    return v != null ? `CCI ${v.toFixed(1)}` : null;
  },
};

registerIndicator(cci);
