import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Brain,
  ChevronUp,
  ChevronDown,
  Settings,
  RotateCcw,
} from 'lucide-react';
import type { TradingRule } from '@/types';
import { useParseRules } from '@/hooks/useParseRules';
import { ruleColor } from '@/utils/ruleEngine';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY_RULES = 'stockmate_trading_rules_v2';

function generateId(): string {
  return 'ai_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

interface InlineAiParsePanelProps {
  /** Stock identifier for contextual parsing */
  stockId: string;
  /** Called after rules are successfully added */
  onRulesAdded?: () => void;
  /** External control: if true the panel opens automatically */
  autoOpen?: boolean;
  /** Callback when panel visibility changes */
  onVisibilityChange?: (isVisible: boolean) => void;
}

export default function InlineAiParsePanel({
  stockId,
  onRulesAdded,
  autoOpen = false,
  onVisibilityChange,
}: InlineAiParsePanelProps) {
  const [isExpanded, setIsExpanded] = useState(autoOpen);
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mutation = useParseRules();
  const navigate = useNavigate();

  // Listen to autoOpen changes
  useEffect(() => {
    if (autoOpen && !isExpanded) {
      setIsExpanded(true);
    }
  }, [autoOpen]);

  // Notify parent of visibility changes
  useEffect(() => {
    onVisibilityChange?.(isExpanded);
  }, [isExpanded, onVisibilityChange]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Reset state when collapsing
  const handleToggle = useCallback(() => {
    const next = !isExpanded;
    if (!next) {
      // Collapsing: reset all state
      setDescription('');
      setSelectedIds(new Set());
      setAdded(false);
      mutation.reset();
    }
    setIsExpanded(next);
  }, [isExpanded, mutation]);

  const parsedRules = mutation.data || [];

  const handleParse = useCallback(() => {
    if (!description.trim()) return;
    mutation.mutate({ stockId, rules: description });
    setSelectedIds(new Set());
    setAdded(false);
  }, [description, stockId, mutation]);

  const handleRetry = useCallback(() => {
    mutation.mutate({ stockId, rules: description });
  }, [stockId, description, mutation]);

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

  const handleImportToKline = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RULES);
      const existing: TradingRule[] = raw ? JSON.parse(raw) : [];

      const maxIndex = existing.reduce(
        (max, r) => Math.max(max, r.markerIndex || 0),
        0,
      );

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

      const updated = [...existing, ...newRules];
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(updated));

      setAdded(true);
      onRulesAdded?.();

      // Auto collapse after a brief delay
      setTimeout(() => {
        setIsExpanded(false);
        setDescription('');
        setSelectedIds(new Set());
        setAdded(false);
        mutation.reset();
      }, 1200);
    } catch (e) {
      console.warn('[InlineAiParsePanel] Failed to save rules to localStorage:', e);
    }
  };

  // Derive user-facing error message from the mutation error
  const errorMessage = mutation.error
    ? (() => {
        const msg = String(mutation.error);
        if (
          msg.includes('API key') ||
          msg.includes('api key') ||
          msg.includes('ApiKey') ||
          msg.includes('not configured')
        ) {
          return null; // Special case: we render a different UI
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

  const isApiKeyError = mutation.error
    ? (() => {
        const msg = String(mutation.error);
        return (
          msg.includes('API key') ||
          msg.includes('api key') ||
          msg.includes('ApiKey') ||
          msg.includes('not configured')
        );
      })()
    : false;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'hsl(var(--bg-card))',
        border: `1px solid ${
          isExpanded ? '#6366f160' : 'hsl(var(--border-default))'
        }`,
        boxShadow: isExpanded
          ? '0 4px 24px rgba(99,102,241,0.08)'
          : 'none',
      }}
    >
      {/* ── Header (always visible) ── */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-5 py-3 transition-colors hover:opacity-85"
        style={{
          background: isExpanded ? '#6366f108' : 'transparent',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: isExpanded ? '#6366f1' : '#6366f115',
            }}
          >
            <Brain
              size={15}
              style={{
                color: isExpanded ? '#ffffff' : '#6366f1',
              }}
            />
          </div>
          <div className="text-left">
            <span
              className="text-sm font-bold"
              style={{ color: 'hsl(var(--text-primary))' }}
            >
              AI 智能提炼
            </span>
            <span
              className="text-[10px] ml-2"
              style={{ color: 'hsl(var(--text-tertiary))' }}
            >
              用自然语言描述交易规则，AI 自动提取
            </span>
          </div>
        </div>
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
          style={{
            background: isExpanded ? '#6366f115' : 'transparent',
          }}
        >
          {isExpanded ? (
            <ChevronUp size={16} style={{ color: '#6366f1' }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'hsl(var(--text-tertiary))' }} />
          )}
        </div>
      </button>

      {/* ── Expandable body ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="inline-parse-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5"
              style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}
            >
              {/* ── Input area ── */}
              <div className="pt-4">
                <textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`描述你的交易策略...

例如：
- 当5日均线上穿10日均线时买入
- RSI低于30时为超卖区域，考虑买入
- 成交量放大1.5倍且价格突破20日高点时买入
- MACD在零轴上方金叉时买入

支持中英文，越详细提取越准确`}
                  className="w-full h-[120px] bg-transparent text-sm outline-none rounded-lg border p-3.5 resize-none transition-colors"
                  style={{
                    color: 'hsl(var(--text-primary))',
                    borderColor: description.trim()
                      ? 'hsl(var(--border-default))'
                      : 'hsl(var(--border-subtle))',
                    lineHeight: 1.6,
                  }}
                />
                <div className="flex items-center justify-between mt-3">
                  <span
                    className="text-[10px]"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    {description
                      ? `${description.split('\n').filter((l) => l.trim()).length} 行 · ${description.length} 字符`
                      : '输入交易策略描述'}
                  </span>
                  <button
                    onClick={handleParse}
                    disabled={!description.trim() || mutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:opacity-85"
                    style={{
                      background: mutation.isPending
                        ? '#6366f180'
                        : '#6366f1',
                      color: '#ffffff',
                    }}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        正在提炼...
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        AI 智能提炼
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Results area ── */}

              {/* Loading state */}
              {mutation.isPending && (
                <div className="flex flex-col items-center justify-center py-10 gap-3 mt-2">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: '#6366f115' }}
                  >
                    <Loader2
                      size={28}
                      className="animate-spin"
                      style={{ color: '#6366f1' }}
                    />
                  </div>
                  <p
                    className="text-sm font-bold"
                    style={{ color: 'hsl(var(--text-secondary))' }}
                  >
                    AI 正在分析策略描述...
                  </p>
                  <p
                    className="text-xs text-center max-w-xs leading-relaxed"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    正在理解你的交易逻辑，提取可量化的规则条件
                  </p>
                </div>
              )}

              {/* Error: API key not configured */}
              {mutation.isError && isApiKeyError && !mutation.isPending && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 mt-2">
                  <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
                  <p
                    className="text-sm font-bold"
                    style={{ color: '#f59e0b' }}
                  >
                    DeepSeek API Key 未配置
                  </p>
                  <p
                    className="text-xs text-center max-w-xs leading-relaxed"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    请先在设置页面配置 DeepSeek API Key，才能使用 AI 提炼功能
                  </p>
                  <button
                    onClick={() => navigate('/settings')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors hover:opacity-85"
                    style={{ background: '#f59e0b', color: '#ffffff' }}
                  >
                    <Settings size={14} /> 前往设置
                  </button>
                </div>
              )}

              {/* Error: network / other */}
              {mutation.isError && !isApiKeyError && !mutation.isPending && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 mt-2">
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
                    <RotateCcw size={14} /> 重试
                  </button>
                </div>
              )}

              {/* Empty state: parsed but no rules found */}
              {mutation.isSuccess && parsedRules.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-3 mt-2">
                  <AlertTriangle
                    size={32}
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  />
                  <p
                    className="text-sm font-bold"
                    style={{ color: 'hsl(var(--text-secondary))' }}
                  >
                    未能识别有效规则
                  </p>
                  <p
                    className="text-xs text-center max-w-xs leading-relaxed"
                    style={{ color: 'hsl(var(--text-tertiary))' }}
                  >
                    请尝试更明确的描述，确保包含可量化的交易条件
                    （如：均线金叉、RSI 超卖、放量突破等）
                  </p>
                </div>
              )}

              {/* Success state with rules list */}
              {mutation.isSuccess && parsedRules.length > 0 && (
                <div className="mt-4 space-y-3">
                  {/* Separator */}
                  <div
                    className="flex items-center gap-3"
                    style={{ color: 'hsl(var(--border-subtle))' }}
                  >
                    <div
                      className="flex-1"
                      style={{
                        height: 1,
                        background: 'hsl(var(--border-subtle))',
                      }}
                    />
                    <span
                      className="text-[10px] font-medium shrink-0"
                      style={{ color: 'hsl(var(--text-tertiary))' }}
                    >
                      识别到 {parsedRules.length} 条规则
                    </span>
                    <div
                      className="flex-1"
                      style={{
                        height: 1,
                        background: 'hsl(var(--border-subtle))',
                      }}
                    />
                  </div>

                  {/* Selection toolbar */}
                  <div className="flex items-center justify-between px-1">
                    <span
                      className="text-xs"
                      style={{ color: 'hsl(var(--text-tertiary))' }}
                    >
                      勾选需要导入的规则
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAll}
                        className="text-[10px] font-medium hover:opacity-70 transition-opacity"
                        style={{ color: '#6366f1' }}
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

                  {/* Rule list */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
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
                              ? `${rule.color}12`
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
                            {isSelected && (
                              <CheckCircle
                                size={12}
                                className="text-white"
                              />
                            )}
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
                                style={{
                                  color: 'hsl(var(--text-primary))',
                                }}
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
                              style={{
                                color: 'hsl(var(--text-tertiary))',
                              }}
                            >
                              {rule.conditions
                                .map(
                                  (c) =>
                                    `${c.type}(${Object.values(c.params).join(', ')})`,
                                )
                                .join('; ')}
                            </p>
                          </div>

                          {/* Direction/type indicator */}
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

                  {/* Just-added success feedback */}
                  {added && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center gap-2 py-3"
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

                  {/* Import button */}
                  {!added && (
                    <div
                      className="flex items-center justify-between pt-3 mt-1"
                      style={{
                        borderTop: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <span
                        className="text-xs"
                        style={{ color: 'hsl(var(--text-tertiary))' }}
                      >
                        已选 {selectedIds.size}/{parsedRules.length}
                      </span>
                      <button
                        onClick={handleImportToKline}
                        disabled={selectedIds.size === 0}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 hover:opacity-85"
                        style={{
                          background: selectedIds.size > 0
                            ? '#6366f1'
                            : 'hsl(var(--border-subtle))',
                          color: selectedIds.size > 0 ? '#ffffff' : 'hsl(var(--text-tertiary))',
                        }}
                      >
                        <Sparkles size={14} /> 导入到K线标记
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
