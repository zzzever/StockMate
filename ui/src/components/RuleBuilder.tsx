import { useState, useCallback } from 'react';
import type {
  TradingRule,
  RuleCondition,
  IndicatorCondition,
  PriceCondition,
  VolumeCondition,
  CompositeCondition,
  RuleTemplate,
} from '@/types/tradingRule';
import { ALL_TEMPLATES, TEMPLATE_CATEGORIES } from '@/utils/ruleTemplates';

// ─── 颜色常量 ───
const COLORS = {
  buy: '#22c55e',
  sell: '#ef4444',
  alert: '#f59e0b',
  and: '#3b82f6',
  or: '#f59e0b',
  not: '#ef4444',
  indicator: '#6366f1',
  price: '#8b5cf6',
  volume: '#14b8a6',
  time: '#f97316',
};

const INDICATOR_OPTIONS = [
  { id: 'ma', label: '均线 MA', fields: ['ma5', 'ma10', 'ma20', 'ma60'] },
  { id: 'macd', label: 'MACD', fields: ['dif', 'dea', 'macd'] },
  { id: 'kdj', label: 'KDJ', fields: ['k', 'd', 'j'] },
  { id: 'rsi', label: 'RSI', fields: ['rsi'] },
  { id: 'boll', label: '布林带', fields: ['upper', 'middle', 'lower'] },
  { id: 'cci', label: 'CCI', fields: ['cci'] },
  { id: 'wr', label: 'WR', fields: ['wr6', 'wr10'] },
  { id: 'dmi', label: 'DMI', fields: ['pdi', 'mdi', 'adx', 'adxr'] },
  { id: 'sar', label: 'SAR', fields: ['sar'] },
  { id: 'atr', label: 'ATR', fields: ['atr'] },
  { id: 'obv', label: 'OBV', fields: ['obv'] },
];

const COMPARE_OPTIONS = [
  { id: 'cross_above', label: '上穿', symbol: '↗' },
  { id: 'cross_below', label: '下穿', symbol: '↘' },
  { id: 'above', label: '大于', symbol: '>' },
  { id: 'below', label: '小于', symbol: '<' },
  { id: 'equal', label: '等于', symbol: '=' },
];

// ─── 条件卡片组件 ───
function ConditionCard({
  condition,
  onChange,
  onRemove,
  color,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
  color: string;
}) {
  if (condition.type === 'composite') {
    const comp = condition as CompositeCondition;
    return (
      <div className="rounded-lg border p-3" style={{ borderColor: color + '40', background: color + '08' }}>
        <div className="flex items-center gap-2 mb-2">
          <select
            className="text-xs font-bold px-2 py-1 rounded"
            style={{ background: color + '20', color }}
            value={comp.logic}
            onChange={(e) => onChange({ ...comp, logic: e.target.value as 'and' | 'or' })}
          >
            <option value="and">AND (同时满足)</option>
            <option value="or">OR (任一满足)</option>
          </select>
          <button onClick={onRemove} className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto">✕</button>
        </div>
        <div className="space-y-2">
          {comp.conditions.map((c, i) => (
            <ConditionCard
              key={i}
              condition={c}
              onChange={(updated) => {
                const next = [...comp.conditions];
                next[i] = updated;
                onChange({ ...comp, conditions: next });
              }}
              onRemove={() => {
                const next = comp.conditions.filter((_, j) => j !== i);
                onChange({ ...comp, conditions: next });
              }}
              color={comp.logic === 'and' ? COLORS.and : COLORS.or}
            />
          ))}
          <button
            onClick={() => onChange({ ...comp, conditions: [...comp.conditions, { type: 'indicator', indicator: 'ma', field: 'ma5', compare: 'cross_above', refField: 'ma10' } as IndicatorCondition] })}
            className="text-xs text-zinc-400 hover:text-zinc-200 border border-dashed border-zinc-600 rounded px-2 py-1 w-full"
          >
            + 添加子条件
          </button>
        </div>
      </div>
    );
  }

  if (condition.type === 'indicator') {
    const ind = condition as IndicatorCondition;
    const indOpt = INDICATOR_OPTIONS.find(o => o.id === ind.indicator) || INDICATOR_OPTIONS[0];
    return (
      <div className="rounded-lg border p-3 flex flex-wrap items-center gap-2" style={{ borderColor: color + '40', background: color + '08' }}>
        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: COLORS.indicator + '20', color: COLORS.indicator }}>
          指标
        </span>
        <select
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          value={ind.indicator}
          onChange={(e) => onChange({ ...ind, indicator: e.target.value, field: INDICATOR_OPTIONS.find(o => o.id === e.target.value)?.fields[0] || '' })}
        >
          {INDICATOR_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          value={ind.field}
          onChange={(e) => onChange({ ...ind, field: e.target.value })}
        >
          {indOpt.fields.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          value={ind.compare}
          onChange={(e) => onChange({ ...ind, compare: e.target.value as IndicatorCondition['compare'] })}
        >
          {COMPARE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.symbol} {o.label}</option>)}
        </select>
        {(ind.compare === 'above' || ind.compare === 'below' || ind.compare === 'equal') ? (
          <input
            type="number"
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 w-16"
            value={ind.value ?? 0}
            onChange={(e) => onChange({ ...ind, value: Number(e.target.value) })}
          />
        ) : ind.compare === 'cross_above' || ind.compare === 'cross_below' ? (
          <select
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
            value={ind.refField || ''}
            onChange={(e) => onChange({ ...ind, refField: e.target.value })}
          >
            <option value="">选择参考线</option>
            {indOpt.fields.filter(f => f !== ind.field).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        ) : null}
        <button onClick={onRemove} className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto">✕</button>
      </div>
    );
  }

  if (condition.type === 'price') {
    const p = condition as PriceCondition;
    return (
      <div className="rounded-lg border p-3 flex flex-wrap items-center gap-2" style={{ borderColor: color + '40', background: color + '08' }}>
        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: COLORS.price + '20', color: COLORS.price }}>
          价格
        </span>
        <select
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          value={p.field}
          onChange={(e) => onChange({ ...p, field: e.target.value as PriceCondition['field'] })}
        >
          <option value="close">收盘价</option>
          <option value="open">开盘价</option>
          <option value="high">最高价</option>
          <option value="low">最低价</option>
        </select>
        <select
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          value={p.compare}
          onChange={(e) => onChange({ ...p, compare: e.target.value as PriceCondition['compare'] })}
        >
          {COMPARE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.symbol} {o.label}</option>)}
        </select>
        <button onClick={onRemove} className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto">✕</button>
      </div>
    );
  }

  if (condition.type === 'volume') {
    const v = condition as VolumeCondition;
    return (
      <div className="rounded-lg border p-3 flex flex-wrap items-center gap-2" style={{ borderColor: color + '40', background: color + '08' }}>
        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: COLORS.volume + '20', color: COLORS.volume }}>
          量能
        </span>
        <span className="text-xs text-zinc-400">成交量</span>
        <select
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
          value={v.compare}
          onChange={(e) => onChange({ ...v, compare: e.target.value as VolumeCondition['compare'] })}
        >
          {COMPARE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.symbol} {o.label}</option>)}
        </select>
        <span className="text-xs text-zinc-400">MA{v.maPeriod || 5} ×</span>
        <input
          type="number"
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 w-16"
          value={v.value ?? 1}
          step={0.1}
          onChange={(e) => onChange({ ...v, value: Number(e.target.value) })}
        />
        <button onClick={onRemove} className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto">✕</button>
      </div>
    );
  }

  return null;
}

// ─── 主组件 ───
interface RuleBuilderProps {
  onSave: (rule: TradingRule) => void;
  initialRule?: TradingRule;
}

export default function RuleBuilder({ onSave, initialRule }: RuleBuilderProps) {
  const [name, setName] = useState(initialRule?.name || '');
  const [description, setDescription] = useState(initialRule?.description || '');
  const [buyCondition, setBuyCondition] = useState<RuleCondition>(
    initialRule?.buyCondition || { type: 'indicator', indicator: 'ma', field: 'ma5', compare: 'cross_above', refField: 'ma10' }
  );
  const [sellCondition, setSellCondition] = useState<RuleCondition>(
    initialRule?.sellCondition || { type: 'indicator', indicator: 'ma', field: 'ma5', compare: 'cross_below', refField: 'ma10' }
  );
  const [stopLossPct, setStopLossPct] = useState(initialRule?.stopLoss.value ?? 8);
  const [takeProfitPct, setTakeProfitPct] = useState(initialRule?.takeProfit.value ?? 15);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('beginner');

  const handleApplyTemplate = useCallback((template: RuleTemplate) => {
    setName(template.rule.name);
    setDescription(template.rule.description || '');
    setBuyCondition(template.rule.buyCondition);
    setSellCondition(template.rule.sellCondition);
    setStopLossPct(template.rule.stopLoss.value ?? 8);
    setTakeProfitPct(template.rule.takeProfit.value ?? 15);
    setShowTemplates(false);
  }, []);

  const handleSave = useCallback(() => {
    const rule: TradingRule = {
      id: initialRule?.id || `rule_${Date.now()}`,
      name,
      description,
      category: '自定义',
      tags: [],
      enabled: true,
      buyCondition,
      sellCondition,
      buyAction: { type: 'buy', label: '买入', color: COLORS.buy },
      sellAction: { type: 'sell', label: '卖出', color: COLORS.sell },
      stopLoss: { enabled: true, type: 'fixed', value: stopLossPct },
      takeProfit: { enabled: true, type: 'fixed', value: takeProfitPct },
      timeframe: 'day',
      createdAt: initialRule?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: (initialRule?.version || 0) + 1,
    };
    onSave(rule);
  }, [name, description, buyCondition, sellCondition, stopLossPct, takeProfitPct, initialRule, onSave]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-100">📋 交易规则构建器</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          >
            📚 模板
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-bold"
          >
            💾 保存规则
          </button>
        </div>
      </div>

      {/* Template Picker */}
      {showTemplates && (
        <div className="border-b border-zinc-800 bg-zinc-900/50 p-3">
          <div className="flex gap-2 mb-3">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-lg ${activeCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_TEMPLATES.filter(t => t.category === activeCategory).map(t => (
              <button
                key={t.id}
                onClick={() => handleApplyTemplate(t)}
                className="text-left p-3 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-indigo-500 hover:bg-zinc-750 transition-colors"
              >
                <div className="text-xs font-bold text-zinc-100">{t.name}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{t.description}</div>
                <div className="flex gap-1 mt-2">
                  {t.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{tag}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rule Info */}
      <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
        <input
          type="text"
          placeholder="规则名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500"
        />
        <input
          type="text"
          placeholder="规则描述（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-300 placeholder-zinc-500"
        />
      </div>

      {/* Conditions */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Buy Condition */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: COLORS.buy + '20', color: COLORS.buy }}>
              🟢 买入条件
            </span>
            <span className="text-[10px] text-zinc-500">满足以下条件时触发买入信号</span>
          </div>
          <ConditionCard
            condition={buyCondition}
            onChange={setBuyCondition}
            onRemove={() => setBuyCondition({ type: 'indicator', indicator: 'ma', field: 'ma5', compare: 'cross_above', refField: 'ma10' })}
            color={COLORS.buy}
          />
        </div>

        {/* Sell Condition */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: COLORS.sell + '20', color: COLORS.sell }}>
              🔴 卖出条件
            </span>
            <span className="text-[10px] text-zinc-500">满足以下条件时触发卖出信号</span>
          </div>
          <ConditionCard
            condition={sellCondition}
            onChange={setSellCondition}
            onRemove={() => setSellCondition({ type: 'indicator', indicator: 'ma', field: 'ma5', compare: 'cross_below', refField: 'ma10' })}
            color={COLORS.sell}
          />
        </div>

        {/* Risk Management */}
        <div className="rounded-lg border border-zinc-800 p-3">
          <div className="text-xs font-bold text-zinc-300 mb-2">⚡ 风险管理</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500">止损 (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={stopLossPct}
                  onChange={(e) => setStopLossPct(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-red-400 font-mono w-8 text-right">{stopLossPct}%</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500">止盈 (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={takeProfitPct}
                  onChange={(e) => setTakeProfitPct(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-green-400 font-mono w-8 text-right">{takeProfitPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
