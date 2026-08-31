import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FactorAnalysisPage from '@/pages/FactorAnalysisPage';

describe('FactorAnalysisPage', () => {
  it('renders page title', () => {
    render(<FactorAnalysisPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('因子分析')).toBeTruthy();
  });

  it('renders factor table', () => {
    render(<FactorAnalysisPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('因子表格')).toBeTruthy();
  });

  it('renders category filters', () => {
    render(<FactorAnalysisPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('全部')).toBeTruthy();
  });
});
