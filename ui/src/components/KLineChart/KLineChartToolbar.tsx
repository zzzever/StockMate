import { type ChartStyle } from '@/config/chartThemes';

export type KLinePeriod = 'minute' | 'day' | 'week' | 'month';
export type KLineRange = '1mo' | '3mo' | '6mo' | '1yr';
export type IndicatorType = 'macd' | 'kdj' | 'rsi' | null;

const PERIOD_LABELS: Record<KLinePeriod, string> = { minute: '分时', day: '日', week: '周', month: '月' };
const RANGE_LABELS: Record<KLineRange, string> = { '1mo': '1月', '3mo': '3月', '6mo': '6月', '1yr': '1年' };
const INDICATOR_LABELS: Record<string, string> = { macd: 'MACD', kdj: 'KDJ', rsi: 'RSI' };
const PERIODS: KLinePeriod[] = ['minute', 'day', 'week', 'month'];
const RANGES: KLineRange[] = ['1mo', '3mo', '6mo', '1yr'];
const INDICATORS: IndicatorType[] = ['macd', 'kdj', 'rsi', null];
const STYLES: ChartStyle[] = ['classic', 'kawaii', 'dark', 'neon', 'minimal'];

interface KLineChartToolbarProps {
  period: KLinePeriod;
  range: KLineRange;
  chartStyle: ChartStyle;
  activeIndicator: IndicatorType;
  onPeriodChange: (p: KLinePeriod) => void;
  onRangeChange: (r: KLineRange) => void;
  onChartStyleChange: (s: ChartStyle) => void;
  onIndicatorToggle: (i: IndicatorType) => void;
  themes: Record<ChartStyle, { name: string; icon: string }>;
}

export function KLineChartToolbar({
  period, range, chartStyle, activeIndicator, themes,
  onPeriodChange, onRangeChange, onChartStyleChange, onIndicatorToggle,
}: KLineChartToolbarProps) {
  // Static arrays moved to module scope
  const btnBase = 'px-1.5 py-0.5 text-[10px] font-medium rounded transition-all border';
  const activeBtn = 'bg-violet-600 border-violet-500 text-white';
  const inactiveBtn = 'border-gray-300 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400';

  return (
    <div className="flex flex-wrap items-center gap-1 px-1.5 py-1">
      {/* Period */}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="周期">
        {PERIODS.map((p) => (
          <button key={p} onClick={() => onPeriodChange(p)} role="radio" aria-checked={p === period} className={`${btnBase} ${p === period ? activeBtn : inactiveBtn}`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-gray-300 dark:bg-zinc-700" />
      {/* Range */}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="时间范围">
        {RANGES.map((r) => (
          <button key={r} onClick={() => onRangeChange(r)} role="radio" aria-checked={r === range} className={`${btnBase} ${r === range ? activeBtn : inactiveBtn}`}>
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-gray-300 dark:bg-zinc-700" />
      {/* Indicators */}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="指标">
        {INDICATORS.map((ind) => (
          <button
            key={ind ?? 'none'}
            onClick={() => onIndicatorToggle(ind)}
            role="radio"
            aria-checked={ind === activeIndicator}
            className={`${btnBase} ${ind === activeIndicator ? activeBtn : inactiveBtn}`}
          >
            {ind ? INDICATOR_LABELS[ind] : '无'}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      {/* Theme */}
      <div className="flex items-center gap-1" role="radiogroup" aria-label="主题">
        {STYLES.map((s) => (
          <button
            key={s}
            onClick={() => onChartStyleChange(s)}
            role="radio"
            aria-checked={s === chartStyle}
            className={`text-xs px-1.5 py-0.5 rounded transition-all ${s === chartStyle ? 'bg-violet-600/20 text-violet-400 ring-1 ring-violet-500' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
            title={themes[s]?.name ?? s}
          >
            {themes[s]?.icon ?? s}
          </button>
        ))}
      </div>
    </div>
  );
}
