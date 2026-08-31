import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocialTradingPage from '@/pages/SocialTradingPage';

describe('SocialTradingPage', () => {
  it('renders page title', () => {
    render(<SocialTradingPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('策略直播')).toBeTruthy();
  });

  it('renders strategy cards', () => {
    render(<SocialTradingPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('量化老王')).toBeTruthy();
  });

  it('renders live count', () => {
    render(<SocialTradingPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText(/直播中/)).toBeTruthy();
  });
});
