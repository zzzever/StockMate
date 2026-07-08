import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PredictPage from '@/pages/PredictPage';

const queryReturn = { data: null, isLoading: false, error: null } as any;
const mutationReturn = { mutate: vi.fn(), isLoading: false, isSuccess: false, data: null } as any;

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(),
  useStockDetail: () => queryReturn,
  useAnalyzeAll: () => queryReturn,
  useStockHistory: () => ({ data: [], isLoading: false }),
  useRealtimeQuote: () => queryReturn,
  useStockFinance: () => queryReturn,
  useDeepSeekConfig: () => queryReturn,
  usePredictWithAI: () => queryReturn,
  useDiagnoseDataSources: () => ({ data: null, isLoading: false }),
  useRealtimePriceListener: () => {},
  useWsRealtimeQuote: () => undefined,
  useGenerateStrategyWithAI: () => mutationReturn,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

vi.mock('lightweight-charts', () => ({
  LineStyle: { Solid: 0, Dashed: 2 },
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    addLineSeries: vi.fn(() => ({ setData: vi.fn() })),
    addHistogramSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    remove: vi.fn(),
  })),
}));

describe('PredictPage', () => {
  it('renders predict page title', () => {
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <PredictPage />
      </MemoryRouter>
    );
    expect(screen.getByText('AI 预测中心')).toBeInTheDocument();
  });

  it('shows code in header when stockId query param is present', () => {
    render(
      <MemoryRouter initialEntries={['/predict?code=600519']}>
        <PredictPage />
      </MemoryRouter>
    );
    expect(screen.getByText('600519')).toBeInTheDocument();
  });
});
