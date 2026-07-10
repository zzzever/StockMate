import { useAppStore, initSystemThemeListener } from '@/store/useAppStore';
import Sidebar from '@/components/Sidebar';
import TitleBar from '@/components/TitleBar';
import TopBar from '@/components/TopBar';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { Page } from '@/types';
import { useRealtimePriceListener } from '@/hooks/useTauriQuery';

interface LayoutProps { children: React.ReactNode; }

export default function Layout({ children }: LayoutProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const location = useLocation();
  const setPage = useAppStore((s) => s.setPage);

  useEffect(() => {
    const path = location.pathname.replace('/', '') || 'search';
    const pageMap: Record<string, Page> = {
      search: 'search', sector: 'sector', stock: 'stockDetail',
      backtest: 'backtest', predict: 'predict', rules: 'rules',
      settings: 'settings', 'indicator-lab': 'indicatorLab',
      watchlist: 'search', quote: 'quote',
    };
    if (pageMap[path]) setPage(pageMap[path]);
  }, [location, setPage]);

  useEffect(() => {
    const cleanup = initSystemThemeListener();
    return () => cleanup();
  }, []);

  useRealtimePriceListener();

  return (
    <div
      className={`h-screen w-screen overflow-hidden grid transition-all duration-[var(--transition-slow)] bg-[var(--bg-root)] ${
        sidebarOpen
          ? 'grid-cols-[var(--sidebar-width)_1fr]'
          : 'grid-cols-[var(--sidebar-collapsed)_1fr]'
      }`}
    >
      <aside
        className={`sidebar-glass relative z-10 flex flex-col transition-all duration-[var(--transition-slow)] ${
          sidebarOpen ? 'w-sidebar' : 'w-sidebar-collapsed'
        }`}
      >
        <Sidebar />
      </aside>
      <div className="flex flex-col overflow-hidden relative z-10">
        <TitleBar />
        <TopBar />
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
