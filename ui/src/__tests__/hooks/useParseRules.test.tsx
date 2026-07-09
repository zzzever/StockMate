import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useParseRules } from '@/hooks/useParseRules';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
import { invoke } from '@tauri-apps/api/core';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useParseRules — three-way dispatch (local / AI / merge)', () => {
  beforeEach(() => { vi.mocked(invoke).mockReset(); });

  it('Case 2: fully local match returns condition rules WITHOUT calling the AI', async () => {
    const { result } = renderHook(() => useParseRules(), { wrapper });
    const rules = await result.current.mutateAsync({ stockId: 'x', rules: '连续三天缩量下跌' });
    expect(invoke).not.toHaveBeenCalled();
    expect(rules[0].kind).toBe('condition');
  });

  it('Case 1: no local match → calls generate_rule_code and maps to code rules', async () => {
    vi.mocked(invoke).mockResolvedValue([
      { name: 'MA上方', code: 'close(i) > sma(20, i)', explanation: '价格高于20日线', signal: 'buy' },
    ] as any);
    const { result } = renderHook(() => useParseRules(), { wrapper });
    const rules = await result.current.mutateAsync({ stockId: 'x', rules: '帮我看看这只票怎么样' });
    expect(invoke).toHaveBeenCalledWith('generate_rule_code', { rules: '帮我看看这只票怎么样' });
    expect(rules).toHaveLength(1);
    expect(rules[0].kind).toBe('code');
    expect(rules[0].code).toBe('close(i) > sma(20, i)');
  });

  it('Case 1: invalid AI code is filtered out by validateStrategyCode', async () => {
    vi.mocked(invoke).mockResolvedValue([
      { name: 'ok', code: 'close(i) > 0', explanation: '', signal: 'buy' },
      { name: 'bad', code: 'window && fetch(1)', explanation: '', signal: 'buy' },
    ] as any);
    const { result } = renderHook(() => useParseRules(), { wrapper });
    const rules = await result.current.mutateAsync({ stockId: 'x', rules: '随便写点' });
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('ok');
  });

  it('Case 3: partial + advanced concept → local rule kept AND AI called, merged', async () => {
    vi.mocked(invoke).mockResolvedValue([
      { name: 'AI趋势规则', code: 'above_ma(20, i)', explanation: '上升趋势', signal: 'buy' },
    ] as any);
    const { result } = renderHook(() => useParseRules(), { wrapper });
    const rules = await result.current.mutateAsync({ stockId: 'x', rules: '连续3天缩量下跌后次日上涨，上升趋势' });
    expect(invoke).toHaveBeenCalledWith('generate_rule_code', expect.objectContaining({ rules: expect.stringContaining('上升趋势') }));
    // AI rule prepended + local rule kept
    expect(rules.some((r) => r.name === 'AI趋势规则')).toBe(true);
    expect(rules.some((r) => r.name.includes('·升势'))).toBe(true);
  });

  it('Case 3: AI failure falls back to local rules (no throw)', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('no api key'));
    const { result } = renderHook(() => useParseRules(), { wrapper });
    const rules = await result.current.mutateAsync({ stockId: 'x', rules: '连续3天缩量下跌后次日上涨，上升趋势' });
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.id.startsWith('local_'))).toBe(true);
  });
});
