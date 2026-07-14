import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'jp' | 'ghibli' | 'bloomberg' | 'morandi' | 'swiss';

interface ThemeStore {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'jp',
      setTheme: (t) => set({ theme: t }),
    }),
    { name: 'stockmate-theme' }
  )
);
