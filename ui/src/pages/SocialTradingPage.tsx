import { useState, useMemo } from 'react';
import { Radio, TrendingUp, TrendingDown, Users, Eye, Heart, MessageCircle, Share2, Flame, Clock, Target, Zap, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 类型 ──

interface LiveStrategy {
  id: string;
  author: string;
  avatar: string;
  title: string;
  description: string;
  pnl30d: number;
  winRate: number;
  sharpe: number;
  followers: number;
  maxDrawdown: number;
  isLive: boolean;
  tags: string[];
  recentTrades: { action: 'buy' | 'sell'; stock: string; time: string; pnl: number }[];
}

// ── 常量 ──

const MOCK_STRATEGIES: LiveStrategy[] = [
  {
    id: '1', author: '量化老王', avatar: '👨‍💻', title: '多因子轮动策略', description: '基于动量+价值的月度轮动，跑赢沪深300超15%',
    pnl30d: 8.5, winRate: 62, sharpe: 1.85, followers: 2350, maxDrawdown: -8.2, isLive: true,
    tags: ['多因子', '轮动', '中频'],
    recentTrades: [
      { action: 'buy', stock: '贵州茅台', time: '10:30', pnl: 2.3 },
      { action: 'sell', stock: '宁德时代', time: '09:45', pnl: 5.1 },
      { action: 'buy', stock: '比亚迪', time: '09:30', pnl: 1.8 },
    ],
  },
  {
    id: '2', author: '趋势猎手', avatar: '🎯', title: '突破追涨策略', description: '布林带+成交量突破，专注强势股短期交易',
    pnl30d: 12.3, winRate: 45, sharpe: 1.22, followers: 1820, maxDrawdown: -15.5, isLive: true,
    tags: ['趋势', '突破', '短线'],
    recentTrades: [
      { action: 'buy', stock: '中芯国际', time: '11:00', pnl: 8.5 },
      { action: 'sell', stock: '东方财富', time: '10:15', pnl: -3.2 },
    ],
  },
  {
    id: '3', author: '稳健理财', avatar: '🛡️', title: '低波动红利策略', description: '高股息+低波动，追求稳定现金流',
    pnl30d: 3.2, winRate: 75, sharpe: 2.15, followers: 3100, maxDrawdown: -4.5, isLive: false,
    tags: ['红利', '低波', '长期'],
    recentTrades: [
      { action: 'buy', stock: '招商银行', time: '09:30', pnl: 1.2 },
      { action: 'buy', stock: '中国平安', time: '09:30', pnl: 0.8 },
    ],
  },
  {
    id: '4', author: '技术派小李', avatar: '📊', title: 'MACD金叉死叉', description: '经典技术指标组合，日线级别交易',
    pnl30d: -2.1, winRate: 52, sharpe: 0.65, followers: 890, maxDrawdown: -12.8, isLive: true,
    tags: ['技术面', 'MACD', '日线'],
    recentTrades: [
      { action: 'sell', stock: '贵州茅台', time: '14:30', pnl: -1.5 },
      { action: 'buy', stock: '五粮液', time: '10:00', pnl: 2.1 },
    ],
  },
  {
    id: '5', author: '资金流达人', avatar: '💰', title: '北向资金跟踪', description: '跟踪北向资金流向，跟随外资布局',
    pnl30d: 5.8, winRate: 58, sharpe: 1.42, followers: 1560, maxDrawdown: -7.2, isLive: true,
    tags: ['资金流', '北向', '中频'],
    recentTrades: [
      { action: 'buy', stock: '宁德时代', time: '13:00', pnl: 3.5 },
      { action: 'buy', stock: '比亚迪', time: '11:30', pnl: 2.8 },
    ],
  },
];

// ── 主页面 ──

export default function SocialTradingPage() {
  const [strategies] = useState(MOCK_STRATEGIES);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'pnl' | 'followers' | 'sharpe'>('pnl');
  const [expanded, setExpanded] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    strategies.forEach(s => s.tags.forEach(t => tags.add(t)));
    return [...tags];
  }, [strategies]);

  const filtered = useMemo(() => {
    return strategies
      .filter(s => !filterTag || s.tags.includes(filterTag))
      .sort((a, b) => {
        if (sortBy === 'pnl') return b.pnl30d - a.pnl30d;
        if (sortBy === 'followers') return b.followers - a.followers;
        return b.sharpe - a.sharpe;
      });
  }, [strategies, filterTag, sortBy]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Radio size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>策略直播</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>实时跟单排行 · 策略作者竞技场</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10b981' }} />
            <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>
              {strategies.filter(s => s.isLive).length} 个策略直播中
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>标签:</span>
        <button onClick={() => setFilterTag(null)}
          className="px-2.5 py-0.5 rounded-lg text-[10px] font-medium"
          style={{ background: !filterTag ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: !filterTag ? 'white' : 'hsl(var(--text-tertiary))' }}>
          全部
        </button>
        {allTags.slice(0, 8).map(tag => (
          <button key={tag} onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            className="px-2.5 py-0.5 rounded-lg text-[10px] font-medium"
            style={{ background: filterTag === tag ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: filterTag === tag ? 'white' : 'hsl(var(--text-tertiary))' }}>
            {tag}
          </button>
        ))}
        <span className="text-[10px] ml-2" style={{ color: 'hsl(var(--text-tertiary))' }}>排序:</span>
        {([['pnl', '收益'], ['followers', '粉丝'], ['sharpe', '夏普']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)}
            className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: sortBy === key ? 'hsl(var(--swiss-accent) / 0.15)' : 'transparent', color: sortBy === key ? 'hsl(var(--swiss-accent))' : 'hsl(var(--text-tertiary))' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Strategy Cards */}
      <div className="space-y-3">
        {filtered.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.avatar}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{s.author}</span>
                    {s.isLive && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>{s.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{s.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: s.pnl30d >= 0 ? '#10b981' : '#ef4444' }}>
                  {s.pnl30d >= 0 ? '+' : ''}{s.pnl30d.toFixed(1)}%
                </p>
                <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>30日收益</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1.5 mb-3">
              {s.tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[9px]"
                  style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: '胜率', value: `${s.winRate}%`, color: s.winRate >= 60 ? '#10b981' : '#f59e0b' },
                { label: '夏普', value: s.sharpe.toFixed(2), color: s.sharpe >= 1.5 ? '#10b981' : '#3b82f6' },
                { label: '最大回撤', value: `${s.maxDrawdown}%`, color: '#ef4444' },
                { label: '粉丝', value: s.followers.toLocaleString(), color: '#8b5cf6' },
              ].map(m => (
                <div key={m.label} className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
                  <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{m.label}</span>
                  <p className="text-xs font-bold mt-0.5" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Recent Trades */}
            <button onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              className="flex items-center gap-1 text-[10px] font-medium"
              style={{ color: 'hsl(var(--text-tertiary))' }}>
              <Clock size={10} /> 最近交易 ({s.recentTrades.length})
              <ChevronDown size={10} style={{ transform: expanded === s.id ? 'rotate(180deg)' : '' }} />
            </button>
            <AnimatePresence>
              {expanded === s.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-2 space-y-1">
                    {s.recentTrades.map((t, j) => (
                      <div key={j} className="flex items-center gap-2 text-[10px] py-1">
                        <span className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white`}
                          style={{ background: t.action === 'buy' ? '#10b981' : '#ef4444' }}>
                          {t.action === 'buy' ? 'B' : 'S'}
                        </span>
                        <span className="flex-1" style={{ color: 'hsl(var(--text-secondary))' }}>{t.stock}</span>
                        <span style={{ color: 'hsl(var(--text-tertiary))' }}>{t.time}</span>
                        <span className="font-bold" style={{ color: t.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                          {t.pnl >= 0 ? '+' : ''}{t.pnl}%
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
