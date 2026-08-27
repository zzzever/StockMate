import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThermometerButton from '@/components/ThermometerButton';
import * as hooks from '@/hooks/useTauriQuery';

const mockOverview = vi.fn();
const marketOverviewCalls = vi.fn();
let overviewCache: any;
vi.mock('@/hooks/useTauriQuery', () => {
  // 模拟 react-query：enabled 时拉取数据写入缓存；disabled 时不再拉取，但仍返回缓存（已加载过则保留）
  return {
    useMarketOverview: (options?: { enabled?: boolean }) => {
      const enabled = options?.enabled ?? true;
      if (enabled) overviewCache = mockOverview();
      marketOverviewCalls(enabled);
      return { data: overviewCache as any };
    },
    useMarketTempHistory: vi.fn(() => ({ data: [] })),
  };
});

function renderButton() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })}>
      <ThermometerButton />
    </QueryClientProvider>
  );
}

const OVERVIEW = { up_count: 3000, down_count: 2000, flat_count: 500, sentiment_index: 0.5, temperature: 68, temp_zone: '常温' };

describe('ThermometerButton', () => {
  beforeEach(() => {
    mockOverview.mockReset();
    marketOverviewCalls.mockReset();
    overviewCache = undefined;
  });

  it('does not enable market-overview polling until the popover is opened', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    // 未打开时以 enabled=false 调用 useMarketOverview（不拉取/轮询）
    expect(marketOverviewCalls).toHaveBeenLastCalledWith(false);
  });

  it('enables market-overview polling once the popover is opened', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /市场温度/ }));
    expect(marketOverviewCalls).toHaveBeenLastCalledWith(true);
  });

  it('shows icon only before temperature has ever been fetched (no cache)', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    const btn = screen.getByRole('button', { name: /市场温度/ });
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).not.toMatch(/\d/);
  });

  it('keeps showing the cached temperature on the button after the popover closes', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    // 打开一次建立缓存
    fireEvent.click(screen.getByRole('button', { name: /市场温度/ }));
    expect(screen.getByText('68')).toBeInTheDocument();
    // 关闭后（enabled=false）按钮仍显示缓存的温度
    fireEvent.click(screen.getByRole('button', { name: /关闭市场温度/ }));
    expect(screen.getByText('68')).toBeInTheDocument();
  });

  it('shows a loading placeholder in the popover when no data', () => {
    mockOverview.mockReturnValue(undefined);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /市场温度/ }));
    expect(screen.getByText('正在获取市场温度...')).toBeInTheDocument();
  });

  it('does not render popover content until opened', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    expect(screen.queryByText('🌡️ 市场温度')).not.toBeInTheDocument();
  });

  it('opens a popover with the thermometer when clicked', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /市场温度/ }));
    expect(screen.getByText('🌡️ 市场温度')).toBeInTheDocument();
    expect(screen.getByText('常温')).toBeInTheDocument();
    expect(hooks.useMarketTempHistory).toHaveBeenCalled();
  });

  it('toggles closed when the button is clicked again', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    const btn = screen.getByRole('button', { name: /市场温度/ });
    fireEvent.click(btn);
    expect(screen.getByText('🌡️ 市场温度')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('🌡️ 市场温度')).not.toBeInTheDocument();
  });

  it('closes the popover when clicking outside', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /市场温度/ }));
    expect(screen.getByText('🌡️ 市场温度')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('🌡️ 市场温度')).not.toBeInTheDocument();
  });

  it('closes the popover on Escape', () => {
    mockOverview.mockReturnValue(OVERVIEW);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /市场温度/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('🌡️ 市场温度')).not.toBeInTheDocument();
  });
});
