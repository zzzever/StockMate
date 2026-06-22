import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { useAppStore } from '@/store/useAppStore';
import ScreenerPage from '@/pages/ScreenerPage';
import StockDetailPage from '@/pages/StockDetailPage';
import BacktestPage from '@/pages/BacktestPage';
import WatchlistPage from '@/pages/WatchlistPage';
import SettingsPage from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const currentPage = useAppStore((s) => s.currentPage);

  const renderPage = () => {
    switch (currentPage) {
      case 'screener': return <ScreenerPage />;
      case 'stockDetail': return <StockDetailPage />;
      case 'backtest': return <BacktestPage />;
      case 'watchlist': return <WatchlistPage />;
      case 'settings': return <SettingsPage />;
      default: return <ScreenerPage />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Layout>{renderPage()}</Layout>
    </QueryClientProvider>
  );
}

export default App;
