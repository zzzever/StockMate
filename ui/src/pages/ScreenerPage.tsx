import { useState } from 'react';
import { useStockList } from '@/hooks/useTauriQuery';
import { Play } from 'lucide-react';

interface FilterState {
  peMin: string;
  peMax: string;
  pbMin: string;
  pbMax: string;
  roeMin: string;
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<FilterState>({
    peMin: '', peMax: '', pbMin: '', pbMax: '', roeMin: '',
  });
  const { data: stocks, isLoading } = useStockList();

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left: Filter Panel */}
      <div className="w-72 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">筛选条件</h2>
        
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">PE 范围</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="最小"
                value={filters.peMin}
                onChange={(e) => updateFilter('peMin', e.target.value)}
                className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <input
                type="number"
                placeholder="最大"
                value={filters.peMax}
                onChange={(e) => updateFilter('peMax', e.target.value)}
                className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">PB 范围</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="最小"
                value={filters.pbMin}
                onChange={(e) => updateFilter('pbMin', e.target.value)}
                className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <input
                type="number"
                placeholder="最大"
                value={filters.pbMax}
                onChange={(e) => updateFilter('pbMax', e.target.value)}
                className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">ROE 最小值 (%)</label>
            <input
              type="number"
              placeholder="例如 15"
              value={filters.roeMin}
              onChange={(e) => updateFilter('roeMin', e.target.value)}
              className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
          <Play size={14} />
          运行筛选
        </button>
      </div>

      {/* Right: Results Table */}
      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <h2 className="text-sm font-semibold text-zinc-100">筛选结果</h2>
          <span className="text-xs text-zinc-500">
            {isLoading ? '加载中...' : `${stocks?.length ?? 0} 条结果`}
          </span>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {/* TODO: virtual scrolling */}
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-900">
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 text-left font-medium text-zinc-400">代码</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-400">名称</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-400">价格</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-400">PE</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-400">PB</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-400">ROE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">加载中...</td></tr>
              )}
              {stocks?.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50 cursor-pointer">
                  <td className="px-3 py-2 font-mono text-emerald-400">{s.ticker}</td>
                  <td className="px-3 py-2 text-zinc-200">{s.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">—</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">—</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">—</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">—</td>
                </tr>
              ))}
              {!isLoading && (stocks?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
