import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CodeViewerModal from '@/components/CodeViewerModal';
import type { TradingRule } from '@/types';

const rule: TradingRule = {
  id: 'r1', name: '三天缩量跌后反弹', conditions: [], signal: 'buy', enabled: true, color: '#6366f1', markerIndex: 1, createdAt: '',
  kind: 'code',
  code: "// 三天缩量跌后反弹\ndown(i-1, 3) && shrink(i-1, 3) && close(i) > close(i-1) => SIGNAL('buy')",
  explanation: '连续3天缩量下跌后次日收阳买入',
};

describe('CodeViewerModal', () => {
  beforeEach(() => {
    (navigator as any).clipboard = { writeText: vi.fn(() => Promise.resolve()) };
  });

  it('renders nothing when rule is null', () => {
    const { container } = render(<CodeViewerModal rule={null} onClose={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('renders the rule name, signal, code lines and explanation', () => {
    render(<CodeViewerModal rule={rule} onClose={() => {}} />);
    expect(screen.getByText('三天缩量跌后反弹')).toBeInTheDocument();
    expect(screen.getByText('买入')).toBeInTheDocument();
    expect(screen.getByText(/down\(i-1, 3\)/)).toBeInTheDocument();
    expect(screen.getByText('连续3天缩量下跌后次日收阳买入')).toBeInTheDocument();
  });

  it('copies the code to clipboard on 复制代码', async () => {
    render(<CodeViewerModal rule={rule} onClose={() => {}} />);
    fireEvent.click(screen.getByText('复制代码'));
    expect((navigator as any).clipboard.writeText).toHaveBeenCalledWith(rule.code);
    await waitFor(() => expect(screen.getByText('已复制')).toBeInTheDocument());
  });

  it('calls onClose on the close button and on Escape', () => {
    const onClose = vi.fn();
    render(<CodeViewerModal rule={rule} onClose={onClose} />);
    fireEvent.click(screen.getByText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
