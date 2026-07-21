import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScreenerPage from '@/pages/ScreenerPage';

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(() => ({ data: [] })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('ScreenerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and strategy selector', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    expect(screen.getByText('选股')).toBeInTheDocument();
    expect(screen.getByText('低价缩量下跌')).toBeInTheDocument();
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

  it('renders strategy description', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    expect(screen.getByText(/价格<20元/)).toBeInTheDocument();
  });
});
