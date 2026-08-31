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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Lazy-loaded page chunks — each produces a separate JS bundle
// Large pages get their own chunk; smaller commonly-used pages are grouped.
const SearchPage = lazy(() => import('@/pages/SearchPage'));
const WatchlistPage = lazy(() => import('@/pages/WatchlistPage'));
const StockDetailPage = lazy(() => import('@/pages/StockDetailPage'));
const SectorStockRankPage = lazy(() => import('@/pages/SectorStockRankPage'));
const BacktestPage = lazy(() => import('@/pages/BacktestPage'));
const PredictPage = lazy(() => import('@/pages/PredictPage'));
const RulesPage = lazy(() => import('@/pages/RulesPage'));
const IndicatorLabPage = lazy(() => import('@/pages/IndicatorLabPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const LNNPage = lazy(() => import('@/pages/LNNPage'));
const KronosPage = lazy(() => import('@/pages/KronosPage'));
const AiPredictPage = lazy(() => import('@/pages/AiPredictPage'));
const ScreenerPage = lazy(() => import('@/pages/ScreenerPage'));
const WikiPage = lazy(() => import('@/pages/WikiPage'));
const IndicatorEditorPage = lazy(() => import('@/pages/IndicatorEditorPage'));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));
const CommunityPage = lazy(() => import('@/pages/CommunityPage'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));
const StrategyGroupPage = lazy(() => import('@/pages/StrategyGroupPage'));
const ApiPage = lazy(() => import('@/pages/ApiPage'));
const SignalAlertPage = lazy(() => import('@/pages/SignalAlertPage'));
const AIScreenerPage = lazy(() => import('@/pages/AIScreenerPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const CopyTradingPage = lazy(() => import('@/pages/CopyTradingPage'));
const ReportPage = lazy(() => import('@/pages/ReportPage'));
const RealTimeDashboard = lazy(() => import('@/pages/RealTimeDashboard'));
const PortfolioAnalytics = lazy(() => import('@/pages/PortfolioAnalytics'));
const MonteCarloPage = lazy(() => import('@/pages/MonteCarloPage'));
const FinancialCalendar = lazy(() => import('@/pages/FinancialCalendar'));
const NotificationCenter = lazy(() => import('@/pages/NotificationCenter'));
const FactorAnalysisPage = lazy(() => import('@/pages/FactorAnalysisPage'));
const RiskParityPage = lazy(() => import('@/pages/RiskParityPage'));
const SocialTradingPage = lazy(() => import('@/pages/SocialTradingPage'));
const CreatorPage = lazy(() => import('@/pages/CreatorPage'));
const PluginSystemPage = lazy(() => import('@/pages/PluginSystemPage'));

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
  useKeyboardShortcuts();
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
            <Route path="/indicator-lab" element={<IndicatorLabPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/ai-predict" element={<AiPredictPage />} />
            <Route path="/lnn" element={<LNNPage />} />
            <Route path="/kronos" element={<KronosPage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/wiki" element={<WikiPage />} />
            <Route path="/indicator-editor" element={<IndicatorEditorPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/strategy-group" element={<StrategyGroupPage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/signal-alert" element={<SignalAlertPage />} />
            <Route path="/ai-screener" element={<AIScreenerPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/copy-trading" element={<CopyTradingPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/real-time" element={<RealTimeDashboard />} />
            <Route path="/portfolio" element={<PortfolioAnalytics />} />
            <Route path="/monte-carlo" element={<MonteCarloPage />} />
            <Route path="/calendar" element={<FinancialCalendar />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/factor-analysis" element={<FactorAnalysisPage />} />
            <Route path="/risk-parity" element={<RiskParityPage />} />
            <Route path="/social-trading" element={<SocialTradingPage />} />
            <Route path="/creator" element={<CreatorPage />} />
            <Route path="/pluginSystem" element={<PluginSystemPage />} />
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
