import { useState, useMemo, useCallback, useEffect } from 'react';
import { Bell, BellRing, Plus, Trash2, Power, PowerOff, Clock, TrendingUp, TrendingDown, Activity, Volume2, X, Check, AlertTriangle, Filter, BarChart3, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 类型 ──

interface AlertRule {
  id: string;
  name: string;
  stockCode: string;
  stockName: string;
  condition: 'price_above' | 'price_below' | 'change_above' | 'change_below' | 'volume_above' | 'ma_cross_up' | 'ma_cross_down' | 'rsi_overbought' | 'rsi_oversold';
  threshold: number;
  enabled: boolean;
  createdAt: string;
  triggeredAt?: string;
  repeatable: boolean;
}

interface SignalRecord {
  id: string;
  alertId: string;
  alertName: string;
  stockCode: string;
  stockName: string;
  condition: string;
  triggeredAt: string;
  price: number;
  value: number;
  read: boolean;
}

// ── 常量 ──

const STORAGE_KEY_ALERTS = 'stockmate_signal_alerts';
const STORAGE_KEY_SIGNALS = 'stockmate_signal_history';

const CONDITION_OPTIONS: { value: AlertRule['condition']; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'price_above', label: '价格高于', icon: TrendingUp, color: '#10b981' },
  { value: 'price_below', label: '价格低于', icon: TrendingDown, color: '#ef4444' },
  { value: 'change_above', label: '涨幅超过', icon: TrendingUp, color: '#10b981' },
  { value: 'change_below', label: '跌幅超过', icon: TrendingDown, color: '#ef4444' },
  { value: 'volume_above', label: '成交量突破', icon: Volume2, color: '#3b82f6' },
  { value: 'ma_cross_up', label: '均线上穿', icon: Activity, color: '#10b981' },
  { value: 'ma_cross_down', label: '均线下穿', icon: Activity, color: '#ef4444' },
  { value: 'rsi_overbought', label: 'RSI 超买', icon: BarChart3, color: '#f59e0b' },
  { value: 'rsi_oversold', label: 'RSI 超卖', icon: BarChart3, color: '#8b5cf6' },
];

const MOCK_ALERTS: AlertRule[] = [
  { id: 'a1', name: '茅台突破2000', stockCode: '600519.SH', stockName: '贵州茅台', condition: 'price_above', threshold: 2000, enabled: true, createdAt: '2026-08-28', repeatable: true },
  { id: 'a2', name: '平安银行放量', stockCode: '000001.SZ', stockName: '平安银行', condition: 'volume_above', threshold: 50000000, enabled: true, createdAt: '2026-08-29', repeatable: false },
  { id: 'a3', name: '宁德时代跌幅', stockCode: '300750.SZ', stockName: '宁德时代', condition: 'change_below', threshold: -5, enabled: false, createdAt: '2026-08-30', triggeredAt: '2026-08-30', repeatable: true },
  { id: 'a4', name: '比亚迪 MA5 上穿 MA20', stockCode: '002594.SZ', stockName: '比亚迪', condition: 'ma_cross_up', threshold: 5, enabled: true, createdAt: '2026-08-27', repeatable: true },
  { id: 'a5', name: 'RSI 超买预警', stockCode: '600519.SH', stockName: '贵州茅台', condition: 'rsi_overbought', threshold: 70, enabled: true, createdAt: '2026-08-26', repeatable: true },
];

const MOCK_SIGNALS: SignalRecord[] = [
  { id: 's1', alertId: 'a3', alertName: '宁德时代跌幅', stockCode: '300750.SZ', stockName: '宁德时代', condition: '跌幅超过 -5%', triggeredAt: '2026-08-30 14:32', price: 198.5, value: -5.2, read: false },
  { id: 's2', alertId: 'a1', alertName: '茅台突破2000', stockCode: '600519.SH', stockName: '贵州茅台', condition: '价格高于 ¥2000', triggeredAt: '2026-08-29 10:15', price: 2012.8, value: 2012.8, read: true },
  { id: 's3', alertId: 'a2', alertName: '平安银行放量', stockCode: '000001.SZ', stockName: '平安银行', condition: '成交量突破 5000万', triggeredAt: '2026-08-28 13:45', price: 12.35, value: 62000000, read: true },
];

function formatThreshold(condition: string, value: number): string {
  if (condition === 'price_above' || condition === 'price_below') return `¥${value.toLocaleString()}`;
  if (condition === 'change_above' || condition === 'change_below') return `${value > 0 ? '+' : ''}${value}%`;
  if (condition === 'volume_above') return value >= 100000000 ? `${(value / 100000000).toFixed(1)}亿` : `${(value / 10000).toFixed(0)}万`;
  if (condition === 'ma_cross_up' || condition === 'ma_cross_down') return `MA${value}`;
  if (condition === 'rsi_overbought' || condition === 'rsi_oversold') return `${value}`;
  return String(value);
}

function getConditionLabel(condition: string): string {
  return CONDITION_OPTIONS.find(c => c.value === condition)?.label || condition;
}

function loadAlerts(): AlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return MOCK_ALERTS;
}

function saveAlerts(alerts: AlertRule[]) {
  try { localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(alerts)); } catch { /* ignore */ }
}

function loadSignals(): SignalRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SIGNALS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return MOCK_SIGNALS;
}

function saveSignals(signals: SignalRecord[]) {
  try { localStorage.setItem(STORAGE_KEY_SIGNALS, JSON.stringify(signals)); } catch { /* ignore */ }
}

// ── 新建告警弹窗 ──

function CreateAlertModal({ onClose, onSave }: { onClose: () => void; onSave: (alert: Omit<AlertRule, 'id' | 'createdAt' | 'enabled'>) => void }) {
  const [stockCode, setStockCode] = useState('');
  const [stockName, setStockName] = useState('');
  const [condition, setCondition] = useState<AlertRule['condition']>('price_above');
  const [threshold, setThreshold] = useState('');
  const [repeatable, setRepeatable] = useState(true);

  const handleSave = () => {
    if (!stockCode || !threshold) return;
    onSave({
      name: `${stockName || stockCode} ${getConditionLabel(condition)} ${formatThreshold(condition, Number(threshold))}`,
      stockCode,
      stockName: stockName || stockCode,
      condition,
      threshold: Number(threshold),
      repeatable,
    });
  };

  const selectedCond = CONDITION_OPTIONS.find(c => c.value === condition);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-xl p-6" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-default))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>新建信号告警</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>股票代码</label>
            <div className="flex gap-2">
              <input value={stockCode} onChange={e => setStockCode(e.target.value)} placeholder="600519.SH"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }} />
              <input value={stockName} onChange={e => setStockName(e.target.value)} placeholder="股票名称（可选）"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>触发条件</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CONDITION_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button key={opt.value} onClick={() => setCondition(opt.value)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: condition === opt.value ? `${opt.color}18` : 'hsl(var(--bg-secondary))',
                      color: condition === opt.value ? opt.color : 'hsl(var(--text-secondary))',
                      border: `1px solid ${condition === opt.value ? opt.color + '40' : 'hsl(var(--border-default))'}`,
                    }}>
                    <Icon size={12} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>
              {selectedCond?.label}阈值
            </label>
            <input value={threshold} onChange={e => setThreshold(e.target.value)}
              type="number" placeholder={condition.includes('price') ? '2000' : condition.includes('change') ? '5' : condition.includes('volume') ? '50000000' : '14'}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }} />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={repeatable} onChange={e => setRepeatable(e.target.checked)}
                className="w-4 h-4 rounded" style={{ accentColor: 'hsl(var(--swiss-accent))' }} />
              <span className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>重复触发</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}>
            取消
          </button>
          <button onClick={handleSave} disabled={!stockCode || !threshold}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
            style={{ background: 'hsl(var(--swiss-accent))' }}>
            创建告警
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 主页面 ──

export default function SignalAlertPage() {
  const [alerts, setAlerts] = useState<AlertRule[]>(() => loadAlerts());
  const [signals, setSignals] = useState<SignalRecord[]>(() => loadSignals());
  const [tab, setTab] = useState<'alerts' | 'signals'>('alerts');
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  useEffect(() => { saveAlerts(alerts); }, [alerts]);
  useEffect(() => { saveSignals(signals); }, [signals]);

  const unreadCount = useMemo(() => signals.filter(s => !s.read).length, [signals]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'enabled') return alerts.filter(a => a.enabled);
    if (filter === 'disabled') return alerts.filter(a => !a.enabled);
    return alerts;
  }, [alerts, filter]);

  const toggleAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setSignals(prev => prev.map(s => ({ ...s, read: true })));
  }, []);

  const handleCreate = useCallback((data: Omit<AlertRule, 'id' | 'createdAt' | 'enabled'>) => {
    const newAlert: AlertRule = {
      ...data,
      id: 'a' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
      enabled: true,
    };
    setAlerts(prev => [newAlert, ...prev]);
    setShowCreate(false);
  }, []);

  const deleteSignal = useCallback((id: string) => {
    setSignals(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
            <BellRing size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>信号推送</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>实时监控价格、指标和技术信号</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{alerts.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>告警规则</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--swiss-accent))' }}>{alerts.filter(a => a.enabled).length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>已启用</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: unreadCount > 0 ? 'hsl(var(--risk-warning))' : 'hsl(var(--text-primary))' }}>{signals.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>触发记录</span>
          </div>
        </div>
      </div>

      {/* Tabs + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
          <button onClick={() => setTab('alerts')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: tab === 'alerts' ? 'hsl(var(--bg-card))' : 'transparent',
              color: tab === 'alerts' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
              boxShadow: tab === 'alerts' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            <Bell size={12} />
            告警规则
          </button>
          <button onClick={() => setTab('signals')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all relative"
            style={{
              background: tab === 'signals' ? 'hsl(var(--bg-card))' : 'transparent',
              color: tab === 'signals' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
              boxShadow: tab === 'signals' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            <Activity size={12} />
            触发记录
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: 'hsl(var(--risk-danger))' }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'alerts' && (
            <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
              {(['all', 'enabled', 'disabled'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
                  style={{
                    background: filter === f ? 'hsl(var(--bg-card))' : 'transparent',
                    color: filter === f ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
                  }}>
                  {f === 'all' ? '全部' : f === 'enabled' ? '已启用' : '已禁用'}
                </button>
              ))}
            </div>
          )}
          {tab === 'signals' && unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'hsl(var(--swiss-accent))', border: '1px solid hsl(var(--border-default))' }}>
              <Check size={12} />
              全部已读
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
            style={{ background: 'hsl(var(--swiss-accent))' }}>
            <Plus size={12} />
            新建告警
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'alerts' ? (
        <div className="space-y-2">
          {filteredAlerts.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Bell size={40} className="mx-auto mb-3" style={{ color: 'hsl(var(--text-tertiary))' }} />
              <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>暂无告警规则</p>
              <p className="text-xs mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>点击「新建告警」创建第一个信号告警</p>
            </div>
          ) : (
            filteredAlerts.map(alert => {
              const condOpt = CONDITION_OPTIONS.find(c => c.value === alert.condition);
              const Icon = condOpt?.icon || Bell;
              return (
                <motion.div key={alert.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg shrink-0" style={{ background: `${condOpt?.color || '#666'}15` }}>
                    <Icon size={18} style={{ color: condOpt?.color || '#666' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{alert.name}</span>
                      {!alert.enabled && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>已禁用</span>
                      )}
                      {alert.repeatable && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>重复</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>{alert.stockCode}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${condOpt?.color || '#666'}15`, color: condOpt?.color || '#666' }}>
                        {getConditionLabel(alert.condition)} {formatThreshold(alert.condition, alert.threshold)}
                      </span>
                      {alert.triggeredAt && (
                        <span className="text-[10px] flex items-center gap-1" style={{ color: 'hsl(var(--risk-warning))' }}>
                          <Clock size={10} />
                          上次触发: {alert.triggeredAt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleAlert(alert.id)}
                      className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                      title={alert.enabled ? '禁用' : '启用'}
                      style={{ color: alert.enabled ? 'hsl(var(--price-up))' : 'hsl(var(--text-tertiary))' }}>
                      {alert.enabled ? <Power size={16} /> : <PowerOff size={16} />}
                    </button>
                    <button onClick={() => deleteAlert(alert.id)}
                      className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                      title="删除" style={{ color: 'hsl(var(--text-tertiary))' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {signals.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <Activity size={40} className="mx-auto mb-3" style={{ color: 'hsl(var(--text-tertiary))' }} />
              <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>暂无触发记录</p>
              <p className="text-xs mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>当告警条件满足时，信号将在此显示</p>
            </div>
          ) : (
            signals.map(signal => (
              <motion.div key={signal.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-xl px-5 py-4 flex items-center gap-4 ${!signal.read ? 'ring-1 ring-[hsl(var(--swiss-accent))]' : ''}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${!signal.read ? 'animate-pulse' : ''}`}
                  style={{ background: !signal.read ? 'hsl(var(--swiss-accent))' : 'transparent' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{signal.stockName}</span>
                    <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>{signal.stockCode}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      {signal.condition}
                    </span>
                    <span className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>
                      触发价 ¥{signal.price.toFixed(2)}
                    </span>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
                      <Clock size={10} />
                      {signal.triggeredAt}
                    </span>
                  </div>
                </div>
                <button onClick={() => deleteSignal(signal.id)}
                  className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
                  style={{ color: 'hsl(var(--text-tertiary))' }}>
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateAlertModal onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      </AnimatePresence>
    </div>
  );
}
