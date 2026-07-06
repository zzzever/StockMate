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
      style={{ background: 'linear-gradient(180deg, #fdfbf7 0%, #f5f0e8 30%, #ede4d3 60%, #fdfbf7 100%)' }}
    >
      {/* Header — 和モダン masthead with 罫線 */}
      <div className="shrink-0 px-8 pt-8 pb-4 fragment-top"
        style={{ borderBottom: '4px double #8b1a1a' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-rose-900"
              style={{ fontFamily: "'Noto Serif SC', serif", letterSpacing: '-0.03em' }}
            >
              交易规则
            </h1>
            <p className="text-base text-rose-700/60 mt-1 tracking-widest"
              style={{ fontFamily: "'Noto Serif SC', serif" }}
            >
              TRADING RULES · 股票买卖的铁律
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-900 text-amber-100 rounded-none hover:bg-rose-800 transition-colors text-sm font-bold tracking-wider shadow-lg"
                style={{ fontFamily: "'Noto Serif SC', serif" }}
              >
                <Edit3 size={16} /> 编辑
              </button>
            ) : (
              <>
                <button onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-800 text-amber-100 rounded-none hover:bg-emerald-700 transition-colors text-sm font-bold tracking-wider shadow-lg"
                >
                  <Save size={16} /> 保存
                </button>
                <button onClick={handleClear}
                  className="flex items-center gap-2 px-3 py-2 bg-transparent border-2 border-rose-800 text-rose-800 rounded-none hover:bg-rose-50 transition-colors text-sm font-bold"
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
            className="w-full h-full min-h-[400px] bg-transparent text-2xl text-slate-900 placeholder-slate-400/60 resize-none outline-none leading-relaxed"
            style={{ fontFamily: "'Noto Serif SC', 'Source Han Serif', 'SimSun', serif", lineHeight: 2 }}
            autoFocus
          />
        ) : (
          <div className="space-y-6">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                <AlertTriangle size={40} className="text-rose-300" />
                <p className="text-xl text-slate-400" style={{ fontFamily: "'Noto Serif SC', serif" }}>
                  还没有交易规则
                </p>
                <button onClick={() => setEditing(true)}
                  className="px-6 py-3 bg-rose-900 text-amber-100 text-lg font-bold tracking-wider shadow-xl hover:bg-rose-800 transition-colors"
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
                    <h2 className="text-3xl font-black text-rose-900 mt-8 mb-3 pb-2 border-b-2 border-rose-300/60 tracking-wide"
                      style={{ fontFamily: "'Noto Serif SC', serif" }}
                    >
                      {line}
                    </h2>
                  ) : line.match(/^\d+[\.、]/) ? (
                    // Rule item
                    <div className="flex items-start gap-3 ml-2 py-1.5 group hover:bg-amber-50/60 px-2 transition-colors">
                      <span className="text-2xl font-black text-amber-700 shrink-0 mt-0.5"
                        style={{ fontFamily: "'Noto Serif SC', serif" }}
                      >
                        {line.match(/^(\d+)/)?.[1]}
                      </span>
                      <p className="text-2xl text-slate-800 font-medium leading-relaxed"
                        style={{ fontFamily: "'Noto Serif SC', 'Source Han Serif', serif" }}
                      >
                        {line.replace(/^\d+[\.、]\s*/, '')}
                      </p>
                    </div>
                  ) : line.startsWith('!') ? (
                    // Highlighted / warning rule
                    <div className="flex items-center gap-2 ml-2 py-2 px-3 my-1 bg-red-50 border-l-4 border-red-600"
                      style={{ fontFamily: "'Noto Serif SC', serif" }}
                    >
                      <AlertTriangle size={20} className="text-red-600 shrink-0" />
                      <p className="text-xl text-red-900 font-bold">{line.slice(1)}</p>
                    </div>
                  ) : line.startsWith('*') ? (
                    // Star / emphasis rule
                    <div className="flex items-center gap-2 ml-2 py-2 px-3 my-1 bg-amber-50 border-l-4 border-amber-500">
                      <Star size={20} className="text-amber-600 shrink-0" fill="#d97706" />
                      <p className="text-xl text-amber-900 font-bold">{line.slice(1)}</p>
                    </div>
                  ) : (
                    // Normal text
                    <p className="text-xl text-slate-700 ml-4 leading-loose"
                      style={{ fontFamily: "'Noto Serif SC', serif" }}
                    >
                      {line}
                    </p>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer — condensed summary */}
      <div className="shrink-0 px-8 py-3 border-t-2 border-slate-300/60 flex items-center justify-between text-sm"
        style={{ background: 'linear-gradient(0deg, #ede4d3, #f5f0e8)' }}
      >
        <span className="text-slate-500 tracking-wide" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          {lines.length > 0 ? `共 ${lines.length} 条规则 · AI 分析时自动附加` : '未设置规则'}
        </span>
        <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
          {lines.length > 0 && <><CheckCircle size={14} /> 已启用</>}
        </span>
      </div>

      {/* Save toast */}
      {saved && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-900 text-amber-100 rounded shadow-2xl text-lg font-bold tracking-wider"
          style={{ fontFamily: "'Noto Serif SC', serif" }}
        >
          规则已保存
        </motion.div>
      )}
    </motion.div>
  );
}
