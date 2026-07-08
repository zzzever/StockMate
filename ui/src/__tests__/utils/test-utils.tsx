import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

// ─── Render With Providers ───

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: false },
  },
});

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Mock Helpers (call vi.mock at top-level of test files) ───

export const createMockStore = (overrides?: any) => ({
  currentPage: 'sectors' as const,
  sidebarOpen: true,
  selectedStock: null,
  darkMode: true,
  setPage: vi.fn(),
  toggleSidebar: vi.fn(),
  setSelectedStock: vi.fn(),
  toggleDarkMode: vi.fn(),
  ...overrides,
});

export function mockAppStore(store = createMockStore()) {
  return vi.mock('@/store/useAppStore', () => ({
    useAppStore: (selector: any) => selector(store),
  }));
}

// ─── Common Mock Modules ───

export const mockFramerMotion = () => vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    main: ({ children, ...props }: any) => <main {...props}>{children}</main>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
    tr: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
    td: ({ children, ...props }: any) => <td {...props}>{children}</td>,
    th: ({ children, ...props }: any) => <th {...props}>{children}</th>,
    table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
    thead: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
    tbody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
    svg: ({ children, ...props }: any) => <svg {...props}>{children}</svg>,
    circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
    line: ({ children, ...props }: any) => <line {...props}>{children}</line>,
    path: ({ children, ...props }: any) => <path {...props}>{children}</path>,
    g: ({ children, ...props }: any) => <g {...props}>{children}</g>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

export const mockLightweightCharts = () => vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    addLineSeries: vi.fn(() => ({ setData: vi.fn() })),
    addHistogramSeries: vi.fn(() => ({ setData: vi.fn() })),
    addAreaSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    remove: vi.fn(),
  })),
  LineStyle: { Dashed: 2 },
}));

export const mockTauriApi = () => vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((_cmd: string, _args?: Record<string, unknown>) => {
    return Promise.resolve(null);
  }),
}));

export const mockTauriEvent = () => vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(() => Promise.resolve()),
}));
