import { describe, it, expect } from 'vitest';
import { runStrategyCode, validateStrategyCode } from '@/utils/strategyRuntime';
import type { KlineItem } from '@/utils/ruleEngine';

function bar(o: number, h: number, l: number, c: number, v: number): KlineItem {
  return { date: 'd', open: o, high: h, low: l, close: c, volume: v };
}

// Rising then noisy series for indicator smoke tests
const series: KlineItem[] = Array.from({ length: 40 }, (_, i) => {
  const base = 100 + Math.sin(i / 3) * 10 + i * 0.5;
  return bar(base, base + 2, base - 2, base + (i % 2 ? 1 : -1), 1000 + (i % 5) * 100);
});

/** Evaluate an expression at the last bar only. */
function atLast(expr: string, data: KlineItem[]): boolean {
  const n = data.length;
  const hits = runStrategyCode(`i == ${n - 1} && (${expr})`, data);
  return hits.length === 1;
}

describe('SSLang v1.1 — extended indicator whitelist', () => {
  const names = [
    'boll_upper(20, i)', 'boll_middle(20, i)', 'boll_lower(20, i)',
    'kdj_k(i)', 'kdj_d(i)', 'kdj_j(i)', 'wr(14, i)', 'cci(14, i)', 'momentum(5, i)', 'roc(5, i)',
    'atr(14, i)', 'obv(i)', 'volume_ma(5, i)', 'volume_ratio(i)', 'stddev(20, i)', 'bias(20, i)', 'ad(i)',
    'hammer(i)', 'inv_hammer(i)', 'doji(i)', 'engulf_bull(i)', 'engulf_bear(i)',
    'morning_star(i)', 'evening_star(i)', 'gap_up(i)', 'gap_down(i)', 'three_soldiers(i)', 'three_crows(i)',
  ];

  it('validates all new functions as whitelisted', () => {
    for (const expr of names) {
      expect(validateStrategyCode(`${expr} > -999999 || ${expr} == true`).valid, expr).toBe(true);
    }
  });

  it('runs every new function without throwing', () => {
    for (const expr of names) {
      expect(() => runStrategyCode(`${expr} != 0`, series), expr).not.toThrow();
    }
  });
});

describe('SSLang v1.1 — indicator correctness', () => {
  it('boll_upper > boll_middle > boll_lower on a volatile series', () => {
    const n = series.length - 1;
    const up = runStrategyCode(`i == ${n} && boll_upper(20, i) > boll_middle(20, i) && boll_middle(20, i) > boll_lower(20, i)`, series);
    expect(up).toHaveLength(1);
  });

  it('momentum(n, i) equals close(i) - close(i-n)', () => {
    // build controlled data: closes 10,11,...,19
    const d = Array.from({ length: 10 }, (_, i) => bar(10 + i, 11 + i, 9 + i, 10 + i, 1000));
    // momentum(3, 9) = close(9)-close(6) = 19-16 = 3
    expect(atLast('momentum(3, i) == 3', d)).toBe(true);
  });

  it('roc(n, i) is percent change', () => {
    const d = [bar(10, 11, 9, 10, 1), bar(10, 11, 9, 10, 1), bar(10, 11, 9, 12, 1)]; // close 10,10,12
    // roc(2, 2) = (12-10)/10*100 = 20
    expect(atLast('roc(2, i) == 20', d)).toBe(true);
  });

  it('obv accumulates volume by direction', () => {
    // closes: 10, 11(up +100), 10(down -200) → obv: 0, 100, -100
    const d = [bar(10, 11, 9, 10, 500), bar(10, 12, 9, 11, 100), bar(11, 12, 9, 10, 200)];
    expect(atLast('obv(i) == -100', d)).toBe(true);
  });

  it('detects a hammer candle', () => {
    // small body near top, long lower shadow: o=100 c=101 h=101.3 l=95
    const d = [bar(100, 101, 95, 101, 1000), bar(100, 101.3, 95, 101, 1000)];
    expect(atLast('hammer(i)', d)).toBe(true);
  });

  it('detects a bullish engulfing', () => {
    // prev bearish (o=105 c=100), cur bullish engulfing (o=99 c=106)
    const d = [bar(105, 106, 99, 100, 1000), bar(99, 107, 98, 106, 1200)];
    expect(atLast('engulf_bull(i)', d)).toBe(true);
  });

  it('detects a gap up', () => {
    const d = [bar(100, 102, 99, 101, 1000), bar(105, 108, 103, 107, 1000)]; // low 103 > prev high 102
    expect(atLast('gap_up(i)', d)).toBe(true);
  });

  it('detects three white soldiers', () => {
    // 3 rising bars, each a strong bullish body
    const d = [bar(100, 101, 99, 100, 1000), bar(100, 105, 100, 104, 1000), bar(104, 109, 104, 108, 1000), bar(108, 113, 108, 112, 1000)];
    expect(atLast('three_soldiers(i)', d)).toBe(true);
  });

  it('rejects an unknown indicator as invalid', () => {
    expect(validateStrategyCode('bollinger(20, i)').valid).toBe(false);
  });
});
