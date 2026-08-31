import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportPage from '@/pages/ReportPage';

describe('ReportPage', () => {
  it('renders page title', () => {
    render(<ReportPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('数据导出')).toBeDefined();
  });

  it('renders export templates', () => {
    render(<ReportPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('数据导出')).toBeDefined();
  });
});
