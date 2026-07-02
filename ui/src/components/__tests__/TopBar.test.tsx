import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/TopBar';

const toggleDarkMode = vi.fn();
const toggleDebug = vi.fn();
const mockStore = {
  sidebarOpen: true,
  currentPage: 'dashboard' as const,
  darkMode: false,
  debugOpen: false,
  setPage: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleDarkMode,
  toggleDebug,
  setSelectedStock: vi.fn(),
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileHover, whileTap, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('TopBar', () => {
  it('renders search input and online status', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('搜索股票代码或名称...')).toBeInTheDocument();
    expect(screen.getByText('在线')).toBeInTheDocument();
  });

  it('updates search value on input', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('搜索股票代码或名称...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '600519' } });
    expect(input.value).toBe('600519');
  });

  it('calls toggleDarkMode when theme button clicked', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const buttons = screen.getAllByRole('button');
    // Theme button is the last one (after refresh, bell, debug)
    const themeBtn = buttons[buttons.length - 1];
    fireEvent.click(themeBtn);
    expect(toggleDarkMode).toHaveBeenCalled();
  });

  it('calls toggleDebug when debug button clicked', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const buttons = screen.getAllByRole('button');
    // Debug button is second-to-last (before theme)
    const debugBtn = buttons[buttons.length - 2];
    fireEvent.click(debugBtn);
    expect(toggleDebug).toHaveBeenCalled();
  });
});
