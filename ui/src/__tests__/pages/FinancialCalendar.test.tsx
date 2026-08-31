import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinancialCalendar from '@/pages/FinancialCalendar';

describe('FinancialCalendar', () => {
  it('renders page title', () => {
    render(<FinancialCalendar />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('财务日历')).toBeTruthy();
  });

  it('renders month label', () => {
    render(<FinancialCalendar />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('2026年9月')).toBeTruthy();
  });

  it('renders weekday headers', () => {
    render(<FinancialCalendar />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('日')).toBeTruthy();
    expect(screen.getByText('一')).toBeTruthy();
  });
});
