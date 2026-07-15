import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';
import type { TradingRule } from '@/types';
import { validateStrategyCode } from '@/utils/strategyRuntime';
import InlineAiParsePanel from '@/components/InlineAiParsePanel';
import CodeViewerModal from '@/components/CodeViewerModal';
import SSLangEditor from '@/components/SSLangEditor';
import { ruleSignalLabel } from '@/lib/signalLabels';
import { backtestRule, type RuleBacktest } from '@/utils/ruleBacktest';
import { useAppStore } from '@/store/useAppStore';
import { useStockHistory } from '@/hooks/useTauriQuery';
import { Code, FileCode, Plus, X, Check, Pencil } from 'lucide-react';

const STORAGE_KEY_RULES = 'stockmate_trading_rules_v2';

function loadRules(): TradingRule[] {
  try { const raw = localStorage.getItem(STORAGE_KEY_RULES); if (raw) { const parsed = JSON.parse(raw); return parsed.map((r: any, i: number) => ({ ...r, markerIndex: r.markerIndex ?? i + 1, color: ruleColor(r.markerIndex ?? i) })); } return RULE_TEMPLATES; } catch (e) { console.warn('Failed to load rules:', e); return RULE_TEMPLATES; }
}
function saveRules(rules: TradingRule[]) { try { localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules)); window.dispatchEvent(new Event('stockmate:rules-changed')); } catch (e) { console.warn('Failed to save rules:', e); } }

/** Status indicator for a rule based on code validity and backtest results. */
function getRuleStatus(rule: TradingRule, stat?: RuleBacktest): { icon: string; label: string; color: string } {
  if (!rule.code || rule.code.trim() === '') {
    return { icon: '✗', label: '代码为空', color: 'hsl(var(--risk-danger))' };
  }
  try {
    const result = validateStrategyCode(rule.code);
    if (!result.valid) {
      return { icon: '✗', label: '语法错误: ' + (result.error || ''), color: 'hsl(var(--risk-danger))' };
    }
    // Use backtest stats to differentiate 就绪/无信号
    if (stat) {
      if (stat.signals > 0) {
        return { icon: '◎', label: '就绪 · 命中 ' + stat.signals, color: 'hsl(var(--price-up))' };
      }
      return { icon: '○', label: '无信号', color: 'hsl(var(--text-tertiary))' };
    }
    return { icon: '◎', label: '就绪', color: 'hsl(var(--price-up))' };
  } catch {
    return { icon: '⚠', label: '校验异常', color: 'hsl(var(--risk-warning))' };
  }
}

/** Compact per-rule backtest badge: hit count + win-rate, with a low-sample warning. */
function BacktestBadge({ stat }: { stat: RuleBacktest | undefined }) {
  if (!stat) return null;
  if (stat.sample === 0 && stat.signals === 0) return null;
  if (stat.signals === 0) return <span className="text-[10px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>命中 0</span>;
  const low = stat.sample < 20;
  const wr = stat.winRate != null ? `${(stat.winRate * 100).toFixed(0)}%` : '--';
  return (
    <span className="text-[10px] shrink-0 font-mono-nums" style={{ color: 'hsl(var(--text-tertiary))' }}
      title={`历史命中 ${stat.signals} 次 · ${stat.horizon}日后同向胜率 ${wr}（样本 ${stat.sample}）${low ? ' · 样本不足20，统计意义有限，仅供参考' : ''}`}>
      命中 {stat.signals} · 胜率 {wr}{low ? ' ⚠' : ''}
    </span>
  );
}

// ── Inline Code Editor Modal ──
function CodeRuleEditor({ rule, onSave, onClose }: {
  rule: { name: string; code: string; signal: string; explanation?: string; direction?: string; sellCode?: string } | null;
  onSave: (name: string, code: string, signal: 'buy' | 'sell' | 'alert', explanation: string, direction: string, codeSell?: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? '');
  const [code, setCode] = useState(rule?.code ?? '');
  const [codeSell, setCodeSell] = useState(rule?.sellCode ?? '');
  const [signal, setSignal] = useState<'buy' | 'sell' | 'alert'>((rule?.signal as any) ?? 'buy');
  const [explanation, setExplanation] = useState(rule?.explanation ?? '');
  const [direction, setLocalDirection] = useState(rule?.direction ?? 'buy');
  const [validBuy, setValidBuy] = useState(true);
  const [validSell, setValidSell] = useState(true);

  const handleSave = () => {
    if (!name.trim() || !code.trim()) return;
    if (direction === 'both' && !codeSell.trim()) return;
    onSave(name.trim(), code, signal, explanation.trim(), direction, direction === 'both' ? codeSell.trim() : undefined);
  };

  return (
    <div
      className="rounded-lg overflow-hidden border mb-4"
      style={{ borderColor: 'hsl(var(--border-default))', background: 'hsl(var(--bg-card))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
        <div className="flex items-center gap-2">
          <FileCode size={14} style={{ color: 'hsl(var(--swiss-accent))' }} />
          <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>
            {rule ? '编辑代码规则' : '新建代码规则'}
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: 'hsl(var(--text-tertiary))' }}>
          <X size={14} />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>规则名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入规则名称..."
              className="w-full px-3 py-1.5 text-sm rounded border outline-none"
              style={{ background: 'hsl(var(--bg-canvas))', borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>信号类型</label>
            <select
              value={signal}
              onChange={(e) => setSignal(e.target.value as any)}
              className="px-3 py-1.5 text-sm rounded border outline-none"
              style={{ background: 'hsl(var(--bg-canvas))', borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
            >
              <option value="buy">看多 (BUY)</option>
              <option value="sell">看空 (SELL)</option>
              <option value="alert">关注 (ALERT)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>方向</label>
            <select value={direction} onChange={e => setLocalDirection(e.target.value)}
              className="px-3 py-1.5 text-sm rounded border outline-none"
              style={{ background: 'hsl(var(--bg-canvas))', borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}>
              <option value="buy">仅买入</option>
              <option value="sell">仅卖出</option>
              <option value="both">买入+卖出</option>
              <option value="alert">关注</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>{direction === 'both' ? '买入条件（SSLang 代码）' : 'SSLang 代码'}</label>
          <SSLangEditor
            value={code}
            onChange={setCode}
            onValidate={setValidBuy}
            minHeight="180px"
            maxHeight="350px"
          />
        </div>

        {direction === 'both' && (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>卖出条件（SSLang 代码）</label>
          <SSLangEditor
            value={codeSell}
            onChange={setCodeSell}
            onValidate={setValidSell}
            minHeight="180px"
            maxHeight="350px"
          />
        </div>
        )}

        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>策略说明（可选）</label>
          <input
            type="text"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="用自然语言描述策略逻辑..."
            className="w-full px-3 py-1.5 text-sm rounded border outline-none"
            style={{ background: 'hsl(var(--bg-canvas))', borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border transition-colors"
            style={{ borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-secondary))' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !code.trim() || !validBuy || (direction === 'both' && (!codeSell.trim() || !validSell))}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border transition-colors disabled:opacity-40"
            style={{ borderColor: 'hsl(var(--price-up) / 0.3)', color: 'hsl(var(--price-up))' }}
          >
            <Check size={12} />
            保存规则
          </button>
        </div>
      </div>
    </div>
  );
}

// ── K线标记规则列表 (with edit/delete/toggle/batch/backtest) ──
function RuleList({ onViewCode, onEditRule, bars, statStockName }: {
  onViewCode: (r: TradingRule) => void;
  onEditRule: (r: TradingRule) => void;
  bars: any[]; statStockName?: string;
}) {
  const [rules, setRules] = useState<TradingRule[]>(loadRules);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  // Reload when rules change elsewhere (AI panel import, other tabs)
  useEffect(() => {
    const sync = () => setRules(loadRules());
    window.addEventListener('stockmate:rules-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('stockmate:rules-changed', sync); window.removeEventListener('storage', sync); };
  }, []);

  const stats = useMemo(() => { const m = new Map<string, RuleBacktest>(); if (bars?.length) for (const r of rules) m.set(r.id, backtestRule(r, bars)); return m; }, [rules, bars]);

  const filteredRules = useMemo(() => {
    if (statusFilter === 'all') return rules;
    return rules.filter(r => {
      const s = getRuleStatus(r, stats.get(r.id));
      if (statusFilter === 'ready') return s.icon === '◎';
      if (statusFilter === 'no-signal') return s.icon === '○';
      if (statusFilter === 'unusable') return s.icon === '✗';
      if (statusFilter === 'warning') return s.icon === '⚠';
      return true;
    });
  }, [rules, stats, statusFilter]);

  const persist = useCallback((updated: TradingRule[]) => { setRules(updated); saveRules(updated); }, []);
  const toggleRule = useCallback((id: string) => persist(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)), [rules, persist]);
  const deleteRule = useCallback((id: string) => { if (!confirm('确认删除此规则?')) return; persist(rules.filter(r => r.id !== id).map((r, i) => ({ ...r, markerIndex: i + 1, color: ruleColor(i + 1) }))); }, [rules, persist]);
  const resetDefaults = useCallback(() => { if (!confirm('将删除所有自定义规则并恢复为预设规则，确认？')) return; persist(RULE_TEMPLATES); }, [persist]);

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const batchSet = (enabled: boolean) => persist(rules.map(r => selected.has(r.id) ? { ...r, enabled } : r));
  const batchDelete = () => { if (!selected.size || !confirm(`确认删除选中的 ${selected.size} 条规则?`)) return; persist(rules.filter(r => !selected.has(r.id)).map((r, i) => ({ ...r, markerIndex: i + 1, color: ruleColor(i + 1) }))); setSelected(new Set()); };

  const exportRules = () => {
    try {
      const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'stockmate-rules.json'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.warn('[RulesPage] export failed:', e); }
  };
  const importRules = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) { alert('文件格式不正确：应为规则数组'); return; }
        const valid = parsed.filter((r: any) => r && typeof r.name === 'string' && (Array.isArray(r.conditions) || typeof r.code === 'string'));
        if (!valid.length) { alert('未在文件中找到有效规则'); return; }
        const base = rules.length;
        const imported: TradingRule[] = valid.map((r: any, i: number) => ({ ...r, id: 'imp_' + Date.now().toString(36) + '_' + i, enabled: r.enabled ?? true, markerIndex: base + i + 1, color: ruleColor(base + i + 1), createdAt: r.createdAt || new Date().toISOString() }));
        persist([...rules, ...imported]);
        alert(`已导入 ${imported.length} 条规则`);
      } catch (e) { console.warn('[RulesPage] import failed:', e); alert('导入失败：无法解析 JSON'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {rules.filter(r => r.enabled).length}/{rules.length} 已启用{statStockName ? ` · 命中率基于「${statStockName}」历史` : ''}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { setBatchMode(!batchMode); setSelected(new Set()); }} className="text-[11px] font-medium" style={{ color: batchMode ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))' }}>{batchMode ? '退出批量' : '批量'}</button>
          <button onClick={exportRules} className="text-[11px] font-medium" style={{ color: 'hsl(var(--text-tertiary))' }}>导出</button>
          <button onClick={() => fileRef.current?.click()} className="text-[11px] font-medium" style={{ color: 'hsl(var(--text-tertiary))' }}>导入</button>
          <button onClick={resetDefaults} className="text-[11px] font-medium" style={{ color: 'hsl(var(--text-tertiary))' }}>重置默认</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importRules(f); e.target.value = ''; }} />
        </div>
      </div>

      {/* Status filter bar */}
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        {[
          { key: 'all', label: '全部', color: 'hsl(var(--text-secondary))' },
          { key: 'ready', label: '◎ 就绪', color: 'hsl(var(--price-up))' },
          { key: 'no-signal', label: '○ 无信号', color: 'hsl(var(--text-tertiary))' },
          { key: 'warning', label: '⚠ 需检查', color: 'hsl(var(--risk-warning))' },
          { key: 'unusable', label: '✗ 不可用', color: 'hsl(var(--risk-danger))' },
        ].map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="px-2 py-1 text-[10px] font-medium rounded transition-colors"
            style={{
              color: statusFilter === f.key ? f.color : 'hsl(var(--text-tertiary))',
              background: statusFilter === f.key ? 'hsl(var(--bg-card))' : 'transparent',
              border: '1px solid',
              borderColor: statusFilter === f.key ? 'hsl(var(--border-default))' : 'transparent',
            }}>
            {f.label}
          </button>
        ))}
        <span className="text-[10px] ml-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {filteredRules.length}/{rules.length} 条
        </span>
      </div>

      {batchMode && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-bold" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>
          <span style={{ color: 'hsl(var(--text-tertiary))' }}>已选 {selected.size}</span>
          <button onClick={() => setSelected(new Set(filteredRules.map(r => r.id)))} style={{ color: 'hsl(var(--text-secondary))' }}>全选</button>
          <button onClick={() => batchSet(true)} style={{ color: 'hsl(var(--price-up))' }}>批量启用</button>
          <button onClick={() => batchSet(false)} style={{ color: 'hsl(var(--text-tertiary))' }}>批量禁用</button>
          <button onClick={batchDelete} className="ml-auto" style={{ color: 'hsl(var(--price-down))' }}>删除选中</button>
        </div>
      )}

      {filteredRules.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {statusFilter === 'all' ? '暂无规则，请从下方模板添加或用 AI 提炼' : '没有符合当前筛选条件的规则'}
        </div>
      ) : (
        filteredRules.map(rule => {
          const status = getRuleStatus(rule, stats.get(rule.id));
          return (
          <div key={rule.id} className="flex items-center justify-between py-2 px-2 rounded" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>
            <div className="flex items-center gap-2 min-w-0">
              {batchMode && (
                <input type="checkbox" checked={selected.has(rule.id)} onChange={() => toggleSelect(rule.id)} className="shrink-0" aria-label={`选择 ${rule.name}`} />
              )}
              <span className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: rule.color, opacity: rule.enabled ? 1 : 0.35 }}>{rule.markerIndex}</span>
              <span className="text-[11px] shrink-0" title={status.label} style={{ color: status.color }}>{status.icon}</span>
              <span className="text-[11px] font-bold truncate" style={{ color: rule.enabled ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))' }}>{rule.name}</span>
              {rule.direction && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm ml-2" style={{
                  background: rule.direction === 'sell' ? 'hsl(var(--price-down-bg))' : rule.direction === 'both' ? 'hsl(var(--swiss-accent-ghost))' : rule.direction === 'alert' ? 'hsl(var(--risk-warning) / 0.15)' : 'hsl(var(--price-up-bg))',
                  color: rule.direction === 'sell' ? 'hsl(var(--price-down))' : rule.direction === 'both' ? 'hsl(var(--swiss-accent))' : rule.direction === 'alert' ? 'hsl(var(--risk-warning))' : 'hsl(var(--price-up))',
                }}>
                  {rule.direction === 'sell' ? 'SELL' : rule.direction === 'both' ? 'BOTH' : rule.direction === 'alert' ? 'ALERT' : 'BUY'}
                </span>
              )}
              {rule.kind === 'code' && (
                <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'hsl(var(--text-tertiary) / 0.15)', color: 'hsl(var(--text-tertiary))' }}>code</span>
              )}
              <span className="text-[10px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{ruleSignalLabel(rule.signal)}</span>
              <BacktestBadge stat={stats.get(rule.id)} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onEditRule(rule)} disabled={!rule.code}
                className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:opacity-70"
                style={{ color: rule.code ? 'hsl(var(--text-tertiary))' : 'hsl(var(--border-subtle))', border: '1px solid hsl(var(--border-subtle))' }}
                title={rule.code ? '编辑代码' : '此规则无可编辑的代码'}>
                <Pencil size={10} className="inline mr-0.5" />编辑
              </button>
              <button onClick={() => onViewCode(rule)} disabled={!rule.code}
                className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:opacity-70"
                style={{ color: rule.code ? 'hsl(var(--text-tertiary))' : 'hsl(var(--border-subtle))', border: '1px solid hsl(var(--border-subtle))' }}
                title={rule.code ? '查看代码' : '此规则无可查看的代码'}>&lt;/&gt;</button>
              <button onClick={() => toggleRule(rule.id)}
                className="px-2 py-0.5 text-[10px] font-bold rounded transition-colors hover:brightness-110"
                style={{ backgroundColor: rule.enabled ? rule.color : 'hsl(var(--border-subtle))', color: rule.enabled ? 'white' : 'hsl(var(--text-tertiary))' }}>
                {rule.enabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => deleteRule(rule.id)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded hover:opacity-70" style={{ color: 'hsl(var(--text-tertiary))' }} title="删除">✕</button>
            </div>
          </div>
          );
        })
      )}
    </div>
  );
}

// ── Template category groups ──
const TEMPLATE_GROUPS = [
  { name: '均线系统', icon: '📈', ids: ['tpl_ma_golden', 'tpl_ma_death', 'tpl_ma_bullish', 'tpl_ma_bearish', 'tpl_ma_squeeze'] },
  { name: 'MACD', icon: '📊', ids: ['tpl_macd_golden', 'tpl_macd_zero_cross', 'tpl_macd_bull_div', 'tpl_macd_bear_div'] },
  { name: 'RSI', icon: '🎯', ids: ['tpl_rsi_oversold', 'tpl_rsi_overbought', 'tpl_rsi_divergence'] },
  { name: '布林带', icon: '📉', ids: ['tpl_bb_rebound', 'tpl_bb_resistance', 'tpl_bb_squeeze'] },
  { name: 'K线形态', icon: '🕯️', ids: ['tpl_morning_star', 'tpl_evening_star', 'tpl_three_soldiers'] },
  { name: '量价关系', icon: '💰', ids: ['tpl_breakout', 'tpl_volume_pullback', 'tpl_volume_climax'] },
  { name: '多周期', icon: '🔄', ids: ['tpl_weekly_macd_daily_vol', 'tpl_monthly_up_daily_dip'] },
];

// ── Main Page ──
export default function RulesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiParseAutoOpen, setAiParseAutoOpen] = useState(false);
  const [viewingCodeRule, setViewingCodeRule] = useState<TradingRule | null>(null);
  const [editingRule, setEditingRule] = useState<TradingRule | null>(null);
  const [showNewCodeRule, setShowNewCodeRule] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('均线系统');
  const selectedStock = useAppStore(s => s.selectedStock);
  const { data: history } = useStockHistory(selectedStock?.code || '', 250, 'day');
  const bars = useMemo(() => history ?? [], [history]);

  const handleRulesAdded = useCallback(() => { setRefreshKey(k => k + 1); setAiParseAutoOpen(false); }, []);

  // Auto-detect direction from SSLang code
  const detectDirection = useCallback((code: string, userDirection: string | undefined): 'buy' | 'sell' | 'both' => {
    if (!code) return 'buy';
    const hasBuy = /SIGNAL\s+BUY/i.test(code);
    const hasSell = /SIGNAL\s+SELL/i.test(code);
    if (hasBuy && hasSell) return 'both';
    if (hasSell) return 'sell';
    if (hasBuy) return 'buy';
    // Fall back to user-provided direction
    return (userDirection as 'buy' | 'sell' | 'both') || 'buy';
  }, []);

  // Save a new or edited code rule
  const handleSaveCodeRule = useCallback((name: string, code: string, signal: 'buy' | 'sell' | 'alert', explanation: string, direction: string, codeSell?: string) => {
    const existing = loadRules();
    const autoDirection = detectDirection(code, direction) as 'buy' | 'sell' | 'both' | 'alert';
    if (editingRule) {
      // Update existing
      const updated = existing.map(r =>
        r.id === editingRule.id
          ? { ...r, name, code, signal, explanation, kind: 'code' as const, direction: direction as any, sellCode: direction === 'both' ? codeSell : undefined }
          : r
      );
      saveRules(updated);
    } else {
      // Create new
      const maxIdx = existing.reduce((max: number, r: TradingRule) => Math.max(max, r.markerIndex ?? 0), 0);
      const newRule: TradingRule = {
        id: 'code_' + Date.now().toString(36),
        name,
        code,
        signal,
        explanation,
        kind: 'code',
        direction: direction as 'buy' | 'sell' | 'both' | 'alert',
        sellCode: direction === 'both' ? codeSell : undefined,
        conditions: [],
        enabled: true,
        color: ruleColor(maxIdx + 1),
        markerIndex: maxIdx + 1,
        createdAt: new Date().toISOString(),
      };
      saveRules([...existing, newRule]);
    }
    setEditingRule(null);
    setShowNewCodeRule(false);
    setRefreshKey(k => k + 1);
  }, [editingRule, detectDirection]);

  const handleEditRule = useCallback((rule: TradingRule) => {
    if (rule.code) {
      setEditingRule(rule);
      setShowNewCodeRule(true);
    }
  }, []);

  return (
    <div
      className="flex flex-col h-full pt-6 px-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gradient" style={{ color: 'hsl(var(--text-primary))' }}>交易规则</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowNewCodeRule(true); setEditingRule(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded border transition-colors"
            style={{ color: 'hsl(var(--text-primary))', borderColor: 'hsl(var(--border-default))' }}>
            <Code size={12} />
            新建代码规则
          </button>
          <button onClick={() => setAiParseAutoOpen(!aiParseAutoOpen)}
            className="px-3 py-1.5 text-[11px] font-bold rounded border transition-colors"
            style={{ color: 'hsl(var(--text-primary))', borderColor: 'hsl(var(--border-default))', background: aiParseAutoOpen ? 'hsl(var(--bg-card))' : 'transparent' }}>
            ✦ AI 提炼
          </button>
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: 'hsl(var(--text-tertiary))' }}>K线标记规则 · 统一管理技术信号 · 支持 SSLang 策略代码</p>

      {/* Permanent risk / compliance notice */}
      <div className="mb-4 rounded-lg px-3 py-2 text-[11px] leading-relaxed shrink-0" style={{ background: 'hsl(var(--price-up) / 0.06)', border: '1px solid hsl(var(--price-up) / 0.25)', color: 'hsl(var(--text-secondary))' }}>
        <span className="font-bold" style={{ color: 'hsl(var(--price-up))' }}>风险提示：</span>
        规则与 K 线标记由 AI 根据您的描述生成，仅供学习研究参考，<b>不构成任何投资建议</b>。AI 可能误解您的意图或产生错误，请务必核对规则逻辑；历史命中率基于有限样本，不代表未来收益。投资有风险，决策需谨慎。
      </div>

      <div className="flex-1 overflow-auto space-y-6">
        {/* AI Parse Panel (collapsible) */}
        <InlineAiParsePanel stockId={selectedStock?.code || ''} onRulesAdded={handleRulesAdded} autoOpen={aiParseAutoOpen} onVisibilityChange={setAiParseAutoOpen} />

        {/* Inline Code Rule Editor */}
        {(showNewCodeRule || editingRule) && (
            <CodeRuleEditor
              key={editingRule?.id ?? 'new'}
              rule={editingRule ? { name: editingRule.name, code: editingRule.code ?? '', signal: editingRule.signal, explanation: editingRule.explanation, direction: editingRule.direction, sellCode: editingRule.sellCode ?? '' } : null}
              onSave={handleSaveCodeRule}
              onClose={() => { setShowNewCodeRule(false); setEditingRule(null); }}
            />
          )}

        {/* K-line marking rules */}
        <div className="pb-4" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>K线标记规则</h3>
          <RuleList key={refreshKey} onViewCode={setViewingCodeRule} onEditRule={handleEditRule} bars={bars} statStockName={selectedStock?.name} />
        </div>

        {/* Preset templates with group tabs */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>预设模板</h3>

          {/* Group tabs */}
          <div className="flex gap-1 mb-3 flex-wrap">
            {TEMPLATE_GROUPS.map(group => (
              <button
                key={group.name}
                onClick={() => setActiveGroup(group.name)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                  activeGroup === group.name ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                style={{
                  color: activeGroup === group.name ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
                  background: activeGroup === group.name ? 'hsl(var(--bg-card))' : 'transparent',
                  border: '1px solid',
                  borderColor: activeGroup === group.name ? 'hsl(var(--border-default))' : 'transparent',
                }}
              >
                {group.icon} {group.name}
              </button>
            ))}
          </div>

          {/* Template cards for active group */}
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATE_GROUPS.find(g => g.name === activeGroup)?.ids.map(tplId => {
              const tpl = RULE_TEMPLATES.find(t => t.id === tplId);
              if (!tpl) return null;
              return (
                <button key={tpl.id} onClick={() => {
                  const existing = loadRules();
                  const maxIdx = existing.reduce((max: number, r: TradingRule) => Math.max(max, r.markerIndex ?? 0), 0);
                  const newRule: TradingRule = { ...tpl, id: 'tpl_' + Date.now() + '_' + tpl.id, enabled: true, markerIndex: maxIdx + 1, color: ruleColor(maxIdx + 1), createdAt: new Date().toISOString() };
                  saveRules([...existing, newRule]);
                  setRefreshKey(k => k + 1);
                }}
                  className="text-left p-3 rounded border transition-colors hover:brightness-110"
                  style={{ background: 'hsl(var(--bg-card))', borderColor: 'hsl(var(--border-subtle))' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tpl.color }} />
                    <span className="text-[11px] font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{tpl.name}</span>
                    <span className="text-[10px] ml-auto shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{ruleSignalLabel(tpl.signal)}</span>
                  </div>
                  <div className="text-[10px] mt-1 line-clamp-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    {tpl.kind === 'code' && tpl.code ? tpl.code.replace(/\n/g, ' ').slice(0, 60) + (tpl.code.length > 60 ? '...' : '') : tpl.conditions.map(c => `${c.type}(${Object.values(c.params).join(',')})`).join(' + ')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary: all categories available */}
          <div className="mt-3 text-[10px] text-center" style={{ color: 'hsl(var(--text-tertiary))' }}>
            共 {RULE_TEMPLATES.length} 个预设模板 · 点击卡片添加到规则列表
          </div>
        </div>
      </div>
      <CodeViewerModal rule={viewingCodeRule} onClose={() => setViewingCodeRule(null)} />
    </div>
  );
}
