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
    { name: '半导体', change_percent: 3.45, volume: 500_000_000, leading_stock: '中芯国际', leading_change: 5.12, stock_count: 20, up_count: 15, down_count: 5, fund_flow: 1_200_000_000, turnover: 50_000_000_000, change_5d: 2.1, change_1m: 8.5, leading_stock_code: '688981' },
    { name: '银行', change_percent: -0.82, volume: 300_000_000, leading_stock: '招商银行', leading_change: 1.23, stock_count: 18, up_count: 6, down_count: 12, fund_flow: -500_000_000, turnover: 30_000_000_000, change_5d: -1.5, change_1m: -3.2, leading_stock_code: '600036' },
    { name: '白酒', change_percent: 1.25, volume: 200_000_000, leading_stock: '贵州茅台', leading_change: 2.34, stock_count: 15, up_count: 10, down_count: 5, fund_flow: 300_000_000, turnover: 20_000_000_000, change_5d: 0.8, change_1m: 5.0, leading_stock_code: '600519' },
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
      // "主力净流入" and "总成交额" appear in both stat cards and table headers
      const allFundFlow = screen.getAllByText('主力净流入');
      expect(allFundFlow.length).toBeGreaterThanOrEqual(1);
      const allTurnover = screen.getAllByText('总成交额');
      expect(allTurnover.length).toBeGreaterThanOrEqual(1);
    });

    it('shows correct total fund flow value in stat card', () => {
      // Total fund_flow = 1_200_000_000 + (-500_000_000) + 300_000_000 = 1_000_000_000
      // fmtFundFlow(1_000_000_000) = '+10.00亿'
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+10.00亿')).toBeInTheDocument();
    });

    it('shows correct total turnover value in stat card', () => {
      // Total turnover = 50_000_000_000 + 30_000_000_000 + 20_000_000_000 = 100_000_000_000
      // fmtTurnover(100_000_000_000) = '1000.00亿'
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('1000.00亿')).toBeInTheDocument();
    });

    it('shows correct up/down/flat counts', () => {
      // 半导体: +3.45 -> up, 银行: -0.82 -> down, 白酒: +1.25 -> up
      // up=2, down=1, flat=0
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const totalCards = screen.getAllByText('3');
      expect(totalCards.length).toBeGreaterThanOrEqual(1); // total
      expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // up
      expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // down
      expect(screen.getByText('0')).toBeInTheDocument(); // flat
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
      // up/down counts rendered as "15/5" or "15 / 5" in table
      const table = document.querySelector('table');
      expect(table?.textContent).toMatch(/15\s*\/\s*5/);
    });

    it('renders leading stock info', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('中芯国际')).toBeInTheDocument();
      expect(screen.getByText('招商银行')).toBeInTheDocument();
    });

    it('renders fund_flow column values', () => {
      // fund_flow: 半导体 (1_200_000_000/1e8=12.00) → '+12.00亿'
      //           银行 (-500_000_000/1e8=-5.00) → '-5.00亿'
      //           白酒 (300_000_000/1e8=3.00) → '+3.00亿'
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+12.00亿')).toBeInTheDocument();
      expect(screen.getByText('-5.00亿')).toBeInTheDocument();
      expect(screen.getByText('+3.00亿')).toBeInTheDocument();
    });

    it('renders turnover column values', () => {
      // turnover: 半导体 (50_000_000_000/1e8=500) → '500.00亿'
      //           银行 (30_000_000_000/1e8=300) → '300.00亿'
      //           白酒 (20_000_000_000/1e8=200) → '200.00亿'
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('500.00亿')).toBeInTheDocument();
      expect(screen.getByText('300.00亿')).toBeInTheDocument();
      expect(screen.getByText('200.00亿')).toBeInTheDocument();
    });

    it('renders change_5d column values', () => {
      // change_5d: 半导体 +2.10%, 银行 -1.50%, 白酒 +0.80%
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+2.10%')).toBeInTheDocument();
      expect(screen.getByText('-1.50%')).toBeInTheDocument();
      expect(screen.getByText('+0.80%')).toBeInTheDocument();
    });

    it('renders change_1m column values', () => {
      // change_1m: 半导体 +8.50%, 银行 -3.20%, 白酒 +5.00%
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('+8.50%')).toBeInTheDocument();
      expect(screen.getByText('-3.20%')).toBeInTheDocument();
      expect(screen.getByText('+5.00%')).toBeInTheDocument();
    });

    it('filters by search', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const input = screen.getByPlaceholderText('搜索板块...');
      fireEvent.change(input, { target: { value: '半导' } });
      expect(screen.getByText('半导体')).toBeInTheDocument();
      expect(screen.queryByText('银行')).not.toBeInTheDocument();
    });

    it('shows "未找到匹配板块" when search matches nothing', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
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
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      const rows = screen.getAllByRole('row');
      // First data row should have the highest change_percent (半导体: +3.45%)
      expect(rows[1].textContent).toContain('半导体');
    });

    it('clicking volume header sorts by volume', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // "成交量" appears in both the sort dropdown and the table header;
      // click the table header (the <th> element)
      const volumeEls = screen.getAllByText('成交量');
      const volumeTh = volumeEls.find((el) => el.tagName === 'TH');
      expect(volumeTh).toBeTruthy();
      fireEvent.click(volumeTh!);
      const rows = screen.getAllByRole('row');
      // After clicking volume sort (desc), the first row should be the highest volume
      expect(rows[1].textContent).toContain('半导体'); // 半导体 has highest volume
    });

    it('clicking fund_flow header sorts by fund_flow', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // "主力净流入" appears in both stat cards and table header;
      // click the table header (the <th> element)
      const fundFlowEls = screen.getAllByText('主力净流入');
      const fundFlowTh = fundFlowEls.find((el) => el.tagName === 'TH');
      expect(fundFlowTh).toBeTruthy();
      fireEvent.click(fundFlowTh!);
      const rows = screen.getAllByRole('row');
      // After clicking fund_flow sort (desc), the first row should be the highest fund_flow
      expect(rows[1].textContent).toContain('半导体'); // 半导体 has highest fund_flow (1.2B)
    });

    it('clicking turnover header sorts by turnover', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // "成交额" only appears in table header (stat card uses "总成交额")
      const turnoverEls = screen.getAllByText('成交额');
      const turnoverTh = turnoverEls.find((el) => el.tagName === 'TH');
      expect(turnoverTh).toBeTruthy();
      fireEvent.click(turnoverTh!);
      const rows = screen.getAllByRole('row');
      // After clicking turnover sort (desc), first row should be highest turnover
      expect(rows[1].textContent).toContain('半导体'); // 半导体 has highest turnover (50B)
    });

    it('clicking change_5d header sorts by change_5d', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // "5日涨幅" only appears in table header
      const change5dEls = screen.getAllByText('5日涨幅');
      const change5dTh = change5dEls.find((el) => el.tagName === 'TH');
      expect(change5dTh).toBeTruthy();
      fireEvent.click(change5dTh!);
      const rows = screen.getAllByRole('row');
      // After clicking change_5d sort (desc), first row should be highest change_5d
      expect(rows[1].textContent).toContain('半导体'); // 半导体 has highest change_5d (2.1)
    });

    it('clicking change_1m header sorts by change_1m', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // "1月涨幅" only appears in table header
      const change1mEls = screen.getAllByText('1月涨幅');
      const change1mTh = change1mEls.find((el) => el.tagName === 'TH');
      expect(change1mTh).toBeTruthy();
      fireEvent.click(change1mTh!);
      const rows = screen.getAllByRole('row');
      // After clicking change_1m sort (desc), first row should be highest change_1m
      expect(rows[1].textContent).toContain('半导体'); // 半导体 has highest change_1m (8.5)
    });

    it('clicking name header sorts by name', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // "板块名称" only appears in table header
      const nameEls = screen.getAllByText('板块名称');
      const nameTh = nameEls.find((el) => el.tagName === 'TH');
      expect(nameTh).toBeTruthy();
      fireEvent.click(nameTh!);
      const rows = screen.getAllByRole('row');
      // After clicking name sort (desc), first row should be first alphabetically (银行 -> 白酒 -> 半导体)
      // 半 < 白 < 银 in Chinese pinyin (bàn < bái < yín)
      // Actually, JS String.localeCompare in default mode: 半 (U+534A) < 白 (U+767D) < 银 (U+94F6) by Unicode code point
      // So descending: 银 > 白 > 半
      expect(rows[1].textContent).toContain('银行'); // 银 is highest
    });

    it('clicking change_percent header again toggles sort order', () => {
      vi.mocked(useHotSectors).mockReturnValue({ data: mockSectors(), isLoading: false, isError: false, error: null } as any);
      renderPage();
      // Default sort is change_percent desc -> first row is 半导体 (+3.45%)
      let rows = screen.getAllByRole('row');
      expect(rows[1].textContent).toContain('半导体');

      // Click "涨跌幅" header to toggle to asc
      const chgEls = screen.getAllByText('涨跌幅');
      const chgTh = chgEls.find((el) => el.tagName === 'TH');
      expect(chgTh).toBeTruthy();
      fireEvent.click(chgTh!);
      rows = screen.getAllByRole('row');
      // After toggle to asc, first row should be the lowest change_percent (银行: -0.82%)
      expect(rows[1].textContent).toContain('银行');
    });
  });
});
