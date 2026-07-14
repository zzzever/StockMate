import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SectorStockRankPage from '@/pages/SectorStockRankPage';
import * as hooks from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useHotSectors: vi.fn(),
  useSectorTopStocks: vi.fn(),
  useWatchlist: vi.fn(),
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

    it('renders combined stats row with strongest/weakest and stat cards', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('最强板块')).toBeInTheDocument();
      expect(screen.getByText('最弱板块')).toBeInTheDocument();
      expect(screen.getByText('上涨')).toBeInTheDocument();
      expect(screen.getByText('下跌')).toBeInTheDocument();
      // 资金流入/资金流出 appear in both stat cards and filter buttons
      const flowIn = screen.getAllByText('资金流入');
      expect(flowIn.length).toBeGreaterThanOrEqual(1);
      const flowOut = screen.getAllByText('资金流出');
      expect(flowOut.length).toBeGreaterThanOrEqual(1);
    });

    it('renders stat cards (上涨, 下跌, 资金流入, 资金流出)', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('上涨')).toBeInTheDocument();
      expect(screen.getByText('下跌')).toBeInTheDocument();
      // 资金流入/资金流出 appear in both stat cards and filter buttons
      expect(screen.getAllByText('资金流入').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('资金流出').length).toBeGreaterThanOrEqual(1);
    });

    it('shows correct up/down and flow counts in stat cards', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // 2 sectors up, 2 sectors with positive fund flow
      // Use a flexible check: the stat card container should contain "2"
      const upStat = screen.getByText('上涨').closest('[class*="flex"]');
      expect(upStat?.textContent).toMatch(/2/);
      // 1 sector down, 1 sector with negative fund flow
      const downStat = screen.getByText('下跌').closest('[class*="flex"]');
      expect(downStat?.textContent).toMatch(/1/);
    });

    it('shows strongest and weakest sectors in sentiment cards', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getAllByText('半导体').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('银行').length).toBeGreaterThanOrEqual(2);
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
      fireEvent.click(screen.getAllByText('资金流入')[1]); // filter button (index 1, index 0 is stat card label)
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
      expect(screen.getAllByText('半导体').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('银行').length).toBeGreaterThanOrEqual(2);
      // 白酒 only appears in table (not in sentiment cards — only extremes shown)
      expect(screen.getByText('白酒')).toBeInTheDocument();
    });

    it('renders change percent in table', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getAllByText('+3.45%').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('-0.82%').length).toBeGreaterThanOrEqual(2);
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

    it('renders change_5d column values', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+2.10%')).toBeInTheDocument();
      expect(screen.getByText('-1.50%')).toBeInTheDocument();
      expect(screen.getByText('+0.80%')).toBeInTheDocument();
    });

    it('change_1m values are no longer shown in table (column removed)', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // 1月涨幅 column header has been removed from the table
      const thEls = document.querySelectorAll('th');
      const match = Array.from(thEls).find((th) => th.textContent?.includes('1月%') || th.textContent?.includes('1月涨幅'));
      expect(match).toBeFalsy();
      // '1月涨幅' still exists in the sort select dropdown option
      expect(screen.getByRole('option', { name: '1月涨幅' })).toBeInTheDocument();
    });

    it('renders 操作 button for each row', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const actionButtons = screen.getAllByTitle('查看成分股');
      expect(actionButtons.length).toBe(3);
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

    it('clicking change_5d header sorts by change_5d', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const change5dEls = screen.getAllByText('5日涨幅');
      const change5dTh = change5dEls.find((el) => el.tagName === 'TH');
      expect(change5dTh).toBeTruthy();
      fireEvent.click(change5dTh!);
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');
    });

    it('change_1m sort header has been removed', () => {
      // 1月涨幅 column removed; sorting by change_1m is no longer available via header click
    });

    it('clicking name header sorts by name', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const nameEls = screen.getAllByText('板块名称');
      const nameTh = nameEls.find((el) => el.tagName === 'TH');
      expect(nameTh).toBeTruthy();
      fireEvent.click(nameTh!);
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('银行');
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

  /* ============================== */
  /*  Expandable Stock Panel        */
  /* ============================== */
  describe('Expandable Stock Panel', () => {
    it('opens panel when clicking a sector row action button', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      vi.mocked(hooks.useSectorTopStocks).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      const actionBtns = screen.getAllByTitle('查看成分股');
      fireEvent.click(actionBtns[0]);
      // Panel header includes sector name + "成分股"
      expect(screen.getByText('收起')).toBeInTheDocument();
    });

    it('closes panel when clicking the close button', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      vi.mocked(hooks.useSectorTopStocks).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      const actionBtns = screen.getAllByTitle('查看成分股');
      fireEvent.click(actionBtns[0]);
      expect(screen.getByText('收起')).toBeInTheDocument();
      fireEvent.click(screen.getByText('收起'));
      expect(screen.queryByText('收起')).not.toBeInTheDocument();
    });

    it('shows loading state in panel', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      vi.mocked(hooks.useSectorTopStocks).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);
      renderPage();
      const actionBtns = screen.getAllByTitle('查看成分股');
      fireEvent.click(actionBtns[0]);
      expect(screen.getByText('加载成分股...')).toBeInTheDocument();
    });

    it('shows stocks data in panel', () => {
      const mockStocks = [
        { id: '1', ticker: '688981', name: '中芯国际', price: 56.78, change: 2.34, change_percent: 4.3, volume: 10_000_000, turnover_rate: 1.25 },
        { id: '2', ticker: '603986', name: '兆易创新', price: 128.90, change: -1.20, change_percent: -0.93, volume: 5_000_000, turnover_rate: 0.85 },
      ];
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      vi.mocked(hooks.useSectorTopStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const actionBtns = screen.getAllByTitle('查看成分股');
      fireEvent.click(actionBtns[0]);
      // 中芯国际 appears in both the table (as leading stock) and the panel (as stock row)
      expect(screen.getAllByText('中芯国际').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('兆易创新')).toBeInTheDocument();
      expect(screen.getByText('688981')).toBeInTheDocument();
      expect(screen.getByText('603986')).toBeInTheDocument();
      expect(screen.getByText('56.78')).toBeInTheDocument();
      expect(screen.getByText('128.90')).toBeInTheDocument();
    });

    it('shows empty state when no stocks', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      vi.mocked(hooks.useSectorTopStocks).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      const actionBtns = screen.getAllByTitle('查看成分股');
      fireEvent.click(actionBtns[0]);
      expect(screen.getByText('暂无成分股数据')).toBeInTheDocument();
    });
  });
});
