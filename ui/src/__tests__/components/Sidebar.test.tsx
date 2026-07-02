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
    expect(screen.getByText('板块排名')).toBeInTheDocument();
    expect(screen.getByText('AI分析')).toBeInTheDocument();
    expect(screen.getByText('策略回测')).toBeInTheDocument();
    expect(screen.getByText('走势预测')).toBeInTheDocument();
    expect(screen.getByText('设置')).toBeInTheDocument();
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
    const sectorsLink = screen.getByText('板块排名').closest('a');
    expect(sectorsLink).toHaveAttribute('href', '/sectors');
    const stockLink = screen.getByText('AI分析').closest('a');
    expect(stockLink).toHaveAttribute('href', '/stock');
    const backtestLink = screen.getByText('策略回测').closest('a');
    expect(backtestLink).toHaveAttribute('href', '/backtest');
    const predictLink = screen.getByText('走势预测').closest('a');
    expect(predictLink).toHaveAttribute('href', '/predict');
    const settingsLink = screen.getByText('设置').closest('a');
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });

  it('shows active state for current page', () => {
    render(
      <MemoryRouter initialEntries={['/sectors']}>
        <Sidebar />
      </MemoryRouter>
    );
    const sectorsLink = screen.getByText('板块排名').closest('a');
    expect(sectorsLink).toHaveClass('bg-violet-100');
  });

  it('renders version info', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('v0.2.0')).toBeInTheDocument();
  });
});
