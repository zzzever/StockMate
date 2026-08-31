import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

const toggleSidebar = vi.fn();
const mockStore = {
  sidebarOpen: true,
  currentPage: 'watchlist' as const,
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
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function renderSidebar(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar', () => {
  it('renders navigation items and logo', () => {
    renderSidebar();
    expect(screen.getByText('StockMate')).toBeInTheDocument();
    expect(screen.getByText('自選股')).toBeInTheDocument();
    expect(screen.getAllByText('行情').length).toBeGreaterThan(0);
    expect(screen.getByText('股票搜索')).toBeInTheDocument();
    expect(screen.queryByText('AI 分析')).not.toBeInTheDocument();
  });

  it('calls toggleSidebar when collapse button is clicked', () => {
    renderSidebar();
    const collapseBtn = document.querySelector('.ml-auto button') || screen.getAllByRole('button')[0];
    fireEvent.click(collapseBtn);
    expect(toggleSidebar).toHaveBeenCalled();
  });

  it('renders nav links with correct hrefs', () => {
    renderSidebar();
    const watchlistLink = screen.getByText('自選股').closest('a');
    expect(watchlistLink).toHaveAttribute('href', '/watchlist');
    const searchLink = screen.getByText('股票搜索').closest('a');
    expect(searchLink).toHaveAttribute('href', '/search');
  });

  it('shows active state for current page', () => {
    renderSidebar('/sector');
    const sectorsLink = screen.getByText('板塊熱點').closest('a');
    expect(sectorsLink).toHaveClass('font-semibold');
  });

  it('shows SM when collapsed', () => {
    mockStore.sidebarOpen = false;
    renderSidebar();
    expect(screen.getByText('SM')).toBeInTheDocument();
    mockStore.sidebarOpen = true;
  });
});
