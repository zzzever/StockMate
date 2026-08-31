import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreatorPage from '@/pages/CreatorPage';

describe('CreatorPage', () => {
  it('renders page title', () => {
    render(<CreatorPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('创作者主页')).toBeTruthy();
  });

  it('renders creator list', () => {
    render(<CreatorPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('量化老王')).toBeTruthy();
  });

  it('renders sort options', () => {
    render(<CreatorPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getAllByText('粉丝').length).toBeGreaterThan(0);
  });
});
