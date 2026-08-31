import { useState, useMemo } from 'react';
import { User, Star, TrendingUp, Users, Award, Calendar, ExternalLink, MessageCircle, Heart, Share2, BarChart3, Target } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface Creator {
  id: string;
  name: string;
  avatar: string;
  title: string;
  followers: number;
  following: number;
  indicators: number;
  totalDownloads: number;
  avgRating: number;
  joinDate: string;
  bio: string;
  badges: string[];
  topIndicators: { name: string; downloads: number; rating: number }[];
  performance: { month: string; return: number }[];
}

// ── 常量 ──

const MOCK_CREATORS: Creator[] = [
  {
    id: '1', name: '量化老王', avatar: '👨‍💻', title: '职业量化交易员',
    followers: 2350, following: 45, indicators: 12, totalDownloads: 18500, avgRating: 4.8,
    joinDate: '2025-06', bio: '10年A股量化经验，专注多因子和CTA策略',
    badges: ['金牌创作者', '月度之星', 'Top10'],
    topIndicators: [
      { name: '多因子轮动V3', downloads: 5200, rating: 4.9 },
      { name: '布林突破Pro', downloads: 3800, rating: 4.7 },
      { name: '量价背离检测', downloads: 2100, rating: 4.8 },
    ],
    performance: [
      { month: '4月', return: 5.2 }, { month: '5月', return: 3.8 }, { month: '6月', return: 7.5 },
      { month: '7月', return: -1.2 }, { month: '8月', return: 6.8 }, { month: '9月', return: 4.5 },
    ],
  },
  {
    id: '2', name: '趋势猎手', avatar: '🎯', title: '技术分析专家',
    followers: 1820, following: 32, indicators: 8, totalDownloads: 12300, avgRating: 4.6,
    joinDate: '2025-08', bio: '15年交易经验，专注趋势跟踪和波段操作',
    badges: ['银牌创作者', '连续3月Top'],
    topIndicators: [
      { name: '趋势突破系统', downloads: 4500, rating: 4.8 },
      { name: '波段买点雷达', downloads: 3200, rating: 4.5 },
    ],
    performance: [
      { month: '4月', return: 8.5 }, { month: '5月', return: -2.3 }, { month: '6月', return: 12.1 },
      { month: '7月', return: 3.2 }, { month: '8月', return: -5.1 }, { month: '9月', return: 9.8 },
    ],
  },
  {
    id: '3', name: '稳健理财', avatar: '🛡️', title: '资产配置顾问',
    followers: 3100, following: 28, indicators: 6, totalDownloads: 22100, avgRating: 4.9,
    joinDate: '2025-03', bio: 'CFA持证人，专注低波动高股息策略',
    badges: ['金牌创作者', '年度最佳', 'Top10'],
    topIndicators: [
      { name: '红利低波组合', downloads: 8900, rating: 4.9 },
      { name: '债券择时模型', downloads: 4200, rating: 4.8 },
    ],
    performance: [
      { month: '4月', return: 2.1 }, { month: '5月', return: 1.8 }, { month: '6月', return: 2.5 },
      { month: '7月', return: 1.2 }, { month: '8月', return: 2.8 }, { month: '9月', return: 1.5 },
    ],
  },
];

// ── 组件 ──

function MiniChart({ data }: { data: { month: string; return: number }[] }) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.return)), 1);
  const w = 120;
  const h = 30;
  const barW = w / data.length - 2;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {data.map((d, i) => {
        const barH = (Math.abs(d.return) / maxAbs) * (h / 2 - 2);
        const y = d.return >= 0 ? h / 2 - barH : h / 2;
        return (
          <g key={i}>
            <rect x={i * (barW + 2)} y={y} width={barW} height={barH} rx={1}
              fill={d.return >= 0 ? '#10b981' : '#ef4444'} opacity={0.7} />
            <text x={i * (barW + 2) + barW / 2} y={h - 2} textAnchor="middle"
              fill="hsl(var(--text-tertiary))" fontSize="6">{d.month}</text>
          </g>
        );
      })}
      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="hsl(var(--text-tertiary))" strokeWidth="0.5" strokeDasharray="2,2" />
    </svg>
  );
}

// ── 主页面 ──

export default function CreatorPage() {
  const [creators] = useState(MOCK_CREATORS);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [sortBy, setSortBy] = useState<'followers' | 'downloads' | 'rating'>('followers');

  const sorted = useMemo(() => {
    return [...creators].sort((a, b) => {
      if (sortBy === 'followers') return b.followers - a.followers;
      if (sortBy === 'downloads') return b.totalDownloads - a.totalDownloads;
      return b.avgRating - a.avgRating;
    });
  }, [creators, sortBy]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <User size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>创作者主页</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>指标创作者排行榜 · 粉丝关注</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {([['followers', '粉丝'], ['downloads', '下载'], ['rating', '评分']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSortBy(key)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                style={{ background: sortBy === key ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: sortBy === key ? 'white' : 'hsl(var(--text-tertiary))' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Creator List */}
      <div className="space-y-3">
        {sorted.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-start gap-4">
              <div className="text-3xl">{c.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{c.name}</span>
                  <div className="flex items-center gap-1">
                    {c.badges.map(b => (
                      <span key={b} className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                        style={{ background: 'hsl(var(--swiss-accent) / 0.15)', color: 'hsl(var(--swiss-accent))' }}>
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>{c.title}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{c.bio}</p>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-2">
                  {[
                    { label: '粉丝', value: c.followers.toLocaleString(), icon: Users, color: '#8b5cf6' },
                    { label: '指标', value: c.indicators, icon: Award, color: '#f59e0b' },
                    { label: '下载', value: c.totalDownloads.toLocaleString(), icon: TrendingUp, color: '#10b981' },
                    { label: '评分', value: c.avgRating.toFixed(1), icon: Star, color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1">
                      <s.icon size={10} style={{ color: s.color }} />
                      <span className="text-[10px] font-bold" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Chart */}
              <div className="shrink-0">
                <MiniChart data={c.performance} />
              </div>
            </div>

            {/* Top Indicators */}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid hsl(var(--border-default))' }}>
              <span className="text-[10px] font-semibold" style={{ color: 'hsl(var(--text-tertiary))' }}>热门指标</span>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {c.topIndicators.map(ind => (
                  <div key={ind.name} className="p-2 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
                    <p className="text-[10px] font-semibold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{ind.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                        {ind.downloads.toLocaleString()} 下载
                      </span>
                      <span className="text-[9px] font-bold" style={{ color: '#f59e0b' }}>
                        ★ {ind.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
