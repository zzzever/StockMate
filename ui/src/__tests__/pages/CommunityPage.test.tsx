import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommunityPage from '@/pages/CommunityPage';

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
      <CommunityPage />
    </MemoryRouter>,
  );
}

describe('CommunityPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders community page with tab buttons (动态, 创作者, 热门)', () => {
    renderPage();
    expect(screen.getByText('社区')).toBeInTheDocument();
    expect(screen.getByText('动态')).toBeInTheDocument();
    expect(screen.getByText('创作者')).toBeInTheDocument();
    expect(screen.getByText('热门')).toBeInTheDocument();
  });

  it('shows posts in feed tab', () => {
    renderPage();
    expect(screen.getByText('新版ATR自适应通道指标分享')).toBeInTheDocument();
    expect(screen.getByText('关于量化策略中的过拟合问题讨论')).toBeInTheDocument();
    expect(screen.getByText('QuantLab')).toBeInTheDocument();
    expect(screen.getByText('TradeMaster')).toBeInTheDocument();
  });

  it('shows creator cards in creators tab', () => {
    renderPage();
    fireEvent.click(screen.getByText('创作者'));
    expect(screen.getByText('QuantLab')).toBeInTheDocument();
    expect(screen.getByText('SignalPro')).toBeInTheDocument();
    expect(screen.getByText('DataFlow')).toBeInTheDocument();
    expect(screen.getByText('TradeMaster')).toBeInTheDocument();
    expect(screen.getByText('量化小白')).toBeInTheDocument();
  });

  it('has search input', () => {
    renderPage();
    const input = screen.getByPlaceholderText('搜索动态、创作者、标签...') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'ATR' } });
    expect(input.value).toBe('ATR');
  });

  it('has "发布动态" button', () => {
    renderPage();
    const buttons = screen.getAllByRole('button');
    const publishBtn = buttons.find((btn) => btn.querySelector('svg') !== null && btn.style.borderRadius === '50%');
    expect(publishBtn).toBeTruthy();
    fireEvent.click(publishBtn!);
    expect(screen.getByText('发布动态'));
  });
});
