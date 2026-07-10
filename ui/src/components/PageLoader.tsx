import { RefreshCw } from 'lucide-react';

interface PageLoaderProps {
  /** Optional hint text shown below the spinner */
  hint?: string;
}

export function PageLoader({ hint }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full min-h-[400px] gap-4 p-8">
      <RefreshCw size={24} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
      {hint && (
        <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Professional skeleton screen for page transitions.
 * Mimics a simple layout structure — header bar, content rows, chart area.
 */
export function PageSkeleton({ hint = '加载中…' }: PageLoaderProps) {
  const pulseClass = 'animate-pulse rounded-md';
  const baseBg = 'bg-black/5 dark:bg-white/10';

  return (
    <div className="flex flex-col h-full w-full p-4 gap-4" aria-label="页面加载中" role="status">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 shrink-0">
        <div className={`h-5 w-24 ${pulseClass} ${baseBg}`} />
        <div className={`h-5 w-16 ${pulseClass} ${baseBg}`} />
        <div className="flex-1" />
        <div className={`h-5 w-20 ${pulseClass} ${baseBg}`} />
      </div>

      {/* Price area skeleton */}
      <div className="flex items-end gap-4 shrink-0">
        <div className={`h-10 w-40 ${pulseClass} ${baseBg}`} />
        <div className={`h-6 w-24 ${pulseClass} ${baseBg}`} />
        <div className={`h-6 w-32 ${pulseClass} ${baseBg}`} />
      </div>

      {/* Divider skeleton */}
      <div className="h-px w-full" style={{ background: 'hsl(var(--border-subtle))' }} />

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 shrink-0">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`h-6 w-12 ${pulseClass} ${baseBg}`} />
        ))}
        <div className="flex-1" />
        <div className={`h-6 w-6 rounded-full ${pulseClass} ${baseBg}`} />
      </div>

      {/* Chart area skeleton — the main visual */}
      <div className={`flex-1 ${pulseClass} ${baseBg} rounded-lg min-h-[200px]`} />

      {/* Bottom info rows skeleton */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <div className={`h-16 ${pulseClass} ${baseBg} rounded-lg`} />
        <div className={`h-16 ${pulseClass} ${baseBg} rounded-lg`} />
        <div className={`h-16 ${pulseClass} ${baseBg} rounded-lg`} />
      </div>

      {/* Hidden accessible text */}
      <span className="sr-only">{hint}</span>
    </div>
  );
}
