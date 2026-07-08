import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Database, Palette, Trash2, Wifi, Bot, Eye, EyeOff, Save, TestTube, CheckCircle, XCircle, AlertCircle, BarChart3, RefreshCw, Activity } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDeepSeekConfig } from '@/hooks/useTauriQuery';
import { useDiagnoseDataSources } from '@/hooks/useTauriQuery';
import { useAppStore } from '@/store/useAppStore';
import { chartThemes, type ChartStyle } from '@/config/chartThemes';
import { type DataSourceResult } from '@/types';

export default function SettingsPage() {
  const { data: config, isLoading: configLoading, error: configError, refetch } = useDeepSeekConfig();
  const deepseekEnabled = useAppStore((s) => s.deepseekEnabled);
  const toggleDeepseek = useAppStore((s) => s.toggleDeepseek);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('deepseek-v4-pro');
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // P0-2: Sync model from config
  useEffect(() => {
    if (config?.model) {
      setModel(config.model);
    }
  }, [config?.model]);

  // Auto-hide toast
  useEffect(() => {
    if (saveToast) {
      const timer = setTimeout(() => setSaveToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveToast]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setSaveToast({ type: 'error', message: 'API Key 不能为空，请输入后重试' });
      return;
    }
    setSaving(true);
    setSaveToast(null);
    try {
      await invoke('save_deepseek_config', { apiKey: apiKey.trim(), model });
      await refetch();
      setSaveToast({ type: 'success', message: '配置已保存' });
      setTestStatus(null);
    } catch (e) {
      console.error('[SettingsPage] config save error:', e);
      setSaveToast({ type: 'error', message: '保存失败: ' + String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setTestStatus({ success: false, message: '请先输入 API Key 再测试连接' });
      return;
    }
    setTesting(true);
    setTestStatus(null);
    console.log('[SettingsPage] test connection start');
    try {
      const result = await invoke<{ success: boolean; message: string }>('test_deepseek_connection', { apiKey: apiKey.trim(), model });
      console.log('[SettingsPage] test connection result:', result);
      setTestStatus(result);
    } catch (e) {
      console.error('[SettingsPage] test connection error:', e);
      setTestStatus({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">设置</h1>

      {configLoading && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="animate-spin" size={24} />
        </div>
      )}

      {configError && (
        <div className="p-4 text-red-500 border border-red-300 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
          加载配置失败: {configError.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* DeepSeek Config */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} className="text-violet-600 dark:text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">DeepSeek AI 配置</h2>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${config?.has_key ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/20 text-slate-600 dark:text-slate-600 dark:text-zinc-400'}`}>
              {config?.has_key ? '已配置' : '未配置'}
            </span>
          </div>

          <div className="space-y-4">
            {/* AI Enable Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">AI 智能分析</div>
                <div className="text-xs text-slate-500 dark:text-zinc-500">关闭后个股详情页和预测页将不调用 DeepSeek</div>
              </div>
              <button
                onClick={toggleDeepseek}
                className={`relative w-11 h-6 rounded-full transition-colors ${deepseekEnabled ? 'bg-violet-600' : 'bg-zinc-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${deepseekEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {/* API Key */}
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-600 dark:text-zinc-400 mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.has_key ? '••••••••••••••••' : '请输入 DeepSeek API Key'}
                  className="w-full bg-slate-100 dark:bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-violet-500/50 pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:text-slate-700 dark:text-zinc-300"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Model Select */}
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-600 dark:text-zinc-400 mb-1.5">模型选择</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-900 dark:text-white outline-none focus:border-violet-500/50"
              >
                <option value="deepseek-v4-pro" className="bg-zinc-900">deepseek-v4-pro</option>
                <option value="deepseek-v4-flash" className="bg-zinc-900">deepseek-v4-flash</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-violet-500/20 border border-violet-500/30 px-4 py-2 rounded-lg text-xs text-violet-700 dark:text-violet-700 dark:text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
              >
                <Save size={12} />
                {saving ? '保存中...' : '保存配置'}
              </button>
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                <TestTube size={12} />
                {testing ? '测试中...' : '连接测试'}
              </button>
            </div>

            {/* Save Toast */}
            {saveToast && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${saveToast.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}
              >
                {saveToast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {saveToast.message}
              </motion.div>
            )}

            {/* Test Status */}
            {testStatus && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${testStatus.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'}`}
              >
                {testStatus.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testStatus.message}
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wifi size={16} className="text-violet-600 dark:text-violet-600 dark:text-violet-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">数据源配置</h2>
          </div>
          <div className="space-y-2 text-xs font-bold">
            {[
              ['A股实时行情', '腾讯财经 (qt.gtimg.cn)'],
              ['K线历史 & 分时', '腾讯财经 (ifzq.gtimg.cn)'],
              ['板块指数', '东方财富 (push2.eastmoney.com)'],
              ['中文名搜索', '新浪财经 (suggest3.sinajs.cn)'],
            ].map(([label, src]) => (
              <div key={label} className="flex items-center justify-between border px-3 py-2" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>{label}</span>
                <span className="flex items-center gap-1.5" style={{ color: 'hsl(var(--ink))' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> {src}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Data Source Diagnostic */}
        <DiagnosticSection />

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-emerald-600 dark:text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">缓存管理</h2>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-secondary))' }}>本地 SQLite 数据缓存</span>
            <CacheClearButton />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">K线风格</h2>
          </div>
          <ChartStyleSelector />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-violet-500" />
            <h2 className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>外观设置</h2>
          </div>
          <div className="space-y-3">
            {/* Theme selector */}
            <div>
              <span className="text-xs font-medium mb-2 block" style={{ color: 'hsl(var(--text-secondary))' }}>主题模式</span>
              <ThemeSelector />
            </div>
            {/* Accent color */}
            <div>
              <span className="text-xs font-medium mb-2 block" style={{ color: 'hsl(var(--text-secondary))' }}>强调色</span>
              <AccentColorPicker />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Theme mode selector (light / dark / system) ──
const THEME_OPTIONS = [
  { value: 'light' as const, label: '浅色', icon: '☀️', desc: '始终使用浅色外观' },
  { value: 'dark' as const, label: '深色', icon: '🌙', desc: '始终使用深色外观' },
  { value: 'system' as const, label: '自动', icon: '🖥️', desc: '跟随系统外观设置' },
];

function ThemeSelector() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEME_OPTIONS.map((opt) => (
        <button key={opt.value} onClick={() => setTheme(opt.value)}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
            theme === opt.value
              ? 'border-violet-500/50 bg-violet-50 dark:bg-violet-500/10'
              : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
          }`}
        >
          <span className="text-lg">{opt.icon}</span>
          <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-primary))' }}>{opt.label}</span>
          <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}

// ── Accent color picker ──
const ACCENT_COLORS: { name: string; key: import('@/store/useAppStore').AccentColor }[] = [
  { name: '红色', key: 'red' },
  { name: '蓝色', key: 'blue' },
  { name: '绿色', key: 'green' },
  { name: '橙色', key: 'orange' },
  { name: '粉色', key: 'pink' },
  { name: '石墨', key: 'graphite' },
];

function AccentColorPicker() {
  const accent = useAppStore((s) => s.accent);
  const setAccent = useAppStore((s) => s.setAccent);
  const ACCENT_VALS: Record<string, [number, number]> = { red: [350, 75], blue: [221, 83], green: [158, 64], orange: [25, 95], pink: [330, 81], graphite: [215, 10] };
  return (
    <div className="flex gap-2">
      {ACCENT_COLORS.map((c) => {
        const [h, s] = ACCENT_VALS[c.key];
        return (
          <button key={c.key} onClick={() => setAccent(c.key)}
            className={`w-8 h-8 rounded-full border-2 shadow-sm hover:scale-110 transition-transform ${accent === c.key ? 'border-black dark:border-white scale-110' : 'border-white dark:border-zinc-700'}`}
            style={{ background: `hsl(${h}, ${s}%, 58%)` }}
            title={c.name}
          />
        );
      })}
    </div>
  );
}

function CacheClearButton() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  const handleClear = async () => {
    try { await invoke('clean_cache'); setCleared(true); setTimeout(() => setCleared(false), 2000); }
    catch (e) { console.error('Cache clear failed:', e); }
    setShowConfirm(false);
  };
  return (
    <>
      <button onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-red-700 text-red-700 font-black text-xs hover:bg-red-50 transition-colors">
        <Trash2 size={12} /> {cleared ? '已清除 ✓' : '清理缓存'}
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowConfirm(false)}>
          <div className="glass-card p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-2" style={{ color: 'hsl(var(--ink))' }}>确认清理缓存？</h3>
            <p className="text-sm mb-4" style={{ color: 'hsl(var(--text-secondary))' }}>将删除所有本地缓存的行情数据，下次加载时重新获取。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-1.5 border-2 text-sm font-bold" style={{ borderColor: 'hsl(var(--border-strong))', color: 'hsl(var(--ink))' }}>取消</button>
              <button onClick={handleClear} className="px-4 py-1.5 border-2 border-red-700 bg-red-700 text-white text-sm font-bold">确认清理</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChartStyleSelector() {
  const chartStyle = useAppStore((s) => s.chartStyle);
  const setChartStyle = useAppStore((s) => s.setChartStyle);

  const styles = Object.entries(chartThemes) as [ChartStyle, typeof chartThemes['classic']][];

  return (
    <div className="grid grid-cols-3 gap-2">
      {styles.map(([key, config]) => (
        <button
          key={key}
          onClick={() => setChartStyle(key)}
          className={`relative flex flex-col items-center gap-1.5 p-3 border transition-all ${
            chartStyle === key
              ? 'border-gray-900 dark:border-white bg-gray-100 dark:bg-white/10'
              : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-gray-400'
          }`}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{config.name}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{config.description}</span>
          <div className="flex gap-1 mt-1">
            <div className="w-3 h-3" style={{ backgroundColor: config.upColor }} />
            <div className="w-3 h-3" style={{ backgroundColor: config.downColor }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: config.ma5Color }} />
          </div>
          {chartStyle === key && (
            <div className="absolute top-1 right-1">
              <CheckCircle size={10} className="text-violet-600 dark:text-violet-600 dark:text-violet-400" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Data Source Diagnostic Component ──
function DiagnosticSection() {
  const {
    data: results,
    isLoading,
    isFetching,
    error: diagnoseError,
    refetch,
    dataUpdatedAt,
  } = useDiagnoseDataSources();

  // Auto-diagnose on first mount
  const [hasAutoRun, setHasAutoRun] = useState(false);
  useEffect(() => {
    if (!hasAutoRun) {
      // Run auto-diagnosis with a short delay so UI renders first
      const timer = setTimeout(() => {
        refetch();
        setHasAutoRun(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasAutoRun, refetch]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const okCount = results?.filter((r) => r.status === 'ok').length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-emerald-500" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">数据源诊断</h2>
        {results && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
            okCount === totalCount
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : okCount > 0
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}>
            {okCount}/{totalCount} 可用
          </span>
        )}
        {lastUpdated && (
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">上次: {lastUpdated}</span>
        )}
      </div>

      <div className="space-y-2">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw size={18} className="animate-spin text-slate-400" />
            <span className="ml-2 text-xs text-slate-400">正在检测各数据源...</span>
          </div>
        ) : diagnoseError ? (
          <div className="flex items-center gap-2 text-xs px-3 py-3 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle size={14} />
            诊断失败: {diagnoseError.message}
          </div>
        ) : !results ? (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-400">点击"一键诊断"测试所有数据源</span>
          </div>
        ) : (
          results.map((result, idx) => (
            <DiagnosticRow key={idx} result={result} />
          ))
        )}
      </div>

      {/* Test all button */}
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => refetch()}
          disabled={isLoading || isFetching}
          className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg text-xs text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          <Activity size={12} />
          {isLoading || isFetching ? '诊断中...' : '一键诊断'}
        </button>
      </div>
    </motion.div>
  );
}

function DiagnosticRow({ result }: { result: DataSourceResult }) {
  const isOk = result.status === 'ok';
  const msText = result.response_time_ms < 1000
    ? `${result.response_time_ms}ms`
    : `${(result.response_time_ms / 1000).toFixed(1)}s`;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
      {/* Status dot */}
      <span className={`relative flex w-2.5 h-2.5 flex-shrink-0 ${isOk ? 'animate-pulse' : ''}`}>
        <span className={`absolute inline-flex w-full h-full rounded-full opacity-75 ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      </span>

      {/* Name */}
      <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 min-w-[5rem]">
        {result.name}
      </span>

      {/* Endpoint */}
      <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex-1 truncate hidden sm:block" title={result.endpoint}>
        {result.endpoint}
      </span>

      {/* Status + Time */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
          isOk
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        }`}>
          {isOk ? 'OK' : 'ERROR'}
        </span>
        <span className="text-[10px] tabular-nums text-slate-500 dark:text-zinc-400 min-w-[3rem] text-right">
          {msText}
        </span>
        {isOk ? (
          <CheckCircle size={12} className="text-emerald-500 flex-shrink-0" />
        ) : (
          <XCircle size={12} className="text-rose-500 flex-shrink-0" />
        )}
      </div>

      {/* Error detail (expandable) */}
      {!isOk && result.detail && (
        <div className="text-[10px] text-rose-400 dark:text-rose-500 mt-1 w-full break-all">
          {result.detail}
        </div>
      )}
    </div>
  );
}
