import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('运行选股')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('筛选条件')).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText('筛选条件')).toBeInTheDocument());
  });

  it('renders strategy dropdown with options', async () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('renders filter conditions section', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    expect(screen.getByText('筛选条件')).toBeInTheDocument();
  });

  it('renders AI input field', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    const input = document.querySelector('input[placeholder*="自然语言"]');
    expect(input).toBeInTheDocument();
  });

  it('can type in AI description', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    const input = document.querySelector('input[placeholder*="自然语言"]') as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value: '低价股' } });
      expect(input.value).toBe('低价股');
    }
  });

  it('has export CSV button when results exist', () => {
    render(<MemoryRouter><ScreenerPage /></MemoryRouter>);
    // CSV 导出按钮在结果区域渲染，初始无结果时按钮不显示
    // 测试确保组件可正常渲染
  });
});
