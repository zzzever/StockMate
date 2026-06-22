import { create } from 'zustand';
import { type Page } from '@/types';

interface AppState {
  currentPage: Page;
  sidebarOpen: boolean;
  selectedStock: string | null;
  darkMode: boolean;

  setPage: (page: Page) => void;
  toggleSidebar: () => void;
  setSelectedStock: (id: string | null) => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'screener',
  sidebarOpen: true,
  selectedStock: null,
  darkMode: true,

  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSelectedStock: (id) => set({ selectedStock: id }),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode;
    if (next) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    return { darkMode: next };
  }),
}));
