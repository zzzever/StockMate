import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import Sidebar from '@/components/Sidebar';
import TitleBar from '@/components/TitleBar';
import TopBar from '@/components/TopBar';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

interface LayoutProps { children: React.ReactNode; }

export default function Layout({ children }: LayoutProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const location = useLocation();
  const setPage = useAppStore((s) => s.setPage);

  useEffect(() => {
    const path = location.pathname.replace('/', '') || 'search';
    const pageMap: Record<string, string> = {
      search: 'search', sector: 'sector', stock: 'stockDetail',
      backtest: 'backtest', predict: 'predict', settings: 'settings',
    };
    if (pageMap[path]) setPage(pageMap[path] as any);
  }, [location, setPage]);

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
