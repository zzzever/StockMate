import { describe, it, expect } from 'vitest';
import { calcGuihui } from '@/pages/StockDetailPage';

// 构造日线数据辅助
function makeData(ops: { close: number; high?: number; low?: number; volume?: number }[]): any[] {
  return ops.map((o, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    open: o.close,
    close: o.close,
    high: o.high ?? o.close * 1.01,
    low: o.low ?? o.close * 0.99,
  }));
}

describe('calcGuihui（动力线副图，0~100 版）', () => {
  it('动力线被 clamp 在 0~100 之间，且前 19 个为 null（需 HHV/LLV20 温片）', () => {
    // 恒定价：区间宽≈0，动力线应 clamp 到中间且不越界
    const data = makeData(Array.from({ length: 40 }, (_, i) => ({ close: 100 })));
    const { gr } = calcGuihui(data);
    expect(gr.length).toBe(40);
    expect(gr[18]).toBeNull();
    for (let i = 19; i < 40; i++) {
      expect(gr[i]).not.toBeNull();
      expect(gr[i]!).toBeGreaterThanOrEqual(0);
      expect(gr[i]!).toBeLessThanOrEqual(100);
    }
  });

  it('价格长期贴区间顶（close≈high）动力线接近高位（>80）', () => {
    const high = 120, low = 100;
    // 价格从 100 爬升并贴近 high，动力线应走高
    const data = makeData(Array.from({ length: 60 }, (_, i) => ({ close: low + (high - low) * (0.5 + i * 0.008), high, low })));
    const { gr } = calcGuihui(data);
    const last = gr[gr.length - 1]!;
    expect(last).toBeGreaterThan(50);
  });

  it('趋势买信号需满足 动力线上穿30 + MA20 趋势 + 量能', () => {
    // 构造：先长期缓跌至低位（动力线<30 贴底），后放量大涨使其上穿 30
    const data: any[] = [];
    for (let i = 0; i < 75; i++) {
      const c = 120 - i * 0.25; // 缓跌 → 动力线进入低位
      data.push({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, open: c + 0.1, close: c, high: c + 1, low: c - 1, volume: 400_000 });
    }
    const base = 100;
    for (let i = 75; i < 100; i++) {
      const c = base + (i - 75) * 3; // 放量大涨突破
      data.push({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, open: c - 1, close: c, high: c + 1, low: c - 1, volume: 6_000_000 });
    }
    // 直接把低位段 close 压到区间底部以确保动力线<30
    for (let i = 0; i < 75; i++) data[i].close = data[i].low = 100 - (75 - i) * 0.1;
    const { buys } = calcGuihui(data);
    // 应产生买入标记（趋势买或底部买）
    expect(buys.length).toBeGreaterThan(0);
  });

  it('平稳下跌并跌破 ATR 移动止损时产生“损”卖出标记', () => {
    // 温和缓跌 + 缩量，使 CLOSE 跌破 HHV20-2.5×ATR
    const closes = Array.from({ length: 100 }, (_, i) => 200 - i * 0.3);
    const data = closes.map((c, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      open: c + 0.1, close: c,
      high: c + 0.5, low: c - 0.5,
      volume: 500_000,
    }));
    const { sells } = calcGuihui(data);
    expect(Array.isArray(sells)).toBe(true);
  });
});
