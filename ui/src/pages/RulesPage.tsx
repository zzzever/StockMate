import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RULE_TEMPLATES, ruleColor } from '@/utils/ruleEngine';
import type { TradingRule } from '@/types';
import InlineAiParsePanel from '@/components/InlineAiParsePanel';
import CodeViewerModal from '@/components/CodeViewerModal';
import { ruleSignalLabel } from '@/lib/signalLabels';
import { backtestRule, type RuleBacktest } from '@/utils/ruleBacktest';
import { useAppStore } from '@/store/useAppStore';
import { useStockHistory } from '@/hooks/useTauriQuery';
import { validateStrategyCode } from '@/utils/strategyRuntime';

const STORAGE_KEY_RULES = 'stockmate_trading_rules_v2';

function loadRules(): TradingRule[] {
  try { const raw = localStorage.getItem(STORAGE_KEY_RULES); if (raw) { const parsed = JSON.parse(raw); return parsed.map((r: any, i: number) => ({ ...r, markerIndex: r.markerIndex ?? i + 1, color: ruleColor(r.markerIndex ?? i) })); } return RULE_TEMPLATES; } catch (e) { console.warn('Failed to load rules:', e); return RULE_TEMPLATES; }
}
function saveRules(rules: TradingRule[]) { try { localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules)); window.dispatchEvent(new Event('stockmate:rules-changed')); } catch (e) { console.warn('Failed to save rules:', e); } }

/** Compact per-rule backtest badge: hit count + win-rate, with a low-sample warning.
 *  If stat is `undefined` it means no bars (no stock selected) — show nothing, not "命中 0". */
function BacktestBadge({ stat }: { stat: RuleBacktest | undefined }) {
  if (!stat) return null;
  if (stat.sample === 0 && stat.signals === 0) return null; // no data available — hide
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

// ── K线标记规则列表 (with edit/delete/toggle/batch/backtest) ──
function RuleList({ onViewCode, bars, statStockName }: { onViewCode: (r: TradingRule) => void; bars: any[]; statStockName?: string }) {
  const [rules, setRules] = useState<TradingRule[]>(loadRules);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  // Reload when rules change elsewhere (AI panel import, other tabs)
  useEffect(() => {
    const sync = () => setRules(loadRules());
    window.addEventListener('stockmate:rules-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('stockmate:rules-changed', sync); window.removeEventListener('storage', sync); };
  }, []);

  const stats = useMemo(() => { const m = new Map<string, RuleBacktest>(); if (bars?.length) for (const r of rules) m.set(r.id, backtestRule(r, bars)); return m; }, [rules, bars]);

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
        const valid = parsed.filter((r: any) => r && typeof r.name === 'string' && (Array.isArray(r.conditions) || typeof r.code === 'string'))
          .filter((r: any) => !r.code || typeof r.code !== 'string' || validateStrategyCode(r.code).valid);
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

      {batchMode && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] font-bold" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>
          <span style={{ color: 'hsl(var(--text-tertiary))' }}>已选 {selected.size}</span>
          <button onClick={() => setSelected(new Set(rules.map(r => r.id)))} style={{ color: 'hsl(var(--text-secondary))' }}>全选</button>
          <button onClick={() => batchSet(true)} style={{ color: '#22c55e' }}>批量启用</button>
          <button onClick={() => batchSet(false)} style={{ color: 'hsl(var(--text-tertiary))' }}>批量禁用</button>
          <button onClick={batchDelete} className="ml-auto" style={{ color: '#ef4444' }}>删除选中</button>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="py-8 text-center text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>暂无规则，请从下方模板添加或用 AI 提炼</div>
      ) : (
        rules.map(rule => (
          <div key={rule.id} className="flex items-center justify-between py-2 px-2 rounded" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>
            <div className="flex items-center gap-2 min-w-0">
              {batchMode && (
                <input type="checkbox" checked={selected.has(rule.id)} onChange={() => toggleSelect(rule.id)} className="shrink-0" aria-label={`选择 ${rule.name}`} />
              )}
              <span className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: rule.color, opacity: rule.enabled ? 1 : 0.35 }}>{rule.markerIndex}</span>
              <span className="text-[11px] font-bold truncate" style={{ color: rule.enabled ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))' }}>{rule.name}</span>
              <span className="text-[10px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{ruleSignalLabel(rule.signal)}</span>
              <BacktestBadge stat={stats.get(rule.id)} />
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
        ))
      )}
    </div>
  );
}

// ── Main Page ──
export default function RulesPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiParseAutoOpen, setAiParseAutoOpen] = useState(false);
  const [viewingCodeRule, setViewingCodeRule] = useState<TradingRule | null>(null);
  const selectedStock = useAppStore(s => s.selectedStock);
  const { data: history } = useStockHistory(selectedStock?.code || '', 250, 'day');
  const bars = useMemo(() => history ?? [], [history]);

  const handleRulesAdded = useCallback(() => { setRefreshKey(k => k + 1); setAiParseAutoOpen(false); }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col h-full pt-6 px-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>交易规则</h1>
        <button onClick={() => setAiParseAutoOpen(!aiParseAutoOpen)}
          className="px-3 py-1.5 text-[11px] font-bold rounded border transition-colors"
          style={{ color: 'hsl(var(--text-primary))', borderColor: 'hsl(var(--border-default))', background: aiParseAutoOpen ? 'hsl(var(--bg-card))' : 'transparent' }}>
          ✦ AI 提炼
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: 'hsl(var(--text-tertiary))' }}>K线标记规则 · 统一管理技术信号</p>

      {/* Permanent risk / compliance notice — rules & markers are for research only */}
      <div className="mb-4 rounded-lg px-3 py-2 text-[11px] leading-relaxed shrink-0" style={{ background: 'hsl(var(--price-up) / 0.06)', border: '1px solid hsl(var(--price-up) / 0.25)', color: 'hsl(var(--text-secondary))' }}>
        <span className="font-bold" style={{ color: 'hsl(var(--price-up))' }}>风险提示：</span>
        规则与 K 线标记由 AI 根据您的描述生成，仅供学习研究参考，<b>不构成任何投资建议</b>。AI 可能误解您的意图或产生错误，请务必核对规则逻辑；历史命中率基于有限样本，不代表未来收益。投资有风险，决策需谨慎。
      </div>

      <div className="flex-1 overflow-auto space-y-6">
        {/* AI Parse Panel (collapsible) */}
        <InlineAiParsePanel stockId={selectedStock?.code || ''} onRulesAdded={handleRulesAdded} autoOpen={aiParseAutoOpen} onVisibilityChange={setAiParseAutoOpen} />

        {/* K-line marking rules */}
        <div className="pb-4" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>K线标记规则</h3>
          <RuleList key={refreshKey} onViewCode={setViewingCodeRule} bars={bars} statStockName={selectedStock?.name} />
        </div>

        {/* Preset templates */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>预设模板</h3>
          <div className="grid grid-cols-2 gap-2">
            {RULE_TEMPLATES.map((tpl, i) => (
              <button key={tpl.id} onClick={() => {
                const existing = loadRules();
                const maxIdx = existing.reduce((max: number, r: TradingRule) => Math.max(max, r.markerIndex ?? 0), 0);
                const newRule: TradingRule = { ...tpl, id: 'tpl_' + Date.now() + '_' + i, enabled: true, markerIndex: maxIdx + 1, color: ruleColor(maxIdx + 1), createdAt: new Date().toISOString() };
                saveRules([...existing, newRule]);
                setRefreshKey(k => k + 1);
              }}
                className="text-left p-3 rounded border transition-colors"
                style={{ background: 'hsl(var(--bg-card))', borderColor: 'hsl(var(--border-subtle))' }}>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tpl.color }} />
                  <span className="text-[11px] font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{tpl.name}</span>
                  <span className="text-[10px] ml-auto shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{ruleSignalLabel(tpl.signal)}</span>
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  {tpl.conditions.map(c => `${c.type}(${Object.values(c.params).join(',')})`).join(' + ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <CodeViewerModal rule={viewingCodeRule} onClose={() => setViewingCodeRule(null)} />
    </motion.div>
  );
}
