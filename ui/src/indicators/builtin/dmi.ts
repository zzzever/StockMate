import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 DMI/ADX (Directional Movement Index) ───
// 公式:
//   +DM = HIGH - REF(HIGH,1);  -DM = REF(LOW,1) - LOW
//   若 +DM > -DM 且 +DM > 0 则 +DM = +DM, 否则 +DM = 0
//   若 -DM > +DM 且 -DM > 0 则 -DM = -DM, 否则 -DM = 0
//   TR = MAX(ABS(H-L), ABS(H-REF(C,1)), ABS(L-REF(C,1)))
//   +DI = SMA(+DM, N) / SMA(TR, N) × 100
//   -DI = SMA(-DM, N) / SMA(TR, N) × 100
//   ADX = SMA(ABS(+DI - -DI) / (+DI + -DI) × 100, M)
// 经典参数: N=14, M=6
// 用法:
//   +DI 上穿 -DI: 金叉买入
//   -DI 上穿 +DI: 死叉卖出
//   ADX > 25: 趋势行情
//   ADX < 20: 盘整行情

function sma(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const r: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    r.push(i + 1 >= period ? sum / period : NaN);
  }
  return r;
}

const dmi: SubIndicator = {
  id: 'dmi',
  label: 'DMI',
  description: '趋向指标 DMI(14,6)：+DI 上穿 -DI 金叉看多，下穿死叉看空；ADX>25 确认趋势行情，ADX<20 为盘整。',
  category: 'trend',
  complexity: 'advanced',
  tags: ['trend-following'],
  meta: {
    author: 'StockMate',
    version: '1.0.0',
    license: 'MIT',
    source: 'builtin',
    formula: '+DI = SMA(+DM,N)/SMA(TR,N)×100\n-DI = SMA(-DM,N)/SMA(TR,N)×100\nDX = ABS(+DI-(-DI))/(+DI+(-DI))×100\nADX = SMA(DX,M)',
    references: [
      'Wilder, J.W. (1978). "New Concepts in Technical Trading Systems"',
    ],
  },
  params: [
    { key: 'period', label: '周期', type: 'number', default: 14, min: 5, max: 50, step: 1 },
    { key: 'adxPeriod', label: 'ADX周期', type: 'number', default: 6, min: 3, max: 30, step: 1 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const n = Number(params.period) || 14;
    const m = Number(params.adxPeriod) || 6;
    const len = bars.length;

    // +DM, -DM, TR
    const pdm: number[] = [0];
    const mdm: number[] = [0];
    const trArr: number[] = [bars[0].high - bars[0].low];

    for (let i = 1; i < len; i++) {
      const upMove = bars[i].high - bars[i - 1].high;
      const downMove = bars[i - 1].low - bars[i].low;
      pdm.push(upMove > downMove && upMove > 0 ? upMove : 0);
      mdm.push(downMove > upMove && downMove > 0 ? downMove : 0);
      const hl = bars[i].high - bars[i].low;
      const hc = Math.abs(bars[i].high - bars[i - 1].close);
      const lc = Math.abs(bars[i].low - bars[i - 1].close);
      trArr.push(Math.max(hl, hc, lc));
    }

    const smaPdm = sma(pdm, n);
    const smaMdm = sma(mdm, n);
    const smaTr = sma(trArr, n);

    // +DI, -DI
    const pdi: (number | null)[] = new Array(len).fill(null);
    const mdi: (number | null)[] = new Array(len).fill(null);
    const dx: number[] = [];

    for (let i = 0; i < len; i++) {
      if (isNaN(smaTr[i]) || smaTr[i] < 1e-10) {
        pdi[i] = 0;
        mdi[i] = 0;
        dx.push(0);
      } else {
        pdi[i] = (smaPdm[i] / smaTr[i]) * 100;
        mdi[i] = (smaMdm[i] / smaTr[i]) * 100;
        const sum = pdi[i]! + mdi[i]!;
        dx.push(sum < 1e-10 ? 0 : (Math.abs(pdi[i]! - mdi[i]!) / sum) * 100);
      }
    }

    // ADX = SMA(DX, M)
    const adxData: (number | null)[] = new Array(len).fill(null);
    const smaDx = sma(dx, m);
    for (let i = 0; i < len; i++) {
      adxData[i] = isNaN(smaDx[i]) ? null : smaDx[i];
    }

    return {
      series: [
        { name: '+DI', color: '#d0314e', type: 'line', data: pdi, lineWidth: 1 },
        { name: '-DI', color: '#1a8a4a', type: 'line', data: mdi, lineWidth: 1 },
        { name: 'ADX', color: '#f0ad4e', type: 'line', data: adxData, lineWidth: 2 },
        { name: '25', color: '#8b949e', type: 'line', data: new Array(len).fill(25), lineStyle: 'dashed', lineWidth: 1 },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    return series.filter(s => s.name !== '25').map(s => ({
      label: s.name,
      value: s.data[s.data.length - 1] ?? null,
      color: s.color,
    }));
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const pdi = series[0].data[series[0].data.length - 1];
    const mdi = series[1].data[series[1].data.length - 1];
    const adx = series[2].data[series[2].data.length - 1];
    if (pdi == null || mdi == null || adx == null) return null;
    return `+DI ${pdi.toFixed(1)} -DI ${mdi.toFixed(1)} ADX ${adx.toFixed(1)}`;
  },
};

registerIndicator(dmi);
