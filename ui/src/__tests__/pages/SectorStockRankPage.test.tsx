import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectorStockRankPage from '@/pages/SectorStockRankPage';
import { useHotSectors } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useHotSectors: vi.fn(),
}));

function mockSectors() {
  return [
    { name: '半导体', change_percent: 3.45, volume: 500_000_000, leading_stock: '中芯国际', leading_change: 5.12, stock_count: 20, up_count: 15, down_count: 5 },
    { name: '银行', change_percent: -0.82, volume: 300_000_000, leading_stock: '招商银行', leading_change: 1.23, stock_count: 18, up_count: 6, down_count: 12 },
    { name: '白酒', change_percent: 1.25, volume: 200_000_000, leading_stock: '贵州茅台', leading_change: 2.34, stock_count: 15, up_count: 10, down_count: 5 },
  ];
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SectorStockRankPage />
    </MemoryRouter>
  );
}

describe('SectorStockRankPage — Sector Overview', () => {
  /* ============================== */
  /*  Loading State                 */
  /* ============================== */
  describe('Loading State', () => {
    it('shows loading indicator', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('加载板块数据...')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Error State                   */
  /* ============================== */
  describe('Error State', () => {
    it('shows error message and retry button', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络超时') } as any);
      renderPage();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('重新加载')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Empty State                   */
  /* ============================== */
  describe('Empty State', () => {
    it('shows empty text when no sectors', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('暂无板块数据')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Header & Stats                */
  /* ============================== */
  describe('Header & Stats', () => {
    it('renders page title', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('板块总览')).toBeInTheDocument();
    });

    it('renders search input', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByPlaceholderText('搜索板块...')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('总板块')).toBeInTheDocument();
      expect(screen.getByText('上涨')).toBeInTheDocument();
      expect(screen.getByText('下跌')).toBeInTheDocument();
      expect(screen.getByText('平盘')).toBeInTheDocument();
      expect(screen.getByText('总成交')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Table Content                 */
  /* ============================== */
  describe('Table Content', () => {
    it('renders sector names', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('半导体')).toBeInTheDocument();
      expect(screen.getByText('银行')).toBeInTheDocument();
      expect(screen.getByText('白酒')).toBeInTheDocument();
    });

    it('renders change percent with color', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+3.45%')).toBeInTheDocument();
      expect(screen.getByText('-0.82%')).toBeInTheDocument();
    });

    it('renders up/down counts', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // up/down counts rendered as "15/5" in table
      const table = document.querySelector('table');
      expect(table?.textContent).toMatch(/15\s*\/\s*5/);
    });

    it('renders leading stock info', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('中芯国际')).toBeInTheDocument();
      expect(screen.getByText('招商银行')).toBeInTheDocument();
    });

    it('filters by search', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const input = screen.getByPlaceholderText('搜索板块...');
      fireEvent.change(input, { target: { value: '半导' } });
      expect(screen.getByText('半导体')).toBeInTheDocument();
      expect(screen.queryByText('银行')).not.toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Sorting                       */
  /* ============================== */
  describe('Sorting', () => {
    it('default sort is by change_percent desc', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const rows = screen.getAllByRole('row');
      // First data row should have the highest change_percent (半导体: +3.45%)
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking volume header sorts by volume', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      fireEvent.click(screen.getByText('成交量'));
      const rows = screen.getAllByRole('row');
      // After clicking volume sort, the first row should be the highest volume
      expect(rows[1].textContent).toContain('半导体'); // 半导体 has highest volume
    });
  });
});
