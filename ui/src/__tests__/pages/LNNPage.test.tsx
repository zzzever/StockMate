import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LNNPage from '@/pages/LNNPage';

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(() => ({ data: [] })),
  useStockHistory: vi.fn(() => ({ data: [] })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('LNNPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(<MemoryRouter><LNNPage /></MemoryRouter>);
    expect(screen.getByText('LNN 股价预测')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<MemoryRouter><LNNPage /></MemoryRouter>);
    expect(screen.getByText(/选择股票/)).toBeInTheDocument();
  });

  it('renders prediction parameters', () => {
    render(<MemoryRouter><LNNPage /></MemoryRouter>);
    expect(screen.getByText('预测周期')).toBeInTheDocument();
    expect(screen.getByText('K线周期')).toBeInTheDocument();
  });

  it('renders a run prediction button', () => {
    render(<MemoryRouter><LNNPage /></MemoryRouter>);
    expect(screen.getByText('开始 LNN 预测')).toBeInTheDocument();
  });
});
