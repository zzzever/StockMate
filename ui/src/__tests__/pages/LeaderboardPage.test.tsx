import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeaderboardPage from '@/pages/LeaderboardPage';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LeaderboardPage />
    </MemoryRouter>,
  );
}

describe('LeaderboardPage', () => {
  it('renders leaderboard with title "指标排行榜"', () => {
    renderPage();
    expect(screen.getByText('指标排行榜')).toBeInTheDocument();
    expect(screen.getByText('发现最受欢迎的交易指标')).toBeInTheDocument();
  });

  it('shows ranking tabs (总下载榜, 评分榜, 新品榜, 趋势榜)', () => {
    renderPage();
    expect(screen.getByText('总下载榜')).toBeInTheDocument();
    expect(screen.getByText('评分榜')).toBeInTheDocument();
    expect(screen.getByText('新品榜')).toBeInTheDocument();
    expect(screen.getByText('趋势榜')).toBeInTheDocument();
  });

  it('displays ranked items', () => {
    renderPage();
    expect(screen.getByText('自定义指标引擎')).toBeInTheDocument();
    expect(screen.getByText('MACD 金叉增强')).toBeInTheDocument();
    expect(screen.getByText('成交量异动 VVolume')).toBeInTheDocument();
    expect(screen.getAllByText('StockMate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('QuantLab').length).toBeGreaterThan(0);
  });

  it('shows category filter buttons', () => {
    renderPage();
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getAllByText('趋势').length).toBeGreaterThan(0);
    expect(screen.getAllByText('振荡').length).toBeGreaterThan(0);
    expect(screen.getAllByText('量能').length).toBeGreaterThan(0);
    expect(screen.getAllByText('波动率').length).toBeGreaterThan(0);
    expect(screen.getAllByText('自定义').length).toBeGreaterThan(0);
  });

  it('shows medal indicators for top 3', () => {
    renderPage();
    const medals = document.querySelectorAll('svg');
    expect(medals.length).toBeGreaterThan(0);
    const rankedItems = screen.getAllByText(/[1-3]/);
    expect(rankedItems.length).toBeGreaterThan(0);
  });

  it('filters items when a category is selected', () => {
    renderPage();
    const trendBtns = screen.getAllByText('趋势');
    fireEvent.click(trendBtns[0]);
    expect(screen.getByText('超级趋势 SuperTrend')).toBeInTheDocument();
    expect(screen.queryByText('KDJ 超买超卖')).not.toBeInTheDocument();
  });

  it('switches between ranking tabs', () => {
    renderPage();
    fireEvent.click(screen.getByText('评分榜'));
    const items = screen.getAllByText(/\d+\.\d/);
    expect(items.length).toBeGreaterThan(0);
  });
});
