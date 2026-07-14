import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConsolePanel } from '@/components/ConsolePanel';
import MiniPage from '@/pages/MiniPage';
import { PageSkeleton } from '@/components/PageLoader';

// Lazy-loaded page chunks — each produces a separate JS bundle
// Large pages get their own chunk; smaller commonly-used pages are grouped.
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const WatchlistPage = lazy(() => import('@/pages/WatchlistPage'));
const StockDetailPage = lazy(() => import('@/pages/StockDetailPage'));
const SectorStockRankPage = lazy(() => import('@/pages/SectorStockRankPage'));
const BacktestPage = lazy(() => import('@/pages/BacktestPage'));
const PredictPage = lazy(() => import('@/pages/PredictPage'));
const RulesPage = lazy(() => import('@/pages/RulesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

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

function AppRoutes() {
  return (
    <Layout>
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Watchlist as default landing page */}
            <Route path="/" element={<Navigate to="/watchlist" />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/quote" element={<StockDetailPage />} />
            <Route path="/sector" element={<SectorStockRankPage />} />
            <Route path="/stock" element={<StockDetailPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
            <Route path="/predict" element={<PredictPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Layout>
  );
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
      <ErrorBoundary>
        <HashRouter>
          <DisclaimerModal />
          <CrossWindowNav />
          <AppRoutes />
          <ConsolePanel />
        </HashRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
