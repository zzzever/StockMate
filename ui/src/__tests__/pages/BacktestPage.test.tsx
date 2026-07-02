import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BacktestPage from '@/pages/BacktestPage';
import { useStockList, useStockHistory } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(),
  useStockHistory: vi.fn(),
}));

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addAreaSeries: vi.fn(() => ({ setData: vi.fn() })),
    addLineSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    remove: vi.fn(),
  })),
  LineStyle: { Dashed: 2 },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('BacktestPage', () => {
  const mockQuotes = [
    { stock_id: '1', date: '2024-01-01', open: '100', high: '105', low: '98', close: '102', volume: 1000000, adjusted_close: '102' },
    { stock_id: '1', date: '2024-01-02', open: '102', high: '108', low: '101', close: '107', volume: 1200000, adjusted_close: '107' },
  ];

  it('renders backtest page with strategy selection', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useStockHistory).mockReturnValue({ data: mockQuotes, isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/backtest?code=600519']}>
        <BacktestPage />
      </MemoryRouter>
    );
    expect(screen.getByText('选择策略')).toBeInTheDocument();
    expect(screen.getByText('均线交叉')).toBeInTheDocument();
    expect(screen.getByText('MACD策略')).toBeInTheDocument();
    expect(screen.getByText('RSI策略')).toBeInTheDocument();
    expect(screen.getByText('布林带')).toBeInTheDocument();
    expect(screen.getByText('双均线')).toBeInTheDocument();
  });

  it('selects different strategy', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useStockHistory).mockReturnValue({ data: mockQuotes, isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/backtest?code=600519']}>
        <BacktestPage />
      </MemoryRouter>
    );
    const macdBtn = screen.getByText('MACD策略');
    fireEvent.click(macdBtn);
    expect(macdBtn).toBeInTheDocument();
  });

  it('shows run backtest button', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useStockHistory).mockReturnValue({ data: mockQuotes, isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/backtest?code=600519']}>
        <BacktestPage />
      </MemoryRouter>
    );
    expect(screen.getByText('开始回测')).toBeInTheDocument();
  });

  it('renders with fallback stockId when stock not in list', () => {
    // 模拟 stock 不在本地列表中（如 688981），stockId 应基于 code 构造
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: 'AAPL.NASDAQ', ticker: 'AAPL', name: 'Apple', exchange: 'NASDAQ', currency: 'USD' }], isLoading: false } as any);
    vi.mocked(useStockHistory).mockReturnValue({ data: mockQuotes, isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/backtest?code=688981']}>
        <BacktestPage />
      </MemoryRouter>
    );
    // 页面应正常渲染，不崩溃
    expect(screen.getByText('选择策略')).toBeInTheDocument();
    expect(screen.getByText('均线交叉')).toBeInTheDocument();
  });
});
