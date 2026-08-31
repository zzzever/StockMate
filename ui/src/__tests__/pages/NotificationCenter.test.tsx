import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationCenter from '@/pages/NotificationCenter';

describe('NotificationCenter', () => {
  it('renders page title', () => {
    render(<NotificationCenter />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('智能提醒')).toBeTruthy();
  });

  it('renders notification channels', () => {
    render(<NotificationCenter />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('推送渠道')).toBeTruthy();
  });

  it('renders notification list', () => {
    render(<NotificationCenter />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getAllByText(/通知列表/).length).toBeGreaterThan(0);
  });
});
