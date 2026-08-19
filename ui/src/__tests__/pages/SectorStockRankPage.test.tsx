import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SectorStockRankPage from '@/pages/SectorStockRankPage';
import * as hooks from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useHotSectors: vi.fn(),
  useWatchlist: vi.fn(),
  useMarketOverview: vi.fn(() => ({ data: { up_count: 3000, down_count: 2000, flat_count: 500, sentiment_index: 0.5 } })),
}));

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: false },
  },
});

function mockSectors() {
  return [
    { name: '半导体', change_percent: 3.45, volume: 500_000_000, leading_stock: '中芯国际', leading_change: 5.12, stock_count: 20, up_count: 15, down_count: 5, fund_flow: 1_200_000_000, turnover: 50_000_000_000, change_5d: 2.1, change_1m: 8.5, leading_stock_code: '688981' },
    { name: '银行', change_percent: -0.82, volume: 300_000_000, leading_stock: '招商银行', leading_change: 1.23, stock_count: 18, up_count: 6, down_count: 12, fund_flow: -500_000_000, turnover: 30_000_000_000, change_5d: -1.5, change_1m: -3.2, leading_stock_code: '600036' },
    { name: '白酒', change_percent: 1.25, volume: 200_000_000, leading_stock: '贵州茅台', leading_change: 2.34, stock_count: 15, up_count: 10, down_count: 5, fund_flow: 300_000_000, turnover: 20_000_000_000, change_5d: 0.8, change_1m: 5.0, leading_stock_code: '600519' },
  ];
}

function renderPage() {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>
        <SectorStockRankPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SectorStockRankPage — Sector Analysis', () => {
  /* ============================== */
  /*  Loading State                 */
  /* ============================== */
  describe('Loading State', () => {
    it('shows loading indicator', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('加载板块数据...')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Error State                   */
  /* ============================== */
  describe('Error State', () => {
    it('shows error message and retry button', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络超时') } as any);
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
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('暂无板块数据')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Header & Stats                */
  /* ============================== */
  describe('Header & Stats', () => {
    it('renders page title', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('板块分析')).toBeInTheDocument();
    });

    it('renders search input', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByPlaceholderText('搜索板块...')).toBeInTheDocument();
    });

    it('renders the sector heatmap grid', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // Heatmap shows short names for each sector
      const heatmapGrid = document.querySelector('.grid[style*="grid-template-columns: repeat(auto-fill, minmax(48px, 1fr))"]');
      expect(heatmapGrid).toBeInTheDocument();
      // Each sector short name appears in the heatmap
      expect(screen.getAllByText('半导体').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('银行').length).toBeGreaterThanOrEqual(2);
      // Heatmap cells have tooltip titles with full name + percent
      const heatmapCells = document.querySelectorAll('[title]');
      expect(heatmapCells.length).toBe(3);
      expect(heatmapCells[0].getAttribute('title')).toContain('半导体 +3.45%');
    });
  });

  /* ============================== */
  /*  Quick Filter                  */
  /* ============================== */
  describe('Quick Filter', () => {
    it('renders all quick filter buttons', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // 领涨 appears in both a <button> and a <th> — check all occurrences
      expect(screen.getAllByText('领涨').length).toBe(1); // button only (th now says '领涨股')
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('领跌')).toBeInTheDocument();
      // 资金流入/资金流出 appear in both stat cards and filter buttons
      expect(screen.getAllByText('资金流入').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('资金流出').length).toBeGreaterThanOrEqual(1);
    });

    it('filters by 领涨 (change_percent > 2%)', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // Click the button (first match), not the th
      const lingZhang = screen.getAllByText('领涨');
      fireEvent.click(lingZhang[0]); // The <button>
      // Sentiment cards still show all data, but table only shows 半导体
      const table = document.querySelector('table');
      expect(table?.textContent).toContain('半导体');
      expect(table?.textContent).not.toContain('银行');
      expect(table?.textContent).not.toContain('白酒');
    });

    it('filters by 资金流入', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      fireEvent.click(screen.getByText('资金流入')); // filter button
      const table = document.querySelector('table');
      expect(table?.textContent).toContain('半导体');
      expect(table?.textContent).toContain('白酒');
      expect(table?.textContent).not.toContain('银行');
    });
  });

  /* ============================== */
  /*  Table Content                 */
  /* ============================== */
  describe('Table Content', () => {
    it('renders sector names in table rows', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // Sector names appear in both heatmap and table
      expect(screen.getAllByText('半导体').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('银行').length).toBeGreaterThanOrEqual(2);
      // 白酒 appears in both heatmap (shortName = 白酒) and table
      expect(screen.getAllByText('白酒').length).toBeGreaterThanOrEqual(2);
    });

    it('renders change percent in table', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // Heatmap uses toFixed(1) (+3.5%), table uses fmtChange (+3.45%)
      const table = document.querySelector('table');
      expect(table?.textContent).toContain('+3.45%');
      expect(table?.textContent).toContain('-0.82%');
      expect(table?.textContent).toContain('+1.25%');
    });

    it('renders up/down counts', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const table = document.querySelector('table');
      expect(table?.textContent).toMatch(/15\s*\/\s*5/);
    });

    it('renders leading stock info', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('中芯国际')).toBeInTheDocument();
      expect(screen.getByText('招商银行')).toBeInTheDocument();
    });

    it('renders fund_flow column values', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+12.00亿')).toBeInTheDocument();
      expect(screen.getByText('-5.00亿')).toBeInTheDocument();
      expect(screen.getByText('+3.00亿')).toBeInTheDocument();
    });

    it('applies correct fund flow colors: positive = red/up, negative = green/down', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // Positive fund flow values should have price-up class (red text/bg)
      const positiveFlow = screen.getByText('+12.00亿');
      expect(positiveFlow.className).toMatch(/price-up/);
      const positiveFlow2 = screen.getByText('+3.00亿');
      expect(positiveFlow2.className).toMatch(/price-up/);
      // Negative fund flow values should have price-down class (green text/bg)
      const negativeFlow = screen.getByText('-5.00亿');
      expect(negativeFlow.className).toMatch(/price-down/);
    });

    it('change_1m values are no longer shown in table (column removed)', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // 1月涨幅 column header has been removed from the table
      const thEls = document.querySelectorAll('th');
      const match = Array.from(thEls).find((th) => th.textContent?.includes('1月%') || th.textContent?.includes('1月涨幅'));
      expect(match).toBeFalsy();
      // '1月涨幅' no longer exists in sort options
      expect(screen.queryByRole('option', { name: '1月涨幅' })).toBeNull();
    });

    it('filters by search', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const input = screen.getByPlaceholderText('搜索板块...');
      fireEvent.change(input, { target: { value: '半导' } });
      expect(screen.getAllByText('半导体').length).toBeGreaterThanOrEqual(1);
    });

    it('shows "未找到匹配板块" when search matches nothing', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const input = screen.getByPlaceholderText('搜索板块...');
      fireEvent.change(input, { target: { value: 'zzz_not_found' } });
      expect(screen.getByText('未找到匹配板块')).toBeInTheDocument();
    });
  });

  /* ============================== */
  /*  Sorting                       */
  /* ============================== */
  describe('Sorting', () => {
    it('default sort is by change_percent desc', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking fund_flow header sorts by fund_flow', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const fundFlowEls = screen.getAllByText('资金流');
      const fundFlowTh = fundFlowEls.find((el) => el.tagName === 'TH');
      expect(fundFlowTh).toBeTruthy();
      fireEvent.click(fundFlowTh!);
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking fund_flow header sorts by fund_flow', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const fundFlowEls = screen.getAllByText('资金流');
      const fundFlowTh = fundFlowEls.find((el) => el.tagName === 'TH');
      expect(fundFlowTh).toBeTruthy();
      fireEvent.click(fundFlowTh!);
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking change_percent header again toggles sort order', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      let rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');

      const chgEls = screen.getAllByText('涨跌幅');
      const chgTh = chgEls.find((el) => el.tagName === 'TH');
      expect(chgTh).toBeTruthy();
      fireEvent.click(chgTh!);
      rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('银行');
    });
  });

});
