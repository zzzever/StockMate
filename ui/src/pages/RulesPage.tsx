import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Trash2, AlertTriangle, CheckCircle, Edit3, TrendingUp, Plus, X, Copy, Power, PowerOff } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { type StrategyMeta } from '@/types';

// ── Constants ──
const STORAGE_KEY_STRATEGIES = 'stockmate_strategies';
const STORAGE_KEY_LEGACY = 'stockmate_trading_rules';

const PRESET_COLORS = [
  '#22c55e', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
];

function generateId(): string {
  return 'strat_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Storage helpers ──
function loadStrategies(): StrategyMeta[] {
  try {
    // Migrate from legacy single-rules format
    const raw = localStorage.getItem(STORAGE_KEY_STRATEGIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // First load: check legacy key
    const legacyRules = localStorage.getItem(STORAGE_KEY_LEGACY) || '';
    if (legacyRules.trim()) {
      const defaultStrategy: StrategyMeta = {
        id: generateId(),
        name: '默认策略',
        rules: legacyRules,
        enabled: true,
        color: '#22c55e',
        createdAt: new Date().toISOString(),
      };
      saveStrategiesToStore([defaultStrategy]);
      return [defaultStrategy];
    }
    return [];
  } catch {
    return [];
  }
}

function saveStrategiesToStore(strategies: StrategyMeta[]) {
  localStorage.setItem(STORAGE_KEY_STRATEGIES, JSON.stringify(strategies));
  // Sync active rules to legacy key for backward compatibility
  const active = strategies.find(s => s.enabled);
  localStorage.setItem(STORAGE_KEY_LEGACY, active?.rules || '');
}

function getColorName(hex: string): string {
  const map: Record<string, string> = {
    '#22c55e': '翠绿',
    '#3b82f6': '蓝色',
    '#8b5cf6': '紫色',
    '#f59e0b': '琥珀',
    '#ef4444': '红色',
    '#06b6d4': '青色',
    '#f97316': '橙色',
    '#ec4899': '粉色',
    '#14b8a6': '青绿',
    '#6366f1': '靛蓝',
  };
  return map[hex] || '自定义';
}

// ── Editor component ──
function StrategyEditor({ draft, onSave, onCancel }: {
  draft: { id: string | null; name: string; rules: string; color: string };
  onSave: (draft: { id: string | null; name: string; rules: string; color: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(draft.name);
  const [rules, setRules] = useState(draft.rules);
  const [color, setColor] = useState(draft.color);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const isValid = name.trim().length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Strategy name input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>
          策略名称
        </label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入策略名称..."
          className="w-full px-4 py-2.5 text-lg font-bold bg-transparent outline-none rounded-lg border"
          style={{
            color: 'hsl(var(--text-primary))',
            borderColor: isValid ? 'hsl(var(--border-default))' : '#ef4444',
          }}
        />
      </div>

      {/* Color picker */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>
          策略颜色 · {getColorName(color)}
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-all border-2"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#ffffff' : 'transparent',
                boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
              }}
              aria-label={getColorName(c)}
            />
          ))}
        </div>
      </div>

      {/* Rules textarea */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>
          规则内容
        </label>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder={`一、买入规则\n1. 单只股票最大仓位不超过总资金的20%\n2. \n\n二、卖出规则\n1. 止损线设在买入价的-8%\n2. \n\n三、风险管理\n1. \n2. `}
          className="w-full h-[400px] bg-transparent text-base outline-none resize-none leading-relaxed rounded-lg border p-4"
          style={{
            color: 'hsl(var(--text-primary))',
            borderColor: 'hsl(var(--border-default))',
            lineHeight: 1.8,
          }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-auto pt-4"
        style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}
      >
        <button
          onClick={() => onSave({ id: draft.id, name: name.trim(), rules, color })}
          disabled={!isValid}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-40"
          style={{ background: '#219653', color: '#ffffff' }}
        >
          <Save size={16} /> 保存策略
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
          style={{ background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}
        >
          <X size={16} /> 取消
        </button>
        <span className="text-xs ml-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {rules.split('\n').filter(l => l.trim()).length} 条规则
        </span>
      </div>
    </div>
  );
}

// ── Strategy card ──
function StrategyCard({ strategy, onEdit, onDelete, onToggle, onDuplicate }: {
  strategy: StrategyMeta;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
}) {
  const ruleCount = strategy.rules.split('\n').filter(l => l.trim()).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden transition-shadow hover:shadow-md"
      style={{
        background: 'hsl(var(--bg-card))',
        border: '1px solid hsl(var(--border-default))',
        borderLeft: `4px solid ${strategy.color}`,
        opacity: strategy.enabled ? 1 : 0.55,
      }}
    >
      <div className="p-4">
        {/* Top row: name + enabled badge */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold truncate mr-2"
            style={{ color: 'hsl(var(--text-primary))' }}
          >
            {strategy.name}
          </h3>
          <span
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: strategy.enabled
                ? `${strategy.color}20`
                : 'hsl(var(--bg-root))',
              color: strategy.enabled ? strategy.color : 'hsl(var(--text-tertiary))',
              border: `1px solid ${strategy.enabled ? strategy.color + '40' : 'hsl(var(--border-subtle))'}`,
            }}
          >
            {strategy.enabled ? <Power size={10} /> : <PowerOff size={10} />}
            {strategy.enabled ? '已启用' : '已禁用'}
          </span>
        </div>

        {/* Rule count + created */}
        <div className="flex items-center gap-3 text-xs mb-3"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <span>{ruleCount} 条规则</span>
          <span>·</span>
          <span>{new Date(strategy.createdAt).toLocaleDateString('zh-CN')}</span>
        </div>

        {/* Quick preview */}
        {strategy.rules.trim() ? (
          <p className="text-xs leading-relaxed line-clamp-2 mb-3"
            style={{ color: 'hsl(var(--text-secondary))' }}
          >
            {strategy.rules.split('\n').find(l => l.trim()) || '空规则'}
          </p>
        ) : (
          <p className="text-xs italic mb-3" style={{ color: 'hsl(var(--text-tertiary))' }}>
            未编写规则内容
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2"
          style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}
        >
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:opacity-80"
            style={{ background: `${strategy.color}15`, color: strategy.color }}
          >
            <Edit3 size={13} /> 编辑
          </button>
          <button
            onClick={onToggle}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={{ background: 'hsl(var(--bg-root))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}
          >
            {strategy.enabled ? <PowerOff size={13} /> : <Power size={13} />}
            {strategy.enabled ? '禁用' : '启用'}
          </button>
          <button
            onClick={onDuplicate}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={{ background: 'hsl(var(--bg-root))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}
            title="复制策略"
          >
            <Copy size={13} />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ml-auto"
            style={{ background: '#fee2e2', color: '#ef4444' }}
          >
            <Trash2 size={13} /> 删除
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main page ──
export default function RulesPage() {
  const [strategies, setStrategies] = useState<StrategyMeta[]>(loadStrategies);
  const [editDraft, setEditDraft] = useState<{
    id: string | null;
    name: string;
    rules: string;
    color: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();
  const selectedStock = useAppStore((s) => s.selectedStock);

  const enabledStrategies = strategies.filter(s => s.enabled);
  const hasActiveRules = enabledStrategies.some(s => s.rules.trim().length > 0);

  const persist = useCallback((updated: StrategyMeta[]) => {
    setStrategies(updated);
    saveStrategiesToStore(updated);
    setSaved(true);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }, []);

  useEffect(() => {
    return () => clearTimeout(savedTimerRef.current);
  }, []);

  // Start editing an existing strategy
  const handleEdit = useCallback((strategy: StrategyMeta) => {
    setEditDraft({
      id: strategy.id,
      name: strategy.name,
      rules: strategy.rules,
      color: strategy.color,
    });
  }, []);

  // Start creating a new strategy
  const handleCreate = useCallback(() => {
    const usedColors = strategies.map(s => s.color);
    const availColor = PRESET_COLORS.find(c => !usedColors.includes(c)) || PRESET_COLORS[0];
    setEditDraft({
      id: null,
      name: '',
      rules: '',
      color: availColor,
    });
  }, [strategies]);

  // Save draft (create or update)
  const handleSaveDraft = useCallback((draft: { id: string | null; name: string; rules: string; color: string }) => {
    if (draft.id === null) {
      // Creating new
      const newStrategy: StrategyMeta = {
        id: generateId(),
        name: draft.name,
        rules: draft.rules,
        enabled: true,
        color: draft.color,
        createdAt: new Date().toISOString(),
      };
      persist([...strategies, newStrategy]);
    } else {
      // Updating existing
      const updated = strategies.map(s =>
        s.id === draft.id
          ? { ...s, name: draft.name, rules: draft.rules, color: draft.color }
          : s
      );
      persist(updated);
    }
    setEditDraft(null);
  }, [strategies, persist]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditDraft(null);
  }, []);

  // Delete strategy
  const handleDelete = useCallback((id: string) => {
    const target = strategies.find(s => s.id === id);
    if (!target) return;
    if (!confirm(`确定要删除策略「${target.name}」？此操作不可撤销。`)) return;
    const updated = strategies.filter(s => s.id !== id);
    persist(updated);
  }, [strategies, persist]);

  // Toggle enabled
  const handleToggle = useCallback((id: string) => {
    const updated = strategies.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    persist(updated);
  }, [strategies, persist]);

  // Duplicate strategy
  const handleDuplicate = useCallback((strategy: StrategyMeta) => {
    const newStrategy: StrategyMeta = {
      id: generateId(),
      name: strategy.name + ' (副本)',
      rules: strategy.rules,
      enabled: false,
      color: strategy.color,
      createdAt: new Date().toISOString(),
    };
    persist([...strategies, newStrategy]);
  }, [strategies, persist]);

  // Apply to market
  const handleApplyToMarket = useCallback(() => {
    if (selectedStock) {
      navigate(`/stock?code=${selectedStock.code}&autoStrategy=1`);
    }
  }, [selectedStock, navigate]);

  const allLines = strategies
    .filter(s => s.enabled)
    .flatMap(s => s.rules.split('\n').filter(l => l.trim()));

  // ── Render editor if editing ──
  if (editDraft !== null) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col"
        style={{ background: 'hsl(var(--bg-root))' }}
      >
        {/* Header */}
        <div className="shrink-0 px-8 pt-8 pb-4"
          style={{ borderBottom: '1px solid hsl(var(--border-default))' }}
        >
          <div className="flex items-end justify-between">
            <div>
              <h1 className="heading-serif text-4xl font-bold tracking-tight" style={{ color: 'hsl(var(--text-primary))' }}>
                {editDraft.id === null ? '新建策略' : '编辑策略'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
                {editDraft.id === null ? '创建一个新的交易策略' : `正在编辑: ${editDraft.name}`}
              </p>
            </div>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <StrategyEditor draft={editDraft} onSave={handleSaveDraft} onCancel={handleCancelEdit} />
        </div>

        {/* Save toast */}
        <AnimatePresence>
          {saved && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-2xl text-base font-bold"
              style={{ background: '#219653', color: '#ffffff' }}
            >
              策略已保存
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // ── Main list view ──
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col"
      style={{ background: 'hsl(var(--bg-root))' }}
    >
      {/* Header */}
      <div className="shrink-0 px-8 pt-8 pb-4"
        style={{ borderBottom: '1px solid hsl(var(--border-default))' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <h1 className="heading-serif text-4xl font-bold tracking-tight" style={{ color: 'hsl(var(--text-primary))' }}>
              交易策略
            </h1>
            <p className="text-sm mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
              TRADING RULES · 多策略管理
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--text-inverse))' }}
            >
              <Plus size={16} /> 新建策略
            </button>
            {selectedStock && hasActiveRules && (
              <button onClick={handleApplyToMarket}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#219653', color: '#ffffff' }}
              >
                <TrendingUp size={16} /> 应用到行情
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Strategy grid */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
            <AlertTriangle size={40} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <p className="text-xl" style={{ color: 'hsl(var(--text-secondary))' }}>
              还没有交易策略
            </p>
            <p className="text-sm" style={{ color: 'hsl(var(--text-tertiary))' }}>
              创建策略来定义你的交易规则，AI 将根据规则分析股票
            </p>
            <button onClick={handleCreate}
              className="px-6 py-3 rounded-lg text-base font-medium transition-colors"
              style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--text-inverse))' }}
            >
              <Plus size={18} className="inline mr-1" /> 创建第一个策略
            </button>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-5 px-1">
              <span className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
                共 {strategies.length} 个策略
                {enabledStrategies.length > 0 && (
                  <> · <span style={{ color: '#22c55e' }}>{enabledStrategies.length} 个已启用</span></>
                )}
                {allLines.length > 0 && (
                  <> · 合计 {allLines.length} 条规则</>
                )}
              </span>
              {enabledStrategies.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: 'hsl(var(--price-down))' }}>
                  <CheckCircle size={14} /> 策略已启用
                </span>
              )}
            </div>

            {/* Strategy cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onEdit={() => handleEdit(strategy)}
                  onDelete={() => handleDelete(strategy.id)}
                  onToggle={() => handleToggle(strategy.id)}
                  onDuplicate={() => handleDuplicate(strategy)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-8 py-3 flex items-center justify-between text-sm"
        style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-card))' }}
      >
        <span style={{ color: 'hsl(var(--text-secondary))' }}>
          {strategies.length > 0
            ? `${allLines.length} 条规则生效 · AI 分析时自动附加`
            : '未设置策略'}
        </span>
        {enabledStrategies.length > 0 && (
          <div className="flex items-center gap-2">
            {enabledStrategies.slice(0, 3).map(s => (
              <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: `${s.color}20`,
                  color: s.color,
                }}
              >
                {s.name}
              </span>
            ))}
            {enabledStrategies.length > 3 && (
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                +{enabledStrategies.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Save toast */}
      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-2xl text-base font-bold"
            style={{ background: '#219653', color: '#ffffff' }}
          >
            策略已保存
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
