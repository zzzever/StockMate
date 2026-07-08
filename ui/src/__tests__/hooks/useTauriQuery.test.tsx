import { vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
  useStockList,
  useHotSectors,
  useStockHistory,
  useDeepSeekConfig,
} from '@/hooks/useTauriQuery';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
  },
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useTauriQuery', () => {
  const invokeMock = invoke as ReturnType<typeof vi.fn>;

  afterEach(() => {
    queryClient.clear();
    invokeMock.mockClear();
  });

  it('useStockList fetches stock list via invoke', async () => {
    const mockStocks = [
      { id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' },
      { id: '2', ticker: '000001', name: '平安银行', exchange: 'SZ', currency: 'CNY' },
    ];
    invokeMock.mockResolvedValue(mockStocks);

    const { result } = renderHook(() => useStockList(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStocks);
    expect(invokeMock).toHaveBeenCalledWith('get_stock_list');
  });

  it('useHotSectors fetches hot sectors', async () => {
    const mockSectors = [
      { name: '半导体', change_percent: 3.5, volume: 100000000, leading_stock: '中芯国际', leading_change: 2.1 },
    ];
    invokeMock.mockResolvedValue(mockSectors);

    const { result } = renderHook(() => useHotSectors(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSectors);
    expect(invokeMock).toHaveBeenCalledWith('get_hot_sectors');
  });

  it('useStockHistory fetches history with days param', async () => {
    const mockHistory = [
      { stock_id: '1', date: '2024-01-01', open: '100', high: '105', low: '98', close: '102', volume: 1000000, adjusted_close: '102' },
    ];
    invokeMock.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useStockHistory('1', 60), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockHistory);
    expect(invokeMock).toHaveBeenCalledWith('get_stock_history', { stockId: '1', days: 60, period: 'day' });
  });

  it('useDeepSeekConfig fetches config', async () => {
    const mockConfig = { model: 'deepseek-v4-pro', has_key: true };
    invokeMock.mockResolvedValue(mockConfig);

    const { result } = renderHook(() => useDeepSeekConfig(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockConfig);
    expect(invokeMock).toHaveBeenCalledWith('get_deepseek_config');
  });

  it('handles errors gracefully', async () => {
    invokeMock.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useStockList(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
