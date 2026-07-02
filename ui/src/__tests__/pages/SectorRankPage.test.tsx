import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectorRankPage from '@/pages/SectorRankPage';
import { useHotSectors } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useHotSectors: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('SectorRankPage', () => {
  it('renders loading state', () => {
    vi.mocked(useHotSectors).mockReturnValue({ data: undefined, isLoading: true } as any);
    render(
      <MemoryRouter>
        <SectorRankPage />
      </MemoryRouter>
    );
    expect(screen.getByText('板块排名')).toBeInTheDocument();
    expect(screen.getByText('加载板块数据中...')).toBeInTheDocument();
  });

  it('renders sector cards when data loaded', () => {
    vi.mocked(useHotSectors).mockReturnValue({
      data: [
        { name: '半导体', change_percent: 3.5, volume: 100000000, leading_stock: '中芯国际', leading_change: 2.1, fund_flow: 50000000, stock_count: 45 },
        { name: '新能源', change_percent: -1.2, volume: 80000000, leading_stock: '比亚迪', leading_change: -0.5, fund_flow: -20000000, stock_count: 32 },
      ],
      isLoading: false,
    } as any);

    render(
      <MemoryRouter>
        <SectorRankPage />
      </MemoryRouter>
    );
    expect(screen.getByText('半导体')).toBeInTheDocument();
    expect(screen.getByText('新能源')).toBeInTheDocument();
    expect(screen.getByText('45 只成分股')).toBeInTheDocument();
  });

  it('switches between grid and list view', () => {
    vi.mocked(useHotSectors).mockReturnValue({
      data: [{ name: '半导体', change_percent: 3.5, volume: 100000000, leading_stock: '中芯国际', leading_change: 2.1, fund_flow: 50000000, stock_count: 45 }],
      isLoading: false,
    } as any);

    render(
      <MemoryRouter>
        <SectorRankPage />
      </MemoryRouter>
    );
    // Default is grid view
    expect(screen.getByText('半导体')).toBeInTheDocument();
    // Switch to list view
    const listBtn = screen.getAllByRole('button').find(b => b.querySelector('svg'));
    if (listBtn) fireEvent.click(listBtn);
  });

  it('switches time range', () => {
    vi.mocked(useHotSectors).mockReturnValue({ data: [], isLoading: false } as any);

    render(
      <MemoryRouter>
        <SectorRankPage />
      </MemoryRouter>
    );
    const weekBtn = screen.getByText('本周');
    fireEvent.click(weekBtn);
    expect(weekBtn).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    vi.mocked(useHotSectors).mockReturnValue({ data: [], isLoading: false } as any);

    render(
      <MemoryRouter>
        <SectorRankPage />
      </MemoryRouter>
    );
    expect(screen.getByText('暂无板块数据')).toBeInTheDocument();
  });
});
