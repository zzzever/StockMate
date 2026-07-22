import { useMemo } from 'react';

interface MiniTrendProps {
  prices?: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function MiniTrend({ prices, width = 80, height = 24, color }: MiniTrendProps) {
  const path = useMemo(() => {
    if (!prices || prices.length < 2) return '';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    return prices.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${(i / (prices.length - 1)) * width},${(1 - (p - min) / range) * height}`
    ).join(' ');
  }, [prices, width, height]);

  if (!prices || prices.length < 2) {
    return <div className="h-6 w-20 rounded-sm" style={{ background: 'var(--bg-input)' }} />;
  }

  const up = prices[prices.length - 1] >= prices[0];
  const lineColor = color || (up ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={path} />
    </svg>
  );
}
