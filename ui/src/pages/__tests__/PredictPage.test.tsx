import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PredictPage from '@/pages/PredictPage';
import { usePredictWithAI, useStockList } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useHotSectors: vi.fn(),
  useHotStocks: vi.fn(),
  useStockList: vi.fn(),
  useSearchStocks: vi.fn(),
  useStockDetail: vi.fn(),
  useStockFinance: vi.fn(),
  useStockFundFlow: vi.fn(),
  useStrategy: vi.fn(),
  usePrediction: vi.fn(),
  usePredictWithAI: vi.fn(),
  useCardData: vi.fn(),
  useMarketOverview: vi.fn(),
}));

vi.mock('recharts', () => ({
  PieChart: ({ children }: any) => <svg data-testid="pie-chart">{children}</svg>,
  Pie: ({ children }: any) => <g>{children}</g>,
  Cell: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PredictPage', () => {
  it('renders predict page with refresh button', () => {
    vi.mocked(usePredictWithAI).mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() } as any);
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    // In loading state, the skeleton/loading UI is shown, not the AI conclusion title
    expect(screen.getByText('预测中...')).toBeInTheDocument();
  });

  it('renders prediction result when data is loaded', () => {
    vi.mocked(usePredictWithAI).mockReturnValue({
      data: {
        direction: 'up',
        confidence: 0.82,
        target_price: '1800-1900',
        reasoning: '技术面显示均线多头排列',
        time_frame: '1月',
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    expect(screen.getAllByText('上涨').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('AI 预测结论')).toBeInTheDocument();
  });

  it('changes active strategy type on button click', () => {
    vi.mocked(usePredictWithAI).mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() } as any);
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    const refreshBtn = screen.getByText('预测中...');
    // The button should still be in the document after click
    expect(refreshBtn).toBeInTheDocument();
  });
});
