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
    // Sidebar shows "股王" as logo text (updated from old "StockMate")
    expect(screen.getByText('股王')).toBeInTheDocument();
    // Updated nav items reflecting the new sidebar structure
    expect(screen.getByText('搜尋')).toBeInTheDocument();
    expect(screen.getByText('行情')).toBeInTheDocument();
    expect(screen.getByText('回測')).toBeInTheDocument();
    expect(screen.getByText('預測')).toBeInTheDocument();
    expect(screen.getByText('規則')).toBeInTheDocument();
    expect(screen.getByText('支撐線')).toBeInTheDocument();
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

  it('renders nav links with correct hrefs', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    const searchLink = screen.getByText('搜尋').closest('a');
    expect(searchLink).toHaveAttribute('href', '/search');
    const stockLink = screen.getByText('行情').closest('a');
    expect(stockLink).toHaveAttribute('href', '/stock');
    const backtestLink = screen.getByText('回測').closest('a');
    expect(backtestLink).toHaveAttribute('href', '/backtest');
    const predictLink = screen.getByText('預測').closest('a');
    expect(predictLink).toHaveAttribute('href', '/predict');
    const rulesLink = screen.getByText('規則').closest('a');
    expect(rulesLink).toHaveAttribute('href', '/rules');
    const indicatorLink = screen.getByText('支撐線').closest('a');
    expect(indicatorLink).toHaveAttribute('href', '/indicator-lab');
    const settingsLink = screen.getByText('設置').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });
});
