import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectorStockRankPage from '@/pages/SectorStockRankPage';
import { useSectorStocks } from '@/hooks/useTauriQuery';

vi.mock('@/hooks/useTauriQuery', () => ({
  useSectorStocks: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('SectorStockRankPage', () => {
  const mockStocks = [
    { id: '1', ticker: '000001', name: '平安银行', price: 10.5, change: 0.2, change_percent: 1.95, volume: 5000000, turnover_rate: 2.5, main_fund_flow: 1000000, five_day_change: 3.2, sector: '银行' },
    { id: '2', ticker: '000002', name: '万科A', price: 15.2, change: -0.3, change_percent: -1.93, volume: 3000000, turnover_rate: 1.8, main_fund_flow: -500000, five_day_change: -2.1, sector: '房地产' },
    { id: '3', ticker: '600519', name: '贵州茅台', price: 1250.0, change: 5.0, change_percent: 0.4, volume: 2000000, turnover_rate: 0.5, main_fund_flow: 2000000, five_day_change: 1.5, sector: '白酒' },
  ];

  const manyStocks = Array.from({ length: 45 }, (_, i) => ({
    id: String(i + 1),
    ticker: String(600000 + i),
    name: `股票${i + 1}`,
    price: 10 + i,
    change: i % 2 === 0 ? 0.5 : -0.3,
    change_percent: i % 2 === 0 ? 2.0 : -1.5,
    volume: 1000000 * (i + 1),
    turnover_rate: 1.0 + i * 0.1,
    main_fund_flow: i % 2 === 0 ? 1000000 : -500000,
    five_day_change: i % 2 === 0 ? 3.0 : -2.0,
    sector: '测试',
  }));

  const renderPage = (initialEntries = ['/sector?sector=银行']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <SectorStockRankPage />
      </MemoryRouter>
    );
  };

  /* ======================================== */
  /*  Loading State                            */
  /* ======================================== */
  describe('Loading State', () => {
    it('renders loading text', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('正在加载板块数据...')).toBeInTheDocument();
    });

    it('shows loading spinner', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  /* ======================================== */
  /*  Error State                              */
  /* ======================================== */
  describe('Error State', () => {
    it('renders error message', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络超时') } as any);
      renderPage();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/网络超时/)).toBeInTheDocument();
    });

    it('shows retry button', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('网络超时') } as any);
      renderPage();
      expect(screen.getByText('重新加载')).toBeInTheDocument();
    });
  });

  /* ======================================== */
  /*  Empty State                              */
  /* ======================================== */
  describe('Empty State', () => {
    it('renders empty state text', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('暂无板块数据')).toBeInTheDocument();
      expect(screen.getByText('该板块暂时没有符合条件的股票')).toBeInTheDocument();
    });

    it('does not render pagination when empty', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.queryByLabelText('上一页')).not.toBeInTheDocument();
    });
  });

  /* ======================================== */
  /*  Header & Stats                           */
  /* ======================================== */
  describe('Header & Stats', () => {
    it('renders sector title', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('银行')).toBeInTheDocument();
    });

    it('renders back button', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByLabelText('返回板块列表')).toBeInTheDocument();
    });

    it('renders stat cards', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('家上涨')).toBeInTheDocument();
      expect(screen.getByText('家下跌')).toBeInTheDocument();
      expect(screen.getByText('家平盘')).toBeInTheDocument();
    });

    it('calculates stats correctly', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      // 精确限定在统计卡片内查找数字
      const statCards = screen.getAllByText(/家上涨|家下跌|家平盘/);
      expect(statCards[0].previousElementSibling?.textContent).toBe('2'); // 家上涨
      expect(statCards[1].previousElementSibling?.textContent).toBe('1'); // 家下跌
      expect(statCards[2].previousElementSibling?.textContent).toBe('0'); // 家平盘
    });

    it('does not show NaN when stocks is empty', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
      renderPage();
      const body = screen.getByRole('table').textContent || '';
      expect(body).not.toContain('NaN');
    });
  });

  /* ======================================== */
  /*  Sorting                                  */
  /* ======================================== */
  describe('Sorting', () => {
    it('renders all sort buttons', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      // 默认active的是change_percent desc
      expect(screen.getByLabelText('按涨跌幅排序，当前降序')).toBeInTheDocument();
      expect(screen.getByLabelText('按成交量排序')).toBeInTheDocument();
      expect(screen.getByLabelText('按换手率排序')).toBeInTheDocument();
      expect(screen.getByLabelText('按主力资金排序')).toBeInTheDocument();
      expect(screen.getByLabelText('按5日涨幅排序')).toBeInTheDocument();
    });

    it('default sort is change_percent desc', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByLabelText('按涨跌幅排序，当前降序')).toBeInTheDocument();
    });

    it('clicking active sort toggles order', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const btn = screen.getByLabelText('按涨跌幅排序，当前降序');
      fireEvent.click(btn);
      expect(screen.getByLabelText('按涨跌幅排序，当前升序')).toBeInTheDocument();
    });

    it('clicking different sort field changes sort', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const volumeBtn = screen.getByLabelText('按成交量排序');
      fireEvent.click(volumeBtn);
      expect(screen.getByLabelText('按成交量排序，当前降序')).toBeInTheDocument();
      // 涨跌幅按钮不再active
      expect(screen.getByLabelText('按涨跌幅排序')).toBeInTheDocument();
    });

    it('sort direction toggle button works', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const toggleBtn = screen.getByLabelText('切换为升序');
      fireEvent.click(toggleBtn);
      expect(screen.getByLabelText('切换为降序')).toBeInTheDocument();
    });
  });

  /* ======================================== */
  /*  Pagination                               */
  /* ======================================== */
  describe('Pagination', () => {
    it('renders pagination when more than 20 items', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: manyStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByLabelText('上一页')).toBeInTheDocument();
      expect(screen.getByLabelText('下一页')).toBeInTheDocument();
      expect(screen.getByLabelText('第1页')).toBeInTheDocument();
      expect(screen.getByLabelText('第3页')).toBeInTheDocument();
    });

    it('does not render pagination when 1 page', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.queryByLabelText('上一页')).not.toBeInTheDocument();
    });

    it('clicking next page changes page', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: manyStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const nextBtn = screen.getByLabelText('下一页');
      fireEvent.click(nextBtn);
      expect(screen.getByLabelText('第2页')).toHaveAttribute('aria-current', 'page');
    });

    it('clicking page number changes page', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: manyStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const page2 = screen.getByLabelText('第2页');
      fireEvent.click(page2);
      expect(page2).toHaveAttribute('aria-current', 'page');
    });

    it('previous page button is disabled on first page', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: manyStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const prevBtn = screen.getByLabelText('上一页');
      expect(prevBtn).toBeDisabled();
    });
  });

  /* ======================================== */
  /*  Table Content                            */
  /* ======================================== */
  describe('Table Content', () => {
    it('renders stock names and tickers', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('平安银行')).toBeInTheDocument();
      expect(screen.getByText('万科A')).toBeInTheDocument();
      expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    });

    it('renders formatted numbers', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('¥10.50')).toBeInTheDocument();
      expect(screen.getByText('¥15.20')).toBeInTheDocument();
    });

    it('renders change colors correctly', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('+1.95%');
      expect(table.textContent).toContain('-1.93%');
    });

    it('renders turnover rate with %', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByText('2.50%')).toBeInTheDocument();
      expect(screen.getByText('1.80%')).toBeInTheDocument();
    });
  });

  /* ======================================== */
  /*  Row Interaction                          */
  /* ======================================== */
  describe('Row Interaction', () => {
    it('rows are clickable', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const rows = screen.getAllByRole('button');
      expect(rows.length).toBeGreaterThan(0);
    });

    it('rows have keyboard support', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('button');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]).toHaveAttribute('tabIndex', '0');
    });
  });

  /* ======================================== */
  /*  Theme                                    */
  /* ======================================== */
  describe('Theme Support', () => {
    it('uses theme-aware color classes', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      const { container } = renderPage();
      const html = container.innerHTML;
      // Should contain dark: prefixes
      expect(html).toContain('dark:');
      expect(html).toContain('text-black');
      expect(html).toContain('dark:text-white');
    });
  });

  /* ======================================== */
  /*  Accessibility                          */
  /* ======================================== */
  describe('Accessibility', () => {
    it('table has aria-label', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', '板块股票排名');
    });

    it('table headers have scope', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: mockStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      const headers = screen.getAllByRole('columnheader');
      headers.forEach(h => {
        expect(h).toHaveAttribute('scope', 'col');
      });
    });

    it('pagination buttons have aria-labels', () => {
      vi.mocked(useSectorStocks).mockReturnValue({ data: manyStocks, isLoading: false, isError: false, error: null } as any);
      renderPage();
      expect(screen.getByLabelText('上一页')).toBeInTheDocument();
      expect(screen.getByLabelText('下一页')).toBeInTheDocument();
      expect(screen.getByLabelText('第1页')).toBeInTheDocument();
    });
  });
});
