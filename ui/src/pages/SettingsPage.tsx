import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Database, Palette, Trash2, Wifi, Server, Bot, Eye, EyeOff, Save, TestTube, CheckCircle, XCircle, AlertCircle, BarChart3 } from 'lucide-react';
import { useDeepSeekConfig } from '@/hooks/useTauriQuery';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store/useAppStore';
import { chartThemes, type ChartStyle } from '@/config/chartThemes';

export default function SettingsPage() {
  const { data: config, refetch } = useDeepSeekConfig();
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
    setSaving(true);
    setSaveToast(null);
    console.log('[SettingsPage] config save start:', { model, hasApiKey: apiKey.trim().length > 0 });
    try {
      // P0-3: allow saving model only, conditionally save key
      if (apiKey.trim()) {
        await invoke('save_deepseek_config', { apiKey: apiKey.trim(), model });
      } else {
        // Only save model to settings when key is empty
        await invoke('save_deepseek_config', { apiKey: '', model });
      }
      await refetch();
      console.log('[SettingsPage] config save success');
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
    setTesting(true);
    setTestStatus(null);
    console.log('[SettingsPage] test connection start');
    try {
      const result = await invoke<{ success: boolean; message: string }>('test_deepseek_connection');
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
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg text-xs text-slate-700 dark:text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:bg-slate-200 dark:bg-white/10 transition-colors disabled:opacity-50"
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
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-100 dark:bg-white/5 px-3 py-2">
              <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-zinc-400">主要数据源</span>
              <span className="text-xs text-slate-800 dark:text-slate-800 dark:text-zinc-200">akshare / 东方财富</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-100 dark:bg-white/5 px-3 py-2">
              <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-zinc-400">备用数据源</span>
              <span className="text-xs text-slate-800 dark:text-slate-800 dark:text-zinc-200">Yahoo Finance</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server size={16} className="text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">Python 桥接</h2>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-zinc-400">akshare 脚本路径</span>
            <span className="text-xs font-mono text-slate-700 dark:text-slate-700 dark:text-zinc-300">scripts/akshare_data.py</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-emerald-600 dark:text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-900 dark:text-white">缓存管理</h2>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-600 dark:text-zinc-400">本地缓存大小</span>
            <button className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs text-rose-300 hover:bg-rose-500/30 transition-colors">
              <Trash2 size={12} />
              清理缓存
            </button>
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
const ACCENT_COLORS = [
  { name: '紫色', hue: 262, sat: 83 },
  { name: '蓝色', hue: 221, sat: 83 },
  { name: '绿色', hue: 158, sat: 64 },
  { name: '橙色', hue: 25, sat: 95 },
  { name: '粉色', hue: 330, sat: 81 },
  { name: '石墨', hue: 215, sat: 10 },
];

function AccentColorPicker() {
  const setAccent = (hue: number, sat: number) => {
    const root = document.documentElement;
    root.style.setProperty('--accent', `${hue} ${sat}% 58%`);
    root.style.setProperty('--accent-subtle', `${hue} ${sat}% 95%`);
    root.style.setProperty('--accent-muted', `${hue} ${sat}% 42%`);
  };
  return (
    <div className="flex gap-2">
      {ACCENT_COLORS.map((c) => (
        <button key={c.name} onClick={() => setAccent(c.hue, c.sat)}
          className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-700 shadow-sm hover:scale-110 transition-transform"
          style={{ background: `hsl(${c.hue} ${c.sat}% 58%)` }}
          title={c.name}
        />
      ))}
    </div>
  );
}

function ChartStyleSelector() {
  const chartStyle = useAppStore((s) => s.chartStyle);
  const setChartStyle = useAppStore((s) => s.setChartStyle);

  const styles = Object.entries(chartThemes) as [ChartStyle, typeof chartThemes['classic']][];

  return (
    <div className="grid grid-cols-5 gap-2">
      {styles.map(([key, config]) => (
        <button
          key={key}
          onClick={() => setChartStyle(key)}
          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
            chartStyle === key
              ? 'border-violet-500/50 bg-violet-500/10'
              : 'border-slate-100 dark:border-slate-100 dark:border-white/5 bg-slate-100 dark:bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-slate-200 dark:bg-white/10'
          }`}
        >
          <span className="text-xl">{config.icon}</span>
          <span className="text-xs text-slate-700 dark:text-slate-700 dark:text-zinc-300 font-medium">{config.name}</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-500 dark:text-zinc-500">{config.description}</span>
          {/* Preview colors */}
          <div className="flex gap-1 mt-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: config.upColor }} />
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: config.downColor }} />
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
