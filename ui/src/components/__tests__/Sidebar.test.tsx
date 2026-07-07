import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

const toggleSidebar = vi.fn();
const mockStore = {
  sidebarOpen: true,
  currentPage: 'search' as const,
  darkMode: true,
  setPage: vi.fn(),
  toggleSidebar,
  toggleDarkMode: vi.fn(),
  setSelectedStock: vi.fn(),
  selectedStock: null,
  theme: 'dark' as const,
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Sidebar', () => {
  it('renders navigation items and logo', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('StockMate')).toBeInTheDocument();
    expect(screen.getByText('自選')).toBeInTheDocument();
    expect(screen.getByText('搜尋')).toBeInTheDocument();
    expect(screen.getByText('回測')).toBeInTheDocument();
    expect(screen.getByText('預測')).toBeInTheDocument();
    expect(screen.getByText('規則')).toBeInTheDocument();
    expect(screen.getByText('板塊')).toBeInTheDocument();
    expect(screen.getByText('設置')).toBeInTheDocument();
  });

  it('calls toggleSidebar when collapse button is clicked', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(toggleSidebar).toHaveBeenCalled();
  });

  it('does not render 個股分析 or 指標實驗室 nav items', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.queryByText('個股分析')).not.toBeInTheDocument();
    expect(screen.queryByText('指標實驗室')).not.toBeInTheDocument();
  });

  it('renders nav links with correct hrefs', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    const searchLink = screen.getByText('搜尋').closest('a');
    expect(searchLink).toHaveAttribute('href', '/search');
    const watchlistLink = screen.getByText('自選').closest('a');
    expect(watchlistLink).toHaveAttribute('href', '/watchlist');
    const backtestLink = screen.getByText('回測').closest('a');
    expect(backtestLink).toHaveAttribute('href', '/backtest');
    const predictLink = screen.getByText('預測').closest('a');
    expect(predictLink).toHaveAttribute('href', '/predict');
    const rulesLink = screen.getByText('規則').closest('a');
    expect(rulesLink).toHaveAttribute('href', '/rules');
    const sectorLink = screen.getByText('板塊').closest('a');
    expect(sectorLink).toHaveAttribute('href', '/sector');
    const settingsLink = screen.getByText('設置').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('adds ?code= param to tool links when selectedStock is set', () => {
    const selectedStock = { code: '600519.SH', name: '贵州茅台' };
    const mockWithStock = {
      ...mockStore,
      selectedStock,
    };
    vi.mocked(useAppStore).mockImplementation((selector: any) => selector(mockWithStock));
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    const backtestLink = screen.getByText('回測').closest('a');
    expect(backtestLink).toHaveAttribute('href', '/backtest?code=600519.SH');
    const predictLink = screen.getByText('預測').closest('a');
    expect(predictLink).toHaveAttribute('href', '/predict?code=600519.SH');
    const rulesLink = screen.getByText('規則').closest('a');
    expect(rulesLink).toHaveAttribute('href', '/rules?code=600519.SH');
  });
});
