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

    it('renders sentiment overview cards', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('总板块')).toBeInTheDocument();
      expect(screen.getByText('涨跌比')).toBeInTheDocument();
      expect(screen.getByText('资金流向')).toBeInTheDocument();
      expect(screen.getByText('最强板块')).toBeInTheDocument();
      expect(screen.getByText('最弱板块')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('上涨')).toBeInTheDocument();
      expect(screen.getByText('下跌')).toBeInTheDocument();
      expect(screen.getByText('平盘')).toBeInTheDocument();
      const allFundFlow = screen.getAllByText('主力净流入');
      expect(allFundFlow.length).toBeGreaterThanOrEqual(1);
      const allTurnover = screen.getAllByText('总成交额');
      expect(allTurnover.length).toBeGreaterThanOrEqual(1);
    });

    it('shows correct total fund flow value in stat card', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+10.00亿')).toBeInTheDocument();
    });

    it('shows correct total turnover value in stat card', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('1000.00亿')).toBeInTheDocument();
    });

    it('shows correct up/down/flat counts', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('0')).toBeInTheDocument();
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
      expect(screen.getAllByText('领涨').length).toBe(2); // button + table header
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('领跌')).toBeInTheDocument();
      expect(screen.getByText('资金流入')).toBeInTheDocument();
      expect(screen.getByText('资金流出')).toBeInTheDocument();
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
      fireEvent.click(screen.getByText('资金流入'));
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

    it('renders change_5d column values', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+2.10%')).toBeInTheDocument();
      expect(screen.getByText('-1.50%')).toBeInTheDocument();
      expect(screen.getByText('+0.80%')).toBeInTheDocument();
    });

    it('renders change_1m column values', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+8.50%')).toBeInTheDocument();
      expect(screen.getByText('-3.20%')).toBeInTheDocument();
      expect(screen.getByText('+5.00%')).toBeInTheDocument();
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
      const change5dEls = screen.getAllByText('5日%');
      const change5dTh = change5dEls.find((el) => el.tagName === 'TH');
      expect(change5dTh).toBeTruthy();
      fireEvent.click(change5dTh!);
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking change_1m header sorts by change_1m', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const change1mEls = screen.getAllByText('1月%');
      const change1mTh = change1mEls.find((el) => el.tagName === 'TH');
      expect(change1mTh).toBeTruthy();
      fireEvent.click(change1mTh!);
      const rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking name header sorts by name', () => {
      vi.mocked(hooks.useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const nameEls = screen.getAllByText('板块');
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
