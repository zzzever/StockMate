import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConsolePanel } from '@/components/ConsolePanel';
import SearchPage from '@/pages/SearchPage';
import SectorStockRankPage from '@/pages/SectorStockRankPage';
import StockDetailPage from '@/pages/StockDetailPage';
import WatchlistPage from '@/pages/WatchlistPage';
import MiniPage from '@/pages/MiniPage';

import BacktestPage from '@/pages/BacktestPage';
import PredictPage from '@/pages/PredictPage';
import RulesPage from '@/pages/RulesPage';
import IndicatorLabPage from '@/pages/IndicatorLabPage';
import SettingsPage from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

import { DisclaimerModal } from '@/components/Disclaimer';

/** Listens for the mini window's row clicks and navigates the main window to that stock. */
function CrossWindowNav() {
  const navigate = useNavigate();
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    listen<{ id: string }>('navigate-to-stock', (event) => {
      const id = event.payload?.id;
      if (id) navigate(`/stock?code=${encodeURIComponent(id)}`);
      try { getCurrentWindow().setFocus(); } catch (e) { console.warn('[main] setFocus failed:', e); }
    }).then((fn) => { cleanup = fn; }).catch((e) => { console.warn('[main] navigate-to-stock listen failed:', e); });
    return () => { cleanup?.(); };
  }, [navigate]);
  return null;
}

function App() {
  // The mini always-on-top window is loaded at #/mini — render only the compact
  // watchlist, without the sidebar / console / disclaimer chrome.
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#/mini')) {
    return (
      <QueryClientProvider client={queryClient}>
        <MiniPage />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <DisclaimerModal />
        <CrossWindowNav />
        <Layout>
          <ErrorBoundary>
            <Routes>
              {/* 自選股作为首页默认 — 所有路径最终导向个股分析 */}
              <Route path="/" element={<Navigate to="/watchlist" />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/quote" element={<StockDetailPage />} />
              <Route path="/sector" element={<SectorStockRankPage />} />
              <Route path="/stock" element={<StockDetailPage />} />
              <Route path="/backtest" element={<BacktestPage />} />
              <Route path="/predict" element={<PredictPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/indicator-lab" element={<IndicatorLabPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
        <ConsolePanel />
      </HashRouter>
    </QueryClientProvider>
  );
}

export default App;
