import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import MiniTrend from './MiniTrend';

interface ScreenResult {
  id: string; ticker: string; name: string; close: number;
  change_pct: number; matches: string[];
}

interface CompareModalProps {
  stocks: ScreenResult[];
  onClose: () => void;
}

export default function CompareModal({ stocks, onClose }: CompareModalProps) {
  const [klineMap, setKlineMap] = useState<Record<string, number[]>>({});

  useEffect(() => {
    stocks.forEach(async (s) => {
      try {
        const data = await invoke<number[]>('get_stock_kline', { stockId: s.id, limit: 20, period: 'day' });
        setKlineMap(prev => ({ ...prev, [s.id]: data }));
      } catch {}
    });
  }, [stocks]);

  const getChangeStyle = (pct: number) => {
    const abs = Math.min(Math.abs(pct) / 10, 1);
    if (pct >= 0) return { color: `hsl(0,80%,${45 - abs * 20}%)`, background: `hsla(0,80%,55%,${abs * 0.12})` };
    return { color: `hsl(145,70%,${35 - abs * 15}%)`, background: `hsla(145,70%,45%,${abs * 0.12})` };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <div className="w-[90vw] max-w-4xl glass-card-flat p-4" style={{ background: 'var(--bg-root)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-data-sm font-bold" style={{ color: 'var(--text-primary)' }}>股票对比</h3>
          <button onClick={onClose} className="btn-ghost p-1">x</button>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stocks.length}, 1fr)` }}>
          {stocks.map(s => (
            <div key={s.id} className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--bg-card)' }}>
              <div className="font-mono text-data-xs" style={{ color: 'var(--text-tertiary)' }}>{s.ticker}</div>
              <div className="text-data-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
              <div className="text-data-sm font-mono-nums" style={{ color: 'var(--text-primary)' }}>¥{s.close.toFixed(2)}</div>
              <div className="text-data-sm font-mono-nums rounded-sm px-1" style={getChangeStyle(s.change_pct)}>
                {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
              </div>
              {klineMap[s.id] && <MiniTrend prices={klineMap[s.id]} width={120} height={32} />}
              <div className="flex flex-wrap gap-1 mt-1">
                {s.matches.map((m, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{m}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
