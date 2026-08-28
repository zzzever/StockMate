import { useState, useCallback } from 'react';
import type { TradingRule } from '@/types';
import { RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';

// ─── 存储 Key ───
const STORAGE_KEY = 'stockmate_trading_rules_v2';

// ─── 从 localStorage 加载 ───
function loadRules(): TradingRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded: TradingRule[] = JSON.parse(raw);
      return loaded.map((r: any, i: number) => ({
        ...r,
        markerIndex: r.markerIndex || i + 1,
        color: r.color || ruleColor(r.markerIndex || i),
      }));
    }
    return RULE_TEMPLATES;
  } catch {
    return RULE_TEMPLATES;
  }
}

// ─── 保存到 localStorage ───
function saveRules(rules: TradingRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  window.dispatchEvent(new Event('stockmate:rules-changed'));
}

// ─── 快速模板（从 RULE_TEMPLATES 中筛选典型代表） ───
const QUICK_TEMPLATES = RULE_TEMPLATES.filter(t =>
  ['tpl_ma_golden', 'tpl_macd_golden', 'tpl_rsi_oversold', 'tpl_bb_rebound'].includes(t.id)
);

// ─── 规则分类 ───
const CATEGORIES = [
  { id: 'all', label: '全部' },
  { id: '均线', label: '均线' },
  { id: 'MACD', label: 'MACD' },
  { id: 'RSI', label: 'RSI' },
  { id: '布林带', label: '布林带' },
  { id: '量价', label: '量价' },
  { id: '形态', label: '形态' },
  { id: '自定义', label: '自定义' },
];

function getRuleCategory(rule: TradingRule): string {
  if (rule.id.startsWith('tpl_ma')) return '均线';
  if (rule.id.startsWith('tpl_macd')) return 'MACD';
  if (rule.id.startsWith('tpl_rsi')) return 'RSI';
  if (rule.id.startsWith('tpl_bb')) return '布林带';
  if (rule.id.startsWith('tpl_break') || rule.id.startsWith('tpl_volume') || rule.id.startsWith('tpl_green') || rule.id.startsWith('tpl_red')) return '量价';
  if (rule.id.startsWith('tpl_morning') || rule.id.startsWith('tpl_evening') || rule.id.startsWith('tpl_three')) return '形态';
  return '自定义';
}

// ─── 规则列表面板 ───
export default function RuleListPanel({ onApplyRule }: { onApplyRule?: (rule: TradingRule) => void }) {
  const [rules, setRules] = useState<TradingRule[]>(loadRules);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCode, setNewRuleCode] = useState('');
  const [newRuleSignal, setNewRuleSignal] = useState<'buy' | 'sell'>('buy');

  const handleToggle = useCallback((id: string) => {
    setRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
      saveRules(next);
      return next;
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== id);
      saveRules(next);
      return next;
    });
  }, []);

  const handleDuplicate = useCallback((rule: TradingRule) => {
    const dup: TradingRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      name: rule.name + ' (副本)',
      enabled: false,
      markerIndex: rules.length + 1,
      color: ruleColor(rules.length + 1),
      createdAt: new Date().toISOString(),
    };
    setRules(prev => {
      const next = [...prev, dup];
      saveRules(next);
      return next;
    });
  }, [rules.length]);

  const handleAddFromTemplate = useCallback((template: TradingRule) => {
    const newRule: TradingRule = {
      ...template,
      id: `rule_${Date.now()}`,
      enabled: true,
      markerIndex: rules.length + 1,
      color: ruleColor(rules.length + 1),
      createdAt: new Date().toISOString(),
    };
    setRules(prev => {
      const next = [...prev, newRule];
      saveRules(next);
      return next;
    });
  }, [rules.length]);

  const handleAddCustom = useCallback(() => {
    if (!newRuleName.trim()) return;
    const newRule: TradingRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim(),
      kind: 'code',
      code: newRuleCode.trim(),
      signal: newRuleSignal,
      conditions: [],
      enabled: true,
      markerIndex: rules.length + 1,
      color: ruleColor(rules.length + 1),
      createdAt: new Date().toISOString(),
      explanation: newRuleName.trim(),
    };
    setRules(prev => {
      const next = [...prev, newRule];
      saveRules(next);
      return next;
    });
    setNewRuleName('');
    setNewRuleCode('');
    setShowAddForm(false);
  }, [newRuleName, newRuleCode, newRuleSignal, rules.length]);

  const filteredRules = activeCategory === 'all' ? rules : rules.filter(r => getRuleCategory(r) === activeCategory);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-100">📋 交易规则 ({rules.length})</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-bold"
          >
            + 新建
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 space-y-2">
          <input
            type="text"
            placeholder="规则名称"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-100"
          />
          <textarea
            placeholder="SSLang 代码 (如: cross(sma(5,i), sma(10,i)))"
            value={newRuleCode}
            onChange={(e) => setNewRuleCode(e.target.value)}
            className="w-full text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-300 font-mono h-16 resize-none"
          />
          <div className="flex gap-2">
            <select
              value={newRuleSignal}
              onChange={(e) => setNewRuleSignal(e.target.value as 'buy' | 'sell')}
              className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1"
            >
              <option value="buy">买入信号</option>
              <option value="sell">卖出信号</option>
            </select>
            <button
              onClick={handleAddCustom}
              disabled={!newRuleName.trim()}
              className="text-[10px] px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              添加
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-[10px] px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`text-[10px] px-2 py-1 rounded whitespace-nowrap ${activeCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Quick Templates */}
      <div className="px-4 py-2 border-b border-zinc-800">
        <div className="text-[10px] text-zinc-500 mb-1">快速启用模板：</div>
        <div className="flex gap-1 flex-wrap">
          {QUICK_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => handleAddFromTemplate(t)}
              className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700"
            >
              + {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Rule List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {filteredRules.length === 0 ? (
          <div className="text-center text-zinc-500 text-xs py-8">
            <div className="text-2xl mb-2">📭</div>
            <div>暂无交易规则</div>
          </div>
        ) : (
          filteredRules.map(rule => (
            <div
              key={rule.id}
              className={`rounded-lg border p-2.5 transition-colors ${rule.enabled ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-900/20 opacity-60'}`}
            >
              <div className="flex items-center gap-2">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(rule.id)}
                  className={`w-7 h-3.5 rounded-full transition-colors shrink-0 ${rule.enabled ? 'bg-green-600' : 'bg-zinc-700'}`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full bg-white transform transition-transform ${rule.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </button>

                {/* Color dot */}
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: rule.color }} />

                {/* Name & signal */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-zinc-100 truncate block">{rule.name}</span>
                  {rule.explanation && (
                    <span className="text-[9px] text-zinc-500 truncate block">{rule.explanation}</span>
                  )}
                </div>

                {/* Signal badge */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                  rule.signal === 'buy' ? 'bg-green-900/30 text-green-400' :
                  rule.signal === 'sell' ? 'bg-red-900/30 text-red-400' :
                  'bg-yellow-900/30 text-yellow-400'
                }`}>
                  {rule.signal === 'buy' ? '🟢 买' : rule.signal === 'sell' ? '🔴 卖' : '🟡 关注'}
                </span>

                {/* Actions */}
                <div className="flex gap-0.5 shrink-0">
                  {onApplyRule && (
                    <button
                      onClick={() => onApplyRule(rule)}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      应用
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(rule)}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  >
                    复制
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-red-400 hover:bg-red-900/30"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
