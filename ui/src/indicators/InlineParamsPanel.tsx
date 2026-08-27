import { useState, useCallback, useEffect, useRef } from 'react';
import type { SubIndicator, ParamDef } from './types';
import { getDefaultParams } from './compute';

function loadSavedParams(id: string): Record<string, number | string> {
  try { return JSON.parse(localStorage.getItem('stockmate_indicator_params') || '{}')[id] || {}; } catch { return {}; }
}

function saveParams(id: string, params: Record<string, number | string>) {
  try {
    const all = JSON.parse(localStorage.getItem('stockmate_indicator_params') || '{}');
    all[id] = params;
    localStorage.setItem('stockmate_indicator_params', JSON.stringify(all));
  } catch {}
}

interface InlineParamsProps {
  indicator: SubIndicator;
  onParamsChange: (params: Record<string, number | string>) => void;
}

/** 内联参数面板 — 嵌入副图顶部，非弹窗 */
export function InlineParamsPanel({ indicator, onParamsChange }: InlineParamsProps) {
  const defaults = getDefaultParams(indicator.id);
  const saved = loadSavedParams(indicator.id);
  const [params, setParams] = useState<Record<string, number | string>>({ ...defaults, ...saved });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 参数变化时 debounce 后通知父组件
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveParams(indicator.id, params);
      onParamsChange(params);
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [indicator.id, params, onParamsChange]);

  // indicator 切换时重置参数
  useEffect(() => {
    const d = getDefaultParams(indicator.id);
    const s = loadSavedParams(indicator.id);
    setParams({ ...d, ...s });
  }, [indicator.id]);

  const handleChange = useCallback((key: string, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setParams({ ...defaults });
  }, [defaults]);

  return (
    <div className="px-2 py-1 flex items-center gap-3 flex-wrap" style={{ background: 'hsl(var(--bg-card))', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
      <span className="text-[11px] font-bold shrink-0" style={{ color: 'hsl(var(--text-primary))' }}>
        {indicator.label}
      </span>
      {indicator.params.map((p: ParamDef) => (
        <div key={p.key} className="flex items-center gap-1">
          <span className="text-[10px] shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>{p.label}</span>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step || 1}
            value={Number(params[p.key]) ?? p.default}
            onChange={e => handleChange(p.key, +e.target.value)}
            className="w-16 h-1"
            style={{ accentColor: 'hsl(var(--text-primary))' }}
          />
          <span className="text-[10px] w-6 text-right font-mono" style={{ color: 'hsl(var(--text-primary))' }}>{params[p.key] ?? p.default}</span>
        </div>
      ))}
      <button onClick={handleReset} className="text-[9px] px-1 py-0 rounded hover:opacity-70" style={{ color: 'hsl(var(--text-tertiary))' }}>恢复</button>
    </div>
  );
}
