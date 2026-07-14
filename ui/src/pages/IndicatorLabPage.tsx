import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { ArrowLeft, Shield, Brain, RefreshCw } from 'lucide-react';
import { useStockHistory, useStockDetail } from '@/hooks/useTauriQuery';
import { invoke } from '@tauri-apps/api/core';

// ═══════════════════════════════════════════════════════════
// 公式1：EMA 指数移动平均
//   EMA₁ = C₁
//   EMAₜ = α·Cₜ + (1-α)·EMAₜ₋₁    (t ≥ 2)
//   其中 α = 2/(N+1)，N 为周期
// ═══════════════════════════════════════════════════════════
function calcEMA(c: number[], p: number): (number | null)[] {
  const r: (number | null)[] = []; const k = 2 / (p + 1); let prev = c[0];
  for (let i = 0; i < c.length; i++) {
    if (i < p - 1) { r.push(null); continue }
    prev = c[i] * k + prev * (1 - k);
    r.push(prev);
  }
  return r;
}

// ═══════════════════════════════════════════════════════════
// 辅助：线性插值填补缺口（maxGap 以内的 null 段）
// ═══════════════════════════════════════════════════════════
function fillGaps(arr: (number | null)[], maxGap: number) {
  const n = arr.length;
  for (let i = 1; i < n - 1; i++) {
    if (arr[i] != null) continue;
    let l = i - 1; while (l >= 0 && arr[l] == null) l--;
    let r = i + 1; while (r < n && arr[r] == null) r++;
    if (l >= 0 && r < n && arr[l] != null && arr[r] != null && r - l <= maxGap) {
      for (let k = l + 1; k < r; k++)
        arr[k] = arr[l]! + (arr[r]! - arr[l]!) * (k - l) / (r - l);
    }
  }
  // 尾端填充
  let lv: number | null = null;
  for (let i = 0; i < n; i++) { if (arr[i] != null) lv = arr[i]; }
  if (lv != null) for (let i = n - 1; i >= 0 && arr[i] == null; i--) arr[i] = lv;
  // 头端填充
  let fv: number | null = null;
  for (let i = 0; i < n; i++) { if (arr[i] != null) { fv = arr[i]; break; } }
  if (fv != null) for (let i = 0; i < n && arr[i] == null; i++) arr[i] = fv;
}

// ═══════════════════════════════════════════════════════════
// 公式2：动态锚点支撑 DAS（Dynamic Anchor Support）
//
// ▸ Step A — 锚点检测
//   找"放量但未大跌"的 K 线作为支撑锚点：
//     VRᵢ = Vᵢ / VolMA(20)ᵢ          —— 成交量比率
//     ΔP₃ = (Cᵢ - Cᵢ₋₃) / Cᵢ₋₃      —— 3日涨跌幅
//
//   当 VRᵢ > 1.3 且 ΔP₃ > -3% 时，确认为多头守住的支撑位：
//     锚点价 = Cᵢ × 0.99
//     锚点强度 = VRᵢ × (1 + max(0, ΔP₃) × 10)
//     （放量且上涨时强度更大）
//
// ▸ Step B — 指数衰减加权锚定
//   DASₜ = P_anchor × 0.6 + EMA₃₀(C)ₜ × 0.4
//   P_anchor = Σ(价ₐ×强度ₐ×e^(-dist/10)) / Σ(强度ₐ×e^(-dist/10))
//   仅纳入前方 20 bar 内的锚点，距离越远权重越低
//
// ▸ Step C — 平滑
//   EMA(α=0.2) 平滑 → 线性填补 ≤15 bar 的缺口
// ═══════════════════════════════════════════════════════════
function calcDAS(closes: number[], volumes: number[]): (number | null)[] {
  const n = closes.length;
  if (n < 30) return closes.map(() => null);

  const base = calcEMA(closes, 30);
  const volMA = calcEMA(volumes, 20);

  // Step A: 锚点检测
  const anchors: { idx: number; price: number; strength: number }[] = [];
  for (let i = 30; i < n - 3; i++) {
    if (base[i] == null || volMA[i] == null) continue;
    const vr = volumes[i] / Math.max(volMA[i]!, 1);
    const chg3 = (closes[i] - closes[i - 3]) / closes[i - 3];
    if (vr > 1.3 && chg3 > -0.03) {
      const strength = vr * (1 + Math.max(0, chg3) * 10);
      anchors.push({ idx: i, price: closes[i] * 0.99, strength });
    }
  }

  // 锚点不足 → 降级为简单 EMA 支撑
  if (anchors.length < 3) {
    // fallback: EMA(30) + 量动量修正
    const raw2: (number | null)[] = [];
    for (let i = 0; i < n; i++) {
      if (base[i] == null) { raw2.push(null); continue }
      let s = base[i]!;
      if (volMA[i]) {
        const vr = volumes[i] / Math.max(volMA[i]!, 1);
        if (vr > 1.5) s *= 1.015; else if (vr < 0.5) s *= 0.985;
      }
      if (i >= 3) {
        const chg = (closes[i] - closes[i - 3]) / closes[i - 3];
        if (chg < -0.05) s *= 0.97; else if (chg > 0.05) s *= 1.03;
      }
      raw2.push(s);
    }
    const alpha = 0.3; const smooth2: (number | null)[] = []; let prev2: number | null = null;
    for (let i = 0; i < n; i++) {
      if (raw2[i] == null) { smooth2.push(null); prev2 = null; continue }
      prev2 = prev2 == null ? raw2[i] : prev2 * (1 - alpha) + raw2[i]! * alpha;
      smooth2.push(prev2);
    }
    fillGaps(smooth2, 10);
    return smooth2;
  }

  // Step B: 锚点加权支撑线
  const raw: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (i < 30 || base[i] == null) { raw.push(null); continue }
    const nearAnchors = anchors.filter(a => a.idx <= i && i - a.idx < 20);
    if (nearAnchors.length > 0) {
      const totalStr = nearAnchors.reduce((s, a) => s + a.strength * Math.exp(-(i - a.idx) / 10), 0);
      const weightedPrice = nearAnchors.reduce((s, a) => s + a.price * a.strength * Math.exp(-(i - a.idx) / 10), 0) / Math.max(totalStr, 0.01);
      raw.push(weightedPrice * 0.6 + base[i]! * 0.4);
    } else {
      raw.push(base[i]!);
    }
  }

  // Step C: 平滑
  const alpha = 0.2; const smooth: (number | null)[] = []; let prev: number | null = null;
  for (let i = 0; i < n; i++) {
    if (raw[i] == null) { smooth.push(null); prev = null; continue }
    prev = prev == null ? raw[i] : prev * (1 - alpha) + raw[i]! * alpha;
    smooth.push(prev);
  }
  fillGaps(smooth, 15);
  return smooth;
}

// ═══════════════════════════════════════════════════════════
// 页面组件
// ═══════════════════════════════════════════════════════════
export default function IndicatorLabPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stockId = searchParams.get('code') || '';
  const effectiveCode = stockId.includes('.') ? stockId : '';
  const { data: stockDetail, isLoading: detailLoading, error: stockError } = useStockDetail(effectiveCode);
  const { data: dailyData, isLoading: dailyLoading, error: historyError } = useStockHistory(effectiveCode, 250, 'day');
  const mainRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<{ chart: IChartApi; candle: ISeriesApi<'Candlestick'>; maLine: ISeriesApi<'Line'> | null; dasLine: ISeriesApi<'Line'> | null } | null>(null);

  const [maPeriod, setMaPeriod] = useState(60);
  const [showMA, setShowMA] = useState(true);
  const [showDAS, setShowDAS] = useState(true);
  const [psychology, setPsychology] = useState(50);
  const [psychLoading, setPsychLoading] = useState(false);
  const [psychDetail, setPsychDetail] = useState('');

  const closes = useMemo(() => dailyData?.map((q: any) => Number(q.close) || 0) || [], [dailyData]);
  const volumes = useMemo(() => dailyData?.map((q: any) => Number(q.volume) || 0) || [], [dailyData]);

  const maLine = useMemo(() => calcEMA(closes, maPeriod), [closes, maPeriod]);
  const dasLine = useMemo(() => calcDAS(closes, volumes), [closes, volumes]);
  const candleItems = useMemo(() => dailyData?.map((q: any) => ({
    time: String(q.date), open: Number(q.open) || 0, high: Number(q.high) || 0,
    low: Number(q.low) || 0, close: Number(q.close) || 0,
  })) || [], [dailyData]);

  const fetchPsychology = useCallback(async () => {
    if (!dailyData?.length) return; setPsychLoading(true);
    try {
      const last = dailyData[dailyData.length - 1], prev = dailyData[dailyData.length - 2];
      const cp = Number(last?.close) || 0, pc = Number(prev?.close) || cp;
      const chgPct = pc > 0 ? ((cp - pc) / pc * 100) : 0;
      const vol = Number(last?.volume) || 0;
      const vols = dailyData.slice(-20).map((d: any) => Number(d.volume) || 0);
      const avgVol = vols.reduce((a: number, b: number) => a + b, 0) / vols.length;
      const trend = dailyData.slice(-5).map((d: any) => Number(d.close) || 0);
      const trendDir = trend[trend.length - 1] > trend[0] ? '上涨' : '下跌';
      const r = await invoke<any>('analyze_psychology', {
        stockId, stockName: stockDetail?.name || '', ticker: stockId.split('.')?.shift() || '',
        currentPrice: cp, prevClose: pc, changePct: chgPct, volume: vol, avgVolume: Math.round(avgVol),
        high: Number(last?.high) || cp, low: Number(last?.low) || cp,
        recentTrend: `近5日${trendDir}`, volumeRatio: avgVol > 0 ? vol / avgVol : 1,
      });
      setPsychology(r.sentiment_score ?? 50);
      setPsychDetail(`${r.sentiment === 'bullish' ? '看多' : r.sentiment === 'bearish' ? '看空' : '中性'} ${r.sentiment_score}% · ${(r.reasoning || '').slice(0, 500)}`);
    } catch (e) { console.error('psych:', e) } setPsychLoading(false);
  }, [dailyData, stockId, stockDetail]);

  useEffect(() => { if (stockId && dailyData?.length) fetchPsychology(); }, [stockId, dailyData, fetchPsychology]);

  // K线图表
  useEffect(() => {
    if (!mainRef.current) return;
    const c = createChart(mainRef.current, {
      layout: { background: { color: 'transparent' }, textColor: 'hsl(var(--text-tertiary))' },
      grid: { vertLines: { color: 'hsla(var(--text-tertiary), 0.1)' }, horzLines: { color: 'hsla(var(--text-tertiary), 0.1)' } },
      autoSize: true, crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'hsla(var(--text-tertiary), 0.2)' },
      timeScale: { borderColor: 'hsla(var(--text-tertiary), 0.2)', timeVisible: true },
    });
    c.timeScale().applyOptions({ minBarSpacing: 4, fixLeftEdge: true, fixRightEdge: true });
    const candle = c.addCandlestickSeries({
      upColor: 'hsl(var(--risk-danger))', downColor: 'hsl(var(--price-down))',
      borderUpColor: 'hsl(var(--risk-danger))', borderDownColor: 'hsl(var(--price-down))',
      wickUpColor: 'hsl(var(--risk-danger))', wickDownColor: 'hsl(var(--price-down))',
    });
    storeRef.current = { chart: c, candle, maLine: null, dasLine: null };
    return () => { try { c.remove() } catch (_) { } storeRef.current = null; }
  }, []);

  // 更新图表数据（使用 setData 增量更新已有系列，避免销毁重建）
  useEffect(() => {
    const s = storeRef.current; if (!s) return;
    s.candle?.setData(candleItems);

    const maData = maLine.map((v, i) =>
      v != null ? { time: (dailyData as any)[i]?.date as Time, value: v } : null
    ).filter(Boolean) as any[];

    const dasData = dasLine.map((v, i) =>
      v != null ? { time: (dailyData as any)[i]?.date as Time, value: v } : null
    ).filter(Boolean) as any[];

    // 公式1：EMA 均线支撑（黄线）
    if (showMA) {
      if (!s.maLine) {
        s.maLine = s.chart.addLineSeries({
          color: 'hsl(var(--risk-warning))', lineWidth: 1, lineStyle: 0,
          priceLineVisible: false, lastValueVisible: true,
        });
      }
      s.maLine.setData(maData);
    } else if (s.maLine) {
      try { s.chart.removeSeries(s.maLine); } catch (_) {}
      s.maLine = null;
    }

    // 公式2：动态锚点支撑 DAS（绿虚线）
    if (showDAS) {
      if (!s.dasLine) {
        s.dasLine = s.chart.addLineSeries({
          color: 'hsl(var(--price-up))', lineWidth: 2, lineStyle: 2,
          priceLineVisible: false, lastValueVisible: true,
        });
      }
      s.dasLine.setData(dasData);
    } else if (s.dasLine) {
      try { s.chart.removeSeries(s.dasLine); } catch (_) {}
      s.dasLine = null;
    }
  }, [candleItems, maLine, dasLine, showMA, showDAS]);

  // 加载 / 错误 / 空数据状态
  if (dailyLoading || detailLoading) {
    return <div className="flex items-center justify-center p-8"><RefreshCw className="animate-spin" size={24} /> <span className="ml-2">加载数据中...</span></div>;
  }
  if (stockError) return <div className="p-4 text-red-500">加载股票详情失败: {stockError.message}</div>;
  if (historyError) return <div className="p-4 text-red-500">加载历史数据失败: {historyError.message}</div>;
  if (!dailyLoading && dailyData?.length === 0) {
    return <div className="p-4" style={{ color: 'hsl(var(--text-secondary))' }}>暂无历史数据</div>;
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-bold hover:opacity-70"
            style={{ color: 'hsl(var(--ink))' }}>
            <ArrowLeft size={18} /> 返回
          </button>
          <h1 className="heading-serif text-2xl font-bold tracking-tight"
            style={{ color: 'hsl(var(--text-primary))' }}>
            支撑线
          </h1>
          {stockId && (
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md"
              style={{ background: 'hsl(var(--bg-input))', color: 'hsl(var(--text-primary))', border: '1px solid hsl(var(--border-default))' }}>
              {stockDetail?.name || stockId}
            </span>
          )}
        </div>
      </div>

      {!stockId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-bold" style={{ color: 'hsl(var(--text-tertiary))' }}>请先选择一只股票</p>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 overflow-hidden">
          {/* 主图 */}
          <div className="lg:col-span-3 glass-card overflow-hidden flex flex-col">
            <div ref={mainRef} className="flex-1" />
          </div>

          {/* 侧边栏 */}
          <div className="glass-card p-4 overflow-auto space-y-3">
            <h3 className="text-sm font-black tracking-wider flex items-center gap-1.5"
              style={{ color: 'hsl(var(--ink))' }}>
              <Shield size={14} /> 支撑线
            </h3>

            {/* ── 公式1：均线支撑 ── */}
            <div className="p-3 border rounded" style={{ borderColor: 'hsla(var(--risk-warning), 0.4)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black" style={{ color: 'hsl(var(--risk-warning))' }}>━ 公式1：均线支撑</span>
                <button onClick={() => setShowMA(!showMA)}
                  className="text-[10px] font-bold px-2 py-0.5 border dark:bg-amber-500/10"
                  style={showMA ? { borderColor: 'hsl(var(--risk-warning))', color: 'hsl(var(--risk-warning))', background: 'var(--bg-input)' } : { borderColor: 'var(--border-default)', color: 'hsl(var(--text-secondary))' }}>
                  {showMA ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px]" style={{ color: 'hsl(var(--text-secondary))' }}>周期 N =</span>
                <input type="range" min={5} max={250} value={maPeriod}
                  onChange={e => setMaPeriod(+e.target.value)} className="flex-1 h-1" style={{ accentColor: 'hsl(var(--risk-warning))' }} />
                <span className="text-xs font-black w-8 text-right"
                  style={{ color: 'hsl(var(--ink))' }}>{maPeriod}</span>
              </div>
              <div className="mt-2 p-2 rounded dark:bg-amber-500/5 text-[10px] leading-relaxed font-mono"
                style={{ color: 'hsl(var(--ink))', background: 'var(--bg-input)' }}>
                <div className="font-bold mb-1" style={{ color: 'hsl(var(--risk-warning))' }}>指数移动平均 EMA(N)</div>
                <div>EMA₁ = C₁</div>
                <div>EMAₜ = α·Cₜ + (1-α)·EMAₜ₋₁</div>
                <div className="mt-0.5 text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
                  α = 2/(N+1) ≈ {((2/(maPeriod+1))*100).toFixed(1)}%（当前周期）
                </div>
              </div>
            </div>

            {/* ── 公式2：动态锚点支撑 DAS ── */}
            <div className="p-3 border rounded" style={{ borderColor: 'hsla(var(--price-up), 0.4)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black" style={{ color: 'hsl(var(--price-up))' }}>┅ 公式2：动态锚点支撑 DAS</span>
                <button onClick={() => setShowDAS(!showDAS)}
                  className="text-[10px] font-bold px-2 py-0.5 border dark:bg-emerald-500/10"
                  style={showDAS ? { borderColor: 'hsl(var(--price-up))', color: 'hsl(var(--price-up))', background: 'var(--bg-input)' } : { borderColor: 'var(--border-default)', color: 'hsl(var(--text-secondary))' }}>
                  {showDAS ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="mt-2 space-y-2 text-[10px] leading-relaxed" style={{ color: 'hsl(var(--ink))' }}>
                {/* Step A */}
                <div className="p-2 rounded dark:bg-emerald-500/5 font-mono" style={{ background: 'var(--bg-input)' }}>
                  <div className="font-bold mb-1" style={{ color: 'hsl(var(--price-up))' }}>Step A · 锚点检测</div>
                  <div>VR = V / EMA₂₀(V)</div>
                  <div>ΔP₃ = (Cₜ - Cₜ₋₃) / Cₜ₋₃</div>
                  <div className="mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    条件：VR {'>'} 1.3 且 ΔP₃ {'>'} -3%
                  </div>
                  <div className="mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    → 锚点价 = Cₜ × 0.99<br />
                    → 强度 = VR × (1 + max(0, ΔP₃) × 10)
                  </div>
                </div>

                {/* Step B */}
                <div className="p-2 rounded dark:bg-emerald-500/5 font-mono" style={{ background: 'var(--bg-input)' }}>
                  <div className="font-bold mb-1" style={{ color: 'hsl(var(--price-up))' }}>Step B · 加权锚定</div>
                  <div>DASₜ = P_anchor × 0.6 + EMA₃₀(C)ₜ × 0.4</div>
                  <div className="mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    P_anchor = Σ(价ₐ × 强度ₐ × e<sup>-dist/10</sup>) / Σ(强度ₐ × e<sup>-dist/10</sup>)
                  </div>
                  <div style={{ color: 'hsl(var(--text-tertiary))' }}>
                    仅纳入前方 20 bar 内的锚点，指数衰减
                  </div>
                </div>

                {/* Step C */}
                <div className="p-2 rounded dark:bg-emerald-500/5 font-mono" style={{ background: 'var(--bg-input)' }}>
                  <div className="font-bold mb-1" style={{ color: 'hsl(var(--price-up))' }}>Step C · 平滑</div>
                  <div>DAS'ₜ = EMA(DASₜ, α=0.2)</div>
                  <div className="mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    缺口 {'≤'} 15 bar 线性插值填充
                  </div>
                </div>

                {/* 降级 */}
                <div className="p-2 rounded dark:bg-zinc-700/50 font-mono text-[9px]"
                  style={{ color: 'hsl(var(--text-tertiary))', background: 'var(--bg-input)' }}>
                  <div className="font-bold">降级策略（锚点 {'<'} 3）</div>
                  <div>DASₜ = EMA₃₀(C)ₜ × vol_corr × mom_corr</div>
                  <div>vol_corr: VR {'>'} 1.5 → ×1.015, VR {'<'} 0.5 → ×0.985</div>
                  <div>mom_corr: ΔP₃ {'<'} -5% → ×0.97, ΔP₃ {'>'} +5% → ×1.03</div>
                  <div>→ 然后 EMA 平滑 (α=0.3)</div>
                </div>
              </div>
            </div>

            {/* DeepSeek 心理 */}
            <div className="p-3 border rounded dark:bg-purple-500/5"
              style={{ borderColor: 'hsla(var(--swiss-accent), 0.3)', background: 'var(--bg-input)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Brain size={12} style={{ color: 'hsl(var(--swiss-accent))' }} />
                <span className="text-xs font-black" style={{ color: 'hsl(var(--swiss-accent))' }}>DeepSeek 市场心理</span>
                <button onClick={fetchPsychology} disabled={psychLoading} className="ml-auto">
                  <RefreshCw size={12} className={`${psychLoading ? 'animate-spin' : ''}`} style={{ color: 'hsl(var(--swiss-accent))' }} />
                </button>
              </div>
              <div className="text-[10px] mb-1" style={{ color: 'hsl(var(--text-secondary))' }}>
                {psychLoading ? '正在获取心理分析...' : (psychDetail || '点击刷新获取心理分析')}
              </div>
              <div className="h-1.5 rounded-full dark:bg-zinc-700 overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                <div className="h-full rounded-full transition-all" style={{ background: 'hsl(var(--text-tertiary))', width: `${psychology}%` }} />
              </div>
              <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                <span>恐惧 0</span><span>中性 50</span><span>贪婪 100</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}