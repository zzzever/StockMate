import { create } from 'zustand';
import { type Page } from '@/types';
import { type ChartStyle, defaultChartStyle } from '@/config/chartThemes';
import { getCurrentWindow } from '@tauri-apps/api/window';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'red' | 'blue' | 'green' | 'orange' | 'pink' | 'graphite';
const ACCENT_MAP: Record<AccentColor, [number, number]> = { red: [350, 75], blue: [221, 83], green: [158, 64], orange: [25, 95], pink: [330, 81], graphite: [215, 10] };

function applyAccent(color: AccentColor) {
  const [h, s] = ACCENT_MAP[color];
  const r = document.documentElement;
  r.style.setProperty('--accent', `${h} ${s}% 38%`);
  r.style.setProperty('--accent-subtle', `${h} ${s}% 95%`);
  r.style.setProperty('--accent-muted', `${h} ${s}% 28%`);
  // Dark mode overrides
  const isDark = r.classList.contains('dark');
  if (isDark) {
    r.style.setProperty('--accent', `${h} ${s}% 52%`);
    r.style.setProperty('--accent-subtle', `${h} 50% 15%`);
    r.style.setProperty('--accent-muted', `${h} 60% 40%`);
  }
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    try { getCurrentWindow().setTheme('dark'); } catch (_) {}
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    try { getCurrentWindow().setTheme('light'); } catch (_) {}
  }
}

// Listen for system theme changes when in 'system' mode
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const mode = useAppStore.getState().theme;
    if (mode === 'system') applyTheme('system');
  });
}

interface AppState {
  currentPage: Page;
  sidebarOpen: boolean;
  selectedStock: { code: string; name: string } | null;
  theme: ThemeMode;
  darkMode: boolean;
  accent: AccentColor;
  debugOpen: boolean;
  chartStyle: ChartStyle;

  setPage: (page: Page) => void;
  toggleSidebar: () => void;
  setSelectedStock: (stock: { code: string; name: string } | null) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  toggleDarkMode: () => void;
  toggleDebug: () => void;
  setChartStyle: (style: ChartStyle) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'search',
  sidebarOpen: true,
  selectedStock: null,
  theme: 'system',
  darkMode: true,
  accent: 'red',
  debugOpen: false,
  chartStyle: defaultChartStyle,

  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSelectedStock: (stock) => set({ selectedStock: stock }),
  setTheme: (theme) => {
    applyTheme(theme);
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    set({ theme, darkMode: isDark });
  },
  toggleDarkMode: () => set((s) => {
    const next = s.theme === 'light' ? 'dark' : s.theme === 'dark' ? 'system' : 'light';
    applyTheme(next);
    const isDark = next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return { theme: next, darkMode: isDark };
  }),
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
  setAccent: (accent) => { applyAccent(accent); set({ accent }); },
  setChartStyle: (style) => set({ chartStyle: style }),
}));
