import { useState, useCallback } from 'react';
import type { SubIndicator, ParamDef } from './types';
import { getDefaultParams } from './compute';

interface Props {
  indicator: SubIndicator;
  onApply: (params: Record<string, number | string>) => void;
  onClose: () => void;
}

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

export default function IndicatorParamsPanel({ indicator, onApply, onClose }: Props) {
  const defaults = getDefaultParams(indicator.id);
  const saved = loadSavedParams(indicator.id);
  const [params, setParams] = useState<Record<string, number | string>>({ ...defaults, ...saved });

  const handleChange = useCallback((key: string, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setParams({ ...defaults });
  }, [defaults]);

  const handleApply = useCallback(() => {
    saveParams(indicator.id, params);
    onApply(params);
    onClose();
  }, [indicator.id, params, onApply, onClose]);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{indicator.label} 参数</span>
        <button onClick={onClose} aria-label="关闭" className="text-xs font-bold hover:opacity-60" style={{ color: 'hsl(var(--text-tertiary))' }}>✕</button>
      </div>
      {indicator.params.map((p: ParamDef) => (
        <div key={p.key} className="flex items-center gap-2">
          <span className="text-[10px] w-14 shrink-0" style={{ color: 'hsl(var(--text-secondary))' }}>{p.label}</span>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step || 1}
            value={Number(params[p.key]) ?? p.default}
            onChange={e => handleChange(p.key, +e.target.value)}
            className="flex-1 h-1"
            style={{ accentColor: 'hsl(var(--text-primary))' }}
          />
          <span className="text-[10px] w-8 text-right font-mono" style={{ color: 'hsl(var(--text-primary))' }}>{params[p.key] ?? p.default}</span>
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={handleReset} className="px-2 py-1 text-[10px] font-bold rounded" style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>恢复默认</button>
        <button onClick={handleApply} className="px-2 py-1 text-[10px] font-bold rounded" style={{ color: 'hsl(var(--bg-root))', background: 'hsl(var(--text-primary))' }}>应用</button>
      </div>
    </div>
  );
}
