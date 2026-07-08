import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StockDetailPage from '@/pages/StockDetailPage';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useStockFundFlow, useSupportResistance, useRealtimeQuote } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(),
  useStockDetail: vi.fn(),
  useStockHistory: vi.fn(),
  useStockFinance: vi.fn(),
  useStockFundFlow: vi.fn(),
  useSupportResistance: vi.fn(),
  useRealtimeQuote: vi.fn(),
  useWatchlistCheck: () => ({ data: false, isLoading: false }),
  useWatchlistAdd: () => ({ mutate: vi.fn(), isPending: false }),
  useWatchlistRemove: () => ({ mutate: vi.fn(), isPending: false }),
  useIntraday: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector({ chartStyle: 'classic', setSelectedStock: vi.fn() }),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn(() => ({ setTheme: vi.fn() })) }));

// IndexBar calls its own useQuery which needs real QueryClient — just stub it out
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('lightweight-charts', () => ({
  LineStyle: { Solid: 0, Dashed: 2, Dotted: 1 },
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    addLineSeries: vi.fn(() => ({ setData: vi.fn() })),
    addHistogramSeries: vi.fn(() => ({ setData: vi.fn(), setColor: vi.fn() })),
    timeScale: vi.fn(() => ({ applyOptions: vi.fn(), fitContent: vi.fn(), scrollToPosition: vi.fn(), getVisibleRange: vi.fn(() => ({ from: 0, to: 100 })), setVisibleRange: vi.fn(), subscribeVisibleTimeRangeChange: vi.fn(() => vi.fn()) })),
    subscribeCrosshairMove: vi.fn(),
    subscribeClick: vi.fn(),
    setCrosshairPosition: vi.fn(),
    priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
    remove: vi.fn(),
  })),
}));

describe('StockDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useStockHistory).mockReturnValue({ data: [{ date: '2025-01-01', open: 100, high: 102, low: 99, close: 101, volume: 1000 }], isLoading: false } as any);
    vi.mocked(useStockFinance).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useStockFundFlow).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useSupportResistance).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useStockFundFlow).mockReturnValue({ data: [], isLoading: false } as any);
  });

  it('shows empty prompt when no stock code', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false } as any);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/stock']}>
        <StockDetailPage />
      </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('请在自选页选择股票')).toBeInTheDocument();
  });

  it('renders stock name and code from URL', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '600519', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false } as any);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByText('600519')).toBeInTheDocument();
  });

  it('renders key data cards', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '600519', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({ data: { current_price: 1800.50, change: 15.20, change_percent: 0.85, volume: 5000000, amount: 9000000000, high: 1810, low: 1790, open: 1795, prev_close: 1785.30, turnover_rate: 0.5 }, isLoading: false } as any);
    vi.mocked(useStockFinance).mockReturnValue({ data: { pe: 35.2 } as any, isLoading: false } as any);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('市盈率')).toBeInTheDocument();
    expect(screen.getByText('换手率')).toBeInTheDocument();
    expect(screen.getByText('成交额')).toBeInTheDocument();
    expect(screen.getByText('振幅')).toBeInTheDocument();
  });

  it('renders loading state for K-line', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '600519', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useStockHistory).mockReturnValue({ data: [], isLoading: true } as any);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
      </QueryClientProvider>
    );
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error message on data failure', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false, error: new Error('API Error') } as any);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });
});
