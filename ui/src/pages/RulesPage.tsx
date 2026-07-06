import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Save, Trash2, AlertTriangle, CheckCircle, Star, Edit3 } from 'lucide-react';

const STORAGE_KEY = 'stockmate_trading_rules';

function loadRules(): string { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; } }
function saveRulesToStore(rules: string) { localStorage.setItem(STORAGE_KEY, rules); }

export default function RulesPage() {
  const [rules, setRules] = useState(loadRules);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSave = useCallback(() => {
    saveRulesToStore(rules);
    setSaved(true); setEditing(false);
    clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }, [rules]);

  useEffect(() => {
    return () => clearTimeout(savedTimerRef.current);
  }, []);

  const handleClear = useCallback(() => {
    if (confirm('确定要清空所有规则？')) { setRules(''); saveRulesToStore(''); }
  }, []);

  const lines = rules.split('\n').filter(l => l.trim());

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
              交易规则
            </h1>
            <p className="text-sm mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
              TRADING RULES · 股票买卖的铁律
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--text-inverse))' }}
              >
                <Edit3 size={16} /> 编辑
              </button>
            ) : (
              <>
                <button onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: '#219653', color: '#ffffff' }}
                >
                  <Save size={16} /> 保存
                </button>
                <button onClick={handleClear}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{ borderColor: 'hsl(var(--border-default))', color: 'hsl(var(--text-secondary))' }}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rules display / editor */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {editing ? (
          <textarea value={rules} onChange={(e) => setRules(e.target.value)}
            placeholder={`一、买入规则\n1. 单只股票最大仓位不超过总资金的20%\n2. \n\n二、卖出规则\n1. 止损线设在买入价的-8%\n2. \n\n三、风险管理\n1. \n2. `}
            className="w-full h-full min-h-[400px] bg-transparent text-xl outline-none resize-none leading-relaxed rounded-lg"
            style={{ color: 'hsl(var(--text-primary))', lineHeight: 2 }}
            autoFocus
          />
        ) : (
          <div className="space-y-6">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                <AlertTriangle size={40} style={{ color: 'hsl(var(--text-tertiary))' }} />
                <p className="text-xl" style={{ color: 'hsl(var(--text-secondary))' }}>
                  还没有交易规则
                </p>
                <button onClick={() => setEditing(true)}
                  className="px-6 py-3 rounded-lg text-base font-medium transition-colors"
                  style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--text-inverse))' }}
                >
                  编写规则
                </button>
              </div>
            ) : (
              lines.map((line, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  {line.match(/^[一二三四五六七八九十]、/) ? (
                    // Section header
                    <h2 className="heading-serif text-2xl font-bold mt-8 mb-3 pb-2 tracking-wide"
                      style={{ color: 'hsl(var(--text-primary))', borderBottom: '2px solid hsl(var(--border-default))' }}
                    >
                      {line}
                    </h2>
                  ) : line.match(/^\d+[\.、]/) ? (
                    // Rule item
                    <div className="flex items-start gap-3 ml-2 py-1.5 px-2 rounded-lg transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <span className="font-mono-nums text-lg font-bold shrink-0 mt-0.5"
                        style={{ color: 'hsl(var(--accent))' }}
                      >
                        {line.match(/^(\d+)/)?.[1]}
                      </span>
                      <p className="text-lg leading-relaxed" style={{ color: 'hsl(var(--text-primary))' }}>
                        {line.replace(/^\d+[\.、]\s*/, '')}
                      </p>
                    </div>
                  ) : line.startsWith('!') ? (
                    // Highlighted / warning rule
                    <div className="flex items-center gap-2 ml-2 py-2 px-3 my-1 rounded-lg"
                      style={{ background: 'hsl(var(--price-up-bg))', borderLeft: '4px solid hsl(var(--price-up))' }}
                    >
                      <AlertTriangle size={20} style={{ color: 'hsl(var(--price-up))', flexShrink: 0 }} />
                      <p className="text-base font-bold" style={{ color: 'hsl(var(--price-up))' }}>{line.slice(1)}</p>
                    </div>
                  ) : line.startsWith('*') ? (
                    // Star / emphasis rule
                    <div className="flex items-center gap-2 ml-2 py-2 px-3 my-1 rounded-lg"
                      style={{ background: 'hsl(42 50% 95%)', borderLeft: '4px solid hsl(42 75% 45%)' }}
                    >
                      <Star size={20} style={{ color: '#d97706', flexShrink: 0 }} fill="#d97706" />
                      <p className="text-base font-bold" style={{ color: '#92400e' }}>{line.slice(1)}</p>
                    </div>
                  ) : (
                    // Normal text
                    <p className="text-lg ml-4 leading-loose" style={{ color: 'hsl(var(--text-primary))' }}>
                      {line}
                    </p>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-8 py-3 flex items-center justify-between text-sm"
        style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-card))' }}
      >
        <span style={{ color: 'hsl(var(--text-secondary))' }}>
          {lines.length > 0 ? `共 ${lines.length} 条规则 · AI 分析时自动附加` : '未设置规则'}
        </span>
        <span className="flex items-center gap-1.5 font-bold" style={{ color: 'hsl(var(--price-down))' }}>
          {lines.length > 0 && <><CheckCircle size={14} /> 已启用</>}
        </span>
      </div>

      {/* Save toast */}
      {saved && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-2xl text-base font-bold"
          style={{ background: '#219653', color: '#ffffff' }}
        >
          规则已保存
        </motion.div>
      )}
    </motion.div>
  );
}
