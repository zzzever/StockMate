import type { SubIndicator, BarData, ComputeResult, LegendItem } from '../types';
import { registerIndicator } from '../registry';

// ─── 通达信 SAR (Parabolic Stop and Reverse) ───
// 公式: SAR(N, M, STEP, MAX)
//   STEP: 加速因子步长 (默认 0.02)
//   MAX:  加速因子上限 (默认 0.2)
// 逻辑:
//   1. 判断趋势方向 (前 N 日涨跌)
//   2. 多头: SAR(i) = SAR(i-1) + AF × (EP - SAR(i-1))
//      空头: SAR(i) = SAR(i-1) + AF × (EP - SAR(i-1))
//      AF 初始值 = STEP, 每创新高/低 AF += STEP, 上限 MAX
//      EP: 多头=最高价, 空头=最低价
// 用法:
//   价格上穿 SAR: 买入信号
//   价格下穿 SAR: 卖出信号

const sar: SubIndicator = {
  id: 'sar',
  label: 'SAR',
  description: '抛物线转向 SAR：价格上穿 SAR 红点为买入信号，下穿绿点为卖出信号；适合追踪止损。',
  category: 'trend',
  complexity: 'advanced',
  tags: ['trend-following'],
  params: [
    { key: 'step', label: '步长', type: 'number', default: 0.02, min: 0.01, max: 0.1, step: 0.01 },
    { key: 'max', label: '上限', type: 'number', default: 0.2, min: 0.1, max: 0.5, step: 0.05 },
  ],

  compute(bars: BarData[], params: Record<string, number | string>): ComputeResult {
    const step = Number(params.step) || 0.02;
    const maxAf = Number(params.max) || 0.2;
    const len = bars.length;

    if (len < 2) {
      return {
        series: [{ name: 'SAR', color: '#f0ad4e', type: 'line', data: new Array(len).fill(null) }],
      };
    }

    // 初始趋势判断: 前 5 日均涨则多头
    const n = Math.min(5, len);
    const firstClose = bars[0].close;
    let bullCount = 0;
    for (let i = 1; i < n; i++) {
      if (bars[i].close > bars[i - 1].close) bullCount++;
    }
    let bull = bullCount >= n / 2;

    let af = step;
    let ep = bull ? bars[0].high : bars[0].low;
    let sarVal = bull ? bars[0].low : bars[0].high;

    const sarData: (number | null)[] = [null];
    const sarColors: (string | undefined)[] = [undefined];

    for (let i = 1; i < len; i++) {
      // 更新 SAR
      let newSar = sarVal + af * (ep - sarVal);

      if (bull) {
        // 多头 SAR 不能高于前两日最低价
        const minLow = Math.min(bars[i - 1].low, i >= 2 ? bars[i - 2].low : bars[i - 1].low);
        newSar = Math.min(newSar, minLow);

        if (bars[i].low < newSar) {
          // 转空
          bull = false;
          newSar = ep; // 翻转点用之前的最高价
          ep = bars[i].low;
          af = step;
        } else {
          if (bars[i].high > ep) {
            ep = bars[i].high;
            af = Math.min(af + step, maxAf);
          }
        }
      } else {
        // 空头 SAR 不能低于前两日最高价
        const maxHigh = Math.max(bars[i - 1].high, i >= 2 ? bars[i - 2].high : bars[i - 1].high);
        newSar = Math.max(newSar, maxHigh);

        if (bars[i].high > newSar) {
          // 转多
          bull = true;
          newSar = ep; // 翻转点用之前的最低价
          ep = bars[i].high;
          af = step;
        } else {
          if (bars[i].low < ep) {
            ep = bars[i].low;
            af = Math.min(af + step, maxAf);
          }
        }
      }

      sarVal = newSar;
      sarData.push(sarVal);
      sarColors.push(bull ? '#d0314e' : '#1a8a4a');
    }

    return {
      series: [
        {
          name: 'SAR',
          color: '#f0ad4e',
          type: 'line',
          data: sarData,
          colors: sarColors,
          lineWidth: 1,
        },
      ],
    };
  },

  legends(bars: BarData[], params: Record<string, number | string>): LegendItem[] {
    const { series } = this.compute(bars, params);
    const val = series[0].data[series[0].data.length - 1];
    return [{ label: 'SAR', value: val ?? null, color: '#f0ad4e' }];
  },

  currentValue(bars: BarData[], params: Record<string, number | string>): string | null {
    const { series } = this.compute(bars, params);
    const v = series[0].data[series[0].data.length - 1];
    if (v == null) return null;
    const last = bars[bars.length - 1];
    const bull = last.close > v;
    return `SAR ${v.toFixed(2)} ${bull ? '↑多' : '↓空'}`;
  },
};

registerIndicator(sar);
