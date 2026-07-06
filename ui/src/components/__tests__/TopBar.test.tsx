import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/TopBar';

const toggleDarkMode = vi.fn();
const mockStore = {
  sidebarOpen: true,
  currentPage: 'search' as const,
  theme: 'dark' as const,
  setPage: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleDarkMode,
  setSelectedStock: vi.fn(),
  selectedStock: null,
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

// TopBar does not use framer-motion directly, but mock to be safe
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileHover, whileTap, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('TopBar', () => {
  it('renders search input with updated placeholder', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    // Placeholder updated from "搜索股票代码或名称..." to "輸入代碼…"
    expect(screen.getByPlaceholderText('輸入代碼…')).toBeInTheDocument();
  });

  it('updates search value on input', () => {
    render(
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const input = screen.getByPlaceholderText('輸入代碼…') as HTMLInputElement;
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
    // TopBar now has only the theme toggle button; click it
    const themeBtn = buttons[0];
    fireEvent.click(themeBtn);
    expect(toggleDarkMode).toHaveBeenCalled();
  });
});
