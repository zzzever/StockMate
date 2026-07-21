import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, RefreshCw, ArrowLeft } from 'lucide-react';
import { useStockList } from '@/hooks/useTauriQuery';
import { invoke } from '@tauri-apps/api/core';

interface ScreenResult {
  id: string; ticker: string; name: string; close: number;
  change_pct: number; matches: string[];
}

const PRESET_STRATEGIES = [
  {
    id: 'cheap_shrink',
    name: '低价缩量下跌',
    desc: '价格<20元 · 连续缩量下跌3日',
  },
];

export default function ScreenerPage() {
  const navigate = useNavigate();
  const { data: stockList } = useStockList();
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [running, setRunning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const cancelRef = useRef(false);
  const [selectedStrategy] = useState('cheap_shrink');

  const runScreener = async () => {
    if (!stockList) return;
    setRunning(true);
    setResults([]);
    setScannedCount(0);
    cancelRef.current = false;

    const matched: ScreenResult[] = [];
    const batch = stockList.slice(0, 500);
    const CONCURRENCY = 10;
    let index = 0;
    let processed = 0;

    const processOne = async () => {
      while (true) {
        const i = index++;
        if (i >= batch.length || cancelRef.current) return;

        const stock = batch[i];
        const id = stock.id || (stock as any).stock_id || '';
        if (!id) {
          processed++;
          if (processed % 5 === 0 || processed === batch.length || cancelRef.current) {
            setScannedCount(processed);
            setResults([...matched]);
            await new Promise(r => setTimeout(r, 0));
          }
          continue;
        }
        try {
          const quotesData: any[] = await invoke('get_stock_history', { stockId: id, days: 30, period: 'day' });
          if (!quotesData || quotesData.length < 5) continue;

          const closes = quotesData.map((q: any) => Number(q.close));
          const volumes = quotesData.map((q: any) => Number(q.volume));
          const n = closes.length;
          const lastClose = closes[n-1];
          const matches: string[] = [];

          if (lastClose < 20) matches.push('低价');

          if (n >= 4) {
            let shrinkDrop = true;
            for (let j = 0; j < 3; j++) {
              if (closes[n-1-j] >= closes[n-2-j]) { shrinkDrop = false; break; }
              const ma5 = volumes.slice(0, n-j).reduce((a: number, b: number) => a + b, 0) / Math.min(5, n-j);
              if (ma5 > 0 && volumes[n-1-j] / ma5 >= 0.6) { shrinkDrop = false; break; }
            }
            if (shrinkDrop) matches.push('缩量下跌3日');
          }

          if (matches.length > 0) {
            const changePct = n >= 2 ? ((closes[n-1] - closes[n-2]) / closes[n-2]) * 100 : 0;
            matched.push({
              id, ticker: stock.ticker || ((stock as any).stock_id?.split('.')[0]) || '', name: stock.name || '',
              close: lastClose, change_pct: changePct, matches,
            });
          }
        } catch (_) {}

        processed++;
        if (processed % 5 === 0 || processed === batch.length || cancelRef.current) {
          setScannedCount(processed);
          setResults([...matched]);
          await new Promise(r => setTimeout(r, 0));
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => processOne());
    await Promise.all(workers);

    if (cancelRef.current) {
      setRunning(false);
      return;
    }

    matched.sort((a, b) => a.close - b.close);
    setResults(matched);
    setScannedCount(batch.length);
    setRunning(false);
  };

  return (
    <div className="h-full flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1"><ArrowLeft size={18} /></button>
        <Filter size={18} className="text-[hsl(var(--swiss-accent))]" />
        <h1 className="text-heading-sm font-bold">选股</h1>
      </div>

      <div className="flex-1 flex gap-2 overflow-hidden">
        <div className="w-[280px] shrink-0 flex flex-col gap-2">
          <div className="glass-card-flat p-2 space-y-2">
            <div className="text-data-xs font-bold" style={{ color: 'var(--text-secondary)' }}>预设策略</div>
            {PRESET_STRATEGIES.map(s => (
              <button key={s.id}
                className="w-full text-left p-2 rounded-lg transition-all"
                style={{
                  background: selectedStrategy === s.id ? 'hsl(var(--swiss-accent-ghost))' : 'var(--bg-card)',
                  border: selectedStrategy === s.id ? '1px solid hsl(var(--swiss-accent) / 0.3)' : '1px solid var(--border-subtle)'
                }}>
                <div className="text-data-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                <div className="text-data-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{s.desc}</div>
              </button>
            ))}
          </div>

          <button onClick={runScreener} disabled={running || !stockList}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-auto">
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {running ? `选股中... (${results.length} 只匹配)` : '运行选股'}
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {results.length === 0 && !running && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
                <Filter size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-data-sm">选择策略并运行选股</p>
                <p className="text-data-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>系统将从 500 只股票中筛选符合条件的标的</p>
              </div>
            </div>
          )}

          {running && (
            <div className="flex flex-col gap-2 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-data-xs">
                  <span style={{ color: 'var(--text-tertiary)' }}>扫描进度</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{scannedCount}/{500}</span>
                </div>
                <div className="h-1 rounded-full" style={{ background: 'var(--bg-input)' }}>
                  <div className="h-full rounded-full transition-all duration-300 ease-out" style={{
                    width: `${(scannedCount / 500) * 100}%`,
                    background: 'hsl(var(--swiss-accent))',
                  }} />
                </div>
                <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
                  已匹配 {results.length} 只
                </div>
              </div>
              <button onClick={() => { cancelRef.current = true; }}
                className="btn-secondary w-full text-data-xs">
                取消选股
              </button>
            </div>
          )}

          {results.length > 0 && !running && (
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="glass-card-flat p-2 text-center">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'var(--text-primary)' }}>{results.length}</div>
                  <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>匹配</div>
                </div>
                <div className="glass-card-flat p-2 text-center">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'var(--text-primary)' }}>¥{(results.reduce((s,r)=>s+r.close,0) / results.length).toFixed(2)}</div>
                  <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>均价</div>
                </div>
                <div className="glass-card-flat p-2 text-center">
                  <div className="text-heading-sm font-bold font-mono-nums" style={{ color: 'hsl(var(--price-down))' }}>¥{Math.min(...results.map(r=>r.close)).toFixed(2)}</div>
                  <div className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最低价</div>
                </div>
              </div>
              {/* Results table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-data-sm">
                  <thead className="sticky top-0" style={{ background: 'var(--bg-root)' }}>
                    <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <th className="text-left py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>代码</th>
                      <th className="text-left py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>名称</th>
                      <th className="text-right py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最新价</th>
                      <th className="text-right py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>涨跌幅</th>
                      <th className="text-left py-2 px-2 text-data-xs" style={{ color: 'var(--text-tertiary)' }}>匹配条件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id} onClick={() => navigate(`/stock?code=${r.id}`)}
                        className="border-b cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                        style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="py-2 px-2 font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{r.ticker}</td>
                        <td className="py-2 px-2 font-medium text-data-sm" style={{ color: 'var(--text-primary)' }}>{r.name}</td>
                        <td className="py-2 px-2 text-right font-mono-nums text-data-sm" style={{ color: 'var(--text-primary)' }}>¥{r.close.toFixed(2)}</td>
                        <td className={`py-2 px-2 text-right font-mono-nums text-data-sm ${r.change_pct >= 0 ? 'price-up' : 'price-down'}`}>
                          {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(2)}%
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {r.matches.map((m, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm"
                                style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{m}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
