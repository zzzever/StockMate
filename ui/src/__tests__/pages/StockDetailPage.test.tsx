import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import StockDetailPage from '@/pages/StockDetailPage';
import { useStockList, useStockDetail, useStockHistory, useStockFinance, useStockFundFlow, useSupportResistance, useRealtimeQuote, useIntraday, useWatchlistCheck, useWatchlistAdd, useWatchlistRemove } from '@/hooks/useTauriQuery';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { getChartTheme } from '@/config/chartThemes';

// ── Route mock ──
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// ── Hook mocks (all vi.fn so they can be overridden per test) ──
vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(),
  useStockDetail: vi.fn(),
  useStockHistory: vi.fn(),
  useStockFinance: vi.fn(),
  useStockFundFlow: vi.fn(),
  useSupportResistance: vi.fn(),
  useRealtimeQuote: vi.fn(),
  useWatchlistCheck: vi.fn(() => ({ data: false, isLoading: false })),
  useWatchlistAdd: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useWatchlistRemove: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useIntraday: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector({ chartStyle: 'classic', darkMode: true, klineBarSpacing: undefined, setKlineBarSpacing: vi.fn(), setSelectedStock: vi.fn() }),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: vi.fn(() => ({ setTheme: vi.fn() })) }));

// Shared state between the lightweight-charts mock factory (hoisted) and the tests,
// so we can capture crosshair-move callbacks and simulate setCrosshairPosition throwing
// "Value is null" (which real lightweight-charts does when the target series is empty).
const chartMockState = vi.hoisted(() => ({
  crosshairCallbacks: [] as ((param: any) => void)[],
  clickCallbacks: [] as ((param: any) => void)[],
  setCrosshairThrows: false,
  priceLineCount: 0,
  removedPriceLines: [] as any[],
  createdPriceLines: [] as any[],
  coordinateToPriceValue: null as number | null,
  fitContentCalls: 0,
  priceScaleAutoScaleCalls: 0,
  setVisibleRangeCalls: 0,
}));

vi.mock('lightweight-charts', () => ({
  LineStyle: { Solid: 0, Dashed: 2, Dotted: 1 },
  createChart: vi.fn(() => {
    const mockSeries = {
      setData: vi.fn(),
      applyOptions: vi.fn(),
      removePriceLine: vi.fn((line: any) => { chartMockState.removedPriceLines.push(line); }),
      createPriceLine: vi.fn((opts: any) => { chartMockState.createdPriceLines.push(opts); return { __id: ++chartMockState.priceLineCount, opts }; }),
      coordinateToPrice: vi.fn(() => chartMockState.coordinateToPriceValue),
    };
    return {
      addCandlestickSeries: vi.fn(() => ({ ...mockSeries })),
      addLineSeries: vi.fn(() => ({ ...mockSeries })),
      addHistogramSeries: vi.fn(() => ({ ...mockSeries, setColor: vi.fn() })),
      timeScale: vi.fn(() => ({
        applyOptions: vi.fn(),
        fitContent: vi.fn(() => { chartMockState.fitContentCalls++; }),
        scrollToPosition: vi.fn(),
        getVisibleRange: vi.fn(() => ({ from: 0, to: 100 })),
        setVisibleRange: vi.fn(() => { chartMockState.setVisibleRangeCalls++; }),
        subscribeVisibleTimeRangeChange: vi.fn(() => vi.fn()),
        subscribeVisibleLogicalRangeChange: vi.fn(() => vi.fn()),
        getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 80 })),
        options: vi.fn(() => ({ barSpacing: 6 })),
        timeToCoordinate: vi.fn(() => 50),
      })),
      subscribeCrosshairMove: vi.fn((cb: (param: any) => void) => { chartMockState.crosshairCallbacks.push(cb); }),
      subscribeClick: vi.fn((cb: (param: any) => void) => { chartMockState.clickCallbacks.push(cb); }),
      setCrosshairPosition: vi.fn(() => { if (chartMockState.setCrosshairThrows) throw new Error('Value is null'); }),
      clearCrosshairPosition: vi.fn(),
      priceScale: vi.fn(() => ({ applyOptions: vi.fn((o: any) => { if (o?.autoScale) chartMockState.priceScaleAutoScaleCalls++; }) })),
      remove: vi.fn(),
      applyOptions: vi.fn(),
    };
  }),
}));

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(client: QueryClient, route: string) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}><StockDetailPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const defaultStockList = [{ id: '600519', ticker: '600519', name: '贵州茅台', exchange: 'SH', currency: 'CNY' }];
const defaultChartHistory = [
  { date: '2025-01-01', open: 100, high: 102, low: 99, close: 101, volume: 1000 },
  { date: '2025-01-02', open: 101, high: 103, low: 100, close: 102, volume: 1200 },
  { date: '2025-01-03', open: 102, high: 104, low: 101, close: 103, volume: 1100 },
  { date: '2025-01-04', open: 103, high: 105, low: 102, close: 104, volume: 1300 },
  { date: '2025-01-05', open: 104, high: 106, low: 103, close: 105, volume: 1400 },
];

describe('StockDetailPage', () => {
  let client: QueryClient;
  let navigateMock: ReturnType<typeof vi.fn>;
  let mockChartData: any[];
  let mockDayData: any[];
  let refetchHistoryMock: ReturnType<typeof vi.fn>;
  let refetchIntradayMock: ReturnType<typeof vi.fn>;

  function setupStockHistory(chartData: any[] = defaultChartHistory, dayData: any[] = []) {
    mockChartData = chartData;
    mockDayData = dayData;
    vi.mocked(useStockHistory).mockImplementation((_code?: string, days?: number, period?: string) => {
      if (period === 'day' && days === 10) {
        return { data: mockDayData, isLoading: false, isFetching: false, refetch: vi.fn() } as any;
      }
      return { data: mockChartData, isLoading: false, isFetching: false, refetch: refetchHistoryMock } as any;
    });
  }

  beforeEach(() => {
    client = createClient();
    navigateMock = vi.fn();
    refetchHistoryMock = vi.fn();
    refetchIntradayMock = vi.fn();
    chartMockState.crosshairCallbacks.length = 0;
    chartMockState.clickCallbacks.length = 0;
    chartMockState.setCrosshairThrows = false;
    chartMockState.priceLineCount = 0;
    chartMockState.removedPriceLines.length = 0;
    chartMockState.createdPriceLines.length = 0;
    chartMockState.coordinateToPriceValue = null;
    chartMockState.fitContentCalls = 0;
    chartMockState.priceScaleAutoScaleCalls = 0;
    chartMockState.setVisibleRangeCalls = 0;
    vi.mocked(invoke).mockReset();
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(navigateMock);

    vi.mocked(useStockList).mockReturnValue({ data: defaultStockList, isLoading: false } as any);
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false } as any);
    setupStockHistory(defaultChartHistory, []);
    vi.mocked(useStockFinance).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useStockFundFlow).mockReturnValue({ data: [], isLoading: false } as any);
    vi.mocked(useSupportResistance).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useIntraday).mockReturnValue({ data: [], isLoading: false, isFetching: false, refetch: refetchIntradayMock } as any);
    vi.mocked(useWatchlistCheck).mockReturnValue({ data: false, isLoading: false });
    vi.mocked(useWatchlistAdd).mockReturnValue({ mutate: vi.fn(), isPending: false });
    vi.mocked(useWatchlistRemove).mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  // ── 1. No code ──
  it('shows empty prompt when no stock code and does not render chart', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [], isLoading: false } as any);
    renderPage(client, '/stock');
    expect(screen.getByText('请在自选页选择股票')).toBeInTheDocument();
    expect(screen.queryByText('分时')).toBeNull();
  });

  // ── 2. Name + code ──
  it('renders stock name and code from URL', () => {
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByText('600519')).toBeInTheDocument();
  });

  // ── 3. Price up ──
  it('renders positive price change with up color', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 1800.50, prev_close: 1785.30, change: 15.20, change_percent: 0.85, volume: 5000000, amount: 9000000000, high: 1810, low: 1790, open: 1795, turnover_rate: 0.5, ratio: 1.2, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/1800\.50/)).toBeInTheDocument();
    expect(screen.getByText(/15\.20/)).toBeInTheDocument();
    const priceEl = screen.getByText(/1800\.50/);
    expect(priceEl).toHaveStyle({ color: 'hsl(var(--price-up))' });
  });

  // ── 4. Price down ──
  it('renders negative price change with down color', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 1750.00, prev_close: 1785.30, change: -35.30, change_percent: -1.98, volume: 6000000, amount: 10000000000, high: 1790, low: 1740, open: 1780, turnover_rate: 0.8, ratio: 0.9, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/-35\.30/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.98%/)).toBeInTheDocument();
    const priceEl = screen.getByText(/1750\.00/);
    expect(priceEl).toHaveStyle({ color: 'hsl(var(--price-down))' });
  });

  // ── 5. Price zero (price === prevClose) ──
  it('renders zero change with up color', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 100.00, prev_close: 100.00, change: 0, change_percent: 0, volume: 1000, amount: 100000, high: 101, low: 99, open: 100, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
    const priceEl = screen.getByText(/100\.00/);
    expect(priceEl).toHaveStyle({ color: 'hsl(var(--price-up))' });
  });

  // ── 6. Financial values ──
  it('renders financial values correctly', () => {
    vi.mocked(useStockFinance).mockReturnValue({ data: { pe: 35.2, pb: 8.5, roe: 0.18, stock_id: '600519' } as any, isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 1800, prev_close: 1785, change: 15, change_percent: 0.84, volume: 5000000, amount: 9000000000, high: 1810, low: 1790, open: 1795, turnover_rate: 0.52, ratio: 1.2, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText(/指标财务/));
    // PE displayed in compact metrics strip
    expect(screen.getByText('35.2')).toBeInTheDocument();
    // Turnover rate displayed once in compact strip
    expect(screen.getByText('0.52%')).toBeInTheDocument();
    // Amount displayed (9,000,000,000 → 90.0亿)
    expect(screen.getByText(/90\.0亿/)).toBeInTheDocument();
  });

  // ── 7. Empty realtime ──
  it('shows -- for all data cards when realtimeQuote is null and price as ¥0.00', () => {
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText(/指标财务/));
    expect(screen.getByText(/0\.00/)).toBeInTheDocument();
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(6);
  });

  // ── 8. Intraday loading ──
  it('switches to minute period and shows spinner when loading', () => {
    vi.mocked(useIntraday).mockReturnValue({ data: [], isLoading: true } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('分时'));
    // minute branch renders a spinning RefreshCw while intraday data loads
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  // ── 9. K-line loading ──
  it('shows loading spinner for K-line chart when loading with empty data', () => {
    vi.mocked(useStockHistory).mockImplementation((_code?: string, _days?: number, _period?: string) => {
      return { data: [], isLoading: true } as any;
    });
    renderPage(client, '/stock?code=600519');
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  // ── 10. Error state ──
  it('shows error message when stock detail fails and stock list exists', () => {
    vi.mocked(useStockDetail).mockReturnValue({ data: null, isLoading: false, error: new Error('API Error') } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
  });

  // ── 11. MA values ──
  it('renders MA5/MA10/MA20/MA60 labels and values when period=day with sufficient data', () => {
    const data60 = Array.from({ length: 60 }, (_, i) => ({
      date: `2025-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000,
    }));
    vi.mocked(useStockHistory).mockImplementation((_code?: string, days?: number, period?: string) => {
      if (period === 'day' && days === 10) return { data: [], isLoading: false } as any;
      return { data: data60, isLoading: false } as any;
    });
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText('MA5')).toBeInTheDocument();
    expect(screen.getByText('MA10')).toBeInTheDocument();
    expect(screen.getByText('MA20')).toBeInTheDocument();
    expect(screen.getByText('MA60')).toBeInTheDocument();
    // Verify MA5 value (last 5 closes 156-160 → avg 158.00)
    expect(screen.getByText((content) => content.includes('158.00'))).toBeInTheDocument();
  });

  // ── 12. Period switch ──
  it('highlights active period button with bottom border', () => {
    renderPage(client, '/stock?code=600519');
    const dayBtn = screen.getByText('日线');
    expect(dayBtn.getAttribute('style')).toContain('border-bottom: 2px solid hsl(var(--text-primary))');
    fireEvent.click(screen.getByText('周线'));
    expect(screen.getByText('周线').getAttribute('style')).toContain('border-bottom: 2px solid hsl(var(--text-primary))');
    expect(dayBtn.getAttribute('style')).toContain('border-bottom: 2px solid transparent');
  });

  // ── 13. Indicator switch ──
  it('highlights active indicator button', () => {
    renderPage(client, '/stock?code=600519');
    // IndicatorPicker shows the current indicator name (default: CCI)
    // Find the button element with CCI text (the picker button, not the inline params label)
    const allCci = screen.getAllByText('CCI');
    const pickerBtn = allCci.find(el => el.tagName === 'BUTTON') || allCci[0];
    expect(pickerBtn).toBeInTheDocument();
    // Click to open dropdown
    fireEvent.click(pickerBtn);
    // Dropdown should be open - find any indicator in the list
    const macdBtn = screen.getByText('MACD');
    expect(macdBtn).toBeInTheDocument();
  });

  // ── 14. BOLL toggle ──
  it('toggles BOLL active state on click', () => {
    renderPage(client, '/stock?code=600519');
    const bollBtns = screen.getAllByText('BOLL');
    const bollBtn = bollBtns[bollBtns.length - 1]; // last BOLL is the overlay toggle
    expect(bollBtn.getAttribute('style')).toContain('border-bottom: 2px solid transparent');
    fireEvent.click(bollBtn);
    expect(bollBtn.getAttribute('style')).toContain('border-bottom: 2px solid hsl(var(--text-primary))');
    fireEvent.click(bollBtn);
    expect(bollBtn.getAttribute('style')).toContain('border-bottom: 2px solid transparent');
  });

  // ── 15. Draw mode toggle ──
  it('shows drawing mode banner when draw is activated, hides on second click', () => {
    renderPage(client, '/stock?code=600519');
    const drawBtn = screen.getByText('画线');
    fireEvent.click(drawBtn);
    expect(screen.getByText(/✦ 画线模式/)).toBeInTheDocument();
    expect(screen.getByText('退出画线')).toBeInTheDocument();
    fireEvent.click(screen.getByText('退出画线'));
    expect(screen.queryByText(/✦ 画线模式/)).toBeNull();
  });

  // ── 16. Watchlist add ──
  it('calls add.mutate when star is clicked and stock is not in watchlist', () => {
    const addMutate = vi.fn();
    vi.mocked(useWatchlistCheck).mockReturnValue({ data: false, isLoading: false });
    vi.mocked(useWatchlistAdd).mockReturnValue({ mutate: addMutate, isPending: false });
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByLabelText('加入自选'));
    expect(addMutate).toHaveBeenCalledWith('600519', expect.any(Object));
  });

  // ── 17. Watchlist remove ──
  it('calls remove.mutate when star is clicked and stock is in watchlist', () => {
    const removeMutate = vi.fn();
    vi.mocked(useWatchlistCheck).mockReturnValue({ data: true, isLoading: false });
    vi.mocked(useWatchlistRemove).mockReturnValue({ mutate: removeMutate, isPending: false });
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByLabelText('取消自选'));
    expect(removeMutate).toHaveBeenCalledWith('600519', expect.any(Object));
  });

  // ── 18. Back button ──
  it('calls navigate(-1) when back button is clicked', () => {
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('←'));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  // ── 19. Refresh button ──
  it('refetches history and invalidates realtime on refresh in day period', () => {
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByTitle('刷新'));
    expect(refetchHistoryMock).toHaveBeenCalledTimes(1);
    expect(refetchIntradayMock).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stocks', 'realtime', '600519'] });
  });

  // ── 19b. Refresh button in minute period refetches intraday ──
  it('refetches intraday (not history) on refresh in minute period', () => {
    vi.mocked(useIntraday).mockReturnValue({ data: [{ time: '09:30', price: 100 }], isLoading: false, isFetching: false, refetch: refetchIntradayMock } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('分时'));
    fireEvent.click(screen.getByTitle('刷新'));
    expect(refetchIntradayMock).toHaveBeenCalledTimes(1);
    expect(refetchHistoryMock).not.toHaveBeenCalled();
  });

  // ── 20. Support/resistance ──
  it('renders support and resistance values', () => {
    vi.mocked(useSupportResistance).mockReturnValue({ data: { stock_id: '600519', supports: [15.2], resistances: [18.5] }, isLoading: false } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText(/指标财务/));
    expect(screen.getByText('18.50')).toBeInTheDocument();
    expect(screen.getByText('15.20')).toBeInTheDocument();
  });

  // ── 21. Fund flow positive ──
  it('renders positive fund flow value', () => {
    vi.mocked(useStockFundFlow).mockReturnValue({ data: [{ main_inflow: 500000000 }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 100, prev_close: 99, change: 1, change_percent: 1.01, volume: 1000, amount: 100000, high: 101, low: 99, open: 100, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText(/指标财务/));
    expect(screen.getByText(/5\.0亿/)).toBeInTheDocument();
  });

  // ── 22. prevClose=0 edge case ──
  it('handles prevClose=0 without NaN or Infinity', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 100, prev_close: 0, change: 100, change_percent: 0, volume: 1000, amount: 100000, high: 101, low: 99, open: 100, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/0\.00%/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.queryByText(/Infinity/)).toBeNull();
  });

  // ── 23. Limit prices for 600519 (10%) ──
  it('shows correct limit up/down for mainboard stock', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 1800, prev_close: 1785.30, change: 14.70, change_percent: 0.82, volume: 5000000, amount: 9000000000, high: 1810, low: 1790, open: 1795, turnover_rate: 0.5, ratio: 1.2, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText('涨停 1963.83')).toBeInTheDocument();
    expect(screen.getByText('跌停 1606.77')).toBeInTheDocument();
  });

  // ── 24. Limit prices for 创业板 (20%) ──
  it('shows correct limit up/down for 创业板 stock', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '300750', ticker: '300750', name: '宁德时代', exchange: 'SZ', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 200, prev_close: 180, change: 20, change_percent: 11.11, volume: 10000000, amount: 2000000000, high: 205, low: 178, open: 185, turnover_rate: 1.5, ratio: 1.5, ticker: '300750', name: '宁德时代' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=300750');
    expect(screen.getByText('涨停 216.00')).toBeInTheDocument();
    expect(screen.getByText('跌停 144.00')).toBeInTheDocument();
  });

  // ── 25. 5-day change ──
  it('calculates 5-day change correctly from daily history', () => {
    // 10 daily bars; index 4 (6th from last) close=100, last close=110 → (110-100)/100*100=10%
    const dayData = [
      { date: '2025-01-01', open: 100, high: 102, low: 99, close: 100, volume: 1000 },
      { date: '2025-01-02', open: 101, high: 103, low: 100, close: 101, volume: 1100 },
      { date: '2025-01-03', open: 102, high: 104, low: 101, close: 102, volume: 1200 },
      { date: '2025-01-04', open: 103, high: 105, low: 102, close: 103, volume: 1300 },
      { date: '2025-01-05', open: 104, high: 106, low: 103, close: 100, volume: 1400 }, // index 4 = length-6
      { date: '2025-01-06', open: 105, high: 107, low: 104, close: 106, volume: 1500 },
      { date: '2025-01-07', open: 106, high: 108, low: 105, close: 107, volume: 1600 },
      { date: '2025-01-08', open: 107, high: 109, low: 106, close: 108, volume: 1700 },
      { date: '2025-01-09', open: 108, high: 110, low: 107, close: 109, volume: 1800 },
      { date: '2025-01-10', open: 109, high: 111, low: 108, close: 110, volume: 1900 }, // index 9 = last
    ];
    vi.mocked(useStockHistory).mockImplementation((_code?: string, days?: number, period?: string) => {
      if (period === 'day' && days === 10) return { data: dayData, isLoading: false } as any;
      return { data: defaultChartHistory, isLoading: false } as any;
    });
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 110, prev_close: 109, change: 1, change_percent: 0.92, volume: 1000, amount: 100000, high: 111, low: 108, open: 109, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText((content) => content.includes('5日') && content.includes('+10.00%'))).toBeInTheDocument();
  });

  // ── 26. ST stock limit (5%) ──
  it('shows 5% limit for ST stocks on mainboard', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '600123', ticker: '600123', name: '*ST庞大', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 1.5, prev_close: 1.52, change: -0.02, change_percent: -1.32, volume: 1000000, amount: 1500000, high: 1.55, low: 1.48, open: 1.52, turnover_rate: 0.5, ratio: 0.8, ticker: '600123', name: '*ST庞大' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600123');
    // 涨停 = round(1.52 * 1.05) = 1.60
    expect(screen.getByText('涨停 1.60')).toBeInTheDocument();
    // 跌停 = round(1.52 * 0.95) = 1.44
    expect(screen.getByText('跌停 1.44')).toBeInTheDocument();
  });

  // ── 27. Limit prices for 科创板 688 (20%) ──
  it('shows correct limit up/down for 科创板 stock', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '688981', ticker: '688981', name: '中芯国际', exchange: 'SH', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 52, prev_close: 50, change: 2, change_percent: 4.0, volume: 1000000, amount: 52000000, high: 55, low: 49, open: 50, turnover_rate: 0.5, ratio: 1.2, ticker: '688981', name: '中芯国际' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=688981');
    expect(screen.getByText('涨停 60.00')).toBeInTheDocument();
    expect(screen.getByText('跌停 40.00')).toBeInTheDocument();
  });

  // ── 28. Limit prices for 北交所 (30%) ──
  it('shows correct limit up/down for 北交所 stock', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '920819', ticker: '920819', name: '颖泰生物', exchange: 'BJ', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 11, prev_close: 10, change: 1, change_percent: 10.0, volume: 1000000, amount: 11000000, high: 12, low: 9.5, open: 10, turnover_rate: 0.5, ratio: 1.2, ticker: '920819', name: '颖泰生物' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=920819');
    expect(screen.getByText('涨停 13.00')).toBeInTheDocument();
    expect(screen.getByText('跌停 7.00')).toBeInTheDocument();
  });

  // ── 29. ST on 创业板 keeps 20% (board takes priority over ST) ──
  it('applies 20% limit for ST stock on 创业板 (not 5%)', () => {
    vi.mocked(useStockList).mockReturnValue({ data: [{ id: '300123', ticker: '300123', name: '*ST某某', exchange: 'SZ', currency: 'CNY' }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 105, prev_close: 100, change: 5, change_percent: 5.0, volume: 1000000, amount: 105000000, high: 110, low: 98, open: 100, turnover_rate: 0.5, ratio: 1.2, ticker: '300123', name: '*ST某某' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=300123');
    // 20% not 5% → 120.00 / 80.00, proving board check precedes ST check
    expect(screen.getByText('涨停 120.00')).toBeInTheDocument();
    expect(screen.getByText('跌停 80.00')).toBeInTheDocument();
  });

  // ── 30. 5-day change hidden when fewer than 6 daily bars ──
  it('hides 5-day change when daily history has fewer than 6 bars', () => {
    const shortDay = [
      { date: '2025-01-01', open: 100, high: 102, low: 99, close: 100, volume: 1000 },
      { date: '2025-01-02', open: 101, high: 103, low: 100, close: 102, volume: 1100 },
      { date: '2025-01-03', open: 102, high: 104, low: 101, close: 103, volume: 1200 },
    ];
    vi.mocked(useStockHistory).mockImplementation((_code?: string, days?: number, period?: string) => {
      if (period === 'day' && days === 10) return { data: shortDay, isLoading: false } as any;
      return { data: defaultChartHistory, isLoading: false } as any;
    });
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 103, prev_close: 102, change: 1, change_percent: 0.98, volume: 1000, amount: 100000, high: 104, low: 101, open: 102, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.queryByText(/5日/)).toBeNull();
  });

  // ── 31. Limit prices hidden when prevClose is 0 ──
  it('hides limit up/down prices when prevClose is 0', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({
      data: { current_price: 100, prev_close: 0, change: 100, change_percent: 0, volume: 1000, amount: 100000, high: 101, low: 99, open: 100, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' },
      isLoading: false,
    } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.queryByText(/涨停/)).toBeNull();
    expect(screen.queryByText(/跌停/)).toBeNull();
  });

  // ── 32. Crosshair sync swallows "Value is null" from empty sub-chart series ──
  it('does not throw when setCrosshairPosition throws (e.g. empty indicator series)', () => {
    renderPage(client, '/stock?code=600519');
    // Chart mounted → crosshair-move callbacks registered for main + sub charts
    expect(chartMockState.crosshairCallbacks.length).toBeGreaterThan(0);
    chartMockState.setCrosshairThrows = true;
    // Firing a crosshair move must not let the "Value is null" error escape the handler
    expect(() => {
      chartMockState.crosshairCallbacks.forEach((cb) => cb({ time: '2025-01-01', point: { x: 10, y: 20 } }));
    }).not.toThrow();
  });

  // ── 33. ESC in draw mode undoes the last drawn line, then exits when none remain ──
  it('ESC in draw mode removes the last drawn line (undo) and exits only when none remain', () => {
    chartMockState.coordinateToPriceValue = 101; // makes each click produce a valid price line
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('画线'));
    expect(chartMockState.clickCallbacks.length).toBeGreaterThan(0);
    // Draw two horizontal lines
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 20 } }));
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 40 } }));
    expect(chartMockState.priceLineCount).toBe(2);
    // First ESC → undo last line, still in draw mode (banner remains)
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(chartMockState.removedPriceLines.length).toBe(1);
    expect(screen.getByText(/✦ 画线模式/)).toBeInTheDocument();
    // Second ESC → undo remaining line, still in draw mode
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(chartMockState.removedPriceLines.length).toBe(2);
    expect(screen.getByText(/✦ 画线模式/)).toBeInTheDocument();
    // Third ESC → nothing left to undo → exit draw mode (banner gone)
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/✦ 画线模式/)).toBeNull();
  });

  // ── 34. 恢复比例 button: 显示最近一个月区间(setVisibleRange) + re-enable price autoScale ──
  it('恢复比例 button shows recent-month range and re-enables price autoScale on main/volume/indicator', () => {
    renderPage(client, '/stock?code=600519');
    const svrBefore = chartMockState.setVisibleRangeCalls;
    expect(chartMockState.priceScaleAutoScaleCalls).toBe(0);
    fireEvent.click(screen.getByTitle('恢复默认比例'));
    expect(chartMockState.setVisibleRangeCalls).toBe(svrBefore + 3);
    expect(chartMockState.priceScaleAutoScaleCalls).toBe(3);
  });

  // ── 35. 清线 button: confirm then remove every drawn line + exit draw mode ──
  it('清线 button removes all drawn lines after confirm and exits draw mode', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    chartMockState.coordinateToPriceValue = 101;
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('画线'));
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 20 } }));
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 40 } }));
    expect(chartMockState.priceLineCount).toBe(2);
    fireEvent.click(screen.getByText('清线'));
    expect(confirmSpy).toHaveBeenCalledWith('清除所有画线?');
    expect(chartMockState.removedPriceLines.length).toBe(2);
    expect(screen.queryByText(/✦ 画线模式/)).toBeNull();
    confirmSpy.mockRestore();
  });

  // ── 36. MA labels tinted with matching theme line colors (distinct per line) ──
  it('tints MA5/MA10/MA20/MA60 labels with their matching theme colors', () => {
    const data60 = Array.from({ length: 60 }, (_, i) => ({
      date: `2025-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000,
    }));
    vi.mocked(useStockHistory).mockImplementation((_c?: string, days?: number, period?: string) =>
      (period === 'day' && days === 10 ? { data: [], isLoading: false } : { data: data60, isLoading: false }) as any);
    renderPage(client, '/stock?code=600519');
    const theme = getChartTheme('classic', true);
    expect(screen.getByText('MA5')).toHaveStyle({ color: theme.ma5Color });
    expect(screen.getByText('MA10')).toHaveStyle({ color: theme.ma10Color });
    expect(screen.getByText('MA20')).toHaveStyle({ color: theme.ma20Color });
    expect(screen.getByText('MA60')).toHaveStyle({ color: theme.ma60Color });
    // per-line tinting means the first three are distinct colors, not one flat color
    expect(new Set([theme.ma5Color, theme.ma10Color, theme.ma20Color]).size).toBe(3);
  });

  // ── 37. Semantic up/down colors on SR / 5-day change / main fund flow ──
  it('applies up/down colors to support-resistance, 5-day change and main fund flow', () => {
    const dayData = Array.from({ length: 10 }, (_, i) => ({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, open: 100, high: 101, low: 99, close: i === 4 ? 100 : 100 + i, volume: 1000 }));
    dayData[9].close = 110; // last close 110, index4 close 100 → +10%
    vi.mocked(useStockHistory).mockImplementation((_c?: string, days?: number, period?: string) =>
      (period === 'day' && days === 10 ? { data: dayData, isLoading: false } : { data: defaultChartHistory, isLoading: false }) as any);
    vi.mocked(useSupportResistance).mockReturnValue({ data: { stock_id: '600519', supports: [15.2], resistances: [18.5] }, isLoading: false } as any);
    vi.mocked(useStockFundFlow).mockReturnValue({ data: [{ main_inflow: 500000000 }], isLoading: false } as any);
    vi.mocked(useRealtimeQuote).mockReturnValue({ data: { current_price: 110, prev_close: 109, change: 1, change_percent: 0.92, volume: 1000, amount: 100000, high: 111, low: 108, open: 109, turnover_rate: 0.1, ratio: 1.0, ticker: '600519', name: '贵州茅台' }, isLoading: false } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText(/指标财务/));
    expect(screen.getByText('18.50')).toHaveStyle({ color: 'hsl(var(--price-up))' });
    expect(screen.getByText('15.20')).toHaveStyle({ color: 'hsl(var(--price-down))' });
    expect(screen.getByText((c) => c.includes('5日') && c.includes('+10.00%'))).toHaveStyle({ color: 'hsl(var(--price-up))' });
    expect(screen.getByText('+5.0亿')).toHaveStyle({ color: 'hsl(var(--price-up))' });
  });

  // ── 38. IndexBar renders 上证/沪深300/创业板 quotes ──
  it('renders IndexBar with index names and prices', async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_index_quotes') {
        return Promise.resolve([
          { ticker: 'sh000001', current_price: 3200, change: 10, change_percent: 0.5 },
          { ticker: '000300', current_price: 3900, change: -5, change_percent: -0.2 },
          { ticker: '399006', current_price: 2100, change: 3, change_percent: 0.1 },
        ]);
      }
      return Promise.resolve(undefined);
    });
    renderPage(client, '/stock?code=600519');
    expect(await screen.findByText('上证')).toBeInTheDocument();
    expect(screen.getByText('沪深300')).toBeInTheDocument();
    expect(screen.getByText('创业板')).toBeInTheDocument();
    expect(screen.getByText('3200')).toBeInTheDocument();
  });

  // ── 39. Watchlist star disabled while a mutation is pending ──
  it('disables the watchlist star while an add mutation is pending', () => {
    vi.mocked(useWatchlistAdd).mockReturnValue({ mutate: vi.fn(), isPending: true });
    renderPage(client, '/stock?code=600519');
    expect(screen.getByLabelText('加入自选')).toBeDisabled();
  });

  // ── 40. MA bar hidden in minute (分时) period ──
  it('hides the MA bar when switching to minute (分时) period', () => {
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText('MA5')).toBeInTheDocument();
    fireEvent.click(screen.getByText('分时'));
    expect(screen.queryByText('MA5')).toBeNull();
  });

  // ── 41. K-line query error → error message + working retry ──
  it('shows a K-line error with retry when the history query fails and has no data', () => {
    const refetch = vi.fn();
    vi.mocked(useStockHistory).mockImplementation((_c?: string, days?: number, period?: string) =>
      (period === 'day' && days === 10 ? { data: [], isLoading: false } : { data: [], isLoading: false, error: new Error('boom'), refetch }) as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/K线数据加载失败/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('重试'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // ── 42. Intraday query error in minute mode → error message + retry ──
  it('shows an intraday error with retry when the intraday query fails in minute mode', () => {
    const refetch = vi.fn();
    vi.mocked(useIntraday).mockReturnValue({ data: [], isLoading: false, isFetching: false, error: new Error('x'), refetch } as any);
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('分时'));
    expect(screen.getByText(/分时数据加载失败/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('重试'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // ── 43. Realtime-quote error → inline hint next to the price ──
  it('shows a realtime-quote error hint when the quote fails and there is no price', () => {
    vi.mocked(useRealtimeQuote).mockReturnValue({ data: null, isLoading: false, error: new Error('x') } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/行情加载失败/)).toBeInTheDocument();
  });

  // ── 44. Secondary-query error → consolidated strip + retry refetches it ──
  it('shows a consolidated secondary-data error strip with a working retry', () => {
    const refetch = vi.fn();
    vi.mocked(useStockFinance).mockReturnValue({ data: null, isLoading: false, error: new Error('x'), refetch } as any);
    renderPage(client, '/stock?code=600519');
    expect(screen.getByText(/财务数据加载失败/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('重试'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // ── 45. Draw color swatches: only in draw mode, default red ──
  it('shows red/green/blue swatches only in draw mode and defaults to red', () => {
    renderPage(client, '/stock?code=600519');
    expect(screen.queryByLabelText('画线颜色 红')).toBeNull();
    fireEvent.click(screen.getByText('画线'));
    expect(screen.getByLabelText('画线颜色 红')).toBeInTheDocument();
    expect(screen.getByLabelText('画线颜色 绿')).toBeInTheDocument();
    expect(screen.getByLabelText('画线颜色 蓝')).toBeInTheDocument();
    // Default color is red → first line drawn without picking uses #ef4444
    chartMockState.coordinateToPriceValue = 101;
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 20 } }));
    expect(chartMockState.createdPriceLines.at(-1).color).toBe('#ef4444');
  });

  // ── 46. Picking a swatch draws subsequent lines in that color ──
  it('draws lines in the picked color (绿 then 蓝)', () => {
    chartMockState.coordinateToPriceValue = 101;
    renderPage(client, '/stock?code=600519');
    fireEvent.click(screen.getByText('画线'));
    fireEvent.click(screen.getByLabelText('画线颜色 绿'));
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 20 } }));
    expect(chartMockState.createdPriceLines.at(-1).color).toBe('#22c55e');
    fireEvent.click(screen.getByLabelText('画线颜色 蓝'));
    chartMockState.clickCallbacks.forEach((cb) => cb({ point: { x: 10, y: 40 } }));
    expect(chartMockState.createdPriceLines.at(-1).color).toBe('#3b82f6');
  });
});
