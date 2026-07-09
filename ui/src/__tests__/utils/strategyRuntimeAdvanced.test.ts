import { describe, it, expect } from 'vitest';
import { runStrategyCode, parseSSLang } from '@/utils/strategyRuntime';
import type { KlineItem } from '@/utils/ruleEngine';

function bar(o: number, h: number, l: number, c: number, v: number): KlineItem {
  return { date: 'd', open: o, high: h, low: l, close: c, volume: v };
}
function dbar(date: string, o: number, h: number, l: number, c: number, v: number): KlineItem {
  return { date, open: o, high: h, low: l, close: c, volume: v };
}
/** true iff expr holds at the last bar */
function atLast(expr: string, data: KlineItem[]): boolean {
  return runStrategyCode(`i == ${data.length - 1} && (${expr})`, data).length === 1;
}

describe('SSLang runtime — safety fixes', () => {
  const data = [bar(10, 11, 9, 10, 100), bar(10, 12, 9, 11, 120)];

  it('NaN index does not crash (returns null → no hit, no throw)', () => {
    expect(() => runStrategyCode('close(0/0) > 0', data)).not.toThrow();
    expect(runStrategyCode('close(0/0) > 0', data)).toEqual([]);
    expect(() => runStrategyCode('close[i % 0] > 0', data)).not.toThrow();
  });

  it('truthy(NaN) is false (0/0 is falsy)', () => {
    // close(i)*0 = 0; 0/0 = NaN; !NaN → true only if NaN is falsy
    expect(atLast('!(close(i) * 0 / 0)', data)).toBe(true);
    expect(runStrategyCode('(close(i) * 0 / 0) && true', data)).toEqual([]);
  });

  it('supports -- line comments (SSLang spec)', () => {
    // -- runs to end of line; close(i) > 0 holds on both bars
    expect(runStrategyCode('close(i) > 0 -- 这是注释', data)).toHaveLength(2);
    const rules = parseSSLang('RULE "t"\n  SIGNAL BUY\n  WHEN close(i) > 0 -- 高于零\n  NOTE "d"');
    expect(rules).toHaveLength(1);
    expect(rules[0].expression.trim()).toBe('close(i) > 0');
  });
});

describe('SSLang runtime — statistical / aggregate functions', () => {
  const d = [bar(10, 12, 8, 11, 100), bar(11, 12, 9, 10, 100), bar(10, 13, 9, 12, 100), bar(12, 14, 11, 13, 100)];
  // close>open: b0 yes, b1 no, b2 yes, b3 yes

  it('count_true counts truthy bars in window', () => {
    expect(atLast('count_true(close(i) > open(i), 4, i) == 3', d)).toBe(true);
  });
  it('consecutive detects an unbroken run', () => {
    expect(atLast('consecutive(close(i) > open(i), 2, i)', d)).toBe(true);  // b2,b3
    expect(atLast('consecutive(close(i) > open(i), 3, i)', d)).toBe(false); // b1 breaks it
  });
  it('highest_of / lowest_of over an expression window', () => {
    expect(atLast('highest_of(close(i), 4, i) == 13', d)).toBe(true);
    expect(atLast('lowest_of(close(i), 4, i) == 10', d)).toBe(true);
  });
  it('is_high_n / is_low_n new-high / new-low', () => {
    expect(atLast('is_high_n(4, i)', d)).toBe(true);   // close 13 is highest
    expect(atLast('is_low_n(4, i)', d)).toBe(false);
  });
});

describe('SSLang runtime — indicator correctness fixes', () => {
  it('EMA returns null during warmup (only hits from index n-1)', () => {
    const rising = Array.from({ length: 5 }, (_, i) => bar(10 + i, 11 + i, 9 + i, 10 + i, 100));
    const hits = runStrategyCode('ema(5, i) > 0', rising).map((h) => h.index);
    expect(hits).toEqual([4]); // null for i<4, value at i=4
  });

  it('ATR uses Wilder smoothing with SMA seed', () => {
    // TR: b0=2, b1=max(3,3,0)=3, b2=max(2,2,0)=2 ; atr(2): [null, 2.5, 2.25]
    const d = [bar(9, 10, 8, 9, 1), bar(11, 12, 9, 11, 1), bar(12, 13, 11, 12, 1)];
    expect(runStrategyCode('i==1 && atr(2, i) > 2.49 && atr(2, i) < 2.51', d)).toHaveLength(1);
    expect(runStrategyCode('i==2 && atr(2, i) > 2.24 && atr(2, i) < 2.26', d)).toHaveLength(1);
    expect(runStrategyCode('i==0 && atr(2, i) > 0', d)).toEqual([]); // null warmup
  });

  it('stddev matches Bollinger band half-width (both population stddev)', () => {
    const d = Array.from({ length: 10 }, (_, i) => bar(100 + i, 102 + i, 98 + i, 100 + (i % 3), 100));
    // boll_upper - boll_middle == 2 * stddev
    expect(atLast('boll_upper(5, i) - boll_middle(5, i) > 2 * stddev(5, i) - 0.0001 && boll_upper(5, i) - boll_middle(5, i) < 2 * stddev(5, i) + 0.0001', d)).toBe(true);
  });
});

describe('SSLang runtime — limit up/down and multi-timeframe', () => {
  it('is_limit_up / is_limit_down (≈10% + closed at extreme)', () => {
    const up = [bar(10, 10, 9.5, 10, 100), bar(10, 11.0, 10, 11.0, 100)]; // +10%, close==high
    expect(atLast('is_limit_up(i)', up)).toBe(true);
    const notUp = [bar(10, 10, 9.5, 10, 100), bar(10, 11.0, 10, 10.5, 100)]; // close != high
    expect(atLast('is_limit_up(i)', notUp)).toBe(false);
    const down = [bar(10, 10, 9.5, 10, 100), bar(10, 10, 9.0, 9.0, 100)]; // -10%, close==low
    expect(atLast('is_limit_down(i)', down)).toBe(true);
  });

  it('tf() evaluates on the last COMPLETED weekly bar (no lookahead)', () => {
    // 3 Mon-Fri weeks; each week closes at 10, 20, 30 respectively
    const d: KlineItem[] = [];
    const weeks = [['2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10'],
                   ['2025-01-13', '2025-01-14', '2025-01-15', '2025-01-16', '2025-01-17'],
                   ['2025-01-20', '2025-01-21', '2025-01-22', '2025-01-23', '2025-01-24']];
    const weekClose = [10, 20, 30];
    weeks.forEach((wk, wi) => wk.forEach((date, di) => d.push(dbar(date, 5, 35, 1, di === wk.length - 1 ? weekClose[wi] : 5 + di, 100))));
    // At the last daily bar (in week3), the last COMPLETED week is week2 → weekly close 20
    expect(atLast('tf(close(i), "week") == 20', d)).toBe(true);
    // In week1 (no completed prior week) → tf returns null → no hit
    expect(runStrategyCode('i == 2 && tf(close(i), "week") > 0', d)).toEqual([]);
  });
});
