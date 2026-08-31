import { useState, useMemo, useCallback } from 'react';
import { Wallet, Plus, Trash2, Edit3, Eye, EyeOff, TrendingUp, TrendingDown, DollarSign, CreditCard, Building2, Briefcase, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 类型 ──

interface TradingAccount {
  id: string;
  name: string;
  broker: string;
  type: 'stock' | 'fund' | 'margin';
  accountNumber: string;
  balance: number;
  totalAssets: number;
  todayPnl: number;
  todayPnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  createdAt: string;
  color: string;
  hidden: boolean;
}

// ── 常量 ──

const STORAGE_KEY_ACCOUNTS = 'stockmate_trading_accounts';

const BROKER_OPTIONS = ['中信证券', '华泰证券', '国泰君安', '招商证券', '广发证券', '东方财富', '雪球', '同花顺'];

const ACCOUNT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const MOCK_ACCOUNTS: TradingAccount[] = [
  { id: 'acc1', name: '主账户', broker: '中信证券', type: 'stock', accountNumber: '****8856', balance: 523680, totalAssets: 685420, todayPnl: 3250, todayPnlPercent: 0.48, totalPnl: 161740, totalPnlPercent: 30.88, createdAt: '2024-01-15', color: '#10b981', hidden: false },
  { id: 'acc2', name: '基金账户', broker: '天天基金', type: 'fund', accountNumber: '****3312', balance: 120000, totalAssets: 156800, todayPnl: -580, todayPnlPercent: -0.37, totalPnl: 36800, totalPnlPercent: 30.67, createdAt: '2024-03-20', color: '#3b82f6', hidden: false },
  { id: 'acc3', name: '两融账户', broker: '华泰证券', type: 'margin', accountNumber: '****7721', balance: 280000, totalAssets: 342500, todayPnl: 1850, todayPnlPercent: 0.54, totalPnl: 62500, totalPnlPercent: 22.32, createdAt: '2024-06-10', color: '#8b5cf6', hidden: false },
];

// ── 组件 ──

function AccountTypeIcon({ type }: { type: TradingAccount['type'] }) {
  if (type === 'fund') return <Briefcase size={16} />;
  if (type === 'margin') return <CreditCard size={16} />;
  return <Building2 size={16} />;
}

function CreateAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (acc: Omit<TradingAccount, 'id' | 'createdAt' | 'balance' | 'totalAssets' | 'todayPnl' | 'todayPnlPercent' | 'totalPnl' | 'totalPnlPercent' | 'hidden'>) => void }) {
  const [name, setName] = useState('');
  const [broker, setBroker] = useState(BROKER_OPTIONS[0]);
  const [type, setType] = useState<TradingAccount['type']>('stock');
  const [accountNumber, setAccountNumber] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);

  const handleSave = () => {
    if (!name || !accountNumber) return;
    onSave({ name, broker, type, accountNumber, color });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-xl p-6" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-default))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>添加账户</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>账户名称</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="如：主账户"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>券商</label>
            <select value={broker} onChange={e => setBroker(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>
              {BROKER_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>账户类型</label>
            <div className="flex gap-2">
              {([['stock', '普通账户'], ['fund', '基金账户'], ['margin', '两融账户']] as const).map(([t, label]) => (
                <button key={t} onClick={() => setType(t)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: type === t ? `${color}15` : 'hsl(var(--bg-secondary))',
                    color: type === t ? color : 'hsl(var(--text-secondary))',
                    border: `1px solid ${type === t ? color + '40' : 'hsl(var(--border-default))'}`,
                  }}>
                  <AccountTypeIcon type={t} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>账号后四位</label>
            <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="8856" maxLength={4}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }} />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>标记颜色</label>
            <div className="flex gap-2">
              {ACCOUNT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform" style={{ background: c, transform: color === c ? 'scale(1.2)' : 'scale(1)' }}>
                  {color === c && <Check size={14} className="text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}>取消</button>
          <button onClick={handleSave} disabled={!name || !accountNumber}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'hsl(var(--swiss-accent))' }}>添加</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── 主页面 ──

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<TradingAccount[]>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return MOCK_ACCOUNTS;
  });
  const [showCreate, setShowCreate] = useState(false);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>({});

  const totalAssets = useMemo(() => accounts.reduce((s, a) => s + a.totalAssets, 0), [accounts]);
  const totalPnl = useMemo(() => accounts.reduce((s, a) => s + a.totalPnl, 0), [accounts]);
  const totalTodayPnl = useMemo(() => accounts.reduce((s, a) => s + a.todayPnl, 0), [accounts]);

  const save = useCallback((accs: TradingAccount[]) => {
    setAccounts(accs);
    try { localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accs)); } catch { /* ignore */ }
  }, []);

  const handleCreate = useCallback((data: Omit<TradingAccount, 'id' | 'createdAt' | 'balance' | 'totalAssets' | 'todayPnl' | 'todayPnlPercent' | 'totalPnl' | 'totalPnlPercent' | 'hidden'>) => {
    save([{ ...data, id: 'acc' + Date.now(), createdAt: new Date().toISOString().split('T')[0], balance: 0, totalAssets: 0, todayPnl: 0, todayPnlPercent: 0, totalPnl: 0, totalPnlPercent: 0, hidden: false }, ...accounts]);
    setShowCreate(false);
  }, [accounts, save]);

  const deleteAccount = useCallback((id: string) => {
    save(accounts.filter(a => a.id !== id));
  }, [accounts, save]);

  const toggleHidden = useCallback((id: string) => {
    setHiddenMap(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
            <Wallet size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>多账户管理</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>统一管理多个券商账户资产</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>总资产</span>
            <span className="text-xl font-bold mt-0.5" style={{ color: 'hsl(var(--text-primary))' }}>¥{totalAssets.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>今日盈亏</span>
            <span className="text-xl font-bold mt-0.5" style={{ color: totalTodayPnl >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
              {totalTodayPnl >= 0 ? '+' : ''}¥{totalTodayPnl.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>累计盈亏</span>
            <span className="text-xl font-bold mt-0.5" style={{ color: totalPnl >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
              {totalPnl >= 0 ? '+' : ''}¥{totalPnl.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
          {accounts.length} 个账户
        </span>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
          style={{ background: 'hsl(var(--swiss-accent))' }}>
          <Plus size={12} />
          添加账户
        </button>
      </div>

      {/* Account Cards */}
      <div className="space-y-3">
        {accounts.map((acc, i) => {
          const isHidden = hiddenMap[acc.id] || acc.hidden;
          return (
            <motion.div key={acc.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl px-5 py-4" style={{ borderLeft: `3px solid ${acc.color}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg" style={{ background: `${acc.color}15` }}>
                    <AccountTypeIcon type={acc.type} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{acc.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
                        {acc.broker}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{acc.accountNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleHidden(acc.id)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => deleteAccount(acc.id)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isHidden ? (
                <div className="py-3 text-center">
                  <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>账户信息已隐藏</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>总资产</span>
                    <p className="text-base font-bold mt-0.5" style={{ color: 'hsl(var(--text-primary))' }}>¥{acc.totalAssets.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>可用资金</span>
                    <p className="text-base font-bold mt-0.5" style={{ color: 'hsl(var(--text-primary))' }}>¥{acc.balance.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>今日盈亏</span>
                    <p className="text-sm font-bold mt-0.5" style={{ color: acc.todayPnl >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                      {acc.todayPnl >= 0 ? '+' : ''}¥{acc.todayPnl.toLocaleString()}
                      <span className="text-[10px] font-normal ml-1">({acc.todayPnlPercent >= 0 ? '+' : ''}{acc.todayPnlPercent.toFixed(2)}%)</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>累计盈亏</span>
                    <p className="text-sm font-bold mt-0.5" style={{ color: acc.totalPnl >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                      {acc.totalPnl >= 0 ? '+' : ''}¥{acc.totalPnl.toLocaleString()}
                      <span className="text-[10px] font-normal ml-1">({acc.totalPnlPercent >= 0 ? '+' : ''}{acc.totalPnlPercent.toFixed(2)}%)</span>
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Wallet size={48} className="mx-auto mb-3" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>暂无账户</p>
          <p className="text-xs mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>点击「添加账户」开始管理您的多个券商账户</p>
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      </AnimatePresence>
    </div>
  );
}
