import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    const store = useAppStore.getState();
    act(() => {
      store.setPage('sectors');
      store.sidebarOpen = true;
      store.selectedStock = null;
      store.darkMode = true;
      store.debugOpen = false;
    });
    // Reset document classList for darkMode tests
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('has correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.currentPage).toBe('sectors');
    expect(state.sidebarOpen).toBe(true);
    expect(state.selectedStock).toBeNull();
    expect(state.darkMode).toBe(true);
    expect(state.debugOpen).toBe(false);
  });

  it('toggleDebug toggles debug panel state', () => {
    act(() => {
      useAppStore.getState().toggleDebug();
    });
    expect(useAppStore.getState().debugOpen).toBe(true);

    act(() => {
      useAppStore.getState().toggleDebug();
    });
    expect(useAppStore.getState().debugOpen).toBe(false);
  });

  it('setPage updates currentPage', () => {
    act(() => {
      useAppStore.getState().setPage('backtest');
    });
    expect(useAppStore.getState().currentPage).toBe('backtest');
  });

  it('toggleSidebar toggles sidebar state', () => {
    act(() => {
      useAppStore.getState().toggleSidebar();
    });
    expect(useAppStore.getState().sidebarOpen).toBe(false);

    act(() => {
      useAppStore.getState().toggleSidebar();
    });
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('setSelectedStock updates selected stock', () => {
    act(() => {
      useAppStore.getState().setSelectedStock('600519');
    });
    expect(useAppStore.getState().selectedStock).toBe('600519');
  });

  it('toggleDarkMode stays dark (dark-only mode)', () => {
    act(() => {
      useAppStore.getState().toggleDarkMode();
    });
    expect(useAppStore.getState().theme).toBe('dark');
    expect(useAppStore.getState().darkMode).toBe(true);
    document.documentElement.className = '';
  });

  it('can be used with selectors in components', () => {
    const { result } = renderHook(() => useAppStore((s) => s.currentPage));
    expect(result.current).toBe('sectors');
  });
});
