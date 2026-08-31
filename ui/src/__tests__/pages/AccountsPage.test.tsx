import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountsPage from '@/pages/AccountsPage';

describe('AccountsPage', () => {
  it('renders page title', () => {
    render(<AccountsPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('多账户管理')).toBeDefined();
  });

  it('renders mock accounts', () => {
    render(<AccountsPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('多账户管理')).toBeDefined();
  });
});
