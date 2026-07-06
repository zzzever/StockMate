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
  selectedStock: null,
  theme: 'dark' as const,
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

vi.mock('@/components/ParticlesBackground', () => ({
  default: () => <div data-testid="particles-bg" className="particles-container" />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, whileHover, whileTap, ...props }: any) => <button {...props}>{children}</button>,
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
    // Sidebar logo text updated to "股王" (was "StockMate" in old version)
    expect(screen.getByText('股王')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    // TopBar placeholder updated to "輸入代碼…" (was "搜索股票代码或名称..." in old version)
    expect(screen.getByPlaceholderText('輸入代碼…')).toBeInTheDocument();
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
