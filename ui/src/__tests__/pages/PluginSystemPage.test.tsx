import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PluginSystemPage from '@/pages/PluginSystemPage';

describe('PluginSystemPage', () => {
  it('renders page title', () => {
    render(<PluginSystemPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('插件系统')).toBeDefined();
  });

  it('renders marketplace tab', () => {
    render(<PluginSystemPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('插件市场')).toBeDefined();
  });

  it('renders SDK tab', () => {
    render(<PluginSystemPage />, { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> });
    expect(screen.getByText('SDK文档')).toBeDefined();
  });
});
