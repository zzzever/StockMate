import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonteCarloPage from '@/pages/MonteCarloPage';

describe('MonteCarloPage', () => {
  it('renders page title', () => {
    render(<MonteCarloPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('蒙特卡洛模拟')).toBeTruthy();
  });

  it('renders config inputs', () => {
    render(<MonteCarloPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('模拟参数')).toBeTruthy();
  });

  it('renders run button', () => {
    render(<MonteCarloPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('开始模拟')).toBeTruthy();
  });
});
