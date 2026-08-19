import { useMemo } from 'react';
import { useMarketOverview } from '@/hooks/useTauriQuery';

/** 市场温度分级 */
export type TempZone =
  | '冰点'      // <= 10
  | '冷点'      // >10 且 <20
  | '常温'      // 20-79
  | '热点'      // >= 80（含 80）
  | '沸点'      // >= 90（含 90，沸点覆盖热点）

export interface MarketTemp {
  temperature: number;   // 1-100
  zone: TempZone;
  label: string;
  color: string;         // hue 字符串
  advice: string;
}

/** 用涨跌家数和情绪指数计算市场温度（1-100） */
export function calcMarketTemp(upCount: number, downCount: number, flatCount: number, sentiment?: number): MarketTemp {
  const total = upCount + downCount + flatCount;
  const ratio = total > 0 ? upCount / total : 0.5; // 0~1，上涨比例
  // sentiment 0~1，若未提供则用 ratio 替代
  const s = typeof sentiment === 'number' ? sentiment : ratio;

  // 综合：上涨比例(70%) + 情绪(30%)
  let temp = Math.round(ratio * 70 + s * 30);
  temp = Math.max(1, Math.min(100, temp));

  let zone: TempZone;
  let color: string;
  let advice: string;

  if (temp <= 10) { zone = '冰点'; color = '#3b82f6'; advice = '市场极度低迷，遍地便宜货，可逐步低吸有基本面支撑的标的，但要控制仓位耐心等待企稳。'; }
  else if (temp < 20) { zone = '冷点'; color = '#22c55e'; advice = '市场偏冷，风险有限，适合逢低布局优质股，观察量能是否回暖。'; }
  else if (temp < 80) { zone = '常温'; color = '#f59e0b'; advice = '市场中性，结构分化，精选个股、控制仓位，按规则操作。'; }
  else if (temp < 90) { zone = '热点'; color = '#f97316'; advice = '市场转热，赚钱效应提升，可积极参与强势股，但仍需设好止损。'; }
  else { zone = '沸点'; color = '#ef4444'; advice = '市场过热，情绪亢奋，警惕冲高回落，逢高兑现利润、切忌追高。'; }

  return { temperature: temp, zone, label: `${temp}°`, color, advice };
}

const ZONE_MARKS = [
  { at: 10, label: '冰点', color: '#3b82f6' },
  { at: 20, label: '冷点', color: '#22c55e' },
  { at: 80, label: '热点', color: '#f97316' },
  { at: 90, label: '沸点', color: '#ef4444' },
];

export default function MarketThermometer() {
  const { data: overview } = useMarketOverview();

  const temp = useMemo(() => {
    if (!overview) return null;
    return calcMarketTemp(overview.up_count, overview.down_count, overview.flat_count, overview.sentiment_index);
  }, [overview]);

  if (!temp) return null;

  const pct = temp.temperature; // 0-100 scale directly as percentage

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-4">
        {/* 温度计 */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-6 h-36 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
            {/* 渐变填充（从底部蓝/绿到顶部红，模拟温度） */}
            <div className="absolute bottom-0 left-0 right-0" style={{ height: `${pct}%`, background: `linear-gradient(to top, #3b82f6, #22c55e, #f59e0b, #f97316, #ef4444)` }} />
            {/* 刻度线 */}
            {[10, 20, 50, 80, 90].map(t => (
              <div key={t} className="absolute left-0 right-0 border-t border-white/40" style={{ bottom: `${t}%` }} />
            ))}
          </div>
          <div className="mt-1 text-lg font-black" style={{ color: temp.color }}>{temp.temperature}°</div>
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-heading-sm" style={{ color: 'var(--text-primary)' }}>🌡️ 市场温度</span>
            <span className="text-data-sm font-bold px-2 py-0.5 rounded-sm" style={{ background: temp.color + '33', color: temp.color }}>
              {temp.zone}
            </span>
          </div>
          <div className="text-data-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{temp.advice}</div>

          {/* 区间标尺 */}
          <div className="relative h-2 mt-3 rounded-full overflow-hidden"
            style={{ background: 'linear-gradient(to right, #3b82f6, #22c55e, #f59e0b, #f97316, #ef4444)' }}>
            <div className="absolute top-0 bottom-0 w-1.5 rounded-full bg-white shadow" style={{ left: `calc(${pct}% - 3px)` }} />
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {ZONE_MARKS.map(m => (
              <span key={m.at} style={{ color: m.color }}>{m.label}{m.at}°</span>
            ))}
          </div>
        </div>
      </div>

      {/* 涨跌家数 */}
      {overview && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-data-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <span>上涨 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-up))' }}>{overview.up_count}</b></span>
          <span>下跌 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-down))' }}>{overview.down_count}</b></span>
          <span>平盘 <b className="font-mono-nums">{overview.flat_count}</b></span>
        </div>
      )}
    </div>
  );
}
