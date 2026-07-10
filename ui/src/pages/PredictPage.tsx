import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, Bot, ArrowLeft, RefreshCw,
  Target, BarChart3, AlertTriangle, CheckCircle2, Activity,
  Zap, Globe, ShieldAlert, Calendar, Settings,
} from 'lucide-react';
import { useAnalyzeAll, useStockHistory, useRealtimeQuote, useStockFinance, useDeepSeekConfig, useStockDetail } from '@/hooks/useTauriQuery';
import type { DeepSeekPrediction, MultiDimensionAnalysis, CardData, MarketEnvironment, Quote } from '@/types';
import { fmtPrice, fmtPct } from '@/lib/format';

// ── helpers ──
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function safePct(v: number): string { return Number.isFinite(v) ? (v * 100).toFixed(1) : '--'; }
function fmtConfidence(v: number): string { return Number.isFinite(v) ? `${(v * 100).toFixed(0)}%` : '--'; }
function fmtBars(quotes: Quote[] | undefined | null, take: number = 60): string {
  return (quotes ?? []).slice(-take).map(q =>
    `${q.date} O:${q.open} H:${q.high} L:${q.low} C:${q.close}`
  ).join('\n');
}
function isValidMultiDim(obj: unknown): obj is MultiDimensionAnalysis {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.technical === 'object' && o.technical !== null
    && typeof o.capital_flow === 'object' && o.capital_flow !== null
    && typeof o.fundamental === 'object' && o.fundamental !== null
    && typeof o.sentiment === 'object' && o.sentiment !== null
    && typeof o.composite === 'object' && o.composite !== null;
}

const DIR_ICON: Record<string, typeof TrendingUp> = { up: TrendingUp, down: TrendingDown, sideways: Minus };
const DIR_COLOR: Record<string, string> = { up: 'text-red-700', down: 'text-blue-700', sideways: 'text-amber-600' };
const DIR_BG: Record<string, string> = { up: 'bg-red-50 border-red-300', down: 'bg-blue-50 border-blue-300', sideways: 'bg-amber-50 border-amber-300' };
const DIR_LABEL: Record<string, string> = { up: '看涨', down: '看跌', sideways: '震荡' };

// ── History storage ──
interface HistoryEntry { date: string; prediction: DeepSeekPrediction | null; multi: MultiDimensionAnalysis | null; card: CardData | null; market: MarketEnvironment | null; }
function loadAllHistory(): Record<string, HistoryEntry> { try { return JSON.parse(localStorage.getItem('stockmate_pred_full') || '{}'); } catch { return {}; } }
function saveHistoryEntry(stockId: string, entry: HistoryEntry) {
  try {
    const all = loadAllHistory();
    all[stockId] = entry;
    localStorage.setItem('stockmate_pred_full', JSON.stringify(all));
  } catch (e) {
    console.error('Failed to save prediction history:', e);
  }
}
function getHistoryDates(stockId: string): string[] { const e = loadAllHistory()[stockId]; return e?.date ? [e.date] : []; }

// ── Component ──
export default function PredictPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stockId = searchParams.get('code') || '';
  const isValidStock = stockId.includes('.');
  const effectiveId = isValidStock ? stockId : '';
  const { data: config, isLoading: configLoading, error: configError, refetch: refetchConfig } = useDeepSeekConfig();
  const hasKey = config?.has_key ?? false;

  // Read cached data from stock detail page
  const { data: stockDetail, error: detailError, refetch: refetchDetail } = useStockDetail(effectiveId);
  const { data: dailyQuotes, error: dailyError, refetch: refetchDaily } = useStockHistory(effectiveId, 60, 'day');
  const { data: weeklyQuotes, error: weeklyError, refetch: refetchWeekly } = useStockHistory(effectiveId, 12, 'week');
  const { data: monthlyQuotes, error: monthlyError, refetch: refetchMonthly } = useStockHistory(effectiveId, 12, 'month');
  const { data: realtimeQuote, error: quoteError, refetch: refetchQuote } = useRealtimeQuote(effectiveId);
  const { data: finance, error: financeError, refetch: refetchFinanceData } = useStockFinance(effectiveId);

  const currentPrice = Number(realtimeQuote?.current_price ?? dailyQuotes?.[dailyQuotes.length - 1]?.close ?? 0);

  const stockName = stockDetail?.name || '';
  const ticker = stockDetail?.ticker || stockId.split('.').shift() || '';

  const prevClose = Number(realtimeQuote?.prev_close ?? (dailyQuotes && dailyQuotes.length > 1 ? dailyQuotes[dailyQuotes.length - 2].close : currentPrice));

  const { data: allData, isLoading, error, refetch } = useAnalyzeAll({
    stockId,
    name: stockName,
    code: ticker,
    price: currentPrice,
    prevClose,
    dailyText: fmtBars(dailyQuotes, 60),
    weeklyText: fmtBars(weeklyQuotes, 12),
    monthlyText: fmtBars(monthlyQuotes, 12),
    grossMargin: finance?.gross_margin ?? null,
    roe: finance?.roe ?? null,
    debtRatio: finance?.debt_ratio ?? null,
  });

  // Load/save history
  const [historyDates, setHistoryDates] = useState<string[]>(() => getHistoryDates(stockId));
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [historyData, setHistoryData] = useState<HistoryEntry | null>(null);

  // Refresh history list when stockId changes
  useEffect(() => { setHistoryDates(getHistoryDates(stockId)); setSelectedDate(''); setHistoryData(null); }, [stockId]);

  // Extract data from unified response
  const prediction = allData?.prediction ?? null;
  let multiDim: MultiDimensionAnalysis | null = allData && isValidMultiDim(allData) ? allData : null;
  // Synthesize briefing from card_reason when AI briefing is missing
  if (multiDim && !multiDim.briefing && allData?.card_reason) {
    multiDim.briefing = {
      commentary: allData.card_reason,
      key_numbers: [],
      risk_warnings: [],
      trading_notes: [],
    };
  }
  const card: CardData | null = allData?.card_reason ? { stock_id: stockId, ticker, name: stockName, price: currentPrice, change_percent: realtimeQuote?.change_percent ?? 0, recommendation: allData.card_reason, buy_signal: allData?.prediction?.direction === 'up' && (allData?.prediction?.confidence ?? 0) > 0.6, late_rush: false, tags: allData?.card_tags ?? [], generated_at: new Date().toISOString() } : null;
  const marketEnv: MarketEnvironment | null = allData?.market ?? null;

  // Save latest data to history after each successful fetch
  const lastSavedRef = useRef('');
  useEffect(() => {
    if (!stockId || !allData) return;
    const key = stockId + '_' + todayStr();
    if (key === lastSavedRef.current) return;
    lastSavedRef.current = key;
    saveHistoryEntry(stockId, { date: todayStr(), prediction, multi: multiDim, card, market: marketEnv });
    setHistoryDates(getHistoryDates(stockId));
  }, [stockId, allData]);

  const activePred = historyData?.prediction ?? prediction;
  const activeMulti = historyData?.multi ?? multiDim;
  const activeCard = historyData?.card ?? card;
  const activeMarket = historyData?.market ?? marketEnv;

  const [activeTab, setActiveTab] = useState<'predict' | 'multi' | 'card' | 'market' | 'history'>('predict');

  const anyLoading = isLoading || configLoading;
  const errors = error ? [error] : [];
  const dataErrors: { label: string; error: Error; retry: () => void }[] = [];
  if (detailError) dataErrors.push({ label: '个股详情', error: detailError, retry: () => refetchDetail() });
  if (dailyError) dataErrors.push({ label: '日线数据', error: dailyError, retry: () => refetchDaily() });
  if (weeklyError) dataErrors.push({ label: '周线数据', error: weeklyError, retry: () => refetchWeekly() });
  if (monthlyError) dataErrors.push({ label: '月线数据', error: monthlyError, retry: () => refetchMonthly() });
  if (quoteError) dataErrors.push({ label: '实时行情', error: quoteError, retry: () => refetchQuote() });
  if (financeError) dataErrors.push({ label: '财务数据', error: financeError, retry: () => refetchFinanceData() });

  const refreshAll = useCallback(() => {
    setSelectedDate(''); setHistoryData(null);
    refetch();
  }, [refetch]);

  const handleHistorySelect = useCallback((date: string) => {
    setSelectedDate(date);
    const entry = loadAllHistory()[stockId];
    if (entry && entry.date === date) setHistoryData(entry);
  }, [stockId]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-bold hover:opacity-70"
            style={{ color: 'hsl(var(--ink))' }}>
            <ArrowLeft size={18} /> 返回
          </button>
          <h1 className="heading-serif text-2xl font-bold tracking-tight" style={{ color: 'hsl(var(--text-primary))' }}>
            AI 预测中心
          </h1>
          {stockId && <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md" style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>{stockId}</span>}
          {/* History date selector */}
          {historyDates.length > 0 && (
            <select value={selectedDate} onChange={(e) => handleHistorySelect(e.target.value)}
              className="text-xs font-medium px-2 py-1 rounded-md bg-transparent cursor-pointer"
              style={{ color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>
              <option value="">实时数据</option>
              {historyDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {selectedDate && (
            <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 border border-red-300">历史: {selectedDate}</span>
          )}
          {dataErrors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {dataErrors.map((de, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 border border-amber-300">
                  {de.label} 失败
                  <button onClick={de.retry} className="underline decoration-dotted underline-offset-2 hover:text-amber-900">重试</button>
                </span>
              ))}
            </div>
          )}
          {configError && (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-300 flex items-center gap-1">
              <AlertTriangle size={12} /> 配置加载失败
              <button onClick={() => refetchConfig()} className="underline decoration-dotted underline-offset-2">重试</button>
            </span>
          )}
          {errors.length > 0 && (
            <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 border border-red-300 flex items-center gap-1">
              <AlertTriangle size={12} /> {errors.length === 1 ? 'AI 查询失败' : `${errors.length} 个查询失败`}
              <button onClick={() => refetch()} className="underline decoration-dotted underline-offset-2">重试</button>
            </span>
          )}
          {import.meta.env.DEV && (
            /* Debug: hook states */
            <span className="text-[10px] text-gray-400 font-mono">
              pred={prediction?'ok':isLoading?'loading':error?'err':'--'}
              card={card?.recommendation?'ok':isLoading?'loading':error?'err':'--'}
              env={marketEnv?'ok':isLoading?'loading':'--'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hasKey && (
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-300 px-2 py-1 flex items-center gap-1">
              <AlertTriangle size={12} /> 未配置 API Key
            </span>
          )}
          <button onClick={refreshAll} disabled={anyLoading || !stockId}
            className="flex items-center gap-1.5 text-xs font-black border-2 px-3 py-1.5 hover:bg-black/5 disabled:opacity-30 transition-colors"
            style={{ borderColor: 'hsl(var(--ink))', color: 'hsl(var(--ink))' }}>
            <RefreshCw size={14} className={anyLoading ? 'animate-spin' : ''} /> 刷新全部
          </button>
        </div>
      </div>

      {!isValidStock ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-lg font-bold opacity-40" style={{ color: 'hsl(var(--ink))' }}>请先选择一只股票（格式：代码.交易所，如 000001.SZ）</p>
        </div>
      ) : configLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={24} className="animate-spin" style={{ color: 'hsl(var(--text-tertiary))' }} />
        </div>
      ) : !hasKey ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <ShieldAlert size={40} className="mx-auto text-red-400" />
            <p className="text-lg font-bold" style={{ color: 'hsl(var(--ink))' }}>请先在设置页配置 DeepSeek API Key</p>
            <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors" style={{ background: '#6366f1', color: '#ffffff' }}>
              <Settings size={12} /> 前往设置
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <AlertTriangle size={40} className="mx-auto text-red-500" />
            <p className="text-sm font-bold text-red-700 dark:text-red-400">AI 分析失败</p>
            <p className="text-xs max-w-md" style={{ color: 'hsl(var(--text-secondary))' }}>{error.message || 'DeepSeek API 调用异常，请检查网络连接和 API Key 配置'}</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors" style={{ background: '#6366f1', color: '#ffffff' }}>
                <RefreshCw size={12} /> 重试
              </button>
              <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors" style={{ background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-default))' }}>
                <Settings size={12} /> 配置设置
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-0 shrink-0 flex-wrap">
            {([
              { id: 'predict' as const, label: '走势预测' },
              { id: 'multi' as const, label: '多维分析' },
              { id: 'card' as const, label: 'AI 快评' },
              { id: 'market' as const, label: '市场环境' },
              { id: 'history' as const, label: '历史准确率' },
            ]).map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs font-black border-2 border-b-0 transition-colors ${
                  activeTab === t.id ? 'bg-white text-red-800 border-red-700' : 'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'predict' && <PredictPanel key="predict" data={activePred} loading={isLoading && !selectedDate} />}
            {activeTab === 'multi' && <MultiDimPanel key="multi" data={activeMulti} loading={isLoading && !selectedDate} />}
            {activeTab === 'card' && <CardPanel key="card" data={activeCard} loading={isLoading && !selectedDate} error={error ?? null} />}
            {activeTab === 'market' && <MarketEnvPanel key="market" data={activeMarket} loading={isLoading && !selectedDate} stockId={stockId} />}
            {activeTab === 'history' && <HistoryPanel key="history" stockId={stockId} />}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
//  Predict Panel
// ═══════════════════════════════════════════════════════

function PredictPanel({ data, loading }: { data: DeepSeekPrediction | null; loading: boolean }) {
  const Icon = data ? DIR_ICON[data.direction] ?? Minus : Minus;
  const colorClass = data ? DIR_COLOR[data.direction] ?? '' : '';
  const bgClass = data ? DIR_BG[data.direction] ?? '' : '';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex-1 grid grid-cols-2 gap-3 overflow-auto">
      {/* Main prediction card */}
      <div className="glass-card p-5 col-span-2 flex flex-col items-center justify-center gap-4 min-h-[200px]">
        {loading ? (
          <RefreshCw size={32} className="animate-spin text-gray-400" />
        ) : data ? (
          <>
            <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${bgClass}`}>
              <Icon size={40} className={colorClass} />
            </div>
            <h2 className={`text-3xl font-black ${colorClass}`}>{DIR_LABEL[data.direction]}</h2>
            <div className="flex gap-4 text-sm font-bold">
              <span>置信度 <b className="text-lg">{fmtConfidence(data.confidence)}</b></span>
              {data.target_price && <span>目标价 <b className="text-lg">{data.target_price}</b></span>}
              <span>周期 <b>{data.time_frame}</b></span>
            </div>
            <div className="w-full" style={{ borderTop: '1px solid hsl(var(--border-subtle))' }} />
            <p className="text-sm leading-relaxed max-w-2xl text-center" style={{ color: 'hsl(var(--text-secondary))' }}>{data.reasoning}</p>
          </>
        ) : (
          <p className="text-gray-400 font-bold">点击刷新获取 AI 预测</p>
        )}
      </div>

      {/* Probability distribution */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-black tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'hsl(var(--ink))' }}>
          <Target size={14} /> 概率分布
        </h3>
        {data ? (() => {
          // 根据方向生成总和为 100% 的概率分布
          let dist: number[];
          if (data.direction === 'up') {
            dist = [0.35, 0.30, 0.15, 0.12, 0.08];  // 总和 1.0
          } else if (data.direction === 'down') {
            dist = [0.08, 0.12, 0.15, 0.30, 0.35];  // 总和 1.0
          } else {
            dist = [0.10, 0.15, 0.50, 0.15, 0.10];  // 总和 1.0
          }
          // 乘以置信度后归一化，确保始终 100%
          const weighted = dist.map(v => v * (data.confidence ?? 0.5));
          const total = weighted.reduce((a, b) => a + b, 0);
          const normalized = weighted.map(v => v / total);
          const probs = normalized.map(v => Math.round(v * 100));
          probs[4] = 100 - probs.slice(0, 4).reduce((a, b) => a + b, 0);
          const labels = ['大幅上涨', '小幅上涨', '震荡', '小幅下跌', '大幅下跌'];
          const colors = ['bg-red-600', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-blue-600'];
          return (
            <div className="space-y-2">
              {labels.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-16 shrink-0">{label}</span>
                  <div className="flex-1 h-5 border border-gray-200">
                    <div className={`h-full ${colors[i]} transition-all duration-500`} style={{ width: `${probs[i]}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold w-10 text-right">{probs[i]}%</span>
                </div>
              ))}
            </div>
          );
        })() : (
          <p className="text-xs text-gray-400">等待数据…</p>
        )}
      </div>

      {/* Key levels */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-black tracking-wider mb-3 flex items-center gap-1.5" style={{ color: 'hsl(var(--ink))' }}>
          <Activity size={14} /> 关键数据
        </h3>
        {data ? (
          <div className="space-y-2 text-sm font-bold">
            <div className="flex justify-between border-b pb-1"><span>预测方向</span><span className={colorClass}>{DIR_LABEL[data.direction]}</span></div>
            <div className="flex justify-between border-b pb-1"><span>置信度</span><span>{fmtConfidence(data.confidence)}</span></div>
            <div className="flex justify-between border-b pb-1"><span>时间周期</span><span>{data.time_frame}</span></div>
            {data.target_price && <div className="flex justify-between border-b pb-1"><span>目标价格</span><span className="text-lg">{data.target_price}</span></div>}
          </div>
        ) : (
          <p className="text-xs text-gray-400">等待数据…</p>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
//  Multi-Dimension Panel
// ═══════════════════════════════════════════════════════

function DimCard({ label, data }: { label: string; data: import('@/types').DimensionScore | null }) {
  if (!data) return <div className="glass-card p-4"><p className="text-xs text-gray-400">等待数据…</p></div>;
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-black tracking-wider" style={{ color: 'hsl(var(--ink))' }}>{label}</h4>
        <span className={`text-lg font-black ${data.score >= 60 ? 'text-red-700' : data.score >= 40 ? 'text-amber-600' : 'text-blue-700'}`}>
          {data.score}
        </span>
      </div>
      <p className="text-xs mb-2" style={{ color: 'hsl(var(--text-secondary))' }}>{data.summary}</p>
      {(data.key_points ?? []).slice(0, 3).map((kp: string, j: number) => (
        <div key={j} className="flex items-start gap-1 text-xs"><span className="text-red-700 mt-0.5">◆</span><span>{kp}</span></div>
      ))}
      <div className="mt-2 flex flex-wrap gap-1">
        {(data.signals ?? []).slice(0, 4).map((s: any, k: number) => (
          <span key={k} className={`text-[10px] font-bold px-1.5 py-0.5 border ${
            s.direction === 'bullish' ? 'bg-red-50 text-red-700 border-red-300' :
            s.direction === 'bearish' ? 'bg-blue-50 text-blue-700 border-blue-300' :
            'bg-gray-50 text-gray-600 border-gray-300'
          }`}>{s.name} {s.strength != null ? `${(s.strength * 100).toFixed(0)}%` : ''}</span>
        ))}
      </div>
    </div>
  );
}

function MultiDimPanel({ data, loading }: { data: MultiDimensionAnalysis | null; loading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex-1 overflow-auto space-y-3">
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={32} className="animate-spin text-gray-400" /></div>
      ) : data ? (
        <>
          <div className="glass-card p-5 flex items-center gap-6">
            <div className="w-24 h-24 rounded-full border-4 border-red-700 flex items-center justify-center shrink-0 bg-red-50">
              <span className="text-3xl font-black text-red-700">{data.composite.overall}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black mb-1" style={{ color: 'hsl(var(--ink))' }}>综合评分</h3>
              <p className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>{data.composite.recommendation}</p>
              <div className="flex gap-3 mt-2 text-xs font-bold">
                <span>技术 {data.technical?.score ?? '--'}</span><span>资金 {data.capital_flow?.score ?? '--'}</span>
                <span>基本面 {data.fundamental?.score ?? '--'}</span><span>情绪 {data.sentiment?.score ?? '--'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DimCard label="技术面" data={data.technical} />
            <DimCard label="资金面" data={data.capital_flow} />
            <DimCard label="基本面" data={data.fundamental} />
            <DimCard label="情绪面" data={data.sentiment} />
          </div>
          {data.briefing && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-black tracking-wider mb-2" style={{ color: 'hsl(var(--ink))' }}>AI 简报</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>{data.briefing.commentary}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {data.briefing.risk_warnings.map((w: string, i: number) => (
                  <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-300 flex items-center gap-1">
                    <AlertTriangle size={10} />{w}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center py-20"><p className="text-gray-400 font-bold">点击刷新获取多维分析</p></div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
//  Card Panel
// ═══════════════════════════════════════════════════════

function CardPanel({ data, loading, error }: { data: CardData | null; loading: boolean; error: Error | null }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#fdfbf7' });
      const link = document.createElement('a');
      link.download = `stockmate_${data?.name || 'stock'}_${data?.ticker || ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) { console.error('Export failed:', e); }
    setExporting(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex-1 overflow-auto flex flex-col items-center">
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={32} className="animate-spin text-gray-400" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle size={40} className="text-red-500" />
          <p className="text-sm font-bold text-red-700">DeepSeek 生成失败</p>
          <p className="text-xs text-gray-500">{error.message}</p>
        </div>
      ) : data ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-[480px]">
          {/* Card — modern finance report card */}
          <div ref={cardRef}
            className="relative w-full rounded-xl shadow-lg overflow-hidden"
            style={{
              aspectRatio: '3/4',
              background: 'hsl(var(--bg-card))',
              border: '1px solid hsl(var(--border-default))',
            }}
          >
            {/* Accent top bar */}
            <div style={{ height: 4, background: 'hsl(var(--accent))' }} />

            {/* Header: stock name + ticker */}
            <div className="text-center pt-6 pb-3 px-6">
              <div className="text-[10px] font-bold tracking-widest mb-1" style={{ color: 'hsl(var(--text-tertiary))' }}>STOCKMATE · 个股分析</div>
              <h2 className="heading-serif text-3xl font-bold tracking-tight" style={{ color: 'hsl(var(--text-primary))' }}>{data.name}</h2>
              <p className="font-mono-nums text-sm font-medium mt-0.5" style={{ color: 'hsl(var(--text-secondary))' }}>{data.ticker}</p>
            </div>

            {/* Price + change */}
            <div className="text-center py-3 px-6">
              <div className={`font-mono-nums text-5xl font-bold tracking-tight ${(data.change_percent ?? 0) >= 0 ? 'price-up' : 'price-down'}`}>
                ¥{fmtPrice(data.price)}
              </div>
              <div className={`font-mono-nums text-xl font-bold mt-1 ${(data.change_percent ?? 0) >= 0 ? 'price-up' : 'price-down'}`}>
                {(data.change_percent ?? 0) >= 0 ? '+' : ''}{fmtPct(data.change_percent)}%
              </div>
            </div>

            {/* Signal badge */}
            <div className="flex justify-center py-2">
              <span className="inline-block px-4 py-1.5 text-sm font-bold rounded-lg"
                style={{
                  background: data.buy_signal ? 'hsl(var(--price-up-bg))' : 'hsl(var(--border-subtle))',
                  color: data.buy_signal ? 'hsl(var(--price-up))' : 'hsl(var(--text-tertiary))',
                }}>
                {data.buy_signal ? '买入信号' : '观望'}
              </span>
            </div>

            {/* Recommendation */}
            <div className="px-6 py-3 text-center">
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'hsl(var(--text-primary))' }}>
                「{data.recommendation}」
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap justify-center gap-1.5 px-6 py-2">
              {(data.tags ?? []).map((t, i) => (
                <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-md"
                  style={{
                    background: 'hsl(var(--accent-subtle))',
                    color: 'hsl(var(--accent))',
                    border: '1px solid hsl(var(--border-default))',
                  }}>
                  #{t}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-[10px] font-medium"
              style={{ color: 'hsl(var(--text-tertiary))' }}>
              <span>{data.late_rush ? '尾盘抢筹' : ''}</span>
              <span>{data.generated_at?.slice(0, 10)}</span>
            </div>
          </div>

          {/* Export button */}
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>
            {exporting ? '导出中…' : '导出为图片'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-400 font-bold">点击刷新获取 AI 快评</p>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
//  Market Environment Panel
// ═══════════════════════════════════════════════════════

const CTX_COLORS: Record<string, string> = { bullish: 'text-red-700 bg-red-50 border-red-300', bearish: 'text-blue-700 bg-blue-50 border-blue-300', neutral: 'text-amber-600 bg-amber-50 border-amber-300' };
const CTX_LABELS: Record<string, string> = { bullish: '偏多', bearish: '偏空', neutral: '中性' };

function CtxCard({ title, items }: { title: string; items: [string, import('@/types').MarketContextItem][] }) {
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-black tracking-wider mb-3 border-b-2 pb-1" style={{ borderColor: 'hsl(var(--border-strong))', color: 'hsl(var(--ink))' }}>{title}</h3>
      <div className="space-y-2">
        {items.map(([label, item]) => (
          <div key={label} className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold shrink-0">{label}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${CTX_COLORS[item.status] ?? ''}`}>{CTX_LABELS[item.status] ?? item.status}</span>
            <span className="text-xs text-right flex-1" style={{ color: 'hsl(var(--text-secondary))' }}>{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketEnvPanel({ data, loading }: { data: MarketEnvironment | null; loading: boolean; stockId: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex-1 overflow-auto space-y-3">
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={32} className="animate-spin text-gray-400" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <CtxCard title="大环境分析" items={[
              ['美联储', data.macro_context.fed_policy], ['宏观经济', data.macro_context.macro_economy],
              ['地缘政治', data.macro_context.geopolitics], ['汇率影响', data.macro_context.exchange_rate],
            ]} />
            <CtxCard title="行业动态" items={[
              ['政策环境', data.industry_context.policy], ['行业景气', data.industry_context.prosperity],
              ['竞争格局', data.industry_context.competition], ['供应链', data.industry_context.supply_chain],
            ]} />
            <div className="glass-card p-4">
              <h3 className="text-sm font-black tracking-wider mb-3 border-b-2 pb-1" style={{ borderColor: 'hsl(var(--border-strong))', color: 'hsl(var(--ink))' }}>公司消息面</h3>
              {['announcements', 'management_changes', 'contracts', 'product_progress'].map((cat) => {
                const items = (data.company_news as any)[cat] as string[];
                if (!items?.length) return null;
                const labels: Record<string, string> = { announcements: '公告', management_changes: '管理层', contracts: '重大合同', product_progress: '产品进展' };
                return (
                  <div key={cat} className="mb-2">
                    <span className="text-[10px] font-black text-red-700">{labels[cat]}</span>
                    {items.map((item, i) => (
                      <div key={i} className="text-xs ml-2 mt-0.5" style={{ color: 'hsl(var(--text-secondary))' }}>· {item}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="glass-card p-4">
            <h3 className="text-sm font-black tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'hsl(var(--ink))' }}>
              <AlertTriangle size={14} className="text-red-600" /> 风险提示
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {data.risks.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 border-l-4 ${
                  r.severity === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' : r.severity === 'medium' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' : 'border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                }`}>
                  <span className={`text-[10px] font-black px-1 ${
                    r.severity === 'high' ? 'text-red-700 dark:text-red-400' : r.severity === 'medium' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'
                  }`}>{r.severity === 'high' ? '高' : r.severity === 'medium' ? '中' : '低'}</span>
                  <span className="text-xs font-bold" style={{ color: 'hsl(var(--ink))' }}>{r.description}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-20"><p className="text-gray-400 font-bold">点击刷新获取市场环境分析</p></div>
      )}
    </motion.div>
  );
}

// ── History Panel (localStorage) ──
interface HistoryRecord { date: string; stockId: string; stockName: string; predicted: string; confidence: number; actual?: string; correct?: boolean; }
function loadHistory(): HistoryRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem('stockmate_pred_full') || '{}');
    return Object.entries(all).map(([sid, entry]) => {
      const e = entry as HistoryEntry;
      return {
        date: e.date,
        stockId: sid,
        stockName: '',
        predicted: e.prediction?.direction ?? '',
        confidence: e.prediction?.confidence ?? 0,
        // TODO: correct 字段需要实际行情数据来验证预测结果，目前无法自动设置
        correct: undefined,
      };
    });
  } catch { return []; }
}

function HistoryPanel({ stockId }: { stockId: string }) {
  const records = loadHistory().filter(r => r.stockId === stockId);
  const verifiedCount = records.filter(r => r.correct !== undefined).length;
  const correct = records.filter(r => r.correct === true).length;
  const accuracy = verifiedCount > 0 ? (correct / verifiedCount * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex-1 overflow-auto space-y-3">
      <div className="glass-card p-5">
        <h3 className="text-sm font-black tracking-wider mb-4" style={{ color: 'hsl(var(--ink))' }}>历史预测准确率</h3>
        {records.length === 0 ? (
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full border-4 border-red-700 flex items-center justify-center bg-red-50">
              <span className="text-2xl font-black text-red-700">--</span>
            </div>
            <div>
              <p className="text-sm font-bold">暂无预测记录</p>
              <p className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>进行AI预测后将在本地记录结果</p>
            </div>
          </div>
        ) : verifiedCount === 0 ? (
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full border-4 border-red-700 flex items-center justify-center bg-red-50">
              <span className="text-2xl font-black text-red-700">--</span>
            </div>
            <div>
              <p className="text-sm font-bold">共 {records.length} 次预测（待验证）</p>
              <p className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>需要实际行情数据验证预测结果</p>
            </div>
          </div>
        ) : records.length > 0 ? (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full border-4 border-red-700 flex items-center justify-center bg-red-50">
                <span className="text-2xl font-black text-red-700">{accuracy.toFixed(0)}%</span>
              </div>
              <div><p className="text-sm font-bold">共 {records.length} 次预测</p><p className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>{correct} 次正确 · {verifiedCount - correct} 次错误</p></div>
            </div>
            <div className="space-y-2">
              {[90,80,70,60,50].map(pct => {
                const count = records.filter(r => Math.round(r.confidence * 100) >= pct && Math.round(r.confidence * 100) < pct + 10).length;
                const ok = records.filter(r => Math.round(r.confidence * 100) >= pct && Math.round(r.confidence * 100) < pct + 10 && r.correct).length;
                const bandAcc = count > 0 ? (ok / count * 100) : 0;
                return (
                  <div key={pct} className="flex items-center gap-2">
                    <span className="text-xs font-bold w-12">{pct}%+</span>
                    <div className="flex-1 h-4 border border-gray-200 bg-gray-50"><div className="h-full bg-red-600" style={{ width: `${bandAcc}%` }} /></div>
                    <span className="text-xs font-mono w-14 text-right">{ok}/{count}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-2 text-gray-400">校准曲线：横轴=置信度区间 纵轴=正确率</p>
            <div className="mt-3 max-h-40 overflow-auto space-y-1">
              {records.slice(-10).reverse().map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs border-b pb-1">
                  <span className="font-mono text-[10px]">{r.date.slice(0,10)}</span>
                  <span className={r.predicted==='up'?'text-red-700':r.predicted==='down'?'text-blue-700':'text-amber-600'}>{DIR_LABEL[r.predicted]}</span>
                  <span>{fmtConfidence(r.confidence)}</span>
                  {r.correct !== undefined && <span className={`text-[10px] font-bold ${r.correct?'text-emerald-600':'text-red-600'}`}>{r.correct?'✓':'✗'}</span>}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
