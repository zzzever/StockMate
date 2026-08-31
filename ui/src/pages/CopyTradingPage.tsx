import { useState, useMemo, useCallback } from 'react';
import { Users, Copy, Star, TrendingUp, TrendingDown, BarChart3, Clock, UserPlus, UserCheck, Eye, ChevronDown, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface StrategyTrader {
  id: string;
  name: string;
  avatar: string;
  followers: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  monthlyReturns: number[];
  strategy: string;
  riskLevel: 'low' | 'medium' | 'high';
  followed: boolean;
}

// ── 常量 ──

const STORAGE_KEY_COPY_TRADING = 'stockmate_copy_trading';

const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
const RISK_LABELS = { low: '低风险', medium: '中风险', high: '高风险' };

const MOCK_TRADERS: StrategyTrader[] = [
  { id: 't1', name: '量化老张', avatar: '张', followers: 2340, winRate: 68.5, totalReturn: 156.2, sharpeRatio: 2.1, maxDrawdown: -12.3, monthlyReturns: [3.2, -1.5, 5.8, 2.1, -0.8, 4.5, 1.2, -2.1, 6.3, 3.8, -1.2, 4.1], strategy: '均线多头 + 量价配合', riskLevel: 'medium', followed: false },
  { id: 't2', name: '趋势猎手', avatar: '猎', followers: 1850, winRate: 72.1, totalReturn: 203.8, sharpeRatio: 2.5, maxDrawdown: -8.7, monthlyReturns: [4.1, 2.3, -0.5, 6.2, 3.8, -1.2, 5.1, 2.8, -0.3, 4.5, 1.8, 3.2], strategy: '趋势跟踪 + 动量策略', riskLevel: 'low', followed: true },
  { id: 't3', name: '短线刀客', avatar: '刀', followers: 3120, winRate: 55.2, totalReturn: 89.5, sharpeRatio: 1.3, maxDrawdown: -18.5, monthlyReturns: [8.2, -5.1, 12.3, -3.8, 6.5, -2.1, 9.8, -4.5, 7.2, -1.8, 5.3, -2.8], strategy: '打板 + 情绪周期', riskLevel: 'high', followed: false },
  { id: 't4', name: '价值投资者', avatar: '值', followers: 980, winRate: 65.8, totalReturn: 78.3, sharpeRatio: 1.8, maxDrawdown: -10.2, monthlyReturns: [1.5, 0.8, 2.3, -0.5, 1.8, 0.3, 2.1, -0.8, 1.2, 0.5, 1.8, 0.2], strategy: '基本面 + 估值修复', riskLevel: 'low', followed: false },
  { id: 't5', name: 'CTA策略师', avatar: 'C', followers: 1560, winRate: 61.3, totalReturn: 112.7, sharpeRatio: 1.9, maxDrawdown: -14.8, monthlyReturns: [2.8, -1.2, 4.5, 1.8, -0.5, 3.2, -1.8, 5.1, 2.3, -0.8, 3.5, 1.2], strategy: '商品期货 + 趋势', riskLevel: 'medium', followed: true },
];

// ── 组件 ──

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data.map(Math.abs));
  const h = 32;
  const w = 80;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h / 2 - (v / max) * (h / 2 - 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CopyTradingPage() {
  const [traders, setTraders] = useState<StrategyTrader[]>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY_COPY_TRADING); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return MOCK_TRADERS;
  });
  const [filter, setFilter] = useState<'all' | 'followed' | 'low' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'return' | 'winRate' | 'sharpe' | 'followers'>('return');

  const filtered = useMemo(() => {
    let list = [...traders];
    if (filter === 'followed') list = list.filter(t => t.followed);
    else if (filter !== 'all') list = list.filter(t => t.riskLevel === filter);
    list.sort((a, b) => {
      if (sortBy === 'return') return b.totalReturn - a.totalReturn;
      if (sortBy === 'winRate') return b.winRate - a.winRate;
      if (sortBy === 'sharpe') return b.sharpeRatio - a.sharpeRatio;
      return b.followers - a.followers;
    });
    return list;
  }, [traders, filter, sortBy]);

  const toggleFollow = useCallback((id: string) => {
    setTraders(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, followed: !t.followed, followers: t.followed ? t.followers - 1 : t.followers + 1 } : t);
      try { localStorage.setItem(STORAGE_KEY_COPY_TRADING, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const followedCount = useMemo(() => traders.filter(t => t.followed).length, [traders]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
            <Users size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>策略跟单</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>关注优秀策略，一键跟单复制</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{traders.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>策略作者</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--swiss-accent))' }}>{followedCount}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>已关注</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
          {([['all', '全部'], ['followed', '已关注'], ['low', '低风险'], ['medium', '中风险'], ['high', '高风险']] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
              style={{
                background: filter === f ? 'hsl(var(--bg-card))' : 'transparent',
                color: filter === f ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
              }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
          {([['return', '收益率'], ['winRate', '胜率'], ['sharpe', '夏普'], ['followers', '粉丝']] as const).map(([s, label]) => (
            <button key={s} onClick={() => setSortBy(s)}
              className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
              style={{
                background: sortBy === s ? 'hsl(var(--bg-card))' : 'transparent',
                color: sortBy === s ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Trader Cards */}
      <div className="space-y-3">
        {filtered.map((trader, i) => (
          <motion.div key={trader.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: RISK_COLORS[trader.riskLevel] }}>
                  {trader.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{trader.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${RISK_COLORS[trader.riskLevel]}15`, color: RISK_COLORS[trader.riskLevel] }}>
                      {RISK_LABELS[trader.riskLevel]}
                    </span>
                  </div>
                  <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{trader.strategy}</span>
                </div>
              </div>
              <button onClick={() => toggleFollow(trader.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: trader.followed ? 'hsl(var(--swiss-accent))' : 'transparent',
                  color: trader.followed ? 'white' : 'hsl(var(--swiss-accent))',
                  border: trader.followed ? 'none' : '1px solid hsl(var(--swiss-accent))',
                }}>
                {trader.followed ? <><UserCheck size={12} /> 已关注</> : <><UserPlus size={12} /> 关注</>}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>总收益</span>
                <p className="text-sm font-bold" style={{ color: trader.totalReturn >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                  {trader.totalReturn >= 0 ? '+' : ''}{trader.totalReturn.toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>胜率</span>
                <p className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{trader.winRate.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>夏普比</span>
                <p className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{trader.sharpeRatio.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>最大回撤</span>
                <p className="text-sm font-bold" style={{ color: 'hsl(var(--price-down))' }}>{trader.maxDrawdown.toFixed(1)}%</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MiniChart data={trader.monthlyReturns} color={trader.totalReturn >= 0 ? '#10b981' : '#ef4444'} />
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>近12月收益曲线</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={10} style={{ color: 'hsl(var(--text-tertiary))' }} />
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{trader.followers.toLocaleString()} 粉丝</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Users size={48} className="mx-auto mb-3" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>暂无匹配的策略作者</p>
        </div>
      )}
    </div>
  );
}
