import { useState, useMemo } from 'react';
import { Bell, Check, CheckCheck, Trash2, Settings, Filter, Volume2, Mail, Smartphone, MessageSquare, AlertTriangle, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 类型 ──

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'signal' | 'alert' | 'system' | 'news' | 'portfolio';
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  timestamp: string;
  action?: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  icon: React.ElementType;
  enabled: boolean;
  types: string[];
}

// ── 常量 ──

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'RSI超买信号', message: '贵州茅台(600519) RSI(14)=72.5，进入超买区域', type: 'signal', priority: 'high', read: false, timestamp: '2026-09-01T10:30:00' },
  { id: '2', title: '涨停板提醒', message: '东方财富(300059)触及涨停板，涨幅10.01%', type: 'alert', priority: 'high', read: false, timestamp: '2026-09-01T09:45:00' },
  { id: '3', title: '均线金叉信号', message: '比亚迪(002594) MA5上穿MA20，形成金叉', type: 'signal', priority: 'medium', read: false, timestamp: '2026-09-01T09:30:00' },
  { id: '4', title: '组合预警', message: '您的持仓宁德时代(300750)今日跌幅超过3%', type: 'portfolio', priority: 'high', read: false, timestamp: '2026-09-01T10:15:00' },
  { id: '5', title: '系统公告', message: 'StockMate v2.5.0 已发布，新增蒙特卡洛模拟功能', type: 'system', priority: 'low', read: true, timestamp: '2026-08-31T18:00:00' },
  { id: '6', title: '成交量异动', message: '中芯国际(688981) 成交量较昨日放大3倍', type: 'signal', priority: 'medium', read: true, timestamp: '2026-09-01T11:00:00' },
  { id: '7', title: '新闻推送', message: '央行宣布降准0.25个百分点，释放长期资金约5000亿元', type: 'news', priority: 'high', read: false, timestamp: '2026-09-01T12:00:00' },
  { id: '8', title: '跌破止损线', message: '您的持仓中国平安(601318)已跌破设定止损价¥50', type: 'portfolio', priority: 'high', read: false, timestamp: '2026-09-01T13:30:00' },
  { id: '9', title: '布林带突破', message: '招商银行(600036)收盘价突破布林带上轨', type: 'signal', priority: 'medium', read: true, timestamp: '2026-08-31T15:00:00' },
  { id: '10', title: '分红到账', message: '贵州茅台(600519)现金分红¥3.50/股已到账', type: 'portfolio', priority: 'low', read: true, timestamp: '2026-08-30T10:00:00' },
];

const MOCK_CHANNELS: NotificationChannel[] = [
  { id: 'app', name: '应用内通知', icon: Bell, enabled: true, types: ['signal', 'alert', 'system', 'news', 'portfolio'] },
  { id: 'email', name: '邮件推送', icon: Mail, enabled: true, types: ['signal', 'alert', 'portfolio'] },
  { id: 'sms', name: '短信提醒', icon: Smartphone, enabled: false, types: ['alert', 'portfolio'] },
  { id: 'wechat', name: '微信推送', icon: MessageSquare, enabled: false, types: ['signal', 'news'] },
];

const TYPE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  signal: { color: '#3b82f6', icon: Zap, label: '信号' },
  alert: { color: '#ef4444', icon: AlertTriangle, label: '预警' },
  system: { color: '#64748b', icon: Settings, label: '系统' },
  news: { color: '#8b5cf6', icon: Mail, label: '新闻' },
  portfolio: { color: '#f59e0b', icon: TrendingUp, label: '持仓' },
};

const PRIORITY_MAP: Record<string, { color: string; label: string }> = {
  high: { color: '#ef4444', label: '紧急' },
  medium: { color: '#f59e0b', label: '一般' },
  low: { color: '#64748b', label: '低' },
};

// ── 组件 ──

function NotificationItem({ notif, onRead, onDelete }: { notif: Notification; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  const pri = PRIORITY_MAP[notif.priority];
  const timeDiff = useMemo(() => {
    const diff = Date.now() - new Date(notif.timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  }, [notif.timestamp]);

  return (
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
      className="flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer"
      style={{ background: notif.read ? 'transparent' : 'hsl(var(--swiss-accent) / 0.05)', borderLeft: `3px solid ${notif.read ? 'transparent' : cfg.color}` }}
      onClick={() => !notif.read && onRead(notif.id)}>
      <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${cfg.color}15` }}>
        <cfg.icon size={14} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold" style={{ color: notif.read ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))' }}>
            {notif.title}
          </span>
          <span className="text-[9px] px-1 py-0.5 rounded font-medium" style={{ background: `${pri.color}15`, color: pri.color }}>
            {pri.label}
          </span>
          {!notif.read && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />}
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: 'hsl(var(--text-tertiary))' }}>{notif.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{timeDiff}</span>
          <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: `${cfg.color}10`, color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!notif.read && (
          <button onClick={e => { e.stopPropagation(); onRead(notif.id); }}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <Check size={12} />
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

// ── 主页面 ──

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [channels, setChannels] = useState(MOCK_CHANNELS);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');

  const filtered = useMemo(() => {
    return notifications
      .filter(n => !filterType || n.type === filterType)
      .filter(n => filterRead === 'all' || (filterRead === 'unread' ? !n.read : n.read))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, filterType, filterRead]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const deleteNotif = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));
  const toggleChannel = (id: string) => setChannels(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Bell size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>智能提醒</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>统一管理所有通知渠道</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: '#ef4444', color: 'white' }}>
                {unreadCount} 条未读
              </span>
            )}
            <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium"
              style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-secondary))' }}>
              <CheckCheck size={12} />
              全部已读
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Notification Channels */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>推送渠道</span>
          </div>
          <div className="space-y-2">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
                <div className="flex items-center gap-2">
                  <ch.icon size={14} style={{ color: ch.enabled ? 'hsl(var(--swiss-accent))' : 'hsl(var(--text-tertiary))' }} />
                  <span className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>{ch.name}</span>
                </div>
                <button onClick={() => toggleChannel(ch.id)}
                  className="w-8 h-4 rounded-full relative transition-all"
                  style={{ background: ch.enabled ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-tertiary))' }}>
                  <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: ch.enabled ? '16px' : '2px' }} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid hsl(var(--border-default))' }}>
            <span className="text-[10px] font-semibold block mb-2" style={{ color: 'hsl(var(--text-tertiary))' }}>通知类型</span>
            <div className="space-y-1">
              {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
                const count = notifications.filter(n => n.type === type).length;
                return (
                  <button key={type} onClick={() => setFilterType(filterType === type ? null : type)}
                    className="flex items-center gap-2 w-full p-1.5 rounded text-left"
                    style={{ background: filterType === type ? `${cfg.color}15` : 'transparent' }}>
                    <cfg.icon size={10} style={{ color: cfg.color }} />
                    <span className="text-[10px] flex-1" style={{ color: 'hsl(var(--text-secondary))' }}>{cfg.label}</span>
                    <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notification List */}
        <div className="lg:col-span-3 glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
              通知列表 ({filtered.length})
            </span>
            <div className="ml-auto flex items-center gap-1">
              {(['all', 'unread', 'read'] as const).map(r => (
                <button key={r} onClick={() => setFilterRead(r)}
                  className="text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{ background: filterRead === r ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: filterRead === r ? 'white' : 'hsl(var(--text-tertiary))' }}>
                  {r === 'all' ? '全部' : r === 'unread' ? '未读' : '已读'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            <AnimatePresence>
              {filtered.map(n => (
                <NotificationItem key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="text-center py-8">
                <Bell size={32} style={{ color: 'hsl(var(--text-tertiary))', opacity: 0.3 }} />
                <p className="text-xs mt-2" style={{ color: 'hsl(var(--text-tertiary))' }}>暂无通知</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
