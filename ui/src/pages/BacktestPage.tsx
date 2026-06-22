import { Play, Settings } from 'lucide-react';
import { useState } from 'react';

export default function BacktestPage() {
  const [strategy, setStrategy] = useState('multi_factor');
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2024-01-01');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-100">回测引擎</h1>
        <button className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition-colors">
          <Play size={14} />
          运行回测
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Strategy Panel */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Settings size={14} />
            策略配置
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">策略类型</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
              >
                <option value="multi_factor">多因子策略</option>
                <option value="momentum">动量策略</option>
                <option value="value">价值策略</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-400">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-400">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Placeholder */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100">回测结果</h2>
          <div className="space-y-2 text-xs text-zinc-500">
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>年化收益率 (CAGR)</span>
              <span className="font-mono text-zinc-300">—</span>
            </div>
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>最大回撤</span>
              <span className="font-mono text-zinc-300">—</span>
            </div>
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>夏普比率</span>
              <span className="font-mono text-zinc-300">—</span>
            </div>
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>胜率</span>
              <span className="font-mono text-zinc-300">—</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
