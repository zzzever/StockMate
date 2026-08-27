import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '@/components/Layout';

const mockStore = {
  sidebarOpen: true,
  currentPage: 'search' as const,
  darkMode: true,
  setPage: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleDarkMode: vi.fn(),
  setSelectedStock: vi.fn(),
  selectedStock: null as { code: string; name: string } | null,
  theme: 'dark' as const,
  debugOpen: false,
  accent: 'red' as const,
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
  initSystemThemeListener: () => () => {},
}));

vi.mock('@/hooks/useTauriQuery', () => ({
  useRealtimePriceListener: () => {},
  useDiagnoseDataSources: () => ({ data: null, isLoading: false }),
  useMarketOverview: () => ({ data: { up_count: 3000, down_count: 2000, flat_count: 500, sentiment_index: 0.5 } }),
  useMarketTempHistory: () => ({ data: [] }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, whileHover, whileTap, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Layout', () => {
  it('renders layout with sidebar, topbar and children', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div data-testid="child">Child Content</div>
        </Layout>
      </MemoryRouter>
    );
    expect(screen.getAllByText(/StockMate/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    // TopBar renders (its theme toggle is present); the inline search box was removed.
    // Theme toggle removed (dark-only mode)
  });

  it('sets page based on route in useEffect', () => {
    render(
      <MemoryRouter initialEntries={['/backtest']}>
        <Layout>
          <div>Backtest Page</div>
        </Layout>
      </MemoryRouter>
    );
    expect(screen.getByText('Backtest Page')).toBeInTheDocument();
  });
});
