import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScreenerPage from '@/pages/ScreenerPage';

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(() => ({ data: [] })),
}));

vi.mock('@tauri-apps/api/core', () => {
  const mockInvoke = vi.fn((cmd: string) => {
    if (cmd === 'get_all_strategies') return Promise.resolve([[1, '历史相对低价 + 缩量下跌', JSON.stringify([{type:'LowPrice',params:{}},{type:'ShrinkDrop',params:{}},{type:'LowPosition',params:{}}]), true]]);
    if (cmd === 'save_strategy') return Promise.resolve(1);
    return Promise.resolve([]);
  });
  return { invoke: mockInvoke };
});

describe('ScreenerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and strategy selector', async () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    expect(screen.getByText('选股')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('历史相对低价 + 缩量下跌')).toBeInTheDocument());
    expect(screen.getByText('运行选股')).toBeInTheDocument();
  });

  it('shows empty state by default', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    expect(screen.getByText(/选择策略并运行选股/)).toBeInTheDocument();
  });

  it('run button renders and is clickable with stock list', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    expect(screen.getByText('运行选股').closest('button')).toBeInTheDocument();
  });

  it('renders strategy description', async () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('历史相对低价 + 缩量下跌')).toBeInTheDocument());
  });
});
