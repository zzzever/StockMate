import { Star, Plus } from 'lucide-react';

const watchlistGroups = [
  {
    name: '默认分组',
    stocks: [
      { ticker: 'AAPL', name: 'Apple Inc.', price: 173.45, change: 1.2 },
      { ticker: 'MSFT', name: 'Microsoft Corp.', price: 420.12, change: -0.5 },
      { ticker: '600519', name: '贵州茅台', price: 1688.00, change: 0.8 },
    ],
  },
];

export default function WatchlistPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-zinc-100">自选股</h1>
        <button className="flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors">
          <Plus size={14} />
          添加
        </button>
      </div>

      {watchlistGroups.map((group) => (
        <div key={group.name} className="rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
            <Star size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-zinc-100">{group.name}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/50">
                <th className="px-4 py-2 text-left font-medium text-zinc-500">代码</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">名称</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">价格</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">涨跌幅</th>
              </tr>
            </thead>
            <tbody>
              {group.stocks.map((s) => {
                const up = s.change >= 0;
                return (
                  <tr key={s.ticker} className="border-b border-zinc-800/30 hover:bg-zinc-800/30">
                    <td className="px-4 py-2 font-mono text-emerald-400">{s.ticker}</td>
                    <td className="px-4 py-2 text-zinc-200">{s.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{s.price.toFixed(2)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {up ? '+' : ''}{s.change.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
