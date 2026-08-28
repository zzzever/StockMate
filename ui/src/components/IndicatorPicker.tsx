import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { getAllIndicators, type SubIndicator } from '../indicators';

// ─── 分类配置 ───
const CATEGORIES = [
  { id: 'all', label: '全部', icon: '📋' },
  { id: 'trend', label: '趋势', icon: '📈' },
  { id: 'oscillator', label: '震荡', icon: '📊' },
  { id: 'volume', label: '量能', icon: '📦' },
  { id: 'volatility', label: '波动', icon: '📐' },
  { id: 'custom', label: '自定义', icon: '🔧' },
] as const;

// ─── 难度标签 ───
const COMPLEXITY_LABEL: Record<string, { label: string; color: string }> = {
  basic: { label: '入门', color: '#22c55e' },
  intermediate: { label: '进阶', color: '#f59e0b' },
  advanced: { label: '专业', color: '#ef4444' },
};

// ─── 策略标签 ───
const STRATEGY_LABEL: Record<string, string> = {
  reversal: '反转',
  momentum: '动量',
  'trend-following': '趋势',
  'mean-reversion': '均值回归',
  breakout: '突破',
};

interface IndicatorPickerProps {
  value: string;
  onChange: (id: string) => void;
  recentIds?: string[];
  activeIds?: string[];
  onToggleMulti?: (id: string) => void;
}

export function IndicatorPicker({ value, onChange, recentIds = [], activeIds = [], onToggleMulti }: IndicatorPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [btnRect, setBtnRect] = useState<DOMRect | null>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 记录按钮位置
  const handleOpen = useCallback(() => {
    if (!open && btnRef.current) {
      setBtnRect(btnRef.current.getBoundingClientRect());
    }
    setOpen(!open);
  }, [open]);

  const allIndicators = useMemo(() => getAllIndicators(), []);

  const filtered = useMemo(() => {
    let list = allIndicators;
    if (activeCategory !== 'all') {
      list = list.filter(i => i.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return list;
  }, [allIndicators, activeCategory, search]);

  // 最近使用的指标
  const recent = useMemo(() => {
    if (!recentIds.length) return [];
    return recentIds.map(id => allIndicators.find(i => i.id === id)).filter(Boolean) as SubIndicator[];
  }, [recentIds, allIndicators]);

  // 当前选中指标
  const current = allIndicators.find(i => i.id === value);

  return (
    <div ref={ref} className="relative">
      {/* 触发按钮 */}
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        style={{
          color: value !== 'none' ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
          borderBottom: value !== 'none' ? '2px solid hsl(var(--text-primary))' : '2px solid transparent',
        }}
      >
        {current ? current.label : '指标'}
        <span className="text-[8px] opacity-60">▾</span>
      </button>

      {/* 下拉面板 - 使用 fixed 定位避免 overflow 裁剪 */}
      {open && btnRect && (
        <div
          className="fixed w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{
            top: btnRect.bottom + 4,
            left: btnRect.left,
            background: 'hsl(var(--bg-card))',
            border: '1px solid hsl(var(--border-subtle))',
            maxHeight: 'calc(100vh - 20px)',
          }}
        >
          {/* 搜索框 */}
          <div className="p-2" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索指标..."
              className="w-full px-2 py-1 text-[11px] rounded outline-none"
              style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-subtle))' }}
            />
          </div>

          {/* 分类标签 */}
          <div className="flex gap-0.5 px-2 py-1.5 overflow-x-auto" style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded whitespace-nowrap transition-colors"
                style={{
                  color: activeCategory === c.id ? 'hsl(var(--bg-root))' : 'hsl(var(--text-secondary))',
                  background: activeCategory === c.id ? 'hsl(var(--text-primary))' : 'transparent',
                }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {/* 最近使用 */}
            {recent.length > 0 && !search && activeCategory === 'all' && (
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-bold mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>⭐ 常用</div>
                <div className="flex flex-wrap gap-1">
                  {recent.map(ind => (
                    <button
                      key={ind.id}
                      onClick={() => { onChange(ind.id); setOpen(false); setSearch(''); }}
                      className="px-2 py-0.5 text-[11px] font-bold rounded transition-colors hover:opacity-80"
                      style={{
                        color: ind.id === value ? 'hsl(var(--bg-root))' : 'hsl(var(--text-primary))',
                        background: ind.id === value ? 'hsl(var(--text-primary))' : 'hsl(var(--bg-input))',
                        border: `1px solid ${ind.id === value ? 'hsl(var(--text-primary))' : 'hsl(var(--border-subtle))'}`,
                      }}
                    >
                      {ind.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 指标列表 */}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                未找到匹配的指标
              </div>
            ) : (
              <div className="py-1">
                {filtered.map(ind => {
                  const complexity = COMPLEXITY_LABEL[ind.complexity ?? 'basic'];
                  const strategies = (ind.tags ?? []).map(t => STRATEGY_LABEL[t]).filter(Boolean);
                  const isActive = activeIds.includes(ind.id) || ind.id === value;
                  return (
                    <button
                      key={ind.id}
                      onClick={() => { 
                        if (onToggleMulti) {
                          onToggleMulti(ind.id);
                        } else {
                          onChange(ind.id); 
                        }
                        setOpen(false); setSearch(''); 
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-start gap-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ background: isActive ? 'hsl(var(--bg-input))' : 'transparent' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{ind.label}</span>
                          {complexity && (
                            <span className="text-[9px] px-1 py-0 rounded" style={{ color: complexity.color, background: `${complexity.color}20` }}>
                              {complexity.label}
                            </span>
                          )}
                          {strategies.map(s => (
                            <span key={s} className="text-[9px] px-1 py-0 rounded" style={{ color: 'hsl(var(--text-tertiary))', background: 'hsl(var(--bg-input))' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
                          {ind.description}
                        </div>
                      </div>
                      {isActive && <span className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--text-primary))' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部：无指标 + 通达信 */}
          <div className="px-2 py-1.5 flex gap-1" style={{ borderTop: '1px solid hsl(var(--border-subtle))' }}>
            <button
              onClick={() => { onChange('none'); setOpen(false); setSearch(''); }}
              className="flex-1 px-2 py-1 text-[11px] font-bold rounded transition-colors"
              style={{
                color: value === 'none' ? 'hsl(var(--bg-root))' : 'hsl(var(--text-secondary))',
                background: value === 'none' ? 'hsl(var(--text-primary))' : 'hsl(var(--bg-input))',
              }}
            >
              无指标
            </button>
            <button
              onClick={() => { onChange('tdx'); setOpen(false); setSearch(''); }}
              className="flex-1 px-2 py-1 text-[11px] font-bold rounded transition-colors"
              style={{
                color: value === 'tdx' ? 'hsl(var(--bg-root))' : 'hsl(var(--text-secondary))',
                background: value === 'tdx' ? 'hsl(var(--text-primary))' : 'hsl(var(--bg-input))',
              }}
            >
              ✎ 通达信公式
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
