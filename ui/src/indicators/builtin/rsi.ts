import type { SubIndicator, BarData, LegendItem, ComputeResult } from '../types';
import { registerIndicator } from '../registry';

const rsi: SubIndicator = {
  id: 'rsi',
  label: 'RSI',
  description: 'RSI 相对强弱指标(14)：>70 超买区警惕回调，<30 超卖区关注反弹；50 为多空分界。',
  category: 'oscillator',
  complexity: 'basic',
  tags: ['reversal', 'momentum'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: 'RS = EMA(MAX(CLOSE-REF(C,1),0), N) / EMA(ABS(CLOSE-REF(C,1)), N)\nRSI = 100 - 100/(1+RS)',
    references: [
      'Wilder, J.W. (1978). "New Concepts in Technical Trading Systems"',
    ],
  },
  params: [
    { key: 'period', label: '周期', type: 'number', default: 14, min: 2, max: 50, step: 1 },
    { key: 'overbought', label: '超买线', type: 'number', default: 70, min: 50, max: 95, step: 5 },
    { key: 'oversold', label: '超卖线', type: 'number', default: 30, min: 5, max: 50, step: 5 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const period = Number(params.period) || 14;
    const overbought = Number(params.overbought) || 70;
    const oversold = Number(params.oversold) || 30;
    const closes = bars.map(b => b.close);
    const n = closes.length;

    const rsiData: (number | null)[] = new Array(n).fill(null);

    if (n < period + 1) {
      for (let i = 0; i < n; i++) rsiData[i] = 50;
      return {
        series: [
          { name: 'RSI', color: '#4a90d9', type: 'line', data: rsiData, lineWidth: 1 },
          { name: '超买', color: 'rgba(208,49,78,0.15)', type: 'line', data: new Array(n).fill(overbought), lineStyle: 'dashed', lineWidth: 1 },
          { name: '超卖', color: 'rgba(26,138,74,0.15)', type: 'line', data: new Array(n).fill(oversold), lineStyle: 'dashed', lineWidth: 1 },
        ],
      };
    }

    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    for (let i = 0; i <= period; i++) rsiData[i] = 50;

    if (avgLoss < 1e-9 && avgGain < 1e-9) {
      rsiData[period] = 50;
    } else if (avgLoss < 1e-9) {
      rsiData[period] = 100;
    } else {
      rsiData[period] = Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
    }

    for (let i = period + 1; i < n; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss < 1e-9 && avgGain < 1e-9) rsiData[i] = 50;
      else if (avgLoss < 1e-9) rsiData[i] = 100;
      else rsiData[i] = Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
    }

    const constLine = (val: number) => new Array(n).fill(val);

    return {
      series: [
        { name: 'RSI', color: '#4a90d9', type: 'line', data: rsiData, lineWidth: 1 },
        { name: '超买', color: 'rgba(208,49,78,0.15)', type: 'line', data: constLine(overbought), lineStyle: 'dashed', lineWidth: 1 },
        { name: '超卖', color: 'rgba(26,138,74,0.15)', type: 'line', data: constLine(oversold), lineStyle: 'dashed', lineWidth: 1 },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    const rsiLine = series[0];
    const lastVal = rsiLine.data[rsiLine.data.length - 1];
    return [{ label: 'RSI', value: lastVal ?? null, color: '#4a90d9' }];
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const lastVal = series[0].data[series[0].data.length - 1];
    if (lastVal == null) return null;
    return `RSI ${lastVal.toFixed(1)}`;
  },
};

registerIndicator(rsi);
