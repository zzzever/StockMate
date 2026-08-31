import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 BRAR (情绪指标) ───
// 公式:
//   AR = SUM(HIGH - OPEN, N) / SUM(OPEN - LOW, N) × 100
//   BR = SUM(MAX(0, HIGH - REF(C,1)), N) / SUM(MAX(0, REF(C,1) - LOW), N) × 100
// 经典参数: N=26
// 用法:
//   AR > 180: 高位，可能见顶
//   AR < 50: 低位，可能见底
//   BR > 300: 情绪过热
//   BR < 50: 情绪低迷
//   BRAR 同时高: 风险
//   BRAR 同时低: 机会

const brar: SubIndicator = {
  id: 'brar',
  label: 'BRAR',
  description: '情绪指标 AR/BR(26)：AR 衡量买卖气势，BR 衡量买卖意愿；AR>180/BR>300 过热警惕，AR<50/BR<50 过冷关注。',
  category: 'oscillator',
  complexity: 'advanced',
  tags: ['reversal'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: 'AR = SUM(HIGH-OPEN,N)/SUM(OPEN-LOW,N)×100\nBR = SUM(MAX(0,HIGH-REF(C,1)),N)/SUM(MAX(0,REF(C,1)-LOW),N)×100',
    references: [
      'AR/BR 指标源自日本技术分析',
    ],
  },
  params: [
    { key: 'period', label: '周期', type: 'number', default: 26, min: 5, max: 60, step: 1 },
    { key: 'arHigh', label: 'AR高位', type: 'number', default: 180, min: 100, max: 300, step: 10 },
    { key: 'brHigh', label: 'BR高位', type: 'number', default: 300, min: 150, max: 500, step: 10 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const n = Number(params.period) || 26;
    const arHigh = Number(params.arHigh) || 180;
    const brHigh = Number(params.brHigh) || 300;
    const len = bars.length;

    const arData: (number | null)[] = new Array(len).fill(null);
    const brData: (number | null)[] = new Array(len).fill(null);

    for (let i = n - 1; i < len; i++) {
      let sumHo = 0, sumOl = 0; // AR
      let sumBrUp = 0, sumBrDn = 0; // BR

      for (let j = i - n + 1; j <= i; j++) {
        sumHo += bars[j].high - bars[j].open;
        sumOl += bars[j].open - bars[j].low;

        if (j > 0) {
          const prevC = bars[j - 1].close;
          sumBrUp += Math.max(0, bars[j].high - prevC);
          sumBrDn += Math.max(0, prevC - bars[j].low);
        }
      }

      arData[i] = sumOl < 1e-10 ? 100 : (sumHo / sumOl) * 100;
      brData[i] = sumBrDn < 1e-10 ? 100 : (sumBrUp / sumBrDn) * 100;
    }

    return {
      series: [
        { name: 'AR', color: '#58a6ff', type: 'line', data: arData, lineWidth: 1 },
        { name: 'BR', color: '#e879f9', type: 'line', data: brData, lineWidth: 1 },
        { name: 'AR高', color: '#d0314e', type: 'line', data: new Array(len).fill(arHigh), lineStyle: 'dashed', lineWidth: 1 },
        { name: 'BR高', color: '#d0314e', type: 'line', data: new Array(len).fill(brHigh), lineStyle: 'dashed', lineWidth: 1 },
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
    const ar = series[0].data[series[0].data.length - 1];
    const br = series[1].data[series[1].data.length - 1];
    if (ar == null || br == null) return null;
    return `AR ${ar.toFixed(0)} BR ${br.toFixed(0)}`;
  },
};

registerIndicator(brar);
