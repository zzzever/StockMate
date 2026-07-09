import { useState, useEffect, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Pencil } from 'lucide-react';
import type { TradingRule } from '@/types';
import { RULE_SIGNAL_LABELS as SIGNAL_LABELS, RULE_SIGNAL_COLORS as SIGNAL_COLORS } from '@/lib/signalLabels';
import { validateStrategyCode } from '@/utils/strategyRuntime';

const STORAGE_KEY_RULES = 'stockmate_trading_rules_v2';

const SSL_KEYWORDS = new Set(['RULE', 'SIGNAL', 'WHEN', 'NOTE', 'BUY', 'SELL', 'ALERT', 'true', 'false', 'null']);

/** Lightweight SSLang syntax highlighter — colors keywords / functions / numbers / strings / comments. */
function highlightLine(line: string): React.ReactNode {
  // Whole-line comment
  const commentIdx = Math.min(...['--', '//'].map((c) => { const k = line.indexOf(c); return k < 0 ? Infinity : k; }));
  const codePart = commentIdx === Infinity ? line : line.slice(0, commentIdx);
  const comment = commentIdx === Infinity ? '' : line.slice(commentIdx);
  const tokens = codePart.split(/(\s+|[()[\],]|"[^"]*"|&&|\|\||[+\-*/%<>=!?:])/g).filter((t) => t !== '');
  return (
    <>
      {tokens.map((t, i) => {
        let color = 'hsl(var(--text-primary))';
        if (/^"[^"]*"$/.test(t)) color = '#22c55e';
        else if (/^\d+(\.\d+)?$/.test(t)) color = '#f59e0b';
        else if (SSL_KEYWORDS.has(t)) color = '#c084fc';
        else if (/^[a-z_][a-z0-9_]*$/i.test(t) && tokens[i + 1] === '(') color = '#60a5fa'; // function call
        else if (/^(&&|\|\||[+\-*/%<>=!?:])$/.test(t)) color = 'hsl(var(--text-tertiary))';
        return <Fragment key={i}><span style={{ color }}>{t}</span></Fragment>;
      })}
      {comment && <span style={{ color: 'hsl(var(--text-tertiary))', opacity: 0.7 }}>{comment}</span>}
    </>
  );
}

interface Props {
  rule: TradingRule | null;
  onClose: () => void;
}

/** Read-only viewer for a rule's generated strategy code + explanation. */
export default function CodeViewerModal({ rule, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setCopied(false); setEditing(false); setDraft(rule?.code ?? ''); setDisplayCode(rule?.code ?? ''); setError(null); }, [rule]);

  useEffect(() => {
    if (!rule) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rule, onClose]);

  const handleCopy = useCallback(async () => {
    if (!rule?.code) return;
    try { await navigator.clipboard.writeText(rule.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (e) { console.warn('[CodeViewerModal] copy failed:', e); }
  }, [rule]);

  const handleSave = useCallback(() => {
    if (!rule) return;
    const expr = draft.replace(/--[^\n]*/g, '').trim();
    const v = validateStrategyCode(expr);
    if (!v.valid && !v.error?.includes('禁止访问标识符')) { setError(v.error || '代码校验失败'); return; }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RULES);
      const all: TradingRule[] = raw ? JSON.parse(raw) : [];
      const updated = all.map((r) => r.id === rule.id ? { ...r, code: draft, kind: 'code' as const, conditions: [] } : r);
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated));
      window.dispatchEvent(new Event('stockmate:rules-changed'));
      setEditing(false); setError(null); setDisplayCode(draft);
    } catch (e) { console.warn('[CodeViewerModal] save failed:', e); setError('保存失败'); }
  }, [rule, draft]);

  const code = displayCode || rule?.code || '';
  const lines = code.split('\n');

  return (
    <AnimatePresence>
      {rule && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-8"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex flex-col w-full max-w-[680px] max-h-[calc(100vh-80px)] rounded-2xl overflow-hidden"
            style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-default))', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
              <span className="font-mono text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{'</>'}</span>
              <span className="text-sm font-bold truncate" style={{ color: 'hsl(var(--text-primary))' }}>{rule.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${SIGNAL_COLORS[rule.signal]}20`, color: SIGNAL_COLORS[rule.signal] }}>
                {SIGNAL_LABELS[rule.signal] ?? rule.signal}
              </span>
              <button onClick={onClose} aria-label="关闭" className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
                <X size={15} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider px-5 pt-3 pb-1.5" style={{ color: 'hsl(var(--text-tertiary))' }}>Code</div>
              <div className="px-5 pb-2">
                {editing ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => { setDraft(e.target.value); setError(null); }}
                      spellCheck={false}
                      className="w-full h-40 rounded-lg p-3 outline-none resize-y"
                      style={{ background: 'hsl(var(--bg-root))', border: `1px solid ${error ? '#ef4444' : 'hsl(var(--border-subtle))'}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.65, color: 'hsl(var(--text-primary))' }}
                    />
                    {error && <p className="text-[11px] mt-1 font-bold" style={{ color: '#ef4444' }}>⚠ {error}</p>}
                    <p className="text-[10px] mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>仅允许 SSLang 白名单函数；保存前会做沙箱语法/安全校验。</p>
                  </>
                ) : (
                  <pre className="overflow-x-auto rounded-lg py-3" style={{ background: 'hsl(var(--bg-root))', border: '1px solid hsl(var(--border-subtle))', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.65 }}>
                    {lines.map((ln, i) => (
                      <div key={i} className="flex px-0">
                        <span className="inline-block text-right pr-3 shrink-0 select-none" style={{ width: 40, color: 'hsl(var(--text-tertiary))', opacity: 0.45, fontSize: 11 }}>{i + 1}</span>
                        <span className="whitespace-pre pr-4" style={{ color: 'hsl(var(--text-primary))' }}>{ln ? highlightLine(ln) : ' '}</span>
                      </div>
                    ))}
                  </pre>
                )}
              </div>

              {rule.explanation && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider px-5 pt-2 pb-1.5" style={{ color: 'hsl(var(--text-tertiary))' }}>说明</div>
                  <p className="px-5 pb-3 text-xs leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>{rule.explanation}</p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0" style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
              {editing ? (
                <>
                  <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: '#22c55e', color: '#fff' }}>
                    <Check size={13} /> 校验并保存
                  </button>
                  <button onClick={() => { setEditing(false); setDraft(rule.code ?? ''); setError(null); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: 'hsl(var(--bg-root))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditing(true); setDraft(rule.code ?? ''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: 'hsl(var(--bg-root))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>
                    <Pencil size={12} /> 编辑
                  </button>
                  <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: '#6366f1', color: '#fff' }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '已复制' : '复制代码'}
                  </button>
                  <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: 'hsl(var(--bg-root))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>
                    关闭
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
