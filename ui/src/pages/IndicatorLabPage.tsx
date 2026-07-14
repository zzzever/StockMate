import { useState } from 'react';
import { BarChart3, FlaskConical } from 'lucide-react';

/**
 * IndicatorLabPage — 指标实验室占位页面。
 * TODO: 实现技术指标组合回测、参数调优等高级功能。
 */
export default function IndicatorLabPage() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center h-full px-4" style={{ paddingTop: '15vh' }}>
      <div className="flex items-center gap-3 mb-4">
        <FlaskConical size={32} style={{ color: 'hsl(var(--swiss-accent))' }} />
        <h1 className="text-3xl font-bold text-gradient">指标实验室</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'hsl(var(--text-secondary))' }}>
        技术指标组合回测与参数调优（开发中）
      </p>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-colors"
        style={{
          color: 'hsl(var(--swiss-accent))',
          border: '1px solid hsl(var(--swiss-accent) / 0.3)',
          background: 'hsl(var(--swiss-accent) / 0.1)',
        }}
      >
        <BarChart3 size={14} />
        点击次数：{count}
      </button>
      <p className="mt-4 text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>
        此页面为占位页面，实际功能待实现
      </p>
    </div>
  );
}
