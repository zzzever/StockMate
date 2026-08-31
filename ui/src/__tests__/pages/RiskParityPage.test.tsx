import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RiskParityPage from '@/pages/RiskParityPage';

describe('RiskParityPage', () => {
  it('renders page title', () => {
    render(<RiskParityPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getAllByText('风险平价').length).toBeGreaterThan(0);
  });

  it('renders asset allocation', () => {
    render(<RiskParityPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('资产配置')).toBeTruthy();
  });

  it('renders risk contribution', () => {
    render(<RiskParityPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('风险贡献')).toBeTruthy();
  });
});
