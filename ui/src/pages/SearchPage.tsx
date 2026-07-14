import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, ChevronRight, X, BarChart3, Landmark, Clock, Trash2, Star } from 'lucide-react';
import { useSearchStocks, useWatchlistAdd } from '@/hooks/useTauriQuery';
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
// Semantic type badge — ETF uses the accent (blue) token, stock uses a neutral
// surface. Colors come from the design-system CSS variables, not hardcoded hues.
function getTypeBadge(stockType: string) {
  if (stockType === 'etf') {
    return {
      label: 'ETF',
      icon: Landmark,
      style: { background: 'hsl(var(--swiss-accent) / 0.12)', color: 'hsl(var(--swiss-accent))' },
    };
  }
  return {
    label: '股票',
    icon: TrendingUp,
    style: { background: 'var(--bg-input)', color: 'hsl(var(--text-secondary))' },
  };
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

  // Auto-focus on mount — mount-only side effect, intentionally runs once.
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
        onError: (err) => {
          console.warn('[SearchPage] 加入自选失败:', stock.ticker, err);
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
    <div className="flex flex-col items-center h-full pt-16 px-4">
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
        <div className="relative" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-default))', borderRadius: 'var(--radius-md)' }}>
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <input ref={inputRef} type="text" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            placeholder="輸入代碼或名稱…"
            className="w-full h-14 pl-12 pr-12 bg-transparent text-lg outline-none font-medium"
            style={{ color: 'hsl(var(--text-primary))', borderRadius: 'var(--radius-md)' }}
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

          {showResults && error && (
            <div
              className="p-4"
              style={{
                color: 'hsl(var(--risk-danger))',
                border: '1px solid hsl(var(--risk-danger) / 0.4)',
                background: 'hsl(var(--risk-danger) / 0.08)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              搜索失败: {error.message}
            </div>
          )}

          {showResults && isLoading && (
            <div
              className="flex items-center justify-center py-8 text-sm"
              style={{ color: 'hsl(var(--text-secondary))' }}
            >
              <Search size={16} className="animate-pulse mr-2" />
              搜索中...
            </div>
          )}

          {showResults && !isLoading && debouncedQuery && results && results.length === 0 && (
            <div
              className="flex flex-col items-center py-12"
              style={{ color: 'hsl(var(--text-secondary))' }}
            >
              <BarChart3 size={40} className="opacity-30 mb-3" />
              <p className="text-base font-bold" style={{ color: 'hsl(var(--text-primary))' }}>未找到该股票</p>
              <p className="text-xs mt-1 opacity-50">请输入完整代码或关键字</p>
            </div>
          )}

          {showResults && !isLoading && results && results.length > 0 && (
            <div
              className="space-y-1"
            >
              <p className="text-xs font-medium px-2 mb-2" style={{ color: 'hsl(var(--text-tertiary))' }}>
                搜索结果 {results.length} 条
              </p>
              {results.map((stock) => {
                const badge = getTypeBadge(stock.stock_type);
                const BadgeIcon = badge.icon;
                return (
                  <button
                    onClick={() => handleSelect(stock)}
                    className="hover-surface w-full flex items-center gap-4 p-3 text-left group"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    {/* Type icon */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center"
                      style={{ ...badge.style, borderRadius: 'var(--radius-md)' }}
                    >
                      <BadgeIcon size={18} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--text-primary))' }}>
                          {stock.name}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 font-medium"
                          style={{ ...badge.style, borderRadius: 'var(--radius-xs)' }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>
                          {stock.ticker}
                        </span>
                        <span
                          className="text-xs px-1"
                          style={{ color: 'hsl(var(--text-tertiary))', background: 'var(--bg-input)', borderRadius: 'var(--radius-xs)' }}
                        >
                          {getExchangeLabel(stock.exchange)}
                        </span>
                        {stock.sector && (
                          <span className="text-xs truncate" style={{ color: 'hsl(var(--text-tertiary))' }}>
                            {stock.sector}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleAddToWatchlist(e, stock)}
                      className="hover-surface flex h-8 w-8 shrink-0 items-center justify-center"
                      style={{ color: 'hsl(var(--text-tertiary))', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}
                      title="加入自选"
                      aria-label={`加入自选 ${stock.name}`}
                    >
                      <Star size={14} />
                    </button>

                    <ChevronRight size={18} className="shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }} />
                  </button>
                );
              })}
            </div>
          )}

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
                  className="hover-danger text-xs font-medium transition-colors flex items-center gap-1 px-1.5 py-0.5"
                  style={{ color: 'hsl(var(--text-tertiary))', borderRadius: 'var(--radius-xs)' }}
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
                  className="hover-surface w-full flex items-center gap-3 p-2.5 cursor-pointer group"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center"
                    style={{ ...badge.style, borderRadius: 'var(--radius-md)' }}
                  >
                    <BadgeIcon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm" style={{ color: 'hsl(var(--text-primary))' }}>{item.name}</span>
                    <span className="text-xs ml-2 font-mono-nums" style={{ color: 'hsl(var(--text-secondary))' }}>{item.ticker}</span>
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 font-medium"
                    style={{ ...badge.style, borderRadius: 'var(--radius-xs)' }}
                  >
                    {badge.label}
                  </span>
                  <button
                    onClick={(e) => handleRemoveHistory(e, item.id)}
                    className="hover-danger p-1 transition-colors opacity-0 group-hover:opacity-100"
                    style={{ color: 'hsl(var(--text-tertiary))', borderRadius: 'var(--radius-xs)' }}
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
    </div>
  );
}
