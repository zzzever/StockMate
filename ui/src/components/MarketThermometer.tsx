import { useMemo } from 'react';
import { useMarketOverview, useMarketTempHistory } from '@/hooks/useTauriQuery';

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

/** 根据涨跌家数 + 情绪指数计算市场温度（1-100） */
export function calcMarketTemp(upCount: number, downCount: number, flatCount: number, sentiment?: number, overrideTemp?: number): MarketTemp {
  const total = upCount + downCount + flatCount;
  const s = typeof sentiment === 'number' && isFinite(sentiment) ? sentiment : 0.5;
  // 当总数为 0（无个股数据），纯用情绪指数
  const ratio = total > 0 ? upCount / total : s;
  // 综合：上涨比例(70%) + 情绪(30%)
  let temp = overrideTemp ?? Math.round(ratio * 70 + s * 30);
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
  const { data: history = [] } = useMarketTempHistory(30);

  const temp = useMemo(() => {
    if (!overview) return null;
    // 优先使用后端板块驱动的温度/区间；缺省时前端用板块涨跌比例自行计算
    const hasBackend = typeof overview.temperature === 'number';
    if (hasBackend) {
      const t = overview.temperature as number;
      return {
        // overrideTemp 传入后端温度，保证 advice 文案与展示温度一致
        ...calcMarketTemp(overview.up_count, overview.down_count, overview.flat_count, overview.sentiment_index, t),
        temperature: t,
        zone: (overview.temp_zone || zoneOf(t)) as TempZone,
        color: zoneOfColor(overview.temp_zone || zoneOf(t)),
        label: `${t}°`,
      };
    }
    return calcMarketTemp(overview.up_count, overview.down_count, overview.flat_count, overview.sentiment_index);
  }, [overview]);

  if (!overview) return null;
  if (!temp) return null;

  const pct = temp.temperature;
  // 历史温度（最新在前），反转成正序展示
  const histAsc = [...history].reverse();
  // 板块驱动由后端 temperature 字段标识；缺省时走指数/前端自算
  const isSectorDriven = typeof overview.temperature === 'number';
  const unitLabel = isSectorDriven ? '板块' : '指数';
  const canShowUpDown = overview.up_count > 0 || overview.down_count > 0;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-4">
        {/* 温度计 */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative w-6 h-36 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
            <div className="absolute bottom-0 left-0 right-0" style={{ height: `${pct}%`, background: `linear-gradient(to top, #3b82f6, #22c55e, #f59e0b, #f97316, #ef4444)` }} />
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
            <span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>
              板块驱动
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

      {/* 指标行：指数驱动时显示 4 大指数涨跌，否则显示个股涨跌家数 */}
      {overview && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-data-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {canShowUpDown ? (
            <>
              <span>{unitLabel}上涨 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-up))' }}>{overview.up_count}</b></span>
              <span>{unitLabel}下跌 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-down))' }}>{overview.down_count}</b></span>
            </>
          ) : (
            <>
              <span>上涨 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-up))' }}>{overview.up_count}</b></span>
              <span>下跌 <b className="font-mono-nums" style={{ color: 'hsl(var(--price-down))' }}>{overview.down_count}</b></span>
            </>
          )}
          <span className="ml-auto">情绪 {Math.round((overview.sentiment_index ?? 0) * 100)}</span>
        </div>
      )}

      {/* 历史温度曲线 */}
      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-data-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>📅 近 {history.length} 日温度</span>
            <span className="text-data-xs" style={{ color: 'var(--text-tertiary)' }}>最新 {temp.zone}</span>
          </div>
          <div className="flex items-end gap-[2px] h-10">
            {histAsc.map((h, i) => (
              <div key={h.date} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${h.date} · ${h.temperature}° · ${h.zone}`}>
                <div className={`w-full rounded-sm transition-all ${i === histAsc.length - 1 ? 'ring-1 ring-white/60' : ''}`}
                  style={{ height: `${Math.max(6, h.temperature)}%`, background: zoneColor(h.zone) }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            <span>{histAsc[0]?.date?.slice(5)}</span>
            <span>{histAsc[histAsc.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function zoneColor(zone: string): string {
  switch (zone) {
    case '冰点': return '#3b82f6';
    case '冷点': return '#22c55e';
    case '热点': return '#f97316';
    case '沸点': return '#ef4444';
    default: return '#f59e0b';
  }
}

/** 温度 → 区间名 */
function zoneOf(t: number): string {
  if (t <= 10) return '冰点';
  if (t < 20) return '冷点';
  if (t < 80) return '常温';
  if (t < 90) return '热点';
  return '沸点';
}

/** 区间名 → 主色 */
function zoneOfColor(zone: string): string {
  switch (zone) {
    case '冰点': return '#3b82f6';
    case '冷点': return '#22c55e';
    case '热点': return '#f97316';
    case '沸点': return '#ef4444';
    default: return '#f59e0b';
  }
}
