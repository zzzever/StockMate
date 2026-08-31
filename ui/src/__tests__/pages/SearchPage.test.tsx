import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import SearchPage from '@/pages/SearchPage';

// ── Mocks ──
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

// framer-motion: render plain elements, strip animation-only props
vi.mock('framer-motion', () => {
  const strip = ({ initial, animate, exit, transition, whileHover, whileTap, ...rest }: any) => rest;
  return {
    motion: {
      div: ({ children, ...p }: any) => <div {...strip(p)}>{children}</div>,
      button: ({ children, ...p }: any) => <button {...strip(p)}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const searchMock = vi.fn();
const mutateMock = vi.fn();
vi.mock('@/hooks/useTauriQuery', () => ({
  useSearchStocks: (q: string) => searchMock(q),
  useWatchlistAdd: () => ({ mutate: mutateMock }),
}));

const HISTORY_KEY = 'stockmate_search_history';

const STOCK = {
  id: '600519.SH', ticker: '600519', exchange: 'SSE', name: '贵州茅台',
  sector: '白酒', currency: 'CNY', stock_type: 'stock',
};
const ETF = {
  id: '510050.SH', ticker: '510050', exchange: 'SSE', name: '上证50ETF',
  sector: null, currency: 'CNY', stock_type: 'etf',
};

function setSearch(state: { data?: any[]; isLoading?: boolean; error?: Error | null }) {
  searchMock.mockReturnValue({ data: state.data, isLoading: !!state.isLoading, error: state.error ?? null });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<SearchPage />, { wrapper });
}

function getInput() {
  return screen.getByPlaceholderText('輸入代碼或名稱…') as HTMLInputElement;
}

describe('SearchPage', () => {
  beforeEach(() => {
    localStorage.clear();
    navigateMock.mockClear();
    mutateMock.mockClear();
    searchMock.mockReset();
    setSearch({ data: [] }); // default: no results, not loading
  });

  // ── Rendering & states ──
  it('renders title and auto-focuses the input on mount', () => {
    renderPage();
    expect(screen.getByText('股票检索')).toBeInTheDocument();
    expect(document.activeElement).toBe(getInput());
  });

  it('shows the loading state', () => {
    setSearch({ isLoading: true });
    renderPage();
    fireEvent.focus(getInput());
    expect(screen.getByText('搜索中...')).toBeInTheDocument();
  });

  it('shows the error state with the error message', () => {
    setSearch({ error: new Error('Network error') });
    renderPage();
    fireEvent.focus(getInput());
    expect(screen.getByText('搜索失败: Network error')).toBeInTheDocument();
  });

  it('shows the empty state when a query returns no results', () => {
    vi.useFakeTimers();
    setSearch({ data: [] });
    renderPage();
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz' } });
    act(() => { vi.advanceTimersByTime(200); }); // flush debounce → debouncedQuery = 'zzz'
    expect(screen.getByText('未找到该股票')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders a result row with name, ticker and type badge', () => {
    setSearch({ data: [STOCK, ETF] });
    renderPage();
    fireEvent.focus(getInput());
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByText('600519')).toBeInTheDocument();
    expect(screen.getByText('上证50ETF')).toBeInTheDocument();
    expect(screen.getByText('ETF')).toBeInTheDocument();
    expect(screen.getByText(/找到 \d+ 个结果/)).toBeInTheDocument();
  });

  // ── Interactions ──
  it('navigates to the stock detail page when a result is clicked', () => {
    setSearch({ data: [STOCK] });
    renderPage();
    fireEvent.focus(getInput());
    fireEvent.click(screen.getByText('贵州茅台'));
    expect(navigateMock).toHaveBeenCalledWith(
      '/stock?code=600519.SH',
      { state: { stockName: '贵州茅台' } },
    );
  });

  it('selects the first result when Enter is pressed', () => {
    setSearch({ data: [STOCK, ETF] });
    renderPage();
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigateMock).toHaveBeenCalledWith(
      '/stock?code=600519.SH',
      { state: { stockName: '贵州茅台' } },
    );
  });

  it('clears the input and refocuses when the clear button is clicked', () => {
    setSearch({ data: [] });
    renderPage();
    const input = getInput();
    fireEvent.change(input, { target: { value: '茅台' } });
    expect(input.value).toBe('茅台');
    fireEvent.click(screen.getByLabelText('清除搜索'));
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('adds a stock to the watchlist via the star button', () => {
    setSearch({ data: [STOCK] });
    renderPage();
    fireEvent.focus(getInput());
    fireEvent.click(screen.getByLabelText('加入自选 贵州茅台'));
    expect(mutateMock).toHaveBeenCalledWith(
      '600519',
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('debounces input before querying and writes the query into history on select', () => {
    vi.useFakeTimers();
    setSearch({ data: [STOCK] });
    renderPage();
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '茅' } });
    fireEvent.change(input, { target: { value: '茅台' } });
    act(() => { vi.advanceTimersByTime(200); });
    // Only the final debounced value should have reached the hook.
    expect(searchMock).toHaveBeenCalledWith('茅台');
    // Selecting persists to localStorage history.
    fireEvent.click(screen.getByText('贵州茅台'));
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    expect(saved[0]).toMatchObject({ id: '600519.SH', ticker: '600519', name: '贵州茅台' });
    vi.useRealTimers();
  });

  // ── Search history ──
  it('shows the default hint when there is no history and no query', () => {
    setSearch({ data: undefined });
    renderPage();
    expect(screen.getByText(/输入代码、名称或拼音/)).toBeInTheDocument();
  });

  it('renders history, removes a single item, and clears all', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { id: '600519.SH', ticker: '600519', name: '贵州茅台', stockType: 'stock' },
      { id: '510050.SH', ticker: '510050', name: '上证50ETF', stockType: 'etf' },
    ]));
    setSearch({ data: undefined });
    renderPage();
    expect(screen.getByText('搜索历史')).toBeInTheDocument();
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();

    // Remove one
    fireEvent.click(screen.getByLabelText('删除 贵州茅台'));
    expect(screen.queryByText('贵州茅台')).not.toBeInTheDocument();
    expect(screen.getByText('上证50ETF')).toBeInTheDocument();

    // Clear all → default hint returns
    fireEvent.click(screen.getByText('清空'));
    expect(screen.queryByText('上证50ETF')).not.toBeInTheDocument();
    expect(screen.getByText(/输入代码、名称或拼音/)).toBeInTheDocument();
  });

  it('navigates when a history item is clicked', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([
      { id: '600519.SH', ticker: '600519', name: '贵州茅台', stockType: 'stock' },
    ]));
    setSearch({ data: undefined });
    renderPage();
    fireEvent.click(screen.getByText('贵州茅台'));
    expect(navigateMock).toHaveBeenCalledWith(
      '/stock?code=600519.SH',
      { state: { stockName: '贵州茅台' } },
    );
  });
});
