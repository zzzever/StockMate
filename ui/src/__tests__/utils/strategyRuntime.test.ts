import { describe, it, expect } from 'vitest';
import { runStrategyCode, validateStrategyCode, parseSSLang, runSSLang, StrategyCodeError } from '@/utils/strategyRuntime';
import type { KlineItem } from '@/utils/ruleEngine';

function bar(date: string, o: number, h: number, l: number, c: number, v: number): KlineItem {
  return { date, open: o, high: h, low: l, close: c, volume: v };
}

describe('strategyRuntime — validateStrategyCode (sandbox whitelist)', () => {
  it('accepts a valid expression', () => {
    expect(validateStrategyCode("i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1)").valid).toBe(true);
  });
  it('accepts decorated code with // comment and => SIGNAL()', () => {
    expect(validateStrategyCode("// 连续缩量下跌反弹\ndown(i-1,3) && close(i) > close(i-1) => SIGNAL('buy')").valid).toBe(true);
  });
  it('rejects access to window / fetch / constructor', () => {
    expect(validateStrategyCode('window').valid).toBe(false);
    expect(validateStrategyCode('fetch(1)').valid).toBe(false);
    expect(validateStrategyCode('close.constructor').valid).toBe(false); // '.' is illegal char → parse error
  });
  it('rejects unknown functions', () => {
    expect(validateStrategyCode('hack(1, 2)').valid).toBe(false);
  });
  it('rejects assignment / illegal characters', () => {
    expect(validateStrategyCode('close[i] = 100').valid).toBe(false);
  });
  it('rejects empty code', () => {
    expect(validateStrategyCode('   ').valid).toBe(false);
  });
});

describe('strategyRuntime — runStrategyCode (arithmetic / logic / helpers)', () => {
  const data: KlineItem[] = [
    bar('d0', 100, 101, 99, 100, 1000),
    bar('d1', 100, 101, 98, 99, 900),
    bar('d2', 99, 100, 97, 98, 800),
    bar('d3', 98, 99, 96, 97, 700),
    bar('d4', 97, 101, 96, 99, 1200),
  ];

  it('evaluates comparison + logical operators per bar', () => {
    const hits = runStrategyCode('close(i) > 98', data).map((h) => h.index);
    expect(hits).toEqual([0, 1, 4]); // closes: 100,99,98,97,99 → >98 at 0(100),1(99),4(99)
  });

  it('runs the reported pattern: 连续三天缩量下跌后次日上涨', () => {
    const hits = runStrategyCode('i >= 4 && down(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1)', data);
    expect(hits).toHaveLength(1);
    expect(hits[0].index).toBe(4);
  });

  it('supports sma() and cross()', () => {
    // rising series → sma(2,i) crosses above sma(3,i) somewhere; just assert it runs & returns booleans
    const rising: KlineItem[] = Array.from({ length: 10 }, (_, i) => bar(`d${i}`, 10 + i, 11 + i, 9 + i, 10 + i, 1000));
    expect(() => runStrategyCode('cross(sma(2, i), sma(3, i))', rising)).not.toThrow();
  });

  it('out-of-range index yields no crash (null → false)', () => {
    expect(runStrategyCode('close[i-10] > 0', data)).toEqual([]);
  });

  it('division by zero does not crash', () => {
    expect(() => runStrategyCode('close(i) / 0 > 0', data)).not.toThrow();
  });

  it('throws StrategyCodeError on parse error', () => {
    expect(() => runStrategyCode('close(i +', data)).toThrow(StrategyCodeError);
  });

  it('throws on forbidden identifier at runtime path', () => {
    expect(() => runStrategyCode('window', data)).toThrow(StrategyCodeError);
  });
});

describe('SSLang parser — parseSSLang', () => {
  it('parses a single RULE block correctly', () => {
    const src = `RULE "金叉买入"
  SIGNAL BUY
  WHEN cross(sma(5, i), sma(10, i))
  NOTE "5日线上穿10日线"`;
    const rules = parseSSLang(src);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ name: '金叉买入', signal: 'buy', expression: 'cross(sma(5, i), sma(10, i))', explanation: '5日线上穿10日线' });
  });

  it('parses multiple RULE blocks with mixed signals', () => {
    const src = `
RULE "买入规则"  SIGNAL BUY  WHEN close(i) > sma(20, i)  NOTE "价格高于20日线"
RULE "卖出规则"  SIGNAL SELL WHEN close(i) < sma(20, i)  NOTE "价格低于20日线"
RULE "提醒"      SIGNAL ALERT WHEN rsi(14, i) > 70    NOTE "RSI过热"
`;
    const rules = parseSSLang(src);
    expect(rules).toHaveLength(3);
    expect(rules[0].signal).toBe('buy');
    expect(rules[0].expression).toBe('close(i) > sma(20, i)');
    expect(rules[1].signal).toBe('sell');
    expect(rules[2].signal).toBe('alert');
  });

  it('falls back to legacy expression when no RULE blocks found', () => {
    const rules = parseSSLang("down(i-1, 3) && close(i) > close(i-1) => SIGNAL('buy')");
    expect(rules).toHaveLength(1);
    expect(rules[0].expression).toBe('down(i-1, 3) && close(i) > close(i-1)');
    expect(rules[0].signal).toBe('buy');
  });

  it('returns empty for blank text', () => {
    expect(parseSSLang('-- comment only\n   \n-- another comment')).toEqual([]);
  });

  it('skips unrecognised lines between rules and continues parsing', () => {
    const src = `
RULE "第一"  SIGNAL BUY  WHEN close(i) > open(i)  NOTE "a"
some junk line
RULE "第二"  SIGNAL SELL WHEN close(i) < open(i)  NOTE "b"
`;
    const rules = parseSSLang(src);
    expect(rules).toHaveLength(2);
  });

  it('rejects a RULE block without SIGNAL or WHEN as invalid (skips it)', () => {
    const src = `RULE "Bad"  NOTE "missing signal and when"`;
    expect(parseSSLang(src)).toEqual([]);
  });
});

describe('SSLang runtime — runSSLang', () => {
  const data = [
    { date: 'd0', open: 100, high: 101, low: 99, close: 100, volume: 1000 },
    { date: 'd1', open: 100, high: 101, low: 98, close: 99, volume: 900 },
    { date: 'd2', open: 99, high: 100, low: 97, close: 98, volume: 800 },
    { date: 'd3', open: 98, high: 99, low: 96, close: 97, volume: 700 },
    { date: 'd4', open: 97, high: 101, low: 96, close: 99, volume: 1200 },
  ] as any;

  it('runs a multi-rule SSLang text and returns hits with rule names and signals', () => {
    const src = `
RULE "连跌"  SIGNAL SELL WHEN down(i, 3)  NOTE "连续3天下跌"
RULE "反弹"  SIGNAL BUY  WHEN i>=4 && down(i-1,3) && close(i) > close(i-1)  NOTE "缩量跌后反弹"
`;
    const hits = runSSLang(src, data);
    expect(hits.some((h) => h.ruleName === '连跌' && h.signal === 'sell')).toBe(true);
    expect(hits.some((h) => h.ruleName === '反弹' && h.signal === 'buy')).toBe(true);
  });

  it('a broken expression inside one RULE does not crash the entire evaluation', () => {
    const src = `
RULE "好规则"  SIGNAL BUY  WHEN close(i) > 0  NOTE "ok"
RULE "坏规则"  SIGNAL BUY  WHEN close(i +  NOTE "parse error"
`;
    expect(() => runSSLang(src, data)).not.toThrow();
    const hits = runSSLang(src, data);
    expect(hits.some((h) => h.ruleName === '好规则')).toBe(true);
  });
});

// ── green_fat / red_fat — volume-price correlation ──
// 中国股市：红=涨(阳线, close>open), 绿=跌(阴线, close<open)
// green_fat = 绿肥红瘦 = 跌放量 ∨ 涨缩量 → bearish
// red_fat   = 绿瘦红肥 = 涨放量 ∨ 跌缩量 → bullish

describe('strategyRuntime — green_fat / red_fat', () => {
  it('green_fat counts down+vol_up and up+vol_down bars (绿肥红瘦, bearish)', () => {
    const data: KlineItem[] = [
      bar('d0', 10, 11, 9, 11, 100),   // up(红), j=0 skipped
      bar('d1', 11, 12, 10, 12, 200),   // up(红)+vol_up → red_fat, NOT green_fat
      bar('d2', 12, 11, 9, 10, 80),     // down(绿)+vol_down → red_fat, NOT green_fat
      bar('d3', 10, 11, 9, 11, 60),     // up(红)+vol_down → green_fat ✓
      bar('d4', 11, 12, 10, 10, 200),   // down(绿)+vol_up → green_fat ✓
    ];
    // green_fat(4,3) = j=0..3 → j=1:✗, j=2:✗, j=3:up+vol_down ✓ → 1, <2
    // green_fat(4,4) = j=1..4 → j=1:✗, j=2:✗, j=3:✓, j=4:down+vol_up ✓ → 2, >=2 ✓
    const hits = runStrategyCode('green_fat(4, i) >= 2', data);
    expect(hits).toHaveLength(1);
    expect(hits[0].index).toBe(4);
  });

  it('red_fat counts up+vol_up and down+vol_down bars (绿瘦红肥, bullish)', () => {
    const data: KlineItem[] = [
      bar('d0', 10, 11, 9, 11, 100),   // j=0 skipped
      bar('d1', 11, 12, 10, 12, 200),   // up(红)+vol_up → red_fat ✓
      bar('d2', 12, 11, 9, 10, 80),     // down(绿)+vol_down → red_fat ✓
      bar('d3', 10, 11, 9, 11, 60),     // up(红)+vol_down → green_fat
      bar('d4', 11, 12, 10, 10, 200),   // down(绿)+vol_up → green_fat
    ];
    // red_fat(4,3) = j=0..3 → j=1:✓, j=2:✓, j=3:✗ → 2, >=2 ✓ at bar 3
    // red_fat(4,4) = j=1..4 → j=1:✓, j=2:✓, j=3:✗, j=4:✗ → 2, >=2 ✓ at bar 4
    const hits = runStrategyCode('red_fat(4, i) >= 2', data);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((h) => h.index === 3)).toBe(true);
    expect(hits.some((h) => h.index === 4)).toBe(true);
  });

  it('green_fat returns 0 when n<=0 or out of range', () => {
    const data: KlineItem[] = [
      bar('d0', 10, 11, 9, 11, 100),
      bar('d1', 11, 12, 10, 12, 200),
    ];
    expect(runStrategyCode('green_fat(0, i) > 0', data)).toEqual([]);
    expect(runStrategyCode('green_fat(3, 100)', data)).toEqual([]);
  });

  it('绿肥红瘦 SSLang rule block with SELL signal', () => {
    const data: KlineItem[] = [
      bar('d0', 10, 11, 9, 11, 100),   // up(红), j=0 base
      bar('d1', 11, 12, 10, 12, 200),   // up(红)+vol_up → red_fat
      bar('d2', 11, 11, 9, 10, 80),     // down(绿)+vol_down → red_fat
      bar('d3', 9, 10, 8, 9.5, 60),     // up(红)+vol_down → green_fat ✓
      bar('d4', 9.5, 10, 8.5, 9, 200),  // down(绿)+vol_up → green_fat ✓
      bar('d5', 9, 10, 8, 9.5, 50),     // up(红)+vol_down → green_fat ✓
      bar('d6', 9.5, 10, 8.5, 9, 300),  // down(绿)+vol_up → green_fat ✓
    ];
    // green_fat(5,6) = j=2..6 → d2:✗, d3:✓, d4:✓, d5:✓, d6:✓ → 4 >= 3 → hits
    const src = 'RULE "绿肥红瘦"  SIGNAL SELL  WHEN green_fat(5, i) >= 3  NOTE "量价背离"';
    const hits = runSSLang(src, data as any);
    expect(hits.some((h) => h.ruleName === '绿肥红瘦' && h.signal === 'sell')).toBe(true);
  });
});
