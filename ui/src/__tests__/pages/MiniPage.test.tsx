import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MiniPage from '@/pages/MiniPage';
import { useWatchlist } from '@/hooks/useTauriQuery';

const mocks = vi.hoisted(() => ({
  win: { startDragging: vi.fn(), setAlwaysOnTop: vi.fn(async () => {}), close: vi.fn(async () => {}) },
  emitTo: vi.fn(async () => {}),
}));

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => mocks.win }));
vi.mock('@tauri-apps/api/event', () => ({ emitTo: (...a: any[]) => mocks.emitTo(...a) }));

vi.mock('@/hooks/useTauriQuery', () => ({
  useWatchlist: vi.fn(),
  // pass-through: mini merges realtime, but for tests we just echo the polled data
  useWatchlistWithRealtime: vi.fn((wl: any) => wl),
}));

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    stock_id: '600519.SH', stock_code: '600519', stock_name: '贵州茅台', exchange: 'SH',
    added_at: '2025-01-01', price: 1523.45, change: 23.4, change_percent: 1.56,
    volume: 1000, amount: 1000, high: 1530, low: 1500, open: 1505, prev_close: 1500, turnover_rate: 0.5,
    ...over,
  };
}

describe('MiniPage', () => {
  beforeEach(() => {
    mocks.win.startDragging.mockClear();
    mocks.win.setAlwaysOnTop.mockClear();
    mocks.win.close.mockClear();
    mocks.emitTo.mockClear();
  });

  it('renders watchlist rows with name, code and change%', () => {
    vi.mocked(useWatchlist).mockReturnValue({ data: [row()], isLoading: false, error: null, refetch: vi.fn() } as any);
    render(<MiniPage />);
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.getByText('600519')).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes('1523.45'))).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes('+1.56%'))).toBeInTheDocument();
  });

  it('emits navigate-to-stock when a row is clicked', () => {
    vi.mocked(useWatchlist).mockReturnValue({ data: [row()], isLoading: false, error: null, refetch: vi.fn() } as any);
    render(<MiniPage />);
    fireEvent.click(screen.getByText('贵州茅台'));
    expect(mocks.emitTo).toHaveBeenCalledWith('main', 'navigate-to-stock', { id: '600519.SH' });
  });

  it('toggles always-on-top when the pin button is clicked', () => {
    vi.mocked(useWatchlist).mockReturnValue({ data: [row()], isLoading: false, error: null, refetch: vi.fn() } as any);
    render(<MiniPage />);
    // Default pinned=true → clicking sets it to false
    fireEvent.click(screen.getByLabelText('取消置顶'));
    expect(mocks.win.setAlwaysOnTop).toHaveBeenCalledWith(false);
  });

  it('emits mini-closed and closes the window on close click', async () => {
    vi.mocked(useWatchlist).mockReturnValue({ data: [row()], isLoading: false, error: null, refetch: vi.fn() } as any);
    render(<MiniPage />);
    fireEvent.click(screen.getByLabelText('关闭小窗'));
    expect(mocks.emitTo).toHaveBeenCalledWith('main', 'mini-closed', {});
    // close() runs after the emitTo promise resolves (a microtask later)
    await waitFor(() => expect(mocks.win.close).toHaveBeenCalledTimes(1));
  });

  it('shows the empty state when there are no watchlist items', () => {
    vi.mocked(useWatchlist).mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() } as any);
    render(<MiniPage />);
    expect(screen.getByText('暂无自选股')).toBeInTheDocument();
  });

  it('shows the loading spinner before any data arrives', () => {
    vi.mocked(useWatchlist).mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() } as any);
    render(<MiniPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows an error with a working retry', () => {
    const refetch = vi.fn();
    vi.mocked(useWatchlist).mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom'), refetch } as any);
    render(<MiniPage />);
    expect(screen.getByText('加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByText('重试'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
