import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, ChevronRight, X, BarChart3, Landmark, Clock, Trash2, Star } from 'lucide-react';
import { useSearchStocks, useWatchlistAdd, useWatchlistCheck } from '@/hooks/useTauriQuery';
import { useQueryClient } from '@tanstack/react-query';
import type { Stock } from '@/types';

// Minimal type matching only the Stock fields addToHistory actually uses
type SearchResult = Pick<Stock, 'id' | 'ticker' | 'name'> & { stock_type: string };

// ─── Search history (localStorage) ───
const HISTORY_KEY = 'stockmate_search_history';
const MAX_HISTORY = 15;

interface HistoryItem { id: string; ticker: string; name: string; stockType: string; }

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function addToHistory(stock: SearchResult) {
  const items = loadHistory().filter((h) => h.id !== stock.id);
  items.unshift({ id: stock.id, ticker: stock.ticker, name: stock.name, stockType: stock.stock_type });
  saveHistory(items);
}

function removeFromHistory(id: string) {
  saveHistory(loadHistory().filter((h) => h.id !== id));
}

// ─── Helpers ───
function getTypeBadge(stockType: string) {
  if (stockType === 'etf') {
    return { label: 'ETF', bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400', icon: Landmark };
  }
  return { label: '股票', bg: 'bg-violet-100 dark:bg-violet-500/20', text: 'text-violet-700 dark:text-violet-400', icon: TrendingUp };
}

function getExchangeLabel(exchange: string) {
  if (exchange === 'SSE') return '沪';
  if (exchange === 'SZSE') return '深';
  return exchange;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const addWatchlistMutation = useWatchlistAdd();

  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading, error } = useSearchStocks(debouncedQuery);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (stock: Stock) => {
      addToHistory(stock);
      setHistory(loadHistory());
      navigate(`/stock?code=${encodeURIComponent(stock.id)}`, {
        state: { stockName: stock.name },
      });
    },
    [navigate],
  );

  const handleHistorySelect = useCallback(
    (item: HistoryItem) => {
      // Move to top of history
      addToHistory({ id: item.id, ticker: item.ticker, name: item.name, stock_type: item.stockType });
      setHistory(loadHistory());
      navigate(`/stock?code=${encodeURIComponent(item.id)}`, { state: { stockName: item.name } });
    },
    [navigate],
  );

  const handleRemoveHistory = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      removeFromHistory(id);
      setHistory(loadHistory());
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && results && results.length > 0) {
        handleSelect(results[0]);
      }
    },
    [results, handleSelect],
  );

  const handleAddToWatchlist = useCallback(
    (e: React.MouseEvent, stock: Stock) => {
      e.stopPropagation();
      e.preventDefault();
      addWatchlistMutation.mutate(stock.ticker, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['watchlist'] });
        },
      });
    },
    [addWatchlistMutation, queryClient],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center h-full pt-16 px-4"
    >
      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
          股票检索
        </h1>
        <p className="text-sm mt-2" style={{ color: 'hsl(var(--text-tertiary))' }}>
          台湾加权 · 上证综指 · 日经平均
        </p>
      </div>

      {/* Search Box */}
      <div className="w-full max-w-xl relative mb-8">
        <div className="relative rounded-xl" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-default))' }}>
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <input ref={inputRef} type="text" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="輸入代碼或名稱…"
            className="w-full h-14 pl-12 pr-12 bg-transparent text-lg outline-none font-medium rounded-xl"
            style={{ color: 'hsl(var(--text-primary))' }}
            aria-label="搜索股票或ETF"
          />
          {query && (
            <button onClick={handleClear} className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-60 transition-opacity"
              style={{ color: 'hsl(var(--text-tertiary))' }} aria-label="清除搜索">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="w-full max-w-xl">
        <AnimatePresence mode="wait">
          {showResults && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-4 text-red-500 border border-red-300 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20"
            >
              搜索失败: {error.message}
            </motion.div>
          )}

          {showResults && isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-8 text-sm"
              style={{ color: 'hsl(var(--text-secondary))' }}
            >
              <Search size={16} className="animate-pulse mr-2" />
              搜索中...
            </motion.div>
          )}

          {showResults && !isLoading && debouncedQuery && results && results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-12"
              style={{ color: 'hsl(var(--text-secondary))' }}
            >
              <BarChart3 size={40} className="opacity-30 mb-3" />
              <p className="text-base font-bold" style={{ color: 'hsl(var(--text-primary))' }}>未找到该股票</p>
              <p className="text-xs mt-1 opacity-50">请输入完整代码或关键字</p>
            </motion.div>
          )}

          {showResults && !isLoading && results && results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-1"
            >
              <p className="text-xs font-medium px-2 mb-2" style={{ color: 'hsl(var(--text-tertiary))' }}>
                搜索结果 {results.length} 条
              </p>
              {results.map((stock, i) => {
                const badge = getTypeBadge(stock.stock_type);
                const BadgeIcon = badge.icon;
                return (
                  <motion.button
                    key={stock.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleSelect(stock)}
                    className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors text-left group"
                  >
                    {/* Type icon */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${badge.bg}`}
                    >
                      <BadgeIcon size={18} className={badge.text} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-black dark:text-white truncate">
                          {stock.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-400">
                          {stock.ticker}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-1 rounded">
                          {getExchangeLabel(stock.exchange)}
                        </span>
                        {stock.sector && (
                          <span className="text-xs text-gray-600 dark:text-gray-500 truncate">
                            {stock.sector}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleAddToWatchlist(e, stock)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-500 hover:bg-amber-200 dark:hover:bg-amber-500/25 transition-colors"
                      title="加入自选"
                      aria-label={`加入自选 ${stock.name}`}
                    >
                      <Star size={14} />
                    </button>

                    <ChevronRight
                      size={18}
                      className="text-gray-400 group-hover:text-violet-500 transition-colors shrink-0"
                    />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search history when no query */}
        {!debouncedQuery && (
          <div className="space-y-1">
            {history.length > 0 && (
              <div className="flex items-center justify-between px-2 mb-2">
                <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  <Clock size={12} /> 搜索历史
                </p>
                <button
                  onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); }}
                  className="text-xs font-medium hover:text-red-700 transition-colors flex items-center gap-1"
                  style={{ color: 'hsl(var(--text-tertiary))' }}
                >
                  <Trash2 size={12} /> 清空
                </button>
              </div>
            )}
            {history.map((item) => {
              const badge = getTypeBadge(item.stockType);
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleHistorySelect(item)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer group"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${badge.bg}`}>
                    <BadgeIcon size={14} className={badge.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-black dark:text-white">{item.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-mono">{item.ticker}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  <button
                    onClick={(e) => handleRemoveHistory(e, item.id)}
                    className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`删除 ${item.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            {history.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
                  搜索股票代码或名称，如 茅台、600519、510050
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
