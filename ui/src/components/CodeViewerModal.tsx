import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check } from 'lucide-react';
import type { TradingRule } from '@/types';

const SIGNAL_LABELS: Record<string, string> = { buy: '买入', sell: '卖出', alert: '提醒' };
const SIGNAL_COLORS: Record<string, string> = { buy: '#22c55e', sell: '#ef4444', alert: '#f59e0b' };

interface Props {
  rule: TradingRule | null;
  onClose: () => void;
}

/** Read-only viewer for a rule's generated strategy code + explanation. */
export default function CodeViewerModal({ rule, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => { setCopied(false); }, [rule]);

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

  const lines = (rule?.code ?? '').split('\n');

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
                <pre className="overflow-x-auto rounded-lg py-3" style={{ background: 'hsl(var(--bg-root))', border: '1px solid hsl(var(--border-subtle))', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.65 }}>
                  {lines.map((ln, i) => (
                    <div key={i} className="flex px-0">
                      <span className="inline-block text-right pr-3 shrink-0 select-none" style={{ width: 40, color: 'hsl(var(--text-tertiary))', opacity: 0.45, fontSize: 11 }}>{i + 1}</span>
                      <span className="whitespace-pre pr-4" style={{ color: 'hsl(var(--text-primary))' }}>{ln || ' '}</span>
                    </div>
                  ))}
                </pre>
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
              <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: '#6366f1', color: '#fff' }}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '已复制' : '复制代码'}
              </button>
              <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors hover:opacity-85" style={{ background: 'hsl(var(--bg-root))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>
                关闭
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
