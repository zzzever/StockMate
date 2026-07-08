import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, CheckCircle, AlertTriangle, Loader2, Brain } from 'lucide-react';
import type { TradingRule } from '@/types';
import { useParseRules } from '@/hooks/useParseRules';
import { ruleColor } from '@/utils/ruleEngine';

const STORAGE_KEY_RULES = 'stockmate_trading_rules_v2';

function generateId(): string {
  return 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

interface AiParsePanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** The free-text rules content to parse */
  rules: string;
  /** Stock identifier for contextual parsing */
  stockId: string;
  /** Called after rules are successfully added to K-line markers */
  onRulesAdded?: () => void;
}

export default function AiParsePanel({ isOpen, onClose, rules, stockId, onRulesAdded }: AiParsePanelProps) {
  const mutation = useParseRules();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);

  // Auto-trigger parse when panel opens, reset when it closes
  useEffect(() => {
    if (isOpen && rules.trim()) {
      mutation.mutate({ stockId, rules });
      setSelectedIds(new Set());
      setAdded(false);
    }
    if (!isOpen) {
      mutation.reset();
    }
  }, [isOpen]);

  const handleRetry = useCallback(() => {
    mutation.mutate({ stockId, rules });
  }, [stockId, rules, mutation]);

  const parsedRules = mutation.data || [];

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(parsedRules.map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleAddToKline = () => {
    try {
      // Read existing rules from localStorage
      const raw = localStorage.getItem(STORAGE_KEY_RULES);
      const existing: TradingRule[] = raw ? JSON.parse(raw) : [];

      // Determine the starting markerIndex
      const maxIndex = existing.reduce(
        (max, r) => Math.max(max, r.markerIndex || 0),
        0,
      );

      // Build new TradingRule entries from selected parsed rules
      const selectedRules = parsedRules.filter((r) => selectedIds.has(r.id));
      const newRules: TradingRule[] = selectedRules.map((rule, i) => ({
        id: generateId(),
        name: rule.name,
        conditions: rule.conditions,
        signal: rule.signal,
        enabled: true,
        color: ruleColor(maxIndex + i),
        markerIndex: maxIndex + i + 1,
        createdAt: new Date().toISOString(),
      }));

      // Merge and persist
      const updated = [...existing, ...newRules];
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated));

      setAdded(true);
      onRulesAdded?.();
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e) {
      console.warn('[AiParsePanel] Failed to save rules to localStorage:', e);
    }
  };

  // Derive a user-facing error message from the mutation error
  const errorMessage = mutation.error
    ? (() => {
        const msg = String(mutation.error);
        if (
          msg.includes('API key') ||
          msg.includes('api key') ||
          msg.includes('ApiKey') ||
          msg.includes('not configured')
        ) {
          return '请先配置 DeepSeek API Key';
        }
        if (
          msg.includes('network') ||
          msg.includes('Network') ||
          msg.includes('timeout') ||
          msg.includes('Timeout') ||
          msg.includes('ENOTFOUND') ||
          msg.includes('ECONNREFUSED')
        ) {
          return '解析失败，请检查网络连接后重试';
        }
        return '解析失败，请重试';
      })()
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-parse-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        >
          <motion.div
            key="ai-parse-panel"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: 'hsl(var(--bg-card))',
              border: '1px solid hsl(var(--border-default))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}
            >
              <div className="flex items-center gap-2">
                <Brain size={18} style={{ color: '#6366f1' }} />
                <h2
                  className="text-base font-bold"
                  style={{ color: 'hsl(var(--text-primary))' }}
                >
                  AI 解析结果
                </h2>
                {mutation.isPending && (
                  <Loader2
                    size={14}
                    className="animate-spin"
                    style={{ color: '#6366f1' }}
                  />
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: 'hsl(var(--text-tertiary))' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Body ── */}
            <div
              className="px-6 py-4"
              style={{ maxHeight: 420, overflowY: 'auto' }}
            >
              {/* Loading state */}
              {mutation.isPending && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2
                    size={36}
                    className="animate-spin"
                    style={{ color: '#6366f1' }}
                  />
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'hsl(var(--text-secondary))' }}
                  >
                    正在解析规则...
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    AI 正在分析你的交易策略文本
                  </p>
                </div>
              )}

              {/* Error state */}
              {mutation.isError && !mutation.isPending && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <AlertTriangle size={32} style={{ color: '#ef4444' }} />
                  <p
                    className="text-sm font-bold"
                    style={{ color: '#ef4444' }}
                  >
                    {errorMessage}
                  </p>
                  <p
                    className="text-xs text-center max-w-xs leading-relaxed"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    {String(mutation.error)}
                  </p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors hover:opacity-85"
                    style={{ background: '#6366f1', color: '#ffffff' }}
                  >
                    <Loader2 size={14} /> 重试
                  </button>
                </div>
              )}

              {/* Empty state: parsed successfully but no rules found */}
              {mutation.isSuccess && parsedRules.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <AlertTriangle
                    size={32}
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  />
                  <p
                    className="text-sm font-bold"
                    style={{ color: 'hsl(var(--text-secondary))' }}
                  >
                    未识别到有效规则
                  </p>
                  <p
                    className="text-xs text-center max-w-xs leading-relaxed"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    请优化规则描述后重试，确保包含可量化的交易条件（如均线金叉、RSI 超卖等）
                  </p>
                </div>
              )}

              {/* Success state with results */}
              {mutation.isSuccess && parsedRules.length > 0 && (
                <div className="space-y-2">
                  {/* Selection toolbar */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-xs"
                      style={{ color: 'hsl(var(--text-tertiary))' }}
                    >
                      识别到 {parsedRules.length} 条规则
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAll}
                        className="text-[10px] font-medium hover:opacity-70 transition-opacity"
                        style={{ color: 'hsl(var(--text-tertiary))' }}
                      >
                        全选
                      </button>
                      <span
                        className="text-[10px]"
                        style={{ color: 'hsl(var(--text-tertiary))' }}
                      >
                        ·
                      </span>
                      <button
                        onClick={deselectAll}
                        className="text-[10px] font-medium hover:opacity-70 transition-opacity"
                        style={{ color: 'hsl(var(--text-tertiary))' }}
                      >
                        取消全选
                      </button>
                    </div>
                  </div>

                  {/* Rule items */}
                  {parsedRules.map((rule) => {
                    const isSelected = selectedIds.has(rule.id);
                    const signalLabel =
                      rule.signal === 'buy'
                        ? '买入'
                        : rule.signal === 'sell'
                          ? '卖出'
                          : '提醒';
                    const signalColor =
                      rule.signal === 'buy'
                        ? '#22c55e'
                        : rule.signal === 'sell'
                          ? '#ef4444'
                          : '#f59e0b';
                    const signalBg =
                      rule.signal === 'buy'
                        ? '#22c55e20'
                        : rule.signal === 'sell'
                          ? '#ef444420'
                          : '#f59e0b20';

                    return (
                      <div
                        key={rule.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                        style={{
                          background: isSelected
                            ? `${rule.color}15`
                            : 'hsl(var(--bg-root))',
                          border: `1px solid ${
                            isSelected
                              ? `${rule.color}30`
                              : 'hsl(var(--border-subtle))'
                          }`,
                        }}
                        onClick={() => toggleSelection(rule.id)}
                      >
                        {/* Custom checkbox */}
                        <div
                          className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                          style={{
                            background: isSelected ? '#6366f1' : 'transparent',
                            borderColor: isSelected
                              ? '#6366f1'
                              : 'hsl(var(--border-default))',
                          }}
                        >
                          {isSelected && <CheckCircle size={12} className="text-white" />}
                        </div>

                        {/* Color indicator */}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: rule.color }}
                        />

                        {/* Rule info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-sm font-bold truncate"
                              style={{ color: 'hsl(var(--text-primary))' }}
                            >
                              {rule.name}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: signalBg,
                                color: signalColor,
                              }}
                            >
                              {signalLabel}
                            </span>
                          </div>
                          <p
                            className="text-[10px] mt-0.5 truncate"
                            style={{ color: 'hsl(var(--text-tertiary))' }}
                          >
                            {rule.conditions
                              .map(
                                (c) =>
                                  `${c.type}(${Object.values(c.params).join(', ')})`,
                              )
                              .join('; ')}
                          </p>
                        </div>

                        {/* Direction / type indicator */}
                        <span
                          className="text-sm font-bold shrink-0"
                          style={{ color: signalColor }}
                        >
                          {rule.signal === 'buy'
                            ? '↗'
                            : rule.signal === 'sell'
                              ? '➘'
                              : '●'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Just-added success feedback */}
              {added && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 py-4"
                >
                  <CheckCircle size={18} style={{ color: '#22c55e' }} />
                  <span
                    className="text-sm font-bold"
                    style={{ color: '#22c55e' }}
                  >
                    规则已添加到K线标记
                  </span>
                </motion.div>
              )}
            </div>

            {/* ── Footer ── */}
            {mutation.isSuccess && parsedRules.length > 0 && !added && (
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}
              >
                <span
                  className="text-xs"
                  style={{ color: 'hsl(var(--text-tertiary))' }}
                >
                  已选 {selectedIds.size}/{parsedRules.length}
                </span>
                <button
                  onClick={handleAddToKline}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 hover:opacity-85"
                  style={{
                    background: '#6366f1',
                    color: '#ffffff',
                  }}
                >
                  <Sparkles size={14} /> 添加到K线标记
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
