import { useState, useMemo, useCallback } from 'react';
import { FileText, Download, Calendar, Filter, BarChart3, PieChart, TrendingUp, FileSpreadsheet, FileJson, Image, Clock, Check, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

// ── 类型 ──

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  format: string[];
  category: string;
}

interface ExportHistory {
  id: string;
  name: string;
  format: string;
  status: 'success' | 'pending' | 'failed';
  createdAt: string;
  size: string;
}

// ── 常量 ──

const STORAGE_KEY_REPORTS = 'stockmate_report_history';

const REPORT_TEMPLATES: ReportTemplate[] = [
  { id: 'portfolio', name: '持仓报告', description: '完整持仓明细、盈亏分析、行业分布', icon: PieChart, format: ['PDF', 'Excel'], category: '资产' },
  { id: 'performance', name: '业绩报告', description: '收益曲线、夏普比率、最大回撤等核心指标', icon: TrendingUp, format: ['PDF', 'Excel'], category: '业绩' },
  { id: 'trade_log', name: '交易记录', description: '所有历史交易记录，含买卖价格和时间', icon: FileSpreadsheet, format: ['Excel', 'CSV'], category: '交易' },
  { id: 'tax_report', name: '税务报告', description: '年度盈亏汇总，适合报税使用', icon: FileText, format: ['PDF', 'Excel'], category: '税务' },
  { id: 'watchlist', name: '自选股报告', description: '自选股列表及实时行情快照', icon: BarChart3, format: ['Excel', 'CSV', 'JSON'], category: '监控' },
  { id: 'backtest', name: '回测报告', description: '策略回测结果、权益曲线、交易明细', icon: FileText, format: ['PDF', 'HTML'], category: '策略' },
];

const MOCK_HISTORY: ExportHistory[] = [
  { id: 'e1', name: '持仓报告', format: 'PDF', status: 'success', createdAt: '2026-08-30 14:30', size: '2.3 MB' },
  { id: 'e2', name: '交易记录', format: 'Excel', status: 'success', createdAt: '2026-08-29 10:15', size: '1.8 MB' },
  { id: 'e3', name: '业绩报告', format: 'PDF', status: 'pending', createdAt: '2026-08-31 09:00', size: '--' },
];

// ── 组件 ──

function ExportHistoryItem({ item }: { item: ExportHistory }) {
  const statusConfig = {
    success: { color: '#10b981', label: '已完成', icon: Check },
    pending: { color: '#f59e0b', label: '生成中', icon: Clock },
    failed: { color: '#ef4444', label: '失败', icon: FileText },
  };
  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
      <div className="p-1.5 rounded-lg" style={{ background: `${config.color}15` }}>
        <Icon size={14} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{item.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-tertiary))' }}>{item.format}</span>
        </div>
        <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.createdAt} · {item.size}</span>
      </div>
      {item.status === 'success' && (
        <button className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" style={{ color: 'hsl(var(--swiss-accent))' }}>
          <Download size={14} />
        </button>
      )}
    </div>
  );
}

export default function ReportPage() {
  const [history, setHistory] = useState<ExportHistory[]>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY_REPORTS); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return MOCK_HISTORY;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [generating, setGenerating] = useState<string | null>(null);

  const categories = useMemo(() => ['all', ...Array.from(new Set(REPORT_TEMPLATES.map(r => r.category)))], []);
  const filtered = useMemo(() => {
    if (selectedCategory === 'all') return REPORT_TEMPLATES;
    return REPORT_TEMPLATES.filter(r => r.category === selectedCategory);
  }, [selectedCategory]);

  const handleExport = useCallback((template: ReportTemplate, format: string) => {
    setGenerating(template.id);
    setTimeout(() => {
      const newExport: ExportHistory = {
        id: 'e' + Date.now(),
        name: template.name,
        format,
        status: 'success',
        createdAt: new Date().toLocaleString('zh-CN'),
        size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
      };
      setHistory(prev => {
        const updated = [newExport, ...prev];
        try { localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
      setGenerating(null);
    }, 2000);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
            <FileText size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>数据导出</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>导出持仓、交易、业绩等各类报告</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{REPORT_TEMPLATES.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>报告模板</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--swiss-accent))' }}>{history.filter(h => h.status === 'success').length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>已导出</span>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            className="px-3 py-1.5 rounded-md text-[10px] font-medium transition-all"
            style={{
              background: selectedCategory === cat ? 'hsl(var(--bg-card))' : 'transparent',
              color: selectedCategory === cat ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))',
            }}>
            {cat === 'all' ? '全部' : cat}
          </button>
        ))}
      </div>

      {/* Report Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map(template => {
          const Icon = template.icon;
          return (
            <motion.div key={template.id} layout whileHover={{ scale: 1.01 }}
              className="glass-card rounded-xl px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))15' }}>
                    <Icon size={16} style={{ color: 'hsl(var(--swiss-accent))' }} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{template.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded ml-1.5" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
                      {template.category}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs mb-3" style={{ color: 'hsl(var(--text-tertiary))' }}>{template.description}</p>
              <div className="flex gap-1.5">
                {template.format.map(fmt => (
                  <button key={fmt} onClick={() => handleExport(template, fmt)} disabled={generating === template.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-40"
                    style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}>
                    {generating === template.id ? (
                      <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: 'hsl(var(--swiss-accent))', borderTopColor: 'transparent' }} />
                    ) : (
                      <Download size={10} />
                    )}
                    {fmt}
                  </button>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Export History */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>导出历史</span>
        </div>
        <div className="space-y-1.5">
          {history.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <FileText size={32} className="mx-auto mb-2" style={{ color: 'hsl(var(--text-tertiary))' }} />
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>暂无导出记录</p>
            </div>
          ) : (
            history.map(item => <ExportHistoryItem key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}
