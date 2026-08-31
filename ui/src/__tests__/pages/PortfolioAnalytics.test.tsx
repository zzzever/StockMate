import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PortfolioAnalytics from '@/pages/PortfolioAnalytics';

describe('PortfolioAnalytics', () => {
  it('renders page title', () => {
    render(<PortfolioAnalytics />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('组合分析')).toBeTruthy();
  });

  it('renders sector allocation', () => {
    render(<PortfolioAnalytics />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('行业配置')).toBeTruthy();
  });

  it('renders risk metrics', () => {
    render(<PortfolioAnalytics />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('风险指标')).toBeTruthy();
  });

  it('renders holdings detail', () => {
    render(<PortfolioAnalytics />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('持仓明细')).toBeTruthy();
  });
});
