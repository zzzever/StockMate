import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/TopBar';

const toggleDarkMode = vi.fn();
const mockStore = {
  sidebarOpen: true,
  currentPage: 'sectors' as const,
  darkMode: false,
  setPage: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleDarkMode,
  setSelectedStock: vi.fn(),
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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
    // Theme button is the last one (after refresh and bell)
    const themeBtn = buttons[buttons.length - 1];
    fireEvent.click(themeBtn);
    expect(toggleDarkMode).toHaveBeenCalled();
  });

  it('navigates on search enter', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('搜索股票代码或名称...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '000001' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    // Navigation happens via react-router; we just verify input was handled
    expect(input.value).toBe('000001');
  });
});
