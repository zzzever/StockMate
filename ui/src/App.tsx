import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConsolePanel } from '@/components/ConsolePanel';
import SearchPage from '@/pages/SearchPage';
import SectorStockRankPage from '@/pages/SectorStockRankPage';
import StockDetailPage from '@/pages/StockDetailPage';
import WatchlistPage from '@/pages/WatchlistPage';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <DisclaimerModal />
        <Layout>
          <ErrorBoundary>
            <Routes>
              {/* 自選股作为首页默认 — 所有路径最终导向个股分析 */}
              <Route path="/" element={<Navigate to="/watchlist" />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
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
