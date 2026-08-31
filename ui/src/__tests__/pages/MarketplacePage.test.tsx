import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import MarketplacePage from '@/pages/MarketplacePage';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<MarketplacePage />, { wrapper });
}

describe('MarketplacePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders marketplace page with title "指标商店"', () => {
    renderPage();
    expect(screen.getByText('指标商店')).toBeInTheDocument();
  });

  it('shows search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('搜索指标名称、作者、标签...')).toBeInTheDocument();
  });

  it('displays indicator cards from mock data', () => {
    renderPage();
    expect(screen.getByText('超级趋势 SuperTrend')).toBeInTheDocument();
    expect(screen.getByText('RSI 背离探测器')).toBeInTheDocument();
    expect(screen.getByText('成交量异动 VVolume')).toBeInTheDocument();
    expect(screen.getByText('自定义指标引擎')).toBeInTheDocument();
  });

  it('filters by category when category button clicked', () => {
    renderPage();
    const trendBtns = screen.getAllByText('趋势');
    fireEvent.click(trendBtns[0]);
    expect(screen.getByText('超级趋势 SuperTrend')).toBeInTheDocument();
    expect(screen.getByText('双均线交叉增强版')).toBeInTheDocument();
    expect(screen.queryByText('RSI 背离探测器')).not.toBeInTheDocument();
  });

  it('shows publish button', () => {
    renderPage();
    expect(screen.getByText('发布指标')).toBeInTheDocument();
  });

  it('shows sorting options', () => {
    renderPage();
    expect(screen.getByText('按评分')).toBeInTheDocument();
    expect(screen.getByText('按下载')).toBeInTheDocument();
    expect(screen.getByText('按价格')).toBeInTheDocument();
    expect(screen.getByText('按更新')).toBeInTheDocument();
  });
});
