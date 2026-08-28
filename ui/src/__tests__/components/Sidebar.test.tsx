import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

const toggleSidebar = vi.fn();
const mockStore = {
  sidebarOpen: true,
  currentPage: 'sectors' as const,
  darkMode: true,
  setPage: vi.fn(),
  toggleSidebar,
  toggleDarkMode: vi.fn(),
  setSelectedStock: vi.fn(),
  selectedStock: null,
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
    // Swiss-style text-only nav labels
    expect(screen.getByText('自選股')).toBeInTheDocument();
    expect(screen.getByText('行情')).toBeInTheDocument();
    expect(screen.getByText('股票搜索')).toBeInTheDocument();
    expect(screen.getByText('策略回測')).toBeInTheDocument();
    expect(screen.queryByText('AI 分析')).not.toBeInTheDocument();
    expect(screen.getByText('交易規則')).toBeInTheDocument();
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

  it('renders nav links with correct hrefs', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    const watchlistLink = screen.getByText('自選股').closest('a');
    expect(watchlistLink).toHaveAttribute('href', '/watchlist');
    const searchLink = screen.getByText('股票搜索').closest('a');
    expect(searchLink).toHaveAttribute('href', '/search');
    const backtestLink = screen.getByText('策略回測').closest('a');
    expect(backtestLink).toHaveAttribute('href', '/backtest');
    const settingsLink = screen.getByText('設置').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('shows active state for current page', () => {
    render(
      <MemoryRouter initialEntries={['/sector']}>
        <Sidebar />
      </MemoryRouter>
    );
    const sectorsLink = screen.getByText('板塊熱點').closest('a');
    // Swiss style: active = border-left-* + font-semibold, not bg-violet-100
    expect(sectorsLink).toHaveClass('font-semibold');
  });

  it('shows SM when collapsed', () => {
    mockStore.sidebarOpen = false;
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('SM')).toBeInTheDocument();
    mockStore.sidebarOpen = true;
  });
});
