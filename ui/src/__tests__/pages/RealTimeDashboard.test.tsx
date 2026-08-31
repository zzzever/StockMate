import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RealTimeDashboard from '@/pages/RealTimeDashboard';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
);

describe('RealTimeDashboard', () => {
  it('renders page title', () => {
    render(<RealTimeDashboard />, { wrapper });
    expect(screen.getByText('实时行情')).toBeTruthy();
  });

  it('renders market indices', () => {
    render(<RealTimeDashboard />, { wrapper });
    expect(screen.getByText('上证指数')).toBeTruthy();
    expect(screen.getByText('深证成指')).toBeTruthy();
  });

  it('renders sector heatmap', () => {
    render(<RealTimeDashboard />, { wrapper });
    expect(screen.getByText('板块热力')).toBeTruthy();
  });

  it('renders market summary', () => {
    render(<RealTimeDashboard />, { wrapper });
    expect(screen.getByText('市场概况')).toBeTruthy();
  });
});
