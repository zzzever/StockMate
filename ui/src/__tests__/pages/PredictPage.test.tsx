import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PredictPage from '@/pages/PredictPage';
import { usePredictWithAI, useStockList } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  usePredictWithAI: vi.fn(),
  useStockList: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PredictPage', () => {
  it('renders predict page with loading state', () => {
    vi.mocked(usePredictWithAI).mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() } as any);
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    expect(screen.getByText('预测中...')).toBeInTheDocument();
  });

  it('renders prediction result when data is loaded', () => {
    vi.mocked(usePredictWithAI).mockReturnValue({
      data: {
        direction: 'up',
        confidence: 0.82,
        target_price: '1800-1900',
        reasoning: '技术面显示均线多头排列，MACD金叉形成。基本面方面，公司业绩稳健，毛利率维持高位。',
        time_frame: '1个月',
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
    expect(screen.getByText('AI 预测结论')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('上涨')).toBeInTheDocument();
  });

  it('triggers refresh on button click', () => {
    const refetch = vi.fn();
    vi.mocked(usePredictWithAI).mockReturnValue({ data: null, isLoading: false, error: null, refetch } as any);
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    const refreshBtn = screen.getByText('刷新预测');
    fireEvent.click(refreshBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('shows error state when API fails', () => {
    vi.mocked(usePredictWithAI).mockReturnValue({ data: null, isLoading: false, error: new Error('API Key 无效'), refetch: vi.fn() } as any);
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '1', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);

    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    expect(screen.getByText('API Key 无效，请重新配置')).toBeInTheDocument();
  });
});
