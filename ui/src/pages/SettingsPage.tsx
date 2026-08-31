import { useState, useEffect, useCallback } from 'react';
import { Database, Palette, Trash2, Wifi, Bot, Eye, EyeOff, Save, TestTube, CheckCircle, XCircle, AlertCircle, BarChart3, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useDeepSeekConfig } from '@/hooks/useTauriQuery';
import { useAppStore } from '@/store/useAppStore';
import { useThemeStore, type ThemeName } from '@/store/useThemeStore';
import { chartThemes, type ChartStyle } from '@/config/chartThemes';
import DataSourceStatus from '@/components/DataSourceStatus';

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
      <h1 className="text-2xl font-bold text-gradient" style={{ color: 'var(--text-primary)' }}>设置</h1>

      {configLoading && (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="animate-spin" size={24} />
        </div>
      )}

      {configError && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-xs" style={{ color: 'hsl(var(--risk-danger))', background: 'hsl(var(--risk-danger) / 0.1)', border: '1px solid hsl(var(--risk-danger) / 0.2)' }}>
          <AlertCircle size={14} />
          加载配置失败: {configError.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* DeepSeek Config */}
        <div className="glass-card-flat p-3">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={16} style={{ color: 'hsl(var(--swiss-accent))' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>DeepSeek AI 配置</h2>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${config?.has_key ? '' : ''}`} style={{ color: config?.has_key ? 'hsl(var(--price-up))' : 'hsl(var(--text-secondary))', background: config?.has_key ? 'hsl(var(--price-up) / 0.2)' : undefined }}>
              {config?.has_key ? '已配置' : '未配置'}
            </span>
          </div>

          <div className="space-y-4">
            {/* AI Enable Toggle */}
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI 智能分析</div>
                <div className="text-xs" style={{ color: 'hsl(var(--text-secondary))' }}>关闭后个股详情页和预测页将不调用 DeepSeek</div>
              </div>
              <button
                onClick={toggleDeepseek}
                className={`relative w-11 h-6 rounded-full transition-colors ${deepseekEnabled ? '' : ''}`}
                style={{ background: deepseekEnabled ? 'hsl(var(--swiss-accent))' : undefined }}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${deepseekEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {/* API Key */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.has_key ? '••••••••••••••••' : '请输入 DeepSeek API Key'}
                  className="w-full border rounded-lg px-3 py-2 text-sm  dark: dark:placeholder-zinc-500 outline-none pr-10"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', outline: '2px solid hsl(var(--swiss-accent))', outlineOffset: '2px' }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 dark:text-zinc-300" style={{ color: 'hsl(var(--text-secondary))' }}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Model Select */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>模型选择</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
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
                className="btn-secondary text-xs"
                style={{ color: 'hsl(var(--swiss-accent))', border: '1px solid hsl(var(--swiss-accent) / 0.3)', background: 'hsl(var(--swiss-accent) / 0.2)' }}
              >
                <Save size={12} />
                {saving ? '保存中...' : '保存配置'}
              </button>
              <button
                onClick={handleTest}
                disabled={testing}
                className="btn-ghost text-xs"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'hsl(var(--text-secondary))' }}
              >
                <TestTube size={12} />
                {testing ? '测试中...' : '连接测试'}
              </button>
            </div>

            {/* Save Toast */}
            {saveToast && (
              <div
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg`}
                style={{ color: saveToast.type === 'success' ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))', border: saveToast.type === 'success' ? '1px solid hsl(var(--price-up) / 0.2)' : '1px solid hsl(var(--price-down) / 0.2)', background: saveToast.type === 'success' ? 'hsl(var(--price-up) / 0.1)' : 'hsl(var(--price-down) / 0.1)' }}
              >
                {saveToast.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {saveToast.message}
              </div>
            )}

            {/* Test Status */}
            {testStatus && (
              <div
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg`}
                style={{ color: testStatus.success ? 'hsl(var(--price-up))' : 'hsl(var(--price-down))', border: testStatus.success ? '1px solid hsl(var(--price-up) / 0.2)' : '1px solid hsl(var(--price-down) / 0.2)', background: testStatus.success ? 'hsl(var(--price-up) / 0.1)' : 'hsl(var(--price-down) / 0.1)' }}
              >
                {testStatus.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testStatus.message}
              </div>
            )}
          </div>
        </div>

        <div className="glass-card-flat p-3">
          <div className="flex items-center gap-2 mb-4">
            <Wifi size={16} style={{ color: 'hsl(var(--swiss-accent))' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>数据源配置</h2>
            <DataSourceStatus compact />
          </div>
          <div className="space-y-1.5">
            {[
              ['A股实时行情', '腾讯财经 (qt.gtimg.cn)'],
              ['K线历史 & 分时', '腾讯财经 (ifzq.gtimg.cn)'],
              ['板块指数', '东方财富 (push2.eastmoney.com)'],
              ['中文名搜索', '新浪财经 (suggest3.sinajs.cn)'],
            ].map(([label, src]) => (
              <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'hsl(var(--bg-hover) / 0.4)' }}>
                <span className="text-xs font-medium" style={{ color: 'hsl(var(--text-secondary))' }}>{label}</span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'hsl(var(--text-primary))' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--price-up))' }} />
                  {src}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card-flat p-3">
          <DataSourceStatus />
        </div>

        <div className="glass-card-flat p-3">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} style={{ color: 'hsl(var(--price-up))' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>缓存管理</h2>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-secondary))' }}>本地 SQLite 数据缓存</span>
            <CacheClearButton />
          </div>
        </div>

        <div className="glass-card-flat p-3">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} style={{ color: 'hsl(var(--risk-warning))' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>K线风格</h2>
          </div>
          <ChartStyleSelector />
        </div>

        <div className="glass-card-flat p-3">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} style={{ color: 'hsl(var(--accent-purple))' }} />
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>配色方案</h2>
          </div>
          <ThemeSchemeSelector />
        </div>

        <div className="glass-card-flat p-3">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} style={{ color: 'hsl(var(--swiss-accent))' }} />
            <h2 className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>外观设置</h2>
          </div>
          <div className="space-y-3">
            {/* Theme selector */}
            <div>
              <span className="text-xs font-medium mb-2 block" style={{ color: 'hsl(var(--text-secondary))' }}>主题模式</span>
              <div className="text-sm font-medium" style={{ color: 'hsl(var(--text-primary))' }}>暗色</div>
            </div>
            {/* Accent color */}
            <div>
              <span className="text-xs font-medium mb-2 block" style={{ color: 'hsl(var(--text-secondary))' }}>强调色</span>
              <AccentColorPicker />
            </div>
          </div>
        </div>
      </div>
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
            className={`w-8 h-8 rounded-full border-2  hover:scale-110 transition-transform ${accent === c.key ? 'border-black dark:border-white scale-110' : 'border-white dark:border-zinc-700'}`}
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
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all hover:brightness-110"
        style={{ color: cleared ? 'hsl(var(--price-up))' : 'hsl(var(--risk-danger))', background: cleared ? 'hsl(var(--price-up) / 0.15)' : 'hsl(var(--risk-danger) / 0.1)', border: '1px solid', borderColor: cleared ? 'hsl(var(--price-up) / 0.3)' : 'hsl(var(--risk-danger) / 0.2)' }}>
        {cleared ? <><CheckCircle size={12} /> 已清除</> : <><Trash2 size={12} /> 清理缓存</>}
      </button>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)}>
          <div className="glass-card p-6 max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--risk-danger) / 0.15)' }}>
                <Trash2 size={18} style={{ color: 'hsl(var(--risk-danger))' }} />
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>确认清理缓存</h3>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--text-secondary))' }}>此操作不可撤销</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>
              将删除所有本地缓存的行情数据，下次加载时重新获取。自选股和设置不受影响。
            </p>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary text-xs">取消</button>
              <button onClick={handleClear} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all hover:brightness-110" style={{ background: 'hsl(var(--risk-danger))', color: '#fff' }}>
                <Trash2 size={12} /> 确认清理
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Theme scheme selector (jp / ghibli / bloomberg / swiss) ──
const THEME_SCHEMES: { key: ThemeName; label: string; desc: string; colors: string[] }[] = [
  { key: 'jp', label: '日式TV', desc: '鲜艳绯红 · 暖色调默认', colors: ['hsl(0 75% 48%)', 'hsl(25 95% 50%)', 'hsl(45 95% 50%)'] },
  { key: 'ghibli', label: '吉卜力', desc: '温暖琥珀 · 柔和梦幻', colors: ['hsl(30 60% 50%)', 'hsl(40 80% 55%)', 'hsl(180 40% 55%)'] },
  { key: 'bloomberg', label: 'Bloomberg', desc: '冷静蓝调 · 金融专业', colors: ['hsl(220 60% 50%)', 'hsl(30 90% 50%)', 'hsl(120 55% 40%)'] },
  { key: 'morandi', label: '莫兰迪', desc: '低饱和 · 治愈系', colors: ['hsl(340 25% 55%)', 'hsl(25 25% 60%)', 'hsl(190 15% 60%)'] },
  { key: 'swiss', label: '瑞士风格', desc: '经典蓝 · 简约清晰', colors: ['hsl(221 83% 53%)', 'hsl(25 95% 50%)', 'hsl(350 75% 38%)'] },
];

function ThemeSchemeSelector() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEME_SCHEMES.map((opt) => (
        <button key={opt.key} onClick={() => setTheme(opt.key)}
          className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border transition-all ${
            theme === opt.key
              ? '' : 'hover:border-slate-300 dark:hover:border-zinc-600'
          }`}
          style={{
            borderColor: theme === opt.key ? 'hsl(var(--swiss-accent) / 0.5)' : 'var(--border-default)',
            background: theme === opt.key ? 'hsl(var(--swiss-accent-ghost))' : undefined
          }}
        >
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{opt.label}</span>
            {theme === opt.key && <CheckCircle size={10} style={{ color: 'hsl(var(--swiss-accent))' }} className="ml-auto" />}
          </div>
          <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{opt.desc}</span>
          <div className="flex gap-1 mt-0.5">
            {opt.colors.map((c, i) => (
              <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
        </button>
      ))}
    </div>
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
              ? 'border-gray-900 dark:border-white dark:bg-white/10'
              : 'bg-white dark:bg-zinc-900'
          }`}
          style={{
            borderColor: chartStyle === key ? undefined : 'var(--border-default)',
            background: chartStyle === key ? 'var(--bg-input)' : undefined,
          }}
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
              <CheckCircle size={10} style={{ color: 'hsl(var(--swiss-accent))' }} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
