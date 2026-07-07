import { motion, AnimatePresence } from 'framer-motion';
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
    };
    if (pageMap[path]) setPage(pageMap[path]);
  }, [location, setPage]);

  // Initialise the system theme listener (reacts to OS dark/light changes)
  useEffect(() => {
    const cleanup = initSystemThemeListener();
    return () => cleanup();
  }, []);

  // Initialise the WebSocket real-time price listener (receives push from Tauri backend)
  useRealtimePriceListener();

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'hsl(var(--bg-root))' }}>
      <aside
        className={`sidebar-glass relative z-10 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'w-60' : 'w-16'
        }`}
      >
        <Sidebar />
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <TitleBar />
        <TopBar />
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex-1 overflow-auto p-3"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
