import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, LineStyle } from 'lightweight-charts';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { sslangLanguage, sslangTheme } from '@/lib/codemirror/sslang';
import { sslangCompletion } from '@/lib/codemirror/sslang-completion';
import { validateStrategyCode } from '@/utils/strategyRuntime';
import { compileTdx, TDX_DEFAULT_FORMULA } from '@/utils/tdxIndicator';
import { TDX_TEMPLATES, type TdxTemplate } from '@/utils/tdxTemplates';
import { saveCustomIndicator } from '@/indicators/manager';
import type { SminFile } from '@/indicators/types';
import { Save, Play, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight,
  Search, FileCode, Zap, BookOpen, Download, Upload, RotateCcw, Eye,
  Code2, Layers, Settings2, X } from 'lucide-react';

const TDX_CATEGORIES = ['全部', '趋势', '振荡', '量能', '综合'] as const;
const SSLANG_SNIPPETS = [
  // 基础信号
  { name: '金叉买入', code: 'RULE "金叉"\n  SIGNAL BUY\n  WHEN cross(sma(close, 5), sma(close, 20))\n  NOTE "5日均线上穿20日均线"' },
  { name: '死叉卖出', code: 'RULE "死叉"\n  SIGNAL SELL\n  WHEN crossunder(sma(close, 5), sma(close, 20))\n  NOTE "5日均线下穿20日均线"' },
  { name: 'RSI超卖买入', code: 'RULE "RSI超卖"\n  SIGNAL BUY\n  WHEN rsi(close, 14) < 30\n  NOTE "RSI低于30超卖区"' },
  { name: 'RSI超买卖出', code: 'RULE "RSI超买"\n  SIGNAL SELL\n  WHEN rsi(close, 14) > 70\n  NOTE "RSI高于70超买区"' },
  { name: 'MACD金叉', code: 'RULE "MACD金叉"\n  SIGNAL BUY\n  WHEN cross(macd(close).dif, macd(close).dea)\n  NOTE "MACD金叉买入"' },
  { name: '布林下轨买入', code: 'RULE "布林下轨"\n  SIGNAL BUY\n  WHEN close < boll(close, 20, 2).lower\n  NOTE "价格触及布林下轨"' },
  { name: '放量突破', code: 'RULE "放量突破"\n  SIGNAL BUY\n  WHEN vol > ref(sma(vol, 20), 1) * 2 AND close > ref(hhv(high, 20), 1)\n  NOTE "成交量放大2倍且突破20日高点"' },
  { name: '均线多头排列', code: 'RULE "多头排列"\n  SIGNAL BUY\n  WHEN sma(close, 5) > sma(close, 10) AND sma(close, 10) > sma(close, 20) AND sma(close, 20) > sma(close, 60)\n  NOTE "MA5>MA10>MA20>MA60"' },
  // K线形态
  { name: '锤子线买入', code: 'RULE "锤子线"\n  SIGNAL BUY\n  WHEN hammer(open, high, low, close)\n  NOTE "锤子线反转信号"' },
  { name: '十字星', code: 'RULE "十字星"\n  SIGNAL BUY\n  WHEN doji(open, high, low, close)\n  NOTE "十字星犹豫信号"' },
  { name: '吞没形态', code: 'RULE "看涨吞没"\n  SIGNAL BUY\n  WHEN engulf(open, high, low, close) AND close > open\n  NOTE "看涨吞没形态"' },
  { name: '早晨之星', code: 'RULE "早晨之星"\n  SIGNAL BUY\n  WHEN morning_star(open, high, low, close)\n  NOTE "早晨之星三根K线反转"' },
  { name: '黄昏之星', code: 'RULE "黄昏之星"\n  SIGNAL SELL\n  WHEN evening_star(open, high, low, close)\n  NOTE "黄昏之星顶部反转"' },
  { name: '射击之星', code: 'RULE "射击之星"\n  SIGNAL SELL\n  WHEN shooting_star(open, high, low, close)\n  NOTE "射击之星顶部信号"' },
  // 多指标组合
  { name: 'MACD+RSI 组合', code: 'RULE "MACD+RSI"\n  SIGNAL BUY\n  WHEN cross(macd(close).dif, macd(close).dea) AND rsi(close, 14) < 40\n  NOTE "MACD金叉且RSI未超买"' },
  { name: 'KDJ+均线 组合', code: 'RULE "KDJ+MA"\n  SIGNAL BUY\n  WHEN cross(kdj(high, low, close, 9).k, kdj(high, low, close, 9).d) AND close > sma(close, 20)\n  NOTE "KDJ金叉且站上20日均线"' },
  { name: '布林+RSI 组合', code: 'RULE "布林+RSI"\n  SIGNAL BUY\n  WHEN close < boll(close, 20, 2).lower AND rsi(close, 14) < 30\n  NOTE "触及布林下轨且RSI超卖"' },
  { name: 'ATR 止损跟踪', code: 'RULE "ATR止损"\n  SIGNAL SELL\n  WHEN close < ref(hhv(high, 20), 1) - 2 * atr(high, low, close, 14)\n  NOTE "价格跌破20日高点减2倍ATR"' },
  // 趋势系统
  { name: 'EMA趋势跟踪', code: 'RULE "EMA趋势"\n  SIGNAL BUY\n  WHEN ema(close, 12) > ema(close, 26) AND close > ema(close, 12)\n  NOTE "EMA多头且价格在EMA12上方"' },
  { name: '唐奇安突破', code: 'RULE "唐奇安突破"\n  SIGNAL BUY\n  WHEN close > ref(hhv(high, 20), 1)\n  NOTE "突破20日最高价"' },
  { name: '均线回踩买入', code: 'RULE "均线回踩"\n  SIGNAL BUY\n  WHEN cross(sma(close, 20), close) AND sma(close, 20) > sma(close, 60)\n  NOTE "回踩20日均线且趋势向上"' },
  { name: '量价齐升', code: 'RULE "量价齐升"\n  SIGNAL BUY\n  WHEN close > ref(close, 1) AND vol > ref(vol, 1) AND vol > sma(vol, 20)\n  NOTE "价涨量增且放量"' },
  // 反转策略
  { name: 'RSI底背离', code: 'RULE "RSI底背离"\n  SIGNAL BUY\n  WHEN close < ref(low, 5) AND rsi(close, 14) > ref(rsi(close, 14), 5)\n  NOTE "价格创新低但RSI未创新低"' },
  { name: '超卖反弹', code: 'RULE "超卖反弹"\n  SIGNAL BUY\n  WHEN rsi(close, 6) < 20 AND close > open\n  NOTE "6日RSI极度超卖且收阳"' },
  { name: '缩量企稳', code: 'RULE "缩量企稳"\n  SIGNAL BUY\n  WHEN vol < sma(vol, 20) * 0.5 AND close > sma(close, 5) AND close < sma(close, 20)\n  NOTE "缩量且站上5日线"' },
  // 量化策略
  { name: '海龟交易', code: 'RULE "海龟突破"\n  SIGNAL BUY\n  WHEN close > ref(hhv(high, 55), 1)\n  NOTE "突破55日最高价（海龟系统）"' },
  { name: '双均线系统', code: 'RULE "双均线"\n  SIGNAL BUY\n  WHEN cross(sma(close, 10), sma(close, 30))\n  NOTE "10日均线上穿30日均线"' },
  { name: '波动率突破', code: 'RULE "波动率突破"\n  SIGNAL BUY\n  WHEN close > ref(close, 1) + 1.5 * atr(high, low, close, 14)\n  NOTE "价格突破1.5倍ATR"' },
];

function generateId(): string {
  return `ind_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function IndicatorEditorPage() {
  const navigate = useNavigate();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [engine, setEngine] = useState<'sslang' | 'tdx'>('sslang');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<string>('全部');
  const [templateSearch, setTemplateSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [indicatorName, setIndicatorName] = useState('');
  const [indicatorDesc, setIndicatorDesc] = useState('');
  const [saved, setSaved] = useState(false);
  const previewChartRef = useRef<HTMLDivElement>(null);
  const previewChartApiRef = useRef<IChartApi | null>(null);
  const previewSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const previewIndicatorRef = useRef<ISeriesApi<'Line'> | null>(null);
  const themeCompartment = useRef(new Compartment());

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorContainerRef.current || viewRef.current) return;

    const startState = EditorState.create({
      doc: code || (engine === 'tdx' ? TDX_DEFAULT_FORMULA : SSLANG_SNIPPETS[0].code),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        autocompletion({ override: [sslangCompletion] }),
        lintGutter(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        sslangLanguage,
        sslangTheme,
        oneDark,
        themeCompartment.current.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newCode = update.state.doc.toString();
            setCode(newCode);
            validateCode(newCode);
          }
        }),
        EditorView.theme({
          '&': { fontSize: '13px', height: '100%' },
          '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
          '.cm-gutters': { backgroundColor: '#1e1e2e', borderRight: '1px solid #313244' },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    viewRef.current = view;

    // Validate initial code
    validateCode(startState.doc.toString());

    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  // Generate sample OHLC data for preview
  const sampleData = useMemo(() => {
    const data: { time: string; open: number; high: number; low: number; close: number }[] = [];
    let base = 100;
    for (let i = 0; i < 120; i++) {
      const date = new Date(2025, 0, 1);
      date.setDate(date.getDate() + i);
      const ts = date.toISOString().split('T')[0];
      const change = (Math.random() - 0.48) * 4;
      const open = base;
      const close = base + change;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      data.push({ time: ts, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2) });
      base = close;
    }
    return data;
  }, []);

  // Initialize preview chart when showPreview toggles on
  useEffect(() => {
    if (!showPreview || !previewChartRef.current) {
      if (!showPreview && previewChartApiRef.current) {
        previewChartApiRef.current.remove();
        previewChartApiRef.current = null;
        previewSeriesRef.current = null;
        previewIndicatorRef.current = null;
      }
      return;
    }
    const container = previewChartRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: { background: { color: '#1e1e2e' }, textColor: '#abb2bf' },
      grid: { vertLines: { color: '#313244' }, horzLines: { color: '#313244' } },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: false },
    });
    const series = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
    series.setData(sampleData);
    chart.timeScale().fitContent();
    previewChartApiRef.current = chart;
    previewSeriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      }
    });
    ro.observe(container);
    return () => { ro.disconnect(); chart.remove(); previewChartApiRef.current = null; };
  }, [showPreview, sampleData]);

  // Compute and update indicator overlay when code/params change
  useEffect(() => {
    if (!showPreview || !previewChartApiRef.current || !code.trim()) {
      if (previewIndicatorRef.current && previewChartApiRef.current) {
        previewChartApiRef.current.removeSeries(previewIndicatorRef.current);
        previewIndicatorRef.current = null;
      }
      return;
    }
    try {
      let value = 0;
      if (engine === 'sslang') {
        const result = validateStrategyCode(code);
        if (!result.valid) return;
      } else {
        const result = compileTdx(code, sampleData.map(d => ({ open: d.open, high: d.high, low: d.low, close: d.close, volume: 1000, time: d.time })));
        if (result.error || !result.outputs.length) return;
        const out = result.outputs[0];
        if (out && out.series && out.series.length > 0) {
          // Create a line series for the indicator
          if (previewIndicatorRef.current && previewChartApiRef.current) {
            previewChartApiRef.current.removeSeries(previewIndicatorRef.current);
            previewIndicatorRef.current = null;
          }
          const lineSeries = previewChartApiRef.current.addLineSeries({
            color: out.color || '#e5c07b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
          });
          const lineData = out.series
            .map((v: number | null, i: number) => ({ time: sampleData[Math.min(i, sampleData.length - 1)]?.time, value: typeof v === 'number' ? v : 0 }))
            .filter((d: { time?: string; value: number }) => d.time && Number.isFinite(d.value));
          if (lineData.length > 0) {
            lineSeries.setData(lineData as any);
          }
          previewIndicatorRef.current = lineSeries;
        }
      }
    } catch { /* ignore compute errors in preview */ }
  }, [code, engine, showPreview, sampleData]);

  const validateCode = useCallback((c: string) => {
    if (!c.trim()) { setError(null); setIsValid(false); return; }
    if (engine === 'sslang') {
      const result = validateStrategyCode(c);
      setError(result.error || null);
      setIsValid(result.valid);
    } else {
      try {
        const result = compileTdx(c, []);
        if (result.error) { setError(result.error.error); setIsValid(false); }
        else { setError(null); setIsValid(true); }
      } catch (e: any) { setError(e.message); setIsValid(false); }
    }
  }, [engine]);

  const handleLoadTemplate = useCallback((t: { code: string }) => {
    setCode(t.code);
    if (viewRef.current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: t.code },
      });
    }
  }, []);

  const handleLoadSnippet = useCallback((s: { code: string }) => {
    setCode(s.code);
    if (viewRef.current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: s.code },
      });
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!code.trim() || !isValid) return;
    saveCustomIndicator(
      indicatorName || '自定义指标',
      indicatorDesc,
      'custom',
      'intermediate',
      [],
      [],
      code,
      engine,
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [code, isValid, indicatorName, indicatorDesc, engine]);

  const handleExportSmin = useCallback(() => {
    if (!code.trim()) return;
    const smin: SminFile = {
      version: '1.0.0',
      meta: {
        id: generateId(),
        label: indicatorName || '自定义指标',
        description: indicatorDesc,
        author: 'local',
        version: '1.0.0',
        category: 'custom',
        license: 'MIT',
        source: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      params: [],
      code,
      engine,
    };
    const blob = new Blob([JSON.stringify(smin, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${indicatorName || 'indicator'}.smin`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, indicatorName, indicatorDesc, engine]);

  const filteredTemplates = useMemo(() => {
    let list: TdxTemplate[] = TDX_TEMPLATES;
    if (templateFilter !== '全部') list = list.filter(t => t.category === templateFilter);
    if (templateSearch) {
      const q = templateSearch.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return list;
  }, [templateFilter, templateSearch]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: Template browser */}
      {sidebarOpen && (
        <div className="w-64 shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-card))' }}>
          <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
            <div className="flex items-center gap-1.5">
              <Layers size={14} style={{ color: 'hsl(var(--text-tertiary))' }} />
              <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-primary))' }}>模板库</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-0.5 hover:opacity-60" style={{ color: 'hsl(var(--text-tertiary))' }}>
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* Template search */}
          <div className="p-2 border-b" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--text-tertiary))' }} />
              <input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="搜索模板..."
                className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded border bg-transparent"
                style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))' }}
              />
            </div>
          </div>

          {/* Engine tabs */}
          <div className="flex border-b" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
            {(['sslang', 'tdx'] as const).map(e => (
              <button key={e} onClick={() => { setEngine(e); setCode(''); }}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors ${engine === e ? 'border-b-2' : 'hover:opacity-60'}`}
                style={{ color: engine === e ? 'hsl(var(--text-primary))' : 'hsl(var(--text-tertiary))', borderColor: engine === e ? 'hsl(var(--accent))' : 'transparent' }}>
                {e}
              </button>
            ))}
          </div>

          {/* TDX category filters */}
          {engine === 'tdx' && (
            <div className="flex gap-1 p-2 flex-wrap border-b" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
              {TDX_CATEGORIES.map(c => (
                <button key={c} onClick={() => setTemplateFilter(c)}
                  className={`px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors ${templateFilter === c ? 'text-white' : 'hover:opacity-60'}`}
                  style={{ background: templateFilter === c ? 'hsl(var(--accent))' : 'hsl(var(--bg-elevated))', color: templateFilter === c ? '#fff' : 'hsl(var(--text-secondary))' }}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* SSLang snippets */}
          {engine === 'sslang' && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <div className="text-[10px] font-bold mb-2" style={{ color: 'hsl(var(--text-tertiary))' }}>快速模板</div>
              {SSLANG_SNIPPETS.map((s, i) => (
                <button key={i} onClick={() => handleLoadSnippet(s)}
                  className="w-full text-left p-2 rounded text-[11px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: 'hsl(var(--text-primary))' }}>
                  <div className="font-bold">{s.name}</div>
                  <div className="text-[10px] truncate mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>
                    {s.code.split('\n')[1]?.trim() || ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* TDX templates */}
          {engine === 'tdx' && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTemplates.map((t, i) => (
                <button key={i} onClick={() => handleLoadTemplate(t)}
                  className="w-full text-left p-2 rounded text-[11px] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  style={{ color: 'hsl(var(--text-primary))' }}>
                  <div className="font-bold">{t.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'hsl(var(--text-tertiary))' }}>{t.description}</div>
                  <div className="text-[10px] mt-0.5 px-1 py-0.5 rounded inline-block" style={{ background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-tertiary))' }}>
                    {t.category}
                  </div>
                </button>
              ))}
              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-[11px]" style={{ color: 'hsl(var(--text-tertiary))' }}>无匹配模板</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toggle sidebar button when closed */}
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)}
          className="w-6 shrink-0 flex items-center justify-center border-r hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-tertiary))' }}>
          <ChevronRight size={14} />
        </button>
      )}

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-card))' }}>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-[11px] font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>← 返回</button>
            <span className="w-px h-4" style={{ background: 'hsl(var(--border-subtle))' }} />
            <FileCode size={14} style={{ color: 'hsl(var(--accent))' }} />
            <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>指标编辑器</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Validation status */}
            <div className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold" style={{
              background: isValid ? 'hsl(142 76% 36% / 0.1)' : error ? 'hsl(0 84% 60% / 0.1)' : 'hsl(var(--bg-elevated))',
              color: isValid ? 'hsl(142 76% 60%)' : error ? 'hsl(0 84% 60%)' : 'hsl(var(--text-tertiary))',
            }}>
              {isValid ? <CheckCircle size={10} /> : error ? <AlertTriangle size={10} /> : <Code2 size={10} />}
              {isValid ? '有效' : error ? '错误' : '待输入'}
            </div>
            <span className="w-px h-4" style={{ background: 'hsl(var(--border-subtle))' }} />
            <button onClick={handleExportSmin} disabled={!code.trim()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
              style={{ color: 'hsl(var(--text-secondary))' }}>
              <Download size={12} /> 导出 .smin
            </button>
            <button onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded transition-colors ${showPreview ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              style={{ background: showPreview ? 'hsl(var(--accent))' : undefined, color: showPreview ? '#fff' : 'hsl(var(--text-secondary))' }}>
              <Eye size={12} /> 预览
            </button>
            <button onClick={handleSave} disabled={!code.trim() || !isValid}
              className="flex items-center gap-1 px-3 py-1 text-[11px] font-bold rounded transition-colors disabled:opacity-30"
              style={{ background: saved ? 'hsl(142 76% 36%)' : 'hsl(var(--accent))', color: '#fff' }}>
              {saved ? <CheckCircle size={12} /> : <Save size={12} />}
              {saved ? '已保存' : '保存'}
            </button>
          </div>
        </div>

        {/* Indicator metadata */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-card))' }}>
          <input value={indicatorName} onChange={e => setIndicatorName(e.target.value)}
            placeholder="指标名称"
            className="px-2 py-1 text-[11px] rounded border bg-transparent w-40"
            style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))' }} />
          <input value={indicatorDesc} onChange={e => setIndicatorDesc(e.target.value)}
            placeholder="描述（可选）"
            className="flex-1 px-2 py-1 text-[11px] rounded border bg-transparent"
            style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-primary))' }} />
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
            <span className="px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'hsl(var(--bg-elevated))' }}>{engine}</span>
          </div>
        </div>

        {/* Code editor */}
        <div className="flex-1 min-h-0 relative">
          <div ref={editorContainerRef} className="absolute inset-0" />
        </div>

        {/* Error bar */}
        {error && (
          <div className="shrink-0 px-3 py-1.5 border-t flex items-center gap-2 text-[11px]"
            style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(0 84% 60% / 0.05)', color: 'hsl(0 84% 60%)' }}>
            <AlertTriangle size={12} />
            <span className="flex-1 truncate">{error}</span>
            <button onClick={() => setError(null)} className="hover:opacity-60"><X size={12} /></button>
          </div>
        )}

        {/* Status bar */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1 border-t text-[10px]"
          style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-tertiary))', background: 'hsl(var(--bg-card))' }}>
          <span>{code.length} 字符 · {code.split('\n').length} 行</span>
          <span>{engine === 'sslang' ? 'SSLang 策略脚本' : 'TDX 通达信公式'}</span>
        </div>
      </div>

      {/* Preview panel */}
      {showPreview && (
        <div className="w-96 shrink-0 flex flex-col border-l" style={{ borderColor: 'hsl(var(--border-subtle))', background: '#1e1e2e' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: '#313244' }}>
            <div className="flex items-center gap-1.5">
              <Eye size={12} style={{ color: '#e5c07b' }} />
              <span className="text-[11px] font-bold" style={{ color: '#abb2bf' }}>实时预览</span>
            </div>
            <button onClick={() => setShowPreview(false)} className="hover:opacity-60" style={{ color: '#5c6370' }}>
              <X size={14} />
            </button>
          </div>
          <div ref={previewChartRef} className="flex-1 min-h-0" />
          {!code.trim() && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ color: '#5c6370' }}>
              <span className="text-[11px]">输入代码后自动预览</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
