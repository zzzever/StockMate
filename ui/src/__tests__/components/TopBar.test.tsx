import { vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopBar from '@/components/TopBar';

const toggleDarkMode = vi.fn();
const mockStore: { theme: 'light' | 'dark' | 'system'; toggleDarkMode: () => void; selectedStock: { code: string; name: string } | null } = {
  theme: 'dark',
  toggleDarkMode,
  selectedStock: null,
};

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: any) => selector(mockStore),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

function renderTopBar() {
  return render(
    <MemoryRouter>
      <TopBar />
    </MemoryRouter>
  );
}

describe('TopBar', () => {
  beforeEach(() => {
    toggleDarkMode.mockClear();
    navigateMock.mockClear();
    mockStore.selectedStock = null;
  });

  it('no longer renders an inline search box (unified into the search page)', () => {
    renderTopBar();
    expect(screen.queryByPlaceholderText('輸入代碼… (Ctrl+K)')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders the theme toggle and calls toggleDarkMode when clicked', () => {
    renderTopBar();
    const themeBtn = screen.getByTitle('夜');
    fireEvent.click(themeBtn);
    expect(toggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('navigates to the search page on Ctrl+K', () => {
    renderTopBar();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    expect(navigateMock).toHaveBeenCalledWith('/search');
  });

  it('shows the selected stock chip when a stock is selected', () => {
    mockStore.selectedStock = { code: '600519.SH', name: '贵州茅台' };
    renderTopBar();
    expect(screen.getByText('贵州茅台')).toBeInTheDocument();
  });
});
