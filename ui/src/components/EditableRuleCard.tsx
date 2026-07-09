import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Plus, X, Save, Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { TradingRule, RuleCondition, RuleConditionType } from '@/types';
import { RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const STORAGE_KEY_RULES = 'stockmate_trading_rules_v2';

const CONDITION_TYPE_LABELS: Record<RuleConditionType, string> = {
  ma_cross: 'MA交叉',
  rsi_threshold: 'RSI阈值',
  price_breakout: '价格突破',
  volume_surge: '成交量放大',
  macd_signal: 'MACD信号',
  consecutive_days: '连续涨跌',
};

const CONDITION_SUBTITLES: Record<RuleConditionType, string> = {
  ma_cross: '快慢均线交叉信号',
  rsi_threshold: 'RSI超买超卖信号',
  price_breakout: '价格突破近期高/低点',
  volume_surge: '成交量倍量放大',
  macd_signal: 'MACD DIF与DEA交叉',
  consecutive_days: '连续N天涨跌（可选缩量/放量）',
};

interface ParamFieldMeta {
  key: string;
  label: string;
  type: 'number' | 'direction';
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
}

const CONDITION_PARAMS: Record<RuleConditionType, ParamFieldMeta[]> = {
  ma_cross: [
    { key: 'fastPeriod', label: '快周期', type: 'number', defaultValue: 5, min: 2, max: 120, step: 1 },
    { key: 'slowPeriod', label: '慢周期', type: 'number', defaultValue: 10, min: 5, max: 250, step: 1 },
    { key: 'direction', label: '方向', type: 'direction', defaultValue: 'above' },
  ],
  rsi_threshold: [
    { key: 'period', label: '周期', type: 'number', defaultValue: 14, min: 2, max: 50, step: 1 },
    { key: 'threshold', label: '阈值', type: 'number', defaultValue: 30, min: 5, max: 95, step: 5 },
    { key: 'direction', label: '方向', type: 'direction', defaultValue: 'below' },
  ],
  price_breakout: [
    { key: 'period', label: '周期', type: 'number', defaultValue: 20, min: 5, max: 120, step: 1 },
    { key: 'direction', label: '方向', type: 'direction', defaultValue: 'above' },
  ],
  volume_surge: [
    { key: 'period', label: '基准周期', type: 'number', defaultValue: 5, min: 1, max: 60, step: 1 },
    { key: 'multiplier', label: '倍数', type: 'number', defaultValue: 2, min: 1.0, max: 10, step: 0.5 },
  ],
  macd_signal: [
    { key: 'fast', label: '快线', type: 'number', defaultValue: 12, min: 5, max: 50, step: 1 },
    { key: 'slow', label: '慢线', type: 'number', defaultValue: 26, min: 10, max: 100, step: 1 },
    { key: 'signal', label: '信号线', type: 'number', defaultValue: 9, min: 3, max: 30, step: 1 },
    { key: 'direction', label: '方向', type: 'direction', defaultValue: 'above' },
  ],
  consecutive_days: [
    { key: 'days', label: '天数', type: 'number', defaultValue: 3, min: 2, max: 20, step: 1 },
  ],
};

const DIRECTION_OPTIONS: Record<string, { above: string; below: string }> = {
  ma_cross: { above: '上穿', below: '下穿' },
  rsi_threshold: { above: '高于阈值', below: '低于阈值' },
  price_breakout: { above: '突破高点', below: '跌破低点' },
  macd_signal: { above: '上穿', below: '下穿' },
};

const DEFAULT_DIRECTION_LABELS = { above: '上方', below: '下方' };

const SIGNAL_LABELS: Record<string, string> = {
  buy: '买入',
  sell: '卖出',
  alert: '提醒',
};

const SIGNAL_COLORS: Record<string, string> = {
  buy: '#22c55e',
  sell: '#ef4444',
  alert: '#f59e0b',
};

function generateId(): string {
  return 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function createDefaultCondition(type: RuleConditionType): RuleCondition {
  return {
    type,
    params: CONDITION_PARAMS[type].reduce(
      (acc, field) => ({ ...acc, [field.key]: field.defaultValue }),
      {} as Record<string, number | string>,
    ),
  };
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Human-readable one-line summary for collapsed state */
function conditionSummary(cond: RuleCondition): string {
  const p = cond.params;
  switch (cond.type) {
    case 'ma_cross': {
      const fast = p.fastPeriod ?? 5;
      const slow = p.slowPeriod ?? 10;
      const dir = p.direction === 'above' ? '↑' : '↓';
      return `MA${fast}${dir}MA${slow}`;
    }
    case 'rsi_threshold': {
      const period = p.period ?? 14;
      const threshold = p.threshold ?? 30;
      const dir = p.direction === 'below' ? '<' : '>';
      return `RSI(${period})${dir}${threshold}`;
    }
    case 'price_breakout': {
      const period = p.period ?? 20;
      const dir = p.direction === 'above' ? '突破高点' : '跌破低点';
      return `${period}日${dir}`;
    }
    case 'volume_surge': {
      const period = p.period ?? 5;
      const mult = p.multiplier ?? 2;
      return `成交量${mult}x(${period}日)`;
    }
    case 'macd_signal': {
      const fast = p.fast ?? 12;
      const slow = p.slow ?? 26;
      const sig = p.signal ?? 9;
      const dir = p.direction === 'above' ? '↑' : '↓';
      return `MACD(${fast},${slow},${sig})${dir}`;
    }
    case 'consecutive_days': {
      const days = p.days ?? 3;
      const dir = p.direction === 'up' ? '涨' : '跌';
      const vol = p.volume === 'shrink' ? '缩量' : p.volume === 'surge' ? '放量' : '';
      const next = p.next === 'up' ? '→次日涨' : p.next === 'down' ? '→次日跌' : '';
      return `连续${days}天${vol}${dir}${next}`;
    }
  }
}

function getSignalLabel(signal: string): string {
  return SIGNAL_LABELS[signal] ?? signal;
}

function getSignalColor(signal: string): string {
  return SIGNAL_COLORS[signal] ?? '#737373';
}

function getSignalBg(signal: string): string {
  const c = getSignalColor(signal);
  return `${c}20`;
}

function loadRules(): TradingRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RULES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: TradingRule, i: number) => ({
          ...r,
          markerIndex: r.markerIndex ?? i + 1,
          color: ruleColor(r.markerIndex ?? i),
          // Ensure conditions exist
          conditions: r.conditions ?? [],
        }));
      }
    }
    return RULE_TEMPLATES.map((t, i) => ({ ...t, enabled: false, markerIndex: i + 1 }));
  } catch {
    return RULE_TEMPLATES.map((t, i) => ({ ...t, enabled: false, markerIndex: i + 1 }));
  }
}

function saveRules(rules: TradingRule[]): void {
  localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
}

// ─────────────────────────────────────────────────────────
// Reusable Parameter Controls
// ─────────────────────────────────────────────────────────

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (value: number) => void;
}

function NumberStepper({ value, min, max, step, label, onChange }: NumberStepperProps) {
  const inc = useCallback(() => {
    const next = Math.min(max, +(value + step).toFixed(1));
    onChange(next);
  }, [value, max, step, onChange]);

  const dec = useCallback(() => {
    const next = Math.max(min, +(value - step).toFixed(1));
    onChange(next);
  }, [value, min, step, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') return;
      const num = parseFloat(raw);
      if (!isNaN(num) && num >= min && num <= max) {
        onChange(num);
      }
    },
    [min, max, onChange],
  );

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>
        {label}
      </span>
      <div className="flex items-center rounded" style={{ border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-root))' }}>
        <input
          type="text"
          inputMode="decimal"
          value={step < 1 ? value.toFixed(1) : value}
          onChange={handleInputChange}
          className="w-12 px-1.5 py-1 text-[11px] font-bold text-center bg-transparent outline-none tabular-nums"
          style={{ color: 'hsl(var(--text-primary))', fontVariantNumeric: 'tabular-nums' }}
        />
        <div className="flex flex-col border-l" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
          <button
            onClick={inc}
            disabled={value >= max}
            className="px-1 py-0 leading-none text-[10px] hover:opacity-70 transition-opacity disabled:opacity-20"
            style={{ color: 'hsl(var(--text-secondary))' }}
          >
            ▲
          </button>
          <button
            onClick={dec}
            disabled={value <= min}
            className="px-1 py-0 leading-none text-[10px] hover:opacity-70 transition-opacity disabled:opacity-20"
            style={{ borderTop: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))' }}
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

interface DirectionToggleProps {
  value: string;
  conditionType: RuleConditionType;
  onChange: (value: string) => void;
}

function DirectionToggle({ value, conditionType, onChange }: DirectionToggleProps) {
  const labels = DIRECTION_OPTIONS[conditionType] ?? DEFAULT_DIRECTION_LABELS;
  const options = [
    { value: 'above', label: labels.above },
    { value: 'below', label: labels.below },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>
        方向
      </span>
      <div className="flex rounded overflow-hidden" style={{ border: '1px solid hsl(var(--border-subtle))' }}>
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="px-2.5 py-1 text-[11px] font-bold transition-colors"
              style={{
                background: isActive ? 'hsl(var(--accent))' : 'hsl(var(--bg-root))',
                color: isActive ? '#ffffff' : 'hsl(var(--text-secondary))',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SignalCapsuleSelectorProps {
  value: 'buy' | 'sell' | 'alert';
  onChange: (value: 'buy' | 'sell' | 'alert') => void;
}

function SignalCapsuleSelector({ value, onChange }: SignalCapsuleSelectorProps) {
  const options: { value: 'buy' | 'sell' | 'alert'; label: string }[] = [
    { value: 'buy', label: '买入' },
    { value: 'sell', label: '卖出' },
    { value: 'alert', label: '提醒' },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>
        信号类型
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const isActive = value === opt.value;
          const color = getSignalColor(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="px-2.5 py-1 text-[11px] font-bold rounded transition-all"
              style={{
                background: isActive ? color : 'hsl(var(--bg-root))',
                color: isActive ? '#ffffff' : 'hsl(var(--text-secondary))',
                border: `1px solid ${isActive ? color : 'hsl(var(--border-subtle))'}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Condition Editor
// ─────────────────────────────────────────────────────────

interface ConditionEditorProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  onDelete: () => void;
  isLast: boolean;
}

function ConditionEditor({ condition, onChange, onDelete, isLast }: ConditionEditorProps) {
  const handleParamChange = useCallback(
    (key: string, value: number | string) => {
      onChange({ ...condition, params: { ...condition.params, [key]: value } });
    },
    [condition, onChange],
  );

  return (
    <div className="relative rounded-lg p-3" style={{ background: 'hsl(var(--bg-root))', border: '1px solid hsl(var(--border-subtle))' }}>
      {/* Header row: index + type label + delete */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: 'hsl(var(--text-tertiary))' }}>
            {CONDITION_TYPE_LABELS[condition.type]}
          </span>
          <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
            {CONDITION_SUBTITLES[condition.type]}
          </span>
        </div>
        {!isLast && (
          <button
            onClick={onDelete}
            className="p-0.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'hsl(var(--text-tertiary))' }}
            title="删除此条件"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Parameter fields */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {CONDITION_PARAMS[condition.type].map((field) => {
          if (field.type === 'number') {
            return (
              <NumberStepper
                key={field.key}
                label={field.label}
                value={Number(condition.params[field.key] ?? field.defaultValue)}
                min={field.min ?? 1}
                max={field.max ?? 999}
                step={field.step ?? 1}
                onChange={(v) => handleParamChange(field.key, v)}
              />
            );
          }
          if (field.type === 'direction') {
            return (
              <DirectionToggle
                key={field.key}
                value={String(condition.params[field.key] ?? field.defaultValue)}
                conditionType={condition.type}
                onChange={(v) => handleParamChange(field.key, v)}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Condition Type Selector (inline dropdown)
// ─────────────────────────────────────────────────────────

interface ConditionTypeSelectorProps {
  onSelect: (type: RuleConditionType) => void;
  onCancel: () => void;
}

const CONDITION_TYPES: RuleConditionType[] = [
  'ma_cross',
  'rsi_threshold',
  'price_breakout',
  'volume_surge',
  'macd_signal',
];

function ConditionTypeSelector({ onSelect, onCancel }: ConditionTypeSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-lg p-3"
      style={{ background: 'hsl(var(--bg-root))', border: '1px solid hsl(var(--border-default))' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold" style={{ color: 'hsl(var(--text-secondary))' }}>
          选择条件类型
        </span>
        <button
          onClick={onCancel}
          className="p-0.5 rounded hover:opacity-70 transition-opacity"
          style={{ color: 'hsl(var(--text-tertiary))' }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {CONDITION_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="flex items-center gap-2 px-2.5 py-2 rounded text-left transition-colors hover:opacity-80"
            style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
                {CONDITION_TYPE_LABELS[type]}
              </span>
              <span className="text-[10px] leading-tight mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                {CONDITION_SUBTITLES[type]}
              </span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// EditableRuleCard (single expandable card)
// ─────────────────────────────────────────────────────────

interface EditableRuleCardProps {
  rule: TradingRule;
  onUpdate: (rule: TradingRule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

function EditableRuleCard({ rule, onUpdate, onDelete, onToggle }: EditableRuleCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Draft state for editing
  const [draftName, setDraftName] = useState(rule.name);
  const [draftSignal, setDraftSignal] = useState<'buy' | 'sell' | 'alert'>(rule.signal);
  const [draftConditions, setDraftConditions] = useState<RuleCondition[]>(rule.conditions);
  const [showConditionSelector, setShowConditionSelector] = useState(false);

  // Reset draft when entering edit mode
  const handleExpand = useCallback(() => {
    setDraftName(rule.name);
    setDraftSignal(rule.signal);
    setDraftConditions(rule.conditions.map((c) => ({ ...c, params: { ...c.params } })));
    setShowConditionSelector(false);
    setExpanded(true);
  }, [rule]);

  const handleCollapse = useCallback(() => {
    setExpanded(false);
    setShowConditionSelector(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!draftName.trim()) return;
    onUpdate({
      ...rule,
      name: draftName.trim(),
      signal: draftSignal,
      conditions: draftConditions,
    });
    setExpanded(false);
  }, [rule, draftName, draftSignal, draftConditions, onUpdate]);

  const handleCancel = useCallback(() => {
    setExpanded(false);
    setShowConditionSelector(false);
  }, []);

  const handleConditionChange = useCallback(
    (index: number, updated: RuleCondition) => {
      setDraftConditions((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const handleConditionDelete = useCallback(
    (index: number) => {
      setDraftConditions((prev) => prev.filter((_, i) => i !== index));
    },
    [],
  );

  const handleAddCondition = useCallback(
    (type: RuleConditionType) => {
      setDraftConditions((prev) => [...prev, createDefaultCondition(type)]);
      setShowConditionSelector(false);
    },
    [],
  );

  const signalColor = getSignalColor(rule.signal);
  const signalBg = getSignalBg(rule.signal);
  const signalLabel = getSignalLabel(rule.signal);

  // Condition summary for collapsed state
  const summaryParts = rule.conditions.map(conditionSummary);
  const summary = summaryParts.join(' · ');

  // ── Collapsed state ──
  if (!expanded) {
    return (
      <motion.div
        layout
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:opacity-85"
        style={{
          background: 'hsl(var(--bg-card))',
          border: '1px solid hsl(var(--border-subtle))',
          opacity: rule.enabled ? 1 : 0.55,
        }}
        onClick={handleExpand}
      >
        {/* Index circle */}
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[10px] font-bold text-white"
          style={{ backgroundColor: rule.color, opacity: rule.enabled ? 1 : 0.35 }}
        >
          {rule.markerIndex}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold truncate"
              style={{ color: rule.enabled ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))' }}
            >
              {rule.name}
            </span>
            {/* Signal badge */}
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: signalBg, color: signalColor }}
            >
              {signalLabel}
            </span>
          </div>
          {summary && (
            <p
              className="text-[10px] mt-0.5 truncate"
              style={{ color: 'hsl(var(--text-tertiary))' }}
            >
              {summary}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* ON/OFF toggle */}
          <button
            onClick={() => onToggle(rule.id)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
              rule.enabled ? 'text-white' : ''
            }`}
            style={{
              background: rule.enabled ? rule.color : 'hsl(var(--border-subtle))',
              color: rule.enabled ? '#ffffff' : 'hsl(var(--text-tertiary))',
            }}
          >
            {rule.enabled ? 'ON' : 'OFF'}
          </button>
          {/* Edit button */}
          <button
            className="p-1 rounded transition-colors hover:opacity-70"
            style={{ color: 'hsl(var(--text-tertiary))' }}
            title="编辑规则"
          >
            <ChevronDown size={13} />
          </button>
          {/* Delete button */}
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1 rounded transition-colors hover:opacity-70"
            style={{ color: 'hsl(var(--text-tertiary))' }}
            title="删除规则"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Expanded / Editing state ──
  const isValid = draftName.trim().length > 0 && draftConditions.length > 0;
  const hasChanges =
    draftName !== rule.name ||
    draftSignal !== rule.signal ||
    JSON.stringify(draftConditions) !== JSON.stringify(rule.conditions);

  return (
    <motion.div
      layout
      className="rounded-lg overflow-hidden"
      style={{
        background: 'hsl(var(--bg-card))',
        border: '1px solid hsl(var(--border-default))',
        borderLeft: `3px solid ${rule.color}`,
      }}
    >
      {/* ── Header (always visible) ── */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[10px] font-bold text-white"
            style={{ backgroundColor: rule.color }}
          >
            {rule.markerIndex}
          </span>
          <span className="text-[11px] font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>
            {draftName || '未命名规则'}
          </span>
        </div>
        <button
          onClick={handleCollapse}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors hover:opacity-70"
          style={{ color: 'hsl(var(--text-tertiary))', border: '1px solid hsl(var(--border-subtle))' }}
        >
          <ChevronUp size={12} /> 折叠
        </button>
      </div>

      {/* ── Edit body ── */}
      <div className="px-3 pb-3 space-y-3">
        {/* Rule name */}
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
            规则名称
          </label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="输入规则名称..."
            className="w-full px-2.5 py-1.5 text-[12px] font-bold bg-transparent outline-none rounded"
            style={{
              color: 'hsl(var(--text-primary))',
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-root))',
            }}
          />
        </div>

        {/* Signal type */}
        <SignalCapsuleSelector value={draftSignal} onChange={setDraftSignal} />

        {/* ── Conditions ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'hsl(var(--text-tertiary))' }}>
              条件 ({draftConditions.length})
            </span>
          </div>

          {draftConditions.length === 0 && (
            <p className="text-[10px] italic py-2" style={{ color: 'hsl(var(--text-tertiary))' }}>
              暂无条件，请添加至少一个条件
            </p>
          )}

          {draftConditions.map((cond, i) => (
            <ConditionEditor
              key={`${cond.type}_${i}`}
              condition={cond}
              isLast={draftConditions.length <= 1}
              onChange={(updated) => handleConditionChange(i, updated)}
              onDelete={() => handleConditionDelete(i)}
            />
          ))}

          {/* Add condition button / selector */}
          {showConditionSelector ? (
            <ConditionTypeSelector
              onSelect={handleAddCondition}
              onCancel={() => setShowConditionSelector(false)}
            />
          ) : (
            <button
              onClick={() => setShowConditionSelector(true)}
              className="flex items-center gap-1.5 px-3 py-2 w-full rounded-lg text-[11px] font-bold transition-colors hover:opacity-80"
              style={{
                background: 'hsl(var(--bg-root))',
                color: 'hsl(var(--accent))',
                border: '1px dashed hsl(var(--border-default))',
              }}
            >
              <Plus size={13} /> 添加条件
            </button>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={!isValid || !hasChanges}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 hover:opacity-85"
            style={{
              background: '#219653',
              color: '#ffffff',
            }}
          >
            <Save size={13} /> 保存修改
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-80"
            style={{
              background: 'hsl(var(--bg-root))',
              color: 'hsl(var(--text-secondary))',
              border: '1px solid hsl(var(--border-subtle))',
            }}
          >
            <X size={13} /> 取消
          </button>
          {!isValid && (
            <span className="text-[10px]" style={{ color: '#ef4444' }}>
              请填写名称并添加至少一个条件
            </span>
          )}
        </div>
      </div>

      {/* ── Unsaved warning (when has changes but collapsed) ── */}
      {hasChanges && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium"
          style={{ background: '#f59e0b15', color: '#f59e0b', borderTop: '1px solid #f59e0b30' }}
        >
          <AlertTriangle size={10} />
          有未保存的修改
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// StructuredRuleList (container - main export)
// ─────────────────────────────────────────────────────────

interface StructuredRuleListProps {
  /** Custom class name */
  className?: string;
  /** Callback when "AI 智能提炼" is clicked — opens the AI parse panel */
  onAiParse?: () => void;
}

function StructuredRuleList({ className = '', onAiParse }: StructuredRuleListProps) {
  const [rules, setRules] = useState<TradingRule[]>(loadRules);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // Close preset menu on outside click
  useEffect(() => {
    if (!showPresetMenu) return;
    const handler = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPresetMenu]);

  const persist = useCallback((updated: TradingRule[]) => {
    const withColors = updated.map((r, i) => ({
      ...r,
      markerIndex: r.markerIndex ?? i + 1,
      color: ruleColor(r.markerIndex ?? i),
    }));
    setRules(withColors);
    saveRules(withColors);
  }, []);

  const handleToggle = useCallback(
    (id: string) => {
      const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
      persist(updated);
    },
    [rules, persist],
  );

  const handleUpdate = useCallback(
    (updated: TradingRule) => {
      const updatedList = rules.map((r) => (r.id === updated.id ? updated : r));
      persist(updatedList);
    },
    [rules, persist],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const target = rules.find((r) => r.id === id);
      if (!target) return;
      if (!confirm(`确定要删除规则「${target.name}」？`)) return;
      const updated = rules.filter((r) => r.id !== id).map((r, i) => ({ ...r, markerIndex: i + 1 }));
      persist(updated);
    },
    [rules, persist],
  );

  const handleAddFromTemplate = useCallback(
    (template: TradingRule) => {
      const newRule: TradingRule = {
        ...template,
        id: generateId(),
        enabled: true,
        conditions: template.conditions.map((c) => ({ ...c, params: { ...c.params } })),
        markerIndex: rules.length + 1,
        color: ruleColor(rules.length),
        createdAt: new Date().toISOString(),
      };
      persist([...rules, newRule]);
      setShowPresetMenu(false);
    },
    [rules, persist],
  );

  const handleCreateManual = useCallback(() => {
    const newRule: TradingRule = {
      id: generateId(),
      name: '新建规则',
      conditions: [createDefaultCondition('ma_cross')],
      signal: 'buy',
      enabled: true,
      color: ruleColor(rules.length),
      markerIndex: rules.length + 1,
      createdAt: new Date().toISOString(),
    };
    persist([...rules, newRule]);
    setShowPresetMenu(false);
  }, [rules, persist]);

  const handleAiParse = useCallback(() => {
    if (onAiParse) {
      onAiParse();
    } else {
      // Fallback: dispatches a custom event that RulesPage listens for
      window.dispatchEvent(new CustomEvent('open-ai-parse'));
    }
    setShowPresetMenu(false);
  }, [onAiParse]);

  const enabledCount = rules.filter((r) => r.enabled).length;
  const allConditions = rules.flatMap((r) => r.conditions);
  const totalConditions = allConditions.length;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Summary bar */}
      {rules.length > 0 && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
            {enabledCount}/{rules.length} 已启用 · {totalConditions} 个条件
          </span>
          <button
            onClick={() => {
              const defaults = RULE_TEMPLATES.map((t, i) => ({
                ...t,
                enabled: false,
                markerIndex: i + 1,
                color: ruleColor(i),
              }));
              setRules(defaults);
              saveRules(defaults);
            }}
            className="text-[10px] font-medium hover:opacity-70 transition-opacity"
            style={{ color: 'hsl(var(--text-tertiary))' }}
          >
            重置默认
          </button>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 gap-3 rounded-lg"
          style={{ background: 'hsl(var(--bg-card))', border: '1px dashed hsl(var(--border-default))' }}
        >
          <p className="text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
            暂无K线标记规则
          </p>
          <button
            onClick={handleCreateManual}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85"
            style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--text-inverse))' }}
          >
            <Plus size={14} /> 创建第一条规则
          </button>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {rules.map((rule) => (
            <motion.div
              key={rule.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <EditableRuleCard
                rule={rule}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {/* ── Preset Menu (floating "+" button) ── */}
      <div className="relative" ref={presetMenuRef}>
        {/* "+" button */}
        <button
          onClick={() => setShowPresetMenu((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-2 w-full rounded-lg text-[11px] font-bold transition-colors hover:opacity-85"
          style={{
            background: showPresetMenu ? 'hsl(var(--bg-card))' : 'transparent',
            color: 'hsl(var(--accent))',
            border: `1px dashed ${showPresetMenu ? 'hsl(var(--border-default))' : 'hsl(var(--border-subtle))'}`,
          }}
        >
          <Plus size={14} /> 新建规则
        </button>

        {/* Dropdown menu */}
        <AnimatePresence>
          {showPresetMenu && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute bottom-full left-0 right-0 mb-1 rounded-lg overflow-hidden shadow-lg z-10"
              style={{
                background: 'hsl(var(--bg-card))',
                border: '1px solid hsl(var(--border-default))',
              }}
            >
              {/* Menu items */}
              <div className="p-1.5 space-y-0.5">
                {/* From template */}
                <div className="space-y-0.5">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded text-[11px] font-bold"
                    style={{ color: 'hsl(var(--text-secondary))' }}
                  >
                    从模板创建
                  </div>
                  <div className="space-y-0.5 pl-3">
                    {RULE_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleAddFromTemplate(template)}
                        className="flex items-center gap-2 px-3 py-1.5 w-full rounded transition-colors hover:opacity-80 text-left"
                        style={{ color: 'hsl(var(--text-primary))', background: 'hsl(var(--bg-root))' }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: template.color }}
                        />
                        <span className="text-[11px] font-medium truncate">{template.name}</span>
                        <span className="text-[10px] ml-auto shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>
                          {template.conditions.length}个条件
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid hsl(var(--border-subtle))' }} />

                {/* AI parse */}
                <button
                  onClick={handleAiParse}
                  className="flex items-center gap-2 px-3 py-2 w-full rounded text-[11px] font-bold transition-colors hover:opacity-80"
                  style={{ color: '#6366f1' }}
                >
                  AI 智能提炼
                </button>

                {/* Manual create */}
                <button
                  onClick={handleCreateManual}
                  className="flex items-center gap-2 px-3 py-2 w-full rounded text-[11px] font-bold transition-colors hover:opacity-80"
                  style={{ color: 'hsl(var(--text-secondary))' }}
                >
                  手动创建
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

export { EditableRuleCard, StructuredRuleList };
export default StructuredRuleList;
