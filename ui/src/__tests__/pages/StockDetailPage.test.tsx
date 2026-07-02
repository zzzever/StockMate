import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StockDetailPage from '@/pages/StockDetailPage';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useStockFundFlow, useMovingAverage, useSupportResistance, useRealtimeQuote, useDeepSeekConfig, useAnalyzeStockWithAI } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(),
  useStockDetail: vi.fn(),
  useStockHistory: vi.fn(),
  useStockFinance: vi.fn(),
  useStockFundFlow: vi.fn(),
  useMovingAverage: vi.fn(),
  useSupportResistance: vi.fn(),
  useRealtimeQuote: vi.fn(),
  useDeepSeekConfig: vi.fn(),
  useAnalyzeStockWithAI: vi.fn(),
}));

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    remove: vi.fn(),
  })),
}));

describe('StockDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useStockList).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useStockHistory).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useStockFinance).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useStockFundFlow).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useMovingAverage).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useSupportResistance).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useDeepSeekConfig).mockReturnValue({ data: { has_key: true, model: 'deepseek-v4-pro' }, isLoading: false } as any);
    vi.mocked(useAnalyzeStockWithAI).mockReturnValue({ data: null, isLoading: false, refetch: vi.fn() } as any);
  });

  it('renders stock detail with correct stock from URL', () => {
    vi.mocked(useStockList).mockReturnValue({
      data: [{ id: '600519', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }],
      isLoading: false,
    } as any);

    render(
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
    );
    expect(screen.getByText('600519')).toBeInTheDocument();
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByText('市盈率 PE')).toBeInTheDocument();
  });

  it('renders AI analysis panel', () => {
    vi.mocked(useAnalyzeStockWithAI).mockReturnValue({
      data: {
        trend: 'bullish',
        confidence: 85,
        summary: '上涨趋势',
        key_points: ['技术指标积极', '成交量放大'],
        risks: ['市场波动'],
        suggestion: 'buy',
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
    );
    expect(screen.getByText('AI 智能分析')).toBeInTheDocument();
    expect(screen.getByText('看涨')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });

  it('switches tabs', () => {
    render(
      <MemoryRouter initialEntries={['/stock?code=600519']}>
        <StockDetailPage />
      </MemoryRouter>
    );
    expect(screen.getByText('综合分析')).toBeInTheDocument();
    expect(screen.getByText('财务报表')).toBeInTheDocument();
    expect(screen.getByText('资金流向')).toBeInTheDocument();
  });
});
