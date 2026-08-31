import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Bell, FileText, TrendingUp, AlertCircle, Filter } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'earnings' | 'dividend' | 'economic' | 'ipo' | 'holiday';
  importance: 'high' | 'medium' | 'low';
  stock?: string;
  description: string;
}

// ── 常量 ──

const MOCK_EVENTS: CalendarEvent[] = [
  { id: '1', date: '2026-09-01', title: '贵州茅台 半年报披露', type: 'earnings', importance: 'high', stock: '600519.SH', description: '2026年半年度报告' },
  { id: '2', date: '2026-09-03', title: '中国8月PMI数据', type: 'economic', importance: 'high', description: '国家统计局发布制造业PMI' },
  { id: '3', date: '2026-09-05', title: '宁德时代 除权除息', type: 'dividend', importance: 'medium', stock: '300750.SZ', description: '每10股派发现金红利3.5元' },
  { id: '4', date: '2026-09-08', title: '比亚迪 三季报预告', type: 'earnings', importance: 'medium', stock: '002594.SZ', description: '2026年前三季度业绩预告' },
  { id: '5', date: '2026-09-10', title: '中国8月CPI/PPI', type: 'economic', importance: 'high', description: '国家统计局发布通胀数据' },
  { id: '6', date: '2026-09-12', title: '美联储议息会议', type: 'economic', importance: 'high', description: 'FOMC利率决议' },
  { id: '7', date: '2026-09-15', title: '招商银行 除权除息', type: 'dividend', importance: 'low', stock: '600036.SH', description: '每10股派发现金红利5.2元' },
  { id: '8', date: '2026-09-18', title: '某科技股 IPO申购', type: 'ipo', importance: 'medium', description: '深圳某科技公司新股申购' },
  { id: '9', date: '2026-09-20', title: '中国8月社融数据', type: 'economic', importance: 'high', description: '央行发布社会融资规模' },
  { id: '10', date: '2026-09-22', title: '比亚迪 除权除息', type: 'dividend', importance: 'medium', stock: '002594.SZ', description: '每10股派发现金红利2.8元' },
  { id: '11', date: '2026-09-25', title: '东方财富 半年报披露', type: 'earnings', importance: 'medium', stock: '300059.SZ', description: '2026年半年度报告' },
  { id: '12', date: '2026-09-28', title: '中秋假期休市', type: 'holiday', importance: 'low', description: '中秋节假期A股休市' },
  { id: '13', date: '2026-09-30', title: '中国9月官方PMI', type: 'economic', importance: 'high', description: '制造业采购经理指数' },
  { id: '14', date: '2026-10-01', title: '国庆假期休市', type: 'holiday', importance: 'low', description: '国庆节假期A股休市' },
  { id: '15', date: '2026-10-08', title: '中国9月进出口数据', type: 'economic', importance: 'medium', description: '海关总署发布贸易数据' },
];

const TYPE_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  earnings: { color: '#3b82f6', icon: FileText, label: '财报' },
  dividend: { color: '#10b981', icon: TrendingUp, label: '分红' },
  economic: { color: '#f59e0b', icon: AlertCircle, label: '经济' },
  ipo: { color: '#8b5cf6', icon: Bell, label: 'IPO' },
  holiday: { color: '#64748b', icon: Clock, label: '休市' },
};

const IMPORTANCE_MAP: Record<string, string> = { high: '🔴', medium: '🟡', low: '⚪' };

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// ── 主页面 ──

export default function FinancialCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 8, 1)); // Sep 2026
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const events = useMemo(() => {
    return MOCK_EVENTS.filter(e => !filterType || e.type === filterType);
  }, [filterType]);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
    // Padding for first week
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ day: d, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      days.push({ day: d, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, isCurrentMonth: false });
    }
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }, [events]);

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const monthLabel = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>财务日历</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>财报披露、分红除权、经济数据一览</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
              <button key={type} onClick={() => setFilterType(filterType === type ? null : type)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
                style={{ background: filterType === type ? `${cfg.color}20` : 'hsl(var(--bg-secondary))', color: filterType === type ? cfg.color : 'hsl(var(--text-tertiary))', border: `1px solid ${filterType === type ? `${cfg.color}40` : 'transparent'}` }}>
                <cfg.icon size={10} />
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card rounded-xl px-5 py-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{monthLabel}</span>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--text-tertiary))' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold py-1" style={{ color: 'hsl(var(--text-tertiary))' }}>{d}</div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map(({ day, dateStr, isCurrentMonth }) => {
              const dayEvents = eventsByDate[dateStr] || [];
              const today = dateStr === '2026-09-01';
              const selected = dateStr === selectedDate;
              return (
                <motion.button key={dateStr} whileHover={{ scale: 1.05 }}
                  onClick={() => setSelectedDate(dateStr)}
                  className="relative flex flex-col items-center py-1.5 rounded-lg transition-all"
                  style={{
                    background: selected ? 'hsl(var(--swiss-accent))' : today ? 'hsl(var(--swiss-accent) / 0.1)' : 'transparent',
                    color: selected ? 'white' : isCurrentMonth ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
                    opacity: isCurrentMonth ? 1 : 0.4,
                  }}>
                  <span className="text-xs font-medium">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map(e => (
                        <span key={e.id} className="w-1 h-1 rounded-full" style={{ background: TYPE_CONFIG[e.type].color }} />
                      ))}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Event Detail Panel */}
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
              {selectedDate ? `${selectedDate} 事件` : '选择日期查看事件'}
            </span>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar size={32} style={{ color: 'hsl(var(--text-tertiary))', opacity: 0.3 }} />
              <p className="text-xs mt-2" style={{ color: 'hsl(var(--text-tertiary))' }}>
                {selectedDate ? '当日无事件' : '点击日历上的日期'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(e => {
                const cfg = TYPE_CONFIG[e.type];
                return (
                  <motion.div key={e.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))', borderLeft: `3px solid ${cfg.color}` }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${cfg.color}15`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px]">{IMPORTANCE_MAP[e.importance]}</span>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{e.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{e.description}</p>
                    {e.stock && (
                      <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--bg-primary))', color: 'hsl(var(--text-tertiary))' }}>
                        {e.stock}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Upcoming Events */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid hsl(var(--border-default))' }}>
            <span className="text-[10px] font-semibold" style={{ color: 'hsl(var(--text-tertiary))' }}>近期重要事件</span>
            <div className="space-y-1.5 mt-2">
              {MOCK_EVENTS.filter(e => e.importance === 'high').slice(0, 4).map(e => {
                const cfg = TYPE_CONFIG[e.type];
                return (
                  <div key={e.id} className="flex items-center gap-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
                    <span className="text-[10px] shrink-0 w-16" style={{ color: 'hsl(var(--text-tertiary))' }}>{e.date.slice(5)}</span>
                    <span className="text-[10px] truncate" style={{ color: 'hsl(var(--text-secondary))' }}>{e.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
