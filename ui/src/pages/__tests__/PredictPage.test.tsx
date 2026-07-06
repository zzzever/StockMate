import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PredictPage from '@/pages/PredictPage';

// Mock all hooks used by the new PredictPage
vi.mock('@/hooks/useTauriQuery', () => ({
  useDeepSeekConfig: vi.fn(() => ({ data: { has_key: true }, isLoading: false })),
  useStockDetail: vi.fn(() => ({ data: null, isLoading: false })),
  useStockHistory: vi.fn(() => ({ data: null, isLoading: false })),
  useRealtimeQuote: vi.fn(() => ({ data: null, isLoading: false })),
  useStockFinance: vi.fn(() => ({ data: null, isLoading: false })),
  useAnalyzeAll: vi.fn(() => ({ data: null, isLoading: true, error: null, refetch: vi.fn() })),
}));

vi.mock('lucide-react', () => ({
  TrendingUp: () => null, TrendingDown: () => null, Minus: () => null,
  Bot: () => null, ArrowLeft: () => null, RefreshCw: () => <svg>refresh</svg>,
  Target: () => null, BarChart3: () => null, AlertTriangle: () => null,
  CheckCircle2: () => null, Activity: () => null, Zap: () => null,
  Globe: () => null, ShieldAlert: () => null, Calendar: () => null,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('PredictPage', () => {
  it('shows prompt when no stock is selected', () => {
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <PredictPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/请先选择一只股票/)).toBeInTheDocument();
  });

  it('shows loading state when data is being fetched', () => {
    render(
      <MemoryRouter initialEntries={['/predict?code=600519.SH']}>
        <PredictPage />
      </MemoryRouter>
    );
    // The page header should be visible
    expect(screen.getByText('AI 预测中心')).toBeInTheDocument();
    // Refresh button should be present
    expect(screen.getByText('刷新全部')).toBeInTheDocument();
  });
});
