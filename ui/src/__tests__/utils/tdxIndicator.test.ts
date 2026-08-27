import { describe, it, expect } from 'vitest';
import { compileTdx, type TdxSeriesInput } from '@/utils/tdxIndicator';

// 构造 60 根行情
function bars(): TdxSeriesInput[] {
  const arr: TdxSeriesInput[] = [];
  for (let i = 0; i < 60; i++) {
    const c = 100 + i;
    arr.push({ time: `2025-${String(i + 1).padStart(2, '0')}`, close: c, high: c + 2, low: c - 2, open: c - 1, volume: 1000 + i });
  }
  return arr;
}

describe('compileTdx（通达信公式→副图引擎）', () => {
  it('解析简单输出与常量线，输出序列长度与数据一致', () => {
    const { outputs, error } = compileTdx('MA5:MA(CLOSE,5),COLORWHITE; 强弱:50,COLORRED;', bars());
    expect(error).toBeUndefined();
    expect(outputs.length).toBe(2);
    expect(outputs[0].type).toBe('line');
    expect(outputs[0].series.length).toBe(60);
    // MA5 前 4 个为空，第 5 个 = (100+101+102+103+104)/5 = 102
    expect(outputs[0].series[3]).toBeNull();
    expect(outputs[0].series[4]).toBeCloseTo(102);
    // 常量线每根相同
    expect(outputs[1].series.every(v => v === 50)).toBe(true);
  });

  it('支持 LLV/HHV/REF/CROSS 并缓存变量', () => {
    const src = 'LLV20:=LLV(LOW,20); HHV20:=HHV(HIGH,20); 区间:(CLOSE-LLV20)/(HHV20-LLV20),COLORGREEN;';
    const { outputs, error } = compileTdx(src, bars());
    expect(error).toBeUndefined();
    expect(outputs.length).toBe(1);
    // LLV20 在最后接近 close-2，HHV20 接近 close+2，区间约 0.5
    const last = outputs[0].series[outputs[0].series.length - 1];
    expect(last).not.toBeNull();
    expect(last!).toBeGreaterThanOrEqual(0);
    expect(last!).toBeLessThanOrEqual(1.01);
  });

  it('支持 CROSS 与 REF', () => {
    // 价格一路上行：CLOSE 始终>REF(CLOSE,1)，无上穿（CROSS 需从下穿到上）
    const { outputs } = compileTdx('上穿:CROSS(CLOSE,MA(CLOSE,5)),COLORYELLOW;', bars());
    const s = outputs[0].series;
    // 至少最后为 0（上行中不上穿）
    expect(s[s.length - 1]).toBe(0);
  });

  it('支持 STICKLINE 柱输出', () => {
    const { outputs } = compileTdx('STICKLINE(CLOSE>OPEN,CLOSE,OPEN);', bars());
    expect(outputs.some(o => o.type === 'stick')).toBe(true);
    const stick = outputs.find(o => o.type === 'stick')!;
    // 全部 close>open，柱应有值
    expect(stick.series.some(v => v != null)).toBe(true);
  });

  it('非法公式返回错误而非抛异常', () => {
    const { error } = compileTdx('MA5=MA(CLOSE,5', bars());
    expect(error).toBeTruthy();
  });
});
