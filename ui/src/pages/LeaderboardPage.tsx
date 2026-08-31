import { useState, useMemo } from 'react';
import { Trophy, TrendingUp, Download, Star, Clock, Flame, Award, Medal, Zap, Activity, BarChart3, CircleDashed, GitBranch, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface LeaderboardItem {
  id: string;
  name: string;
  author: string;
  category: 'trend' | 'oscillator' | 'volume' | 'volatility' | 'custom';
  price: number;
  rating: number;
  reviewCount: number;
  downloadCount: number;
  weeklyDownloads: number;
  change: number;
  icon: React.ElementType;
  color: string;
}

// ── 常量 ──

const CATEGORIES = [
  { id: 'all', label: '全部', icon: Trophy },
  { id: 'trend', label: '趋势', icon: TrendingUp },
  { id: 'oscillator', label: '振荡', icon: Activity },
  { id: 'volume', label: '量能', icon: BarChart3 },
  { id: 'volatility', label: '波动率', icon: CircleDashed },
  { id: 'custom', label: '自定义', icon: Zap },
];

const CATEGORY_LABEL: Record<string, string> = {
  trend: '趋势', oscillator: '振荡', volume: '量能', volatility: '波动率', custom: '自定义',
};

const CATEGORY_COLORS: Record<string, string> = {
  trend: '#10b981', oscillator: '#f59e0b', volume: '#3b82f6', volatility: '#8b5cf6', custom: '#ef4444',
};

const TABS = [
  { id: 'downloads', label: '总下载榜', icon: Download },
  { id: 'rating', label: '评分榜', icon: Star },
  { id: 'new', label: '新品榜', icon: Flame },
  { id: 'trending', label: '趋势榜', icon: TrendingUp },
];

const MEDAL_COLORS: Record<number, string> = { 1: '#fbbf24', 2: '#94a3b8', 3: '#d97706' };

// ── Mock 数据 ──

const MOCK_LEADERBOARD: LeaderboardItem[] = [
  { id: 'm11', name: '自定义指标引擎', author: 'StockMate', category: 'custom', price: 0, rating: 4.9, reviewCount: 523, downloadCount: 28000, weeklyDownloads: 3200, change: 12.5, icon: Zap, color: '#c1272d' },
  { id: 'm5', name: 'MACD 金叉增强', author: 'QuantLab', category: 'oscillator', price: 0, rating: 4.7, reviewCount: 412, downloadCount: 21000, weeklyDownloads: 2800, change: 8.3, icon: Activity, color: '#ef4444' },
  { id: 'm3', name: '成交量异动 VVolume', author: 'DataFlow', category: 'volume', price: 0, rating: 4.5, reviewCount: 256, downloadCount: 15600, weeklyDownloads: 2100, change: -2.1, icon: BarChart3, color: '#3b82f6' },
  { id: 'm1', name: '超级趋势 SuperTrend', author: 'QuantLab', category: 'trend', price: 0, rating: 4.8, reviewCount: 342, downloadCount: 12800, weeklyDownloads: 1950, change: 15.2, icon: TrendingUp, color: '#10b981' },
  { id: 'm6', name: '双均线交叉增强版', author: 'TradeMaster', category: 'trend', price: 0, rating: 4.4, reviewCount: 178, downloadCount: 9800, weeklyDownloads: 1400, change: 5.7, icon: GitBranch, color: '#06b6d4' },
  { id: 'm2', name: 'RSI 背离探测器', author: 'SignalPro', category: 'oscillator', price: 9.9, rating: 4.6, reviewCount: 186, downloadCount: 8900, weeklyDownloads: 1650, change: 22.4, icon: Activity, color: '#f59e0b' },
  { id: 'm10', name: 'SAR 抛物线转向', author: 'QuantLab', category: 'trend', price: 0, rating: 4.3, reviewCount: 112, downloadCount: 7200, weeklyDownloads: 980, change: -1.3, icon: Zap, color: '#f97316' },
  { id: 'm7', name: 'KDJ 超买超卖', author: 'SignalPro', category: 'oscillator', price: 3.9, rating: 4.2, reviewCount: 134, downloadCount: 6700, weeklyDownloads: 1100, change: 9.8, icon: Gauge, color: '#ec4899' },
  { id: 'm4', name: '布林带挤压 Bollinger Squeeze', author: 'TechTrade', category: 'volatility', price: 4.9, rating: 4.3, reviewCount: 98, downloadCount: 5400, weeklyDownloads: 780, change: -4.5, icon: CircleDashed, color: '#8b5cf6' },
  { id: 'm8', name: 'ATR 波动率通道', author: 'DataFlow', category: 'volatility', price: 5.9, rating: 4.5, reviewCount: 89, downloadCount: 4200, weeklyDownloads: 920, change: 18.6, icon: CircleDashed, color: '#14b8a6' },
  { id: 'm9', name: 'OBV 量能趋势', author: 'TradeMaster', category: 'volume', price: 0, rating: 4.1, reviewCount: 67, downloadCount: 3800, weeklyDownloads: 540, change: -6.2, icon: BarChart3, color: '#a855f7' },
  { id: 'm12', name: 'WR 威廉指标', author: 'SignalPro', category: 'oscillator', price: 0, rating: 4.0, reviewCount: 56, downloadCount: 2900, weeklyDownloads: 420, change: 3.1, icon: Gauge, color: '#64748b' },
  { id: 'm13', name: 'Ichimoku 云图增强', author: 'TechTrade', category: 'trend', price: 6.9, rating: 4.4, reviewCount: 145, downloadCount: 6100, weeklyDownloads: 890, change: 11.3, icon: TrendingUp, color: '#0891b2' },
  { id: 'm14', name: 'VWAP 成交量加权均价', author: 'DataFlow', category: 'volume', price: 0, rating: 4.3, reviewCount: 198, downloadCount: 8200, weeklyDownloads: 1250, change: 7.8, icon: BarChart3, color: '#4f46e5' },
  { id: 'm15', name: 'Ichimoku 云图增强', author: 'QuantLab', category: 'volatility', price: 0, rating: 4.2, reviewCount: 78, downloadCount: 3500, weeklyDownloads: 610, change: -3.4, icon: CircleDashed, color: '#dc2626' },
];

// ── 辅助函数 ──

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function formatPrice(p: number): string {
  if (p === 0) return '免费';
  return '¥' + p.toFixed(1);
}

// ── 子组件 ──

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Medal size={18} style={{ color: MEDAL_COLORS[1] }} className="fill-current" />;
  if (rank === 2) return <Medal size={18} style={{ color: MEDAL_COLORS[2] }} className="fill-current" />;
  if (rank === 3) return <Medal size={18} style={{ color: MEDAL_COLORS[3] }} className="fill-current" />;
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>
      {rank}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  const isUp = change >= 0;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444' }}>
      <TrendingUp size={12} style={{ transform: isUp ? 'none' : 'rotate(180deg)' }} />
      {isUp ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

// ── 主组件 ──

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState('downloads');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredItems = useMemo(() => {
    let items = [...MOCK_LEADERBOARD];
    if (categoryFilter !== 'all') {
      items = items.filter(i => i.category === categoryFilter);
    }
    return items;
  }, [categoryFilter]);

  const sortedItems = useMemo(() => {
    const items = [...filteredItems];
    switch (activeTab) {
      case 'downloads':
        return items.sort((a, b) => b.downloadCount - a.downloadCount);
      case 'rating':
        return items.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      case 'new':
        return items.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
      case 'trending':
        return items.sort((a, b) => b.change - a.change);
      default:
        return items;
    }
  }, [filteredItems, activeTab]);

  const totalIndicators = MOCK_LEADERBOARD.length;
  const avgRating = MOCK_LEADERBOARD.reduce((s, i) => s + i.rating, 0) / totalIndicators;
  const totalDownloads = MOCK_LEADERBOARD.reduce((s, i) => s + i.downloadCount, 0);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'var(--text-primary)' }}>
      {/* Hero Section */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
            <Trophy size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>指标排行榜</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>发现最受欢迎的交易指标</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalIndicators}</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>指标总数</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
              <Star size={16} className="fill-amber-400 text-amber-400" />
              {avgRating.toFixed(1)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>平均评分</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatNumber(totalDownloads)}</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>总下载</span>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const isActive = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: isActive ? 'hsl(var(--swiss-accent))' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'hsl(var(--swiss-accent))' : 'var(--border-subtle)'}`,
              }}
            >
              <CatIcon size={12} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium flex-1 justify-center transition-all"
              style={{
                background: isActive ? 'var(--bg-primary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Leaderboard List */}
      <div className="flex flex-col gap-2">
        {sortedItems.map((item, idx) => {
          const rank = idx + 1;
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                border: rank <= 3 ? `1px solid ${MEDAL_COLORS[rank]}30` : undefined,
                background: rank <= 3 ? `${MEDAL_COLORS[rank]}08` : undefined,
              }}
            >
              {/* Rank */}
              <div className="w-8 flex-shrink-0 flex justify-center">
                <MedalIcon rank={rank} />
              </div>

              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${item.color}18` }}
              >
                <Icon size={18} style={{ color: item.color }} />
              </div>

              {/* Name + Author */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {item.name}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {item.author}
                </div>
              </div>

              {/* Category Badge */}
              <div
                className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 hidden sm:block"
                style={{
                  background: `${CATEGORY_COLORS[item.category]}15`,
                  color: CATEGORY_COLORS[item.category],
                }}
              >
                {CATEGORY_LABEL[item.category]}
              </div>

              {/* Price */}
              <div
                className="text-xs font-semibold flex-shrink-0 w-12 text-right"
                style={{ color: item.price === 0 ? '#10b981' : 'var(--text-primary)' }}
              >
                {formatPrice(item.price)}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1 flex-shrink-0 w-16 justify-center">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {item.rating.toFixed(1)}
                </span>
              </div>

              {/* Downloads */}
              <div className="flex items-center gap-1 flex-shrink-0 w-16 justify-center">
                <Download size={12} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {formatNumber(item.downloadCount)}
                </span>
              </div>

              {/* Change */}
              <div className="flex-shrink-0 w-16 text-right">
                <ChangeIndicator change={item.change} />
              </div>
            </motion.div>
          );
        })}

        {sortedItems.length === 0 && (
          <div className="glass-card rounded-xl p-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
            <Award size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">暂无数据</p>
          </div>
        )}
      </div>
    </div>
  );
}
