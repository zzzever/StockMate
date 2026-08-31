import { useState, useMemo, useCallback } from 'react';
import { Search, Star, Download, TrendingUp, Activity, Gauge, CircleDashed, GitBranch, Zap, BarChart3, Filter, ArrowUpDown, User, Clock, Plus, X, Check, MessageSquare, Eye, Calendar, ChevronRight, AlertCircle, Send, Trash2, Edit3, CheckCircle, XCircle, Pause, CreditCard, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── localStorage Keys ──
const LS_PUBLISHED = 'stockmate_marketplace_published';
const LS_REVIEWS = 'stockmate_marketplace_reviews';
const LS_TRIALS = 'stockmate_marketplace_trials';
const LS_SUBSCRIPTIONS = 'stockmate_marketplace_subscriptions';

// ── 类型 ──

interface MarketplaceIndicator {
  id: string;
  name: string;
  description: string;
  author: string;
  category: 'trend' | 'oscillator' | 'volume' | 'volatility' | 'custom';
  complexity: 'basic' | 'intermediate' | 'advanced';
  tags: string[];
  price: number;
  rating: number;
  reviewCount: number;
  downloadCount: number;
  version: string;
  updatedAt: string;
  icon: React.ElementType;
  color: string;
  featured?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  code?: string;
}

interface Review {
  id: string;
  indicatorId: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

interface TrialRecord {
  indicatorId: string;
  startDate: string;
  endDate: string;
}

interface SubscriptionRecord {
  indicatorId: string;
  startDate: string;
  plan: 'monthly' | 'yearly';
}

// ── Mock 数据 ──

const MOCK_INDICATORS: MarketplaceIndicator[] = [
  { id: 'm1', name: '超级趋势 SuperTrend', description: '基于 ATR 的趋势跟踪指标，自动识别多空方向，适合中短线交易', author: 'QuantLab', category: 'trend', complexity: 'basic', tags: ['趋势跟踪'], price: 0, rating: 4.8, reviewCount: 342, downloadCount: 12800, version: '2.1.0', updatedAt: '2026-08-20', icon: TrendingUp, color: '#10b981', featured: true },
  { id: 'm2', name: 'RSI 背离探测器', description: '自动检测 RSI 与价格的背离信号，提前发现趋势反转', author: 'SignalPro', category: 'oscillator', complexity: 'intermediate', tags: ['反转', '背离'], price: 9.9, rating: 4.6, reviewCount: 186, downloadCount: 8900, version: '1.3.2', updatedAt: '2026-08-18', icon: Activity, color: '#f59e0b', featured: true },
  { id: 'm3', name: '成交量异动 VVolume', description: '检测异常成交量，结合价格变化识别主力资金动向', author: 'DataFlow', category: 'volume', complexity: 'basic', tags: ['量价分析'], price: 0, rating: 4.5, reviewCount: 256, downloadCount: 15600, version: '3.0.1', updatedAt: '2026-08-22', icon: BarChart3, color: '#3b82f6' },
  { id: 'm4', name: '布林带挤压 Bollinger Squeeze', description: '识别布林带收窄后的突破机会，结合 Keltner Channel 使用', author: 'TechTrade', category: 'volatility', complexity: 'intermediate', tags: ['波动率', '突破'], price: 4.9, rating: 4.3, reviewCount: 98, downloadCount: 5400, version: '1.1.0', updatedAt: '2026-08-15', icon: CircleDashed, color: '#8b5cf6' },
  { id: 'm5', name: 'MACD 金叉增强', description: '改进版 MACD，加入成交量过滤和趋势确认，减少假信号', author: 'QuantLab', category: 'oscillator', complexity: 'basic', tags: ['动量', 'MACD'], price: 0, rating: 4.7, reviewCount: 412, downloadCount: 21000, version: '2.0.0', updatedAt: '2026-08-25', icon: Activity, color: '#ef4444' },
  { id: 'm6', name: '双均线交叉增强版', description: 'MA5/MA10 金叉死叉策略，加入趋势过滤和动态止损', author: 'TradeMaster', category: 'trend', complexity: 'basic', tags: ['均线', '趋势跟踪'], price: 0, rating: 4.4, reviewCount: 178, downloadCount: 9800, version: '1.5.0', updatedAt: '2026-08-21', icon: GitBranch, color: '#06b6d4' },
  { id: 'm7', name: 'KDJ 超买超卖', description: '经典 KDJ 指标优化版，减少钝化现象，提高信号准确率', author: 'SignalPro', category: 'oscillator', complexity: 'intermediate', tags: ['KDJ', '超买超卖'], price: 3.9, rating: 4.2, reviewCount: 134, downloadCount: 6700, version: '1.2.1', updatedAt: '2026-08-19', icon: Gauge, color: '#ec4899' },
  { id: 'm8', name: 'ATR 波动率通道', description: '基于 ATR 的动态支撑阻力通道，自动适应市场波动', author: 'DataFlow', category: 'volatility', complexity: 'intermediate', tags: ['波动率', '通道'], price: 5.9, rating: 4.5, reviewCount: 89, downloadCount: 4200, version: '1.0.3', updatedAt: '2026-08-17', icon: CircleDashed, color: '#14b8a6' },
  { id: 'm9', name: 'OBV 量能趋势', description: 'OBV 指标增强版，加入移动平均线和趋势确认', author: 'TradeMaster', category: 'volume', complexity: 'basic', tags: ['量能', 'OBV'], price: 0, rating: 4.1, reviewCount: 67, downloadCount: 3800, version: '1.1.0', updatedAt: '2026-08-14', icon: BarChart3, color: '#a855f7' },
  { id: 'm10', name: 'SAR 抛物线转向', description: 'Parabolic SAR 指标优化版，减少震荡市中的假信号', author: 'QuantLab', category: 'trend', complexity: 'basic', tags: ['SAR', '趋势跟踪'], price: 0, rating: 4.3, reviewCount: 112, downloadCount: 7200, version: '1.3.0', updatedAt: '2026-08-23', icon: Zap, color: '#f97316' },
  { id: 'm11', name: '自定义指标引擎', description: '使用 SSLang 语言编写自定义指标，支持完整编程能力', author: 'StockMate', category: 'custom', complexity: 'advanced', tags: ['自定义', 'SSLang'], price: 0, rating: 4.9, reviewCount: 523, downloadCount: 28000, version: '4.0.0', updatedAt: '2026-08-28', icon: Zap, color: '#c1272d', featured: true },
  { id: 'm12', name: 'WR 威廉指标', description: 'Williams %R 指标，识别超买超卖区域，适合短线交易', author: 'SignalPro', category: 'oscillator', complexity: 'basic', tags: ['WR', '超买超卖'], price: 0, rating: 4.0, reviewCount: 56, downloadCount: 2900, version: '1.0.0', updatedAt: '2026-08-12', icon: Gauge, color: '#64748b' },
];

const MOCK_REVIEWS: Review[] = [
  { id: 'r1', indicatorId: 'm1', author: '交易员A', rating: 5, comment: '非常实用的趋势指标，信号准确率很高！', date: '2026-08-25' },
  { id: 'r2', indicatorId: 'm1', author: '量化小白', rating: 4, comment: '入门友好，但偶尔有假信号', date: '2026-08-20' },
  { id: 'r3', indicatorId: 'm2', author: '技术派', rating: 5, comment: '背离检测很灵敏，帮我避开了好几次大跌', date: '2026-08-22' },
  { id: 'r4', indicatorId: 'm5', author: '老股民', rating: 4, comment: 'MACD增强版确实比原版好用', date: '2026-08-18' },
  { id: 'r5', indicatorId: 'm11', author: '开发者', rating: 5, comment: 'SSLang语言设计得很好，自定义指标很方便', date: '2026-08-27' },
];

const CATEGORIES = [
  { id: 'all', label: '全部', icon: Filter },
  { id: 'trend', label: '趋势', icon: TrendingUp },
  { id: 'oscillator', label: '振荡', icon: Activity },
  { id: 'volume', label: '量能', icon: BarChart3 },
  { id: 'volatility', label: '波动率', icon: CircleDashed },
  { id: 'custom', label: '自定义', icon: Zap },
];

const COMPLEXITY_LABEL: Record<string, { label: string; color: string }> = {
  basic: { label: '入门', color: '#10b981' },
  intermediate: { label: '进阶', color: '#f59e0b' },
  advanced: { label: '高级', color: '#ef4444' },
};

const CATEGORY_LABEL: Record<string, string> = {
  trend: '趋势', oscillator: '振荡', volume: '量能', volatility: '波动率', custom: '自定义',
};

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Activity, Gauge, CircleDashed, GitBranch, Zap, BarChart3,
};

const COLOR_OPTIONS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#f97316', '#a855f7', '#14b8a6'];

// ── localStorage helpers ──

function loadJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}
function saveJSON(key: string, data: unknown) { localStorage.setItem(key, JSON.stringify(data)); }

// ── 子组件 ──

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} className={i < Math.floor(rating) ? 'fill-amber-400 text-amber-400' : i < rating ? 'fill-amber-400/50 text-amber-400/50' : 'text-gray-300 dark:text-gray-600'} />
      ))}
      <span className="text-[11px] font-mono ml-1" style={{ color: 'var(--text-secondary)' }}>{rating.toFixed(1)}</span>
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex items-center gap-0.5 cursor-pointer">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={18}
          className={(hover || value) > i ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}
          onMouseEnter={() => setHover(i + 1)} onMouseLeave={() => setHover(0)} onClick={() => onChange(i + 1)} />
      ))}
    </span>
  );
}

// ── 4.1 发布表单 Modal ──

function PublishModal({ onClose, onPublish }: { onClose: () => void; onPublish: (ind: Omit<MarketplaceIndicator, 'id' | 'rating' | 'reviewCount' | 'downloadCount' | 'updatedAt' | 'icon' | 'featured' | 'status'>) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<MarketplaceIndicator['category']>('trend');
  const [complexity, setComplexity] = useState<MarketplaceIndicator['complexity']>('basic');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState(0);
  const [version, setVersion] = useState('1.0.0');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('#10b981');

  const handleSubmit = () => {
    if (!name.trim() || !description.trim() || !author.trim()) return;
    onPublish({ name, description, author, category, complexity, tags: tags.split(/[,，]/).map(t => t.trim()).filter(Boolean), price, version, code, color });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>发布指标</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>指标名称 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：超级趋势 SuperTrend"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>描述 *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="描述指标的功能和用途..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>作者 *</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="你的名称"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>版本</label>
              <input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>分类</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>难度</label>
              <select value={complexity} onChange={e => setComplexity(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                <option value="basic">入门</option>
                <option value="intermediate">进阶</option>
                <option value="advanced">高级</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>标签（逗号分隔）</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="例如：趋势, 跟踪, ATR"
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>价格（0 = 免费）</label>
            <input type="number" min={0} step={0.1} value={price} onChange={e => setPrice(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>图标颜色</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: color === c ? 'white' : 'transparent' }} />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>指标代码（SSLang / TDX）</label>
            <textarea value={code} onChange={e => setCode(e.target.value)} rows={4} placeholder="在这里粘贴你的指标代码..."
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none font-mono text-xs focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || !description.trim() || !author.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-40"
            style={{ background: 'hsl(var(--swiss-accent))' }}>提交审核</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── 4.1 审核管理 Panel ──

function ReviewQueue({ published, onApprove, onReject }: { published: MarketplaceIndicator[]; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const pending = published.filter(i => i.status === 'pending');
  const approved = published.filter(i => i.status === 'approved');
  const rejected = published.filter(i => i.status === 'rejected');

  if (published.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <CheckCircle size={16} className="text-cyan-400" /> 上架管理
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">{pending.length} 待审</span>
      </h3>

      {pending.length > 0 && (
        <div className="space-y-2 mb-3">
          {pending.map(ind => (
            <div key={ind.id} className="flex items-center gap-3 p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${ind.color}15` }}>
                <ind.icon size={16} style={{ color: ind.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{ind.name}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{ind.author} · {ind.price === 0 ? '免费' : `¥${ind.price}`}</div>
              </div>
              <button onClick={() => onApprove(ind.id)} className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"><Check size={14} /></button>
              <button onClick={() => onReject(ind.id)} className="p-1.5 rounded-lg bg-red-500/15 text-red-500 hover:bg-red-500/25"><XCircle size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {approved.length > 0 && (
        <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>已上架 {approved.length} 个指标</div>
      )}
      {rejected.length > 0 && (
        <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>已拒绝 {rejected.length} 个指标</div>
      )}
    </div>
  );
}

// ── 4.3 试用 / 4.4 订阅 ──

function TrialSubBadge({ indicator, trials, subscriptions, onStartTrial, onSubscribe }: {
  indicator: MarketplaceIndicator; trials: TrialRecord[]; subscriptions: SubscriptionRecord[];
  onStartTrial: (id: string) => void; onSubscribe: (id: string, plan: 'monthly' | 'yearly') => void;
}) {
  if (indicator.price === 0) return <span className="text-xs font-bold text-emerald-500">免费</span>;

  const trial = trials.find(t => t.indicatorId === indicator.id);
  const sub = subscriptions.find(s => s.indicatorId === indicator.id);
  const now = new Date();
  const isTrialActive = trial && new Date(trial.endDate) > now;
  const isSubActive = !!sub;

  if (isSubActive) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-400 font-bold">
        <Crown size={10} />已订阅
      </span>
    );
  }

  if (isTrialActive) {
    const daysLeft = Math.ceil((new Date(trial!.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">
        <Clock size={10} />试用中 ({daysLeft}天)
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>¥{indicator.price}</span>
      <div className="flex gap-1 ml-1">
        <button onClick={() => onStartTrial(indicator.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold">试用7天</button>
        <button onClick={() => onSubscribe(indicator.id, 'monthly')} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 font-bold">订阅</button>
      </div>
    </div>
  );
}

// ── 4.6 评价列表 ──

function ReviewList({ reviews, indicatorId }: { reviews: Review[]; indicatorId: string }) {
  const indicatorReviews = reviews.filter(r => r.indicatorId === indicatorId);
  if (indicatorReviews.length === 0) return <div className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>暂无评价</div>;

  return (
    <div className="space-y-2">
      {indicatorReviews.map(r => (
        <div key={r.id} className="p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.author}</span>
              <StarRating rating={r.rating} size={10} />
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{r.date}</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.comment}</p>
        </div>
      ))}
    </div>
  );
}

// ── 4.6 发表评价 ──

function ReviewForm({ indicatorId, onSubmit }: { indicatorId: string; onSubmit: (review: Omit<Review, 'id' | 'date'>) => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('');

  const handleSubmit = () => {
    if (rating === 0 || !comment.trim() || !author.trim()) return;
    onSubmit({ indicatorId, author, rating, comment });
    setRating(0); setComment(''); setAuthor('');
  };

  return (
    <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>发表评价</div>
      <div className="flex items-center gap-3 mb-2">
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="你的昵称"
          className="flex-1 px-2 py-1 rounded border text-xs outline-none"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
        <StarInput value={rating} onChange={setRating} />
      </div>
      <div className="flex gap-2">
        <input value={comment} onChange={e => setComment(e.target.value)} placeholder="分享你的使用体验..."
          className="flex-1 px-2 py-1 rounded border text-xs outline-none"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <button onClick={handleSubmit} disabled={rating === 0 || !comment.trim() || !author.trim()}
          className="px-3 py-1 rounded text-xs font-bold text-white disabled:opacity-40"
          style={{ background: 'hsl(var(--swiss-accent))' }}><Send size={12} /></button>
      </div>
    </div>
  );
}

// ── 4.5 创作者中心 ──

function CreatorDashboard({ published, reviews }: { published: MarketplaceIndicator[]; reviews: Review[] }) {
  const myIndicators = published.filter(i => i.author === '我');
  const totalDownloads = myIndicators.reduce((s, i) => s + i.downloadCount, 0);
  const avgRating = myIndicators.length > 0 ? myIndicators.reduce((s, i) => s + i.rating, 0) / myIndicators.length : 0;
  const myReviews = reviews.filter(r => myIndicators.some(i => i.id === r.indicatorId));

  if (myIndicators.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Edit3 size={16} className="text-violet-400" /> 创作者中心
      </h3>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{myIndicators.length}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>我的指标</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-lg font-bold text-cyan-400">{totalDownloads > 1000 ? `${(totalDownloads / 1000).toFixed(1)}k` : totalDownloads}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>总下载</div>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-lg font-bold text-amber-400">{avgRating.toFixed(1)}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>平均评分</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {myIndicators.map(ind => (
          <div key={ind.id} className="flex items-center gap-2 p-1.5 rounded" style={{ background: 'var(--bg-secondary)' }}>
            <ind.icon size={14} style={{ color: ind.color }} />
            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{ind.name}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
              ind.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' :
              ind.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
              'bg-red-500/15 text-red-400'
            }`}>{ind.status === 'approved' ? '已上架' : ind.status === 'pending' ? '审核中' : '已拒绝'}</span>
          </div>
        ))}
      </div>

      {myReviews.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="text-[11px] mb-2" style={{ color: 'var(--text-tertiary)' }}>最近收到 {myReviews.length} 条评价</div>
        </div>
      )}
    </div>
  );
}

// ── IndicatorCard ──

function IndicatorCard({ indicator, trials, subscriptions, reviews, onStartTrial, onSubscribe, onOpenDetail }: {
  indicator: MarketplaceIndicator; trials: TrialRecord[]; subscriptions: SubscriptionRecord[];
  reviews: Review[]; onStartTrial: (id: string) => void; onSubscribe: (id: string, plan: 'monthly' | 'yearly') => void;
  onOpenDetail: (ind: MarketplaceIndicator) => void;
}) {
  const Icon = indicator.icon;
  const complexity = COMPLEXITY_LABEL[indicator.complexity];
  const cardReviews = reviews.filter(r => r.indicatorId === indicator.id);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="glass-card p-4 hover:border-white/20 transition-all duration-200 cursor-pointer group" whileHover={{ scale: 1.01 }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${indicator.color}15` }}>
          <Icon size={20} style={{ color: indicator.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{indicator.name}</h3>
            {indicator.featured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-bold flex-shrink-0">精选</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{indicator.author}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${complexity.color}15`, color: complexity.color }}>{complexity.label}</span>
          </div>
        </div>
        <TrialSubBadge indicator={indicator} trials={trials} subscriptions={subscriptions} onStartTrial={onStartTrial} onSubscribe={onSubscribe} />
      </div>

      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{indicator.description}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{CATEGORY_LABEL[indicator.category]}</span>
        {indicator.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <StarRating rating={indicator.rating} />
        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          <span className="flex items-center gap-1"><MessageSquare size={11} />{cardReviews.length}</span>
          <span className="flex items-center gap-1"><Download size={11} />{indicator.downloadCount > 1000 ? `${(indicator.downloadCount / 1000).toFixed(1)}k` : indicator.downloadCount}</span>
          <button onClick={(e) => { e.stopPropagation(); onOpenDetail(indicator); }} className="flex items-center gap-1 hover:text-[hsl(var(--swiss-accent))]"><Eye size={11} />详情</button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Detail Modal ──

function DetailModal({ indicator, reviews, trials, subscriptions, onClose, onStartTrial, onSubscribe, onAddReview }: {
  indicator: MarketplaceIndicator; reviews: Review[]; trials: TrialRecord[]; subscriptions: SubscriptionRecord[];
  onClose: () => void; onStartTrial: (id: string) => void; onSubscribe: (id: string, plan: 'monthly' | 'yearly') => void;
  onAddReview: (review: Omit<Review, 'id' | 'date'>) => void;
}) {
  const Icon = indicator.icon;
  const complexity = COMPLEXITY_LABEL[indicator.complexity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${indicator.color}15` }}>
              <Icon size={24} style={{ color: indicator.color }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{indicator.name}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{indicator.author} · v{indicator.version}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${complexity.color}15`, color: complexity.color }}>{complexity.label}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={18} /></button>
        </div>

        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{indicator.description}</p>

        <div className="flex flex-wrap gap-1 mb-4">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{CATEGORY_LABEL[indicator.category]}</span>
          {indicator.tags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>{tag}</span>
          ))}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <StarRating rating={indicator.rating} size={14} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{indicator.reviewCount} 评价</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}><Download size={11} className="inline" /> {indicator.downloadCount > 1000 ? `${(indicator.downloadCount / 1000).toFixed(1)}k` : indicator.downloadCount}</span>
        </div>

        <div className="mb-4">
          <TrialSubBadge indicator={indicator} trials={trials} subscriptions={subscriptions} onStartTrial={onStartTrial} onSubscribe={onSubscribe} />
        </div>

        {indicator.price > 0 && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>订阅方案</div>
            <div className="flex gap-3">
              <div className="flex-1 p-2 rounded-lg border text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>月付 ¥{indicator.price}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>随时取消</div>
              </div>
              <div className="flex-1 p-2 rounded-lg border text-center relative" style={{ borderColor: 'hsl(var(--swiss-accent))' }}>
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--swiss-accent))] text-white font-bold">推荐</span>
                <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>年付 ¥{(indicator.price * 10).toFixed(0)}</div>
                <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>省2个月</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h4 className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>用户评价</h4>
          <ReviewList reviews={reviews} indicatorId={indicator.id} />
        </div>

        <ReviewForm indicatorId={indicator.id} onSubmit={onAddReview} />
      </motion.div>
    </div>
  );
}

// ── Main ──

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'downloads' | 'price' | 'updated'>('rating');
  const [showPublish, setShowPublish] = useState(false);
  const [detailInd, setDetailInd] = useState<MarketplaceIndicator | null>(null);

  // 4.1 上架数据
  const [published, setPublished] = useState<MarketplaceIndicator[]>(() => loadJSON(LS_PUBLISHED, []));
  const savePublished = useCallback((p: MarketplaceIndicator[]) => { setPublished(p); saveJSON(LS_PUBLISHED, p); }, []);

  // 4.6 评价数据
  const [reviews, setReviews] = useState<Review[]>(() => loadJSON(LS_REVIEWS, MOCK_REVIEWS));
  const saveReviews = useCallback((r: Review[]) => { setReviews(r); saveJSON(LS_REVIEWS, r); }, []);

  // 4.3 试用数据
  const [trials, setTrials] = useState<TrialRecord[]>(() => loadJSON(LS_TRIALS, []));
  const saveTrials = useCallback((t: TrialRecord[]) => { setTrials(t); saveJSON(LS_TRIALS, t); }, []);

  // 4.4 订阅数据
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(() => loadJSON(LS_SUBSCRIPTIONS, []));
  const saveSubscriptions = useCallback((s: SubscriptionRecord[]) => { setSubscriptions(s); saveJSON(LS_SUBSCRIPTIONS, s); }, []);

  // 合并 mock + 已上架（approved）
  const allIndicators = useMemo(() => {
    const approved = published.filter(i => i.status === 'approved');
    return [...MOCK_INDICATORS, ...approved];
  }, [published]);

  // 4.1 发布
  const handlePublish = useCallback((data: Omit<MarketplaceIndicator, 'id' | 'rating' | 'reviewCount' | 'downloadCount' | 'updatedAt' | 'icon' | 'featured' | 'status'>) => {
    const iconFn = ICON_MAP[data.category === 'trend' ? 'TrendingUp' : data.category === 'oscillator' ? 'Activity' : data.category === 'volume' ? 'BarChart3' : data.category === 'volatility' ? 'CircleDashed' : 'Zap'] || Zap;
    const newInd: MarketplaceIndicator = {
      ...data, id: `pub_${Date.now()}`, rating: 0, reviewCount: 0, downloadCount: 0,
      updatedAt: new Date().toISOString().slice(0, 10), icon: iconFn, status: 'pending',
    };
    savePublished([...published, newInd]);
  }, [published, savePublished]);

  // 4.1 审核
  const handleApprove = useCallback((id: string) => {
    savePublished(published.map(i => i.id === id ? { ...i, status: 'approved' as const } : i));
  }, [published, savePublished]);
  const handleReject = useCallback((id: string) => {
    savePublished(published.map(i => i.id === id ? { ...i, status: 'rejected' as const } : i));
  }, [published, savePublished]);

  // 4.3 试用
  const handleStartTrial = useCallback((id: string) => {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    saveTrials([...trials, { indicatorId: id, startDate: now.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }]);
  }, [trials, saveTrials]);

  // 4.4 订阅
  const handleSubscribe = useCallback((id: string, plan: 'monthly' | 'yearly') => {
    saveSubscriptions([...subscriptions, { indicatorId: id, startDate: new Date().toISOString().slice(0, 10), plan }]);
  }, [subscriptions, saveSubscriptions]);

  // 4.6 评价
  const handleAddReview = useCallback((review: Omit<Review, 'id' | 'date'>) => {
    saveReviews([...reviews, { ...review, id: `rev_${Date.now()}`, date: new Date().toISOString().slice(0, 10) }]);
  }, [reviews, saveReviews]);

  // 筛选
  const filtered = useMemo(() => {
    let items = [...allIndicators];
    if (category !== 'all') items = items.filter(i => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.author.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)));
    }
    switch (sortBy) {
      case 'rating': items.sort((a, b) => b.rating - a.rating); break;
      case 'downloads': items.sort((a, b) => b.downloadCount - a.downloadCount); break;
      case 'price': items.sort((a, b) => a.price - b.price); break;
      case 'updated': items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); break;
    }
    items.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return items;
  }, [allIndicators, search, category, sortBy]);

  const stats = useMemo(() => ({
    total: allIndicators.length, free: allIndicators.filter(i => i.price === 0).length,
    avgRating: allIndicators.length > 0 ? allIndicators.reduce((s, i) => s + i.rating, 0) / allIndicators.length : 0,
  }), [allIndicators]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="glass-card p-6 text-center">
        <div className="flex items-center justify-between mb-2">
          <div />
          <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--swiss-accent))' }}>指标商店</h1>
          <button onClick={() => setShowPublish(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
            style={{ background: 'hsl(var(--swiss-accent))' }}>
            <Plus size={14} />发布指标
          </button>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>发现、试用、订阅专业交易指标</p>

        <div className="flex justify-center gap-6 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>指标总数</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-500">{stats.free}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>免费指标</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-500">{stats.avgRating.toFixed(1)}</div>
            <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>平均评分</div>
          </div>
        </div>

        <div className="max-w-lg mx-auto relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索指标名称、作者、标签..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--swiss-accent))]/30"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* 4.5 创作者中心 */}
      <CreatorDashboard published={published} reviews={reviews} />

      {/* 4.1 审核管理 */}
      <ReviewQueue published={published} onApprove={handleApprove} onReject={handleReject} />

      {/* Category + Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(cat => {
            const CatIcon = cat.icon;
            return (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  category === cat.id ? 'bg-[hsl(var(--swiss-accent))]/10 text-[hsl(var(--swiss-accent))] border border-[hsl(var(--swiss-accent))]/30' : 'hover:bg-white/[0.07] border border-transparent'
                }`} style={{ color: category === cat.id ? undefined : 'var(--text-secondary)' }}>
                <CatIcon size={14} />{cat.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} style={{ color: 'var(--text-tertiary)' }} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs px-2 py-1 rounded-lg border outline-none"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            <option value="rating">按评分</option>
            <option value="downloads">按下载</option>
            <option value="price">按价格</option>
            <option value="updated">按更新</option>
          </select>
        </div>
      </div>

      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>找到 {filtered.length} 个指标</div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map(ind => (
            <IndicatorCard key={ind.id} indicator={ind} trials={trials} subscriptions={subscriptions}
              reviews={reviews} onStartTrial={handleStartTrial} onSubscribe={handleSubscribe}
              onOpenDetail={setDetailInd} />
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search size={40} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>未找到匹配的指标</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>尝试调整搜索关键词或筛选条件</p>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showPublish && <PublishModal onClose={() => setShowPublish(false)} onPublish={handlePublish} />}
        {detailInd && <DetailModal indicator={detailInd} reviews={reviews} trials={trials} subscriptions={subscriptions}
          onClose={() => setDetailInd(null)} onStartTrial={handleStartTrial} onSubscribe={handleSubscribe} onAddReview={handleAddReview} />}
      </AnimatePresence>
    </div>
  );
}
