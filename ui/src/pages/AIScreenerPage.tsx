import { useState, useMemo, useCallback } from 'react';
import { Brain, Sparkles, Search, Filter, TrendingUp, TrendingDown, BarChart3, Zap, RefreshCw, ChevronDown, Star, Clock, Target, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 类型 ──

interface AIScreenerPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tags: string[];
}

interface ScreenerResult {
  code: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  score: number;
  signals: string[];
  matchReason: string;
}

// ── 常量 ──

const STORAGE_KEY_AI_SCREENER = 'stockmate_ai_screener_history';

const AI_PRESETS: AIScreenerPreset[] = [
  { id: 'breakout', name: '突破形态', description: '识别即将突破关键阻力位的股票', icon: TrendingUp, color: '#10b981', tags: ['技术面', '形态'] },
  { id: 'oversold', name: '超卖反弹', description: '寻找严重超卖后可能出现反弹的标的', icon: TrendingDown, color: '#8b5cf6', tags: ['技术面', '反转'] },
  { id: 'momentum', name: '动量策略', description: '捕捉强势上涨趋势中的股票', icon: Zap, color: '#f59e0b', tags: ['趋势', '动量'] },
  { id: 'volume', name: '量价异动', description: '发现异常放量或缩量的个股', icon: BarChart3, color: '#3b82f6', tags: ['量能', '异动'] },
  { id: 'value', name: '价值低估', description: '基于基本面寻找被低估的优质标的', icon: Target, color: '#ef4444', tags: ['基本面', '价值'] },
  { id: 'divergence', name: '指标背离', description: '检测价格与指标的背离信号', icon: AlertTriangle, color: '#ec4899', tags: ['技术面', '背离'] },
];

const MOCK_RESULTS: Record<string, ScreenerResult[]> = {
  breakout: [
    { code: '600519.SH', name: '贵州茅台', price: 2012.8, change: 1.2, volume: 3200000, score: 92, signals: ['MA5上穿MA20', '接近阻力位'], matchReason: '均线多头排列，成交量温和放大，接近前高阻力位' },
    { code: '000858.SZ', name: '五粮液', price: 168.5, change: 2.1, volume: 5600000, score: 88, signals: ['突破平台', 'MACD金叉'], matchReason: '横盘整理后放量突破，MACD形成金叉' },
    { code: '601318.SH', name: '中国平安', price: 52.3, change: 0.8, volume: 12000000, score: 85, signals: ['触及年线', 'RSI回升'], matchReason: '股价触及年线后企稳，RSI从超卖区回升' },
  ],
  oversold: [
    { code: '300750.SZ', name: '宁德时代', price: 198.5, change: -3.2, volume: 8900000, score: 78, signals: ['RSI<30', '接近支撑'], matchReason: 'RSI进入超卖区域，接近重要支撑位' },
    { code: '002594.SZ', name: '比亚迪', price: 265.0, change: -2.8, volume: 6700000, score: 75, signals: ['布林下轨', 'KDJ超卖'], matchReason: '触及布林带下轨，KDJ指标超卖' },
  ],
  momentum: [
    { code: '601012.SH', name: '隆基绿能', price: 28.6, change: 4.5, volume: 15000000, score: 91, signals: ['连涨3日', '量价齐升'], matchReason: '连续放量上涨，主力资金持续流入' },
    { code: '002475.SZ', name: '立讯精密', price: 35.2, change: 3.8, volume: 9800000, score: 87, signals: ['突破前高', 'MACD强势'], matchReason: '突破前期高点，MACD处于强势区域' },
    { code: '600036.SH', name: '招商银行', price: 38.9, change: 2.1, volume: 8200000, score: 83, signals: ['均线多头', '资金流入'], matchReason: '均线呈多头排列，北向资金持续买入' },
  ],
  volume: [
    { code: '000001.SZ', name: '平安银行', price: 12.35, change: 1.5, volume: 62000000, score: 82, signals: ['放量3倍', '突破平台'], matchReason: '成交量突然放大至3倍，伴随价格突破' },
    { code: '601899.SH', name: '紫金矿业', price: 18.7, change: -0.8, volume: 45000000, score: 76, signals: ['缩量回调', '支撑有效'], matchReason: '上涨后缩量回调，测试支撑位有效性' },
  ],
  value: [
    { code: '601398.SH', name: '工商银行', price: 6.28, change: 0.3, volume: 25000000, score: 85, signals: ['PE<6', '股息率>5%'], matchReason: '市盈率低于6倍，股息率超过5%，估值偏低' },
    { code: '600900.SH', name: '长江电力', price: 28.5, change: 0.5, volume: 7800000, score: 82, signals: ['现金流稳定', '高分红'], matchReason: '现金流充裕，连续高比例分红' },
  ],
  divergence: [
    { code: '600519.SH', name: '贵州茅台', price: 2012.8, change: 0.8, volume: 3200000, score: 88, signals: ['RSI底背离', '价格新低'], matchReason: '价格创新低但RSI未创新低，形成底背离' },
    { code: '000858.SZ', name: '五粮液', price: 168.5, change: 1.2, volume: 5600000, score: 84, signals: ['MACD背离', '成交量萎缩'], matchReason: 'MACD柱状线与价格走势背离' },
  ],
};

// ── 组件 ──

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : score >= 70 ? '#f59e0b' : '#ef4444';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${color}15`, color }}>
      <Sparkles size={10} />
      {score}
    </span>
  );
}

export default function AIScreenerPage() {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_AI_SCREENER) || '[]'); } catch { return []; }
  });

  const runScreener = useCallback((presetId: string) => {
    setIsRunning(true);
    setSelectedPreset(presetId);
    setResults([]);
    // Simulate AI processing
    setTimeout(() => {
      setResults(MOCK_RESULTS[presetId] || []);
      setIsRunning(false);
      const preset = AI_PRESETS.find(p => p.id === presetId);
      if (preset) {
        const newHistory = [`${preset.name} - ${new Date().toLocaleString('zh-CN')}`, ...history.slice(0, 9)];
        setHistory(newHistory);
        try { localStorage.setItem(STORAGE_KEY_AI_SCREENER, JSON.stringify(newHistory)); } catch { /* ignore */ }
      }
    }, 1500);
  }, [history]);

  const runCustomQuery = useCallback(() => {
    if (!customQuery.trim()) return;
    setIsRunning(true);
    setSelectedPreset(null);
    setResults([]);
    setTimeout(() => {
      setResults(MOCK_RESULTS.momentum || []);
      setIsRunning(false);
      const newHistory = [`自定义: ${customQuery.slice(0, 30)} - ${new Date().toLocaleString('zh-CN')}`, ...history.slice(0, 9)];
      setHistory(newHistory);
      try { localStorage.setItem(STORAGE_KEY_AI_SCREENER, JSON.stringify(newHistory)); } catch { /* ignore */ }
    }, 2000);
  }, [customQuery, history]);

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
            <Brain size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>AI 智能选股</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>基于多维度分析，AI 为您筛选最优标的</p>
          </div>
        </div>
        <div className="flex gap-6 mt-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{AI_PRESETS.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>选股策略</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{results.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>匹配结果</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{history.length}</span>
            <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>历史查询</span>
          </div>
        </div>
      </div>

      {/* Custom Query */}
      <div className="glass-card rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: '#8b5cf6' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>自然语言选股</span>
        </div>
        <div className="flex gap-2">
          <input value={customQuery} onChange={e => setCustomQuery(e.target.value)}
            placeholder="描述你想找的股票，如：连续3天放量上涨的中小盘股"
            onKeyDown={e => e.key === 'Enter' && runCustomQuery()}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }} />
          <button onClick={runCustomQuery} disabled={isRunning || !customQuery.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
            {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
            AI 分析
          </button>
        </div>
      </div>

      {/* Preset Strategies */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>快速策略</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {AI_PRESETS.map(preset => {
            const Icon = preset.icon;
            const isActive = selectedPreset === preset.id;
            return (
              <motion.button key={preset.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={() => runScreener(preset.id)} disabled={isRunning}
                className="glass-card rounded-xl px-4 py-3 text-left transition-all disabled:opacity-50"
                style={isActive ? { border: `1px solid ${preset.color}40`, background: `${preset.color}08` } : undefined}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg" style={{ background: `${preset.color}15` }}>
                    <Icon size={14} style={{ color: preset.color }} />
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{preset.name}</span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'hsl(var(--text-tertiary))' }}>{preset.description}</p>
                <div className="flex gap-1 mt-2">
                  {preset.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: `${preset.color}10`, color: preset.color }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {isRunning && (
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: '#8b5cf6', borderTopColor: 'transparent' }} />
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>AI 正在分析市场数据...</p>
          <p className="text-xs mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>综合技术面、基本面、资金面多维度评估</p>
        </div>
      )}

      {/* Results */}
      {!isRunning && results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
              共找到 {results.length} 个匹配标的
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
              AI 评分排序
            </span>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <motion.div key={r.code} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="glass-card rounded-xl px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{r.name}</span>
                    <span className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>{r.code}</span>
                    <ScoreBadge score={r.score} />
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>¥{r.price.toFixed(2)}</span>
                    <span className="text-xs ml-2 font-medium" style={{ color: r.change >= 0 ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))' }}>
                      {r.change >= 0 ? '+' : ''}{r.change.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs mb-2" style={{ color: 'hsl(var(--text-secondary))' }}>{r.matchReason}</p>
                <div className="flex items-center gap-2">
                  {r.signals.map(sig => (
                    <span key={sig} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
                      {sig}
                    </span>
                  ))}
                  <span className="text-[10px] ml-auto" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    成交量 {(r.volume / 10000).toFixed(0)}万
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {!isRunning && results.length === 0 && history.length > 0 && (
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>最近查询</span>
          </div>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
                <Clock size={10} />
                {h}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isRunning && results.length === 0 && history.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Brain size={48} className="mx-auto mb-3" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>选择策略或输入自然语言开始选股</p>
          <p className="text-xs mt-1" style={{ color: 'hsl(var(--text-tertiary))' }}>AI 将从全市场 5000+ 只股票中为您智能筛选</p>
        </div>
      )}
    </div>
  );
}
