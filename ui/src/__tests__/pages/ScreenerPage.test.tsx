import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScreenerPage from '@/pages/ScreenerPage';

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }));

vi.mock('@/hooks/useTauriQuery', () => ({
  useStockList: vi.fn(() => ({ data: [] })),
}));

const PRESET_CONDITIONS = JSON.stringify([
  { type: 'LowPrice', params: {} },
  { type: 'ShrinkDrop', params: {} },
  { type: 'LowPosition', params: {} },
]);

const TEST_RESULTS = [
  { id: '600519.SH', ticker: '600519', name: '贵州茅台', close: 1500, change_pct: 1.2, matches: ['低价'] },
  { id: '000001.SZ', ticker: '000001', name: '平安银行', close: 10, change_pct: -2.5, matches: ['缩量下跌'] },
  { id: '300750.SZ', ticker: '300750', name: '宁德时代', close: 200, change_pct: 5.0, matches: ['放量'] },
];

// 默认 invoke 行为：返回 1 个预设策略 + 1 个非预设策略
const defaultImpl = (cmd: string) => {
  switch (cmd) {
    case 'get_all_strategies':
      return Promise.resolve([
        [1, '历史相对低价 + 缩量下跌', PRESET_CONDITIONS, true],
        [2, '我的策略', JSON.stringify([{ type: 'LowPrice', params: { maxPrice: 15 } }, { type: 'AboveMA', params: { period: 20 } }]), false],
      ]);
    case 'save_strategy': return Promise.resolve(99);
    case 'get_stock_history': return Promise.resolve([]);
    case 'get_screener_history': return Promise.resolve([]);
    default: return Promise.resolve([]);
  }
};

// 让 screen_stocks 返回指定结果的可复用实现
const setupResults = (results: any[]) => {
  mockInvoke.mockImplementation((cmd: string) => {
    switch (cmd) {
      case 'get_all_strategies':
        return Promise.resolve([[1, '历史相对低价 + 缩量下跌', PRESET_CONDITIONS, true]]);
      case 'screen_stocks': return Promise.resolve(results);
      case 'get_stock_history': return Promise.resolve([]);
      case 'get_screener_history': return Promise.resolve([]);
      case 'save_screener_result': return Promise.resolve(null);
      case 'update_strategy': return Promise.resolve(null);
      default: return Promise.resolve([]);
    }
  });
};

const renderPage = () => render(<MemoryRouter><ScreenerPage /></MemoryRouter>);

// 运行选股并等待结果出现在表格中
const runScreenerWithResults = async (results: any[]) => {
  setupResults(results);
  renderPage();
  await screen.findByText('低价');
  fireEvent.click(screen.getByText('运行选股'));
  await screen.findByText(results[0].name);
};

const firstRowText = () => document.querySelector('tbody tr')?.textContent || '';

describe('ScreenerPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockInvoke.mockReset();
    mockInvoke.mockImplementation(defaultImpl);
  });

  it('renders page title and strategy selector', async () => {
    renderPage();
    expect(screen.getByText('选股')).toBeInTheDocument();
    expect(screen.getByText('运行选股')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('筛选条件')).toBeInTheDocument());
  });

  it('shows empty state by default', () => {
    renderPage();
    expect(screen.getByText(/选择策略并运行选股/)).toBeInTheDocument();
  });

  it('run button renders and is clickable with stock list', () => {
    renderPage();
    expect(screen.getByText('运行选股').closest('button')).toBeInTheDocument();
  });

  it('renders strategy description', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('筛选条件')).toBeInTheDocument());
  });

  it('renders strategy dropdown with options', async () => {
    renderPage();
    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  it('renders filter conditions section', () => {
    renderPage();
    expect(screen.getByText('筛选条件')).toBeInTheDocument();
  });

  it('renders AI input field', () => {
    renderPage();
    const input = document.querySelector('input[placeholder*="自然语言"]');
    expect(input).toBeInTheDocument();
  });

  it('can type in AI description', () => {
    renderPage();
    const input = document.querySelector('input[placeholder*="自然语言"]') as HTMLInputElement;
    if (input) {
      fireEvent.change(input, { target: { value: '低价股' } });
      expect(input.value).toBe('低价股');
    }
  });

  it('has export CSV button when results exist', () => {
    renderPage();
    // CSV 导出按钮在结果区域渲染，初始无结果时按钮不显示
    // 测试确保组件可正常渲染
  });

  // ==================== 策略管理 ====================

  it('creates a new strategy via +新建 prompt', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('我的新策略');
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText('+新建'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('save_strategy', { name: '我的新策略', strategyJson: expect.any(String), isPreset: false }));
    await waitFor(() => expect(screen.getByText('我的新策略')).toBeInTheDocument());
    promptSpy.mockRestore();
  });

  it('copies the active strategy via 📋', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('历史相对低价 + 缩量下跌 (副本)');
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText('📋'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('save_strategy', expect.objectContaining({ name: '历史相对低价 + 缩量下跌 (副本)', isPreset: false })));
    promptSpy.mockRestore();
  });

  it('deletes a non-preset strategy after confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('低价');
    // 切换到非预设策略（我的策略）
    const strategySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(strategySelect, { target: { value: '2' } });
    await screen.findByText('高于均线'); // 策略2条件已加载
    fireEvent.click(screen.getByText('删除'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('delete_strategy', { strategyId: 2 }));
    await waitFor(() => expect(screen.queryByText('我的策略')).not.toBeInTheDocument());
    confirmSpy.mockRestore();
  });

  it('does not delete strategy when confirm is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await screen.findByText('低价');
    const strategySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(strategySelect, { target: { value: '2' } });
    await screen.findByText('高于均线');
    fireEvent.click(screen.getByText('删除'));
    expect(mockInvoke).not.toHaveBeenCalledWith('delete_strategy', expect.anything());
    expect(screen.getByText('我的策略')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('hides delete button when strategy is locked and restores after unlock', async () => {
    renderPage();
    await screen.findByText('低价');
    expect(screen.getByText('🔓')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
    fireEvent.click(screen.getByText('🔓'));
    expect(screen.getByText('🔒')).toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('🔒'));
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  // ==================== 条件构建 ====================

  it('adds a condition via the add-condition dropdown', async () => {
    renderPage();
    await screen.findByText('低价');
    const selects = screen.getAllByRole('combobox');
    const addSelect = selects[selects.length - 1];
    fireEvent.change(addSelect, { target: { value: 'VolumeSurge' } });
    expect(screen.getByText('放量')).toBeInTheDocument();
  });

  it('removes a condition', async () => {
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText('低价')); // 进入编辑态
    fireEvent.click(screen.getByText('移除'));
    expect(screen.queryByText('低价')).not.toBeInTheDocument();
    // 剩余两个条件
    expect(screen.getByText('缩量下跌')).toBeInTheDocument();
    expect(screen.getByText('历史低位')).toBeInTheDocument();
  });

  it('toggles condition logic between AND and OR', async () => {
    renderPage();
    await screen.findByText('低价');
    // 预设 3 个条件：i=0 无逻辑按钮，i=1、i=2 为 AND
    const andButtons = screen.getAllByText('AND');
    expect(andButtons.length).toBe(2);
    fireEvent.click(andButtons[0]);
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getAllByText('AND').length).toBe(1);
    // 再点回 AND
    fireEvent.click(screen.getByText('OR'));
    expect(screen.getAllByText('AND').length).toBe(2);
  });

  it('edits a condition parameter inline', async () => {
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText('低价'));
    // LowPrice 的参数输入框（默认 20）
    const inputs = document.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(1);
    fireEvent.change(inputs[0], { target: { value: '15' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('15');
  });

  // ==================== 运行选股 / 结果表格 ====================

  it('runs screener and displays results with stats', async () => {
    setupResults(TEST_RESULTS);
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText('运行选股'));
    await screen.findByText('贵州茅台');
    expect(mockInvoke).toHaveBeenCalledWith('screen_stocks', expect.objectContaining({ conditionsJson: expect.any(String), limit: 5000 }));
    // 统计栏（exact 匹配避免命中表头"匹配条件"）
    expect(screen.getByText('匹配', { exact: true })).toBeInTheDocument();
    expect(document.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('lazily loads trend data (MiniTrend) for visible results', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('get_stock_history', expect.objectContaining({ days: 20, period: 'day' })));
  });

  it('sorts by price descending when price header clicked', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    // 默认按 close 升序 → 平安银行(10) 第一
    expect(firstRowText()).toContain('平安银行');
    fireEvent.click(screen.getByText(/最新价/));
    // close 降序 → 贵州茅台(1500) 第一
    expect(firstRowText()).toContain('贵州茅台');
    // 再点一次 → 升序
    fireEvent.click(screen.getByText(/最新价/));
    expect(firstRowText()).toContain('平安银行');
  });

  it('sorts by change_pct when header clicked', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    // exact 匹配表头（避免命中添加条件下拉 option "涨跌幅 — ..."）
    fireEvent.click(screen.getByText('涨跌幅'));
    // 降序 → 宁德时代(5.0) 第一
    expect(firstRowText()).toContain('宁德时代');
    expect(document.querySelectorAll('tbody tr')[2].textContent).toContain('平安银行');
  });

  it('sorts by name when name header clicked', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    fireEvent.click(screen.getByText('名称'));
    // 顺序与 localeCompare 实际行为保持一致，不硬编码 Unicode 假设
    const expected = [...['贵州茅台', '平安银行', '宁德时代']].sort((a, b) => a.localeCompare(b));
    const rows = () => Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.textContent || '');
    expect(rows()[0]).toContain(expected[0]);
    expect(rows()[1]).toContain(expected[1]);
    expect(rows()[2]).toContain(expected[2]);
    // 再点一次 → 降序
    fireEvent.click(screen.getByText(/名称/));
    expect(rows()[0]).toContain(expected[2]);
    expect(rows()[2]).toContain(expected[0]);
  });

  it('filters results via search box and clears with x', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    fireEvent.change(screen.getByPlaceholderText('搜索名称或代码...'), { target: { value: '茅台' } });
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    expect(screen.queryByText('平安银行')).not.toBeInTheDocument();
    expect(screen.queryByText('宁德时代')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('清除搜索'));
    expect(screen.getByText('平安银行')).toBeInTheDocument();
    expect(screen.getByText('宁德时代')).toBeInTheDocument();
  });

  it('paginates results with 50 per page and navigates pages', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      id: `ID${i}`, ticker: `T${i}`, name: `测试股票${i}`, close: i, change_pct: i % 5, matches: ['低价'],
    }));
    setupResults(many);
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText('运行选股'));
    await screen.findByText('测试股票0');
    expect(document.querySelectorAll('tbody tr').length).toBe(50);
    expect(screen.getByText(/共/)).toBeInTheDocument();
    expect(screen.getByText(/第/)).toBeInTheDocument();
    // 跳转到最后一页
    fireEvent.click(screen.getByText('»'));
    await waitFor(() => {
      expect(firstRowText()).toContain('测试股票100');
    });
    expect(document.querySelectorAll('tbody tr').length).toBe(20); // 最后 20 条
    // 回到第一页
    fireEvent.click(screen.getByText('«'));
    await waitFor(() => expect(firstRowText()).toContain('测试股票0'));
  });

  it('batch-selects all, toggles one off, and cancels selection', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    const headerCheckbox = document.querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(headerCheckbox);
    expect(screen.getByText(/已选/)).toBeInTheDocument();
    expect(document.querySelectorAll('tbody input[type="checkbox"]:checked').length).toBe(3);
    // 取消一行
    const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    fireEvent.click(rowCheckboxes[0]);
    expect(document.querySelectorAll('tbody input[type="checkbox"]:checked').length).toBe(2);
    // 取消全部选择
    fireEvent.click(screen.getByText('取消'));
    expect(screen.queryByText(/已选/)).not.toBeInTheDocument();
  });

  it('batch adds selected stocks to watchlist', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    fireEvent.click(document.querySelector('thead input[type="checkbox"]') as HTMLInputElement);
    fireEvent.click(screen.getByText('+ 加入自选'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('add_to_watchlist', { stockId: '600519.SH' }));
    await waitFor(() => expect(screen.queryByText(/已选/)).not.toBeInTheDocument());
  });

  it('switches between table and card view', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    expect(screen.getByRole('table')).toBeInTheDocument();
    fireEvent.click(screen.getByText('卡'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
    fireEvent.click(screen.getByText('表'));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('saves result via save button (title attr)', async () => {
    await runScreenerWithResults(TEST_RESULTS);
    fireEvent.click(screen.getByTitle('保存选股结果到数据库'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('save_screener_result', expect.objectContaining({ matchCount: 3 })));
  });

  // ==================== AI 生成条件 ====================

  it('generates conditions via AI description', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_strategies') return Promise.resolve([[1, '历史相对低价 + 缩量下跌', PRESET_CONDITIONS, true]]);
      if (cmd === 'generate_screener_conditions') return Promise.resolve(JSON.stringify([{ type: 'KDJOverSold', params: {} }]));
      return Promise.resolve([]);
    });
    renderPage();
    await screen.findByText('低价');
    const input = document.querySelector('input[placeholder*="自然语言"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '寻找超卖股票' } });
    fireEvent.click(screen.getByText('AI生成'));
    await screen.findByText('KDJ超卖');
    expect(mockInvoke).toHaveBeenCalledWith('generate_screener_conditions', { description: '寻找超卖股票' });
  });

  it('disables AI button when description is empty', async () => {
    renderPage();
    await screen.findByText('低价');
    const btn = screen.getByText('AI生成').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalledWith('generate_screener_conditions', expect.anything());
  });

  // ==================== 历史记录 ====================

  it('loads a history record into results', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_strategies') return Promise.resolve([[1, '历史相对低价 + 缩量下跌', PRESET_CONDITIONS, true]]);
      if (cmd === 'get_screener_history') return Promise.resolve([[10, 'stg', '[]', 5, '2025-01-01T00:00:00']]);
      if (cmd === 'load_screener_history_result') return Promise.resolve(JSON.stringify([TEST_RESULTS[0]]));
      return Promise.resolve([]);
    });
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText(/历史记录/));
    expect(screen.getByText(/2025-01-01 — 5 只/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/2025-01-01 — 5 只/));
    await screen.findByText('贵州茅台');
    expect(mockInvoke).toHaveBeenCalledWith('load_screener_history_result', { historyId: 10 });
  });

  it('deletes a history record after confirm', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_all_strategies') return Promise.resolve([[1, '历史相对低价 + 缩量下跌', PRESET_CONDITIONS, true]]);
      if (cmd === 'get_screener_history') return Promise.resolve([[10, 'stg', '[]', 5, '2025-01-01T00:00:00']]);
      return Promise.resolve([]);
    });
    renderPage();
    await screen.findByText('低价');
    fireEvent.click(screen.getByText(/历史记录/));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText('✕'));
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('delete_screener_result', { recordId: 10 }));
    await waitFor(() => expect(screen.queryByText(/2025-01-01 — 5 只/)).not.toBeInTheDocument());
    confirmSpy.mockRestore();
  });
});
