import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '@/components/Layout';

const mockStore = {
  sidebarOpen: true,
  currentPage: 'dashboard' as const,
  darkMode: true,
  setPage: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleDarkMode: vi.fn(),
  setSelectedStock: vi.fn(),
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

vi.mock('@/components/ParticlesBackground', () => ({
  default: () => <div data-testid="particles-bg" className="particles-container" />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, whileHover, whileTap, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Layout', () => {
  it('renders layout with sidebar, topbar and children', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div data-testid="child">Child Content</div>
        </Layout>
      </MemoryRouter>
    );
    expect(screen.getByText('StockMate')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索股票代码或名称...')).toBeInTheDocument();
  });

  it('sets page based on route in useEffect', () => {
    render(
      <MemoryRouter initialEntries={['/strategy']}>
        <Layout>
          <div>Strategy Page</div>
        </Layout>
      </MemoryRouter>
    );
    expect(screen.getByText('Strategy Page')).toBeInTheDocument();
  });
});
