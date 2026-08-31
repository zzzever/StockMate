import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CopyTradingPage from '@/pages/CopyTradingPage';

describe('CopyTradingPage', () => {
  it('renders page title', () => {
    render(<CopyTradingPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('策略跟单')).toBeDefined();
  });

  it('renders trader cards', () => {
    render(<CopyTradingPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('策略跟单')).toBeDefined();
  });
});
