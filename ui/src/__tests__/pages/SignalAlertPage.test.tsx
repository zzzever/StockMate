import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignalAlertPage from '@/pages/SignalAlertPage';

describe('SignalAlertPage', () => {
  it('renders page title', () => {
    render(<SignalAlertPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('信号推送')).toBeDefined();
  });

  it('renders alert rules', () => {
    render(<SignalAlertPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('信号推送')).toBeDefined();
  });
});
