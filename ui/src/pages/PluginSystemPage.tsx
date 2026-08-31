import { useState, useMemo, useCallback } from 'react';
import { Puzzle, Store, Download, Upload, Trash2, Settings, Play, Pause, Code, FileCode, Shield, Star, Users, Clock, CheckCircle, AlertTriangle, Eye, Edit3, Plus, Search, Filter, ChevronDown, ExternalLink, Package, RefreshCw, Lock, Unlock, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── 类型 ──

interface PluginMeta {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  icon: string;
  downloads: number;
  rating: number;
  reviews: number;
  price: number; // 0 = free
  status: 'installed' | 'available' | 'update' | 'dev';
  enabled: boolean;
  permissions: string[];
  code?: string;
  changelog?: string;
  lastUpdated: string;
}

interface PluginTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
  category: string;
}

// ── 常量 ──

const MOCK_PLUGINS: PluginMeta[] = [
  {
    id: 'custom-rsi-div', name: 'RSI背离检测', version: '1.2.0', author: '量化老王',
    description: '自动检测RSI与价格的顶背离和底背离信号，支持自定义灵敏度',
    category: '信号检测', icon: '📊', downloads: 3200, rating: 4.8, reviews: 156, price: 0,
    status: 'installed', enabled: true, permissions: ['price_data', 'indicator_output'],
    lastUpdated: '2026-08-15',
  },
  {
    id: 'volume-profile', name: '成交量分布图', version: '2.0.1', author: '趋势猎手',
    description: '基于价格区间的成交量分布分析，识别关键支撑阻力位',
    category: '量价分析', icon: '📈', downloads: 2800, rating: 4.7, reviews: 98, price: 0,
    status: 'installed', enabled: false, permissions: ['price_data', 'volume_data'],
    lastUpdated: '2026-08-20',
  },
  {
    id: 'smart-money', name: '聪明资金追踪', version: '1.5.0', author: '资金流达人',
    description: '追踪大单资金流向，识别机构资金进出信号',
    category: '资金流', icon: '💰', downloads: 4500, rating: 4.9, reviews: 234, price: 9.9,
    status: 'available', enabled: false, permissions: ['price_data', 'volume_data', 'fund_flow'],
    lastUpdated: '2026-08-25',
  },
  {
    id: 'pattern-scanner', name: 'K线形态扫描', version: '3.1.0', author: '技术派小李',
    description: '自动识别50+种K线形态，支持自定义形态组合',
    category: '形态识别', icon: '🔍', downloads: 5200, rating: 4.6, reviews: 312, price: 0,
    status: 'available', enabled: false, permissions: ['price_data'],
    lastUpdated: '2026-08-18',
  },
  {
    id: 'wave-analyzer', name: '艾略特波浪分析', version: '1.0.3', author: '波浪大师',
    description: '自动标注艾略特波浪结构，支持推动浪和调整浪识别',
    category: '技术分析', icon: '🌊', downloads: 1800, rating: 4.5, reviews: 67, price: 19.9,
    status: 'available', enabled: false, permissions: ['price_data'],
    lastUpdated: '2026-07-30',
  },
  {
    id: 'heatmap-pro', name: '板块热力图Pro', version: '2.2.0', author: '数据可视化',
    description: '增强版板块热力图，支持多维度数据叠加和自定义配色',
    category: '可视化', icon: '🗺️', downloads: 3800, rating: 4.8, reviews: 189, price: 0,
    status: 'available', enabled: false, permissions: ['sector_data'],
    lastUpdated: '2026-08-22',
  },
  {
    id: 'backtest-engine', name: '高级回测引擎', version: '1.8.0', author: '回测专家',
    description: '支持多标的组合回测、滑点模拟、手续费计算',
    category: '回测工具', icon: '⚙️', downloads: 2100, rating: 4.7, reviews: 89, price: 29.9,
    status: 'update', enabled: true, permissions: ['price_data', 'indicator_output', 'strategy_code'],
    lastUpdated: '2026-08-28',
  },
  {
    id: 'news-sentiment', name: '新闻情绪分析', version: '1.3.0', author: 'NLP实验室',
    description: '基于AI的财经新闻情绪分析，实时监控市场情绪变化',
    category: '情绪分析', icon: '📰', downloads: 1500, rating: 4.4, reviews: 45, price: 14.9,
    status: 'dev', enabled: false, permissions: ['news_data', 'price_data'],
    lastUpdated: '2026-08-10',
  },
];

const PLUGIN_TEMPLATES: PluginTemplate[] = [
  {
    id: 'simple-signal', name: '简单信号插件', description: '基础的买入/卖出信号生成模板',
    category: '信号检测',
    code: `// StockMate Plugin SDK v1.0
import { PluginAPI } from '@stockmate/sdk';

export function register(api: PluginAPI) {
  // 注册指标
  api.registerIndicator({
    id: 'my-signal',
    name: '我的信号',
    category: 'custom',
    params: [
      { key: 'period', label: '周期', type: 'number', default: 14 }
    ],
    compute: (bars, params) => {
      const { period } = params;
      // 在此编写计算逻辑
      return { series: [] };
    }
  });

  // 注册信号检测
  api.onBarClose((bar, index) => {
    // 每根K线收盘时触发
  });
}`,
  },
  {
    id: 'data-fetcher', name: '数据获取插件', description: '从外部API获取数据的模板',
    category: '数据源',
    code: `// StockMate Plugin SDK v1.0
import { PluginAPI } from '@stockmate/sdk';

export function register(api: PluginAPI) {
  // 注册数据源
  api.registerDataSource({
    id: 'my-data-source',
    name: '我的数据源',
    fetch: async (symbol, period) => {
      // 调用外部API获取数据
      const response = await fetch(\`https://api.example.com/\${symbol}\`);
      return response.json();
    }
  });

  // 注册定时任务
  api.schedule('*/5 * * * *', async () => {
    // 每5分钟执行一次
  });
}`,
  },
  {
    id: 'custom-visual', name: '自定义可视化插件', description: '自定义图表渲染模板',
    category: '可视化',
    code: `// StockMate Plugin SDK v1.0
import { PluginAPI } from '@stockmate/sdk';

export function register(api: PluginAPI) {
  // 注册自定义图表层
  api.registerChartLayer({
    id: 'my-layer',
    name: '我的图层',
    render: (ctx, data, options) => {
      // Canvas 2D 渲染逻辑
      ctx.beginPath();
      ctx.strokeStyle = '#ff0000';
      // ... 绘制自定义图形
    }
  });

  // 注册tooltip
  api.registerTooltip({
    id: 'my-tooltip',
    render: (data) => {
      return \`自定义数据: \${data.value}\`;
    }
  });
}`,
  },
];

const CATEGORIES = ['全部', '信号检测', '量价分析', '资金流', '形态识别', '技术分析', '可视化', '回测工具', '情绪分析', '数据源'];

const PERMISSION_LABELS: Record<string, string> = {
  price_data: '价格数据', volume_data: '成交量数据', fund_flow: '资金流数据',
  indicator_output: '指标输出', strategy_code: '策略代码', sector_data: '板块数据',
  news_data: '新闻数据',
};

// ── 组件 ──

function PluginCard({ plugin, onInstall, onToggle, onUninstall, onView }: {
  plugin: PluginMeta;
  onInstall: (id: string) => void;
  onToggle: (id: string) => void;
  onUninstall: (id: string) => void;
  onView: (plugin: PluginMeta) => void;
}) {
  const statusConfig = {
    installed: { color: '#10b981', label: '已安装', icon: CheckCircle },
    available: { color: '#3b82f6', label: '可安装', icon: Download },
    update: { color: '#f59e0b', label: '可更新', icon: RefreshCw },
    dev: { color: '#8b5cf6', label: '开发中', icon: Code },
  };
  const status = statusConfig[plugin.status];
  const StatusIcon = status.icon;

  return (
    <motion.div whileHover={{ scale: 1.01 }} className="glass-card rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{plugin.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{plugin.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${status.color}15`, color: status.color }}>
              {status.label}
            </span>
            {plugin.price > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
                ¥{plugin.price}
              </span>
            )}
          </div>
          <p className="text-[10px] mb-1.5" style={{ color: 'hsl(var(--text-secondary))' }}>{plugin.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>v{plugin.version}</span>
            <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>by {plugin.author}</span>
            <span className="text-[9px]" style={{ color: '#f59e0b' }}>★ {plugin.rating}</span>
            <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{plugin.downloads.toLocaleString()} 下载</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            {plugin.permissions.map(p => (
              <span key={p} className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
                {PERMISSION_LABELS[p] || p}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {plugin.status === 'installed' ? (
            <>
              <button onClick={() => onToggle(plugin.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium"
                style={{ background: plugin.enabled ? '#10b98115' : 'hsl(var(--bg-secondary))', color: plugin.enabled ? '#10b981' : 'hsl(var(--text-tertiary))' }}>
                {plugin.enabled ? <Pause size={10} /> : <Play size={10} />}
                {plugin.enabled ? '已启用' : '已禁用'}
              </button>
              <button onClick={() => onUninstall(plugin.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px]"
                style={{ color: '#ef4444' }}>
                <Trash2 size={10} /> 卸载
              </button>
            </>
          ) : plugin.status === 'update' ? (
            <button onClick={() => onInstall(plugin.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium"
              style={{ background: '#f59e0b', color: 'white' }}>
              <RefreshCw size={10} /> 更新
            </button>
          ) : plugin.status === 'available' ? (
            <button onClick={() => onInstall(plugin.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium"
              style={{ background: 'hsl(var(--swiss-accent))', color: 'white' }}>
              <Download size={10} /> 安装
            </button>
          ) : (
            <span className="text-[10px] px-2 py-1 rounded" style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-tertiary))' }}>
              开发中
            </span>
          )}
          <button onClick={() => onView(plugin)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px]"
            style={{ color: 'hsl(var(--text-tertiary))' }}>
            <Eye size={10} /> 详情
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SDKCodeBlock({ template }: { template: PluginTemplate }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass-card rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Code size={14} style={{ color: 'hsl(var(--swiss-accent))' }} />
          <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-primary))' }}>{template.name}</span>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {expanded ? '收起' : '展开'}
        </button>
      </div>
      <p className="text-[10px] mb-2" style={{ color: 'hsl(var(--text-tertiary))' }}>{template.description}</p>
      <AnimatePresence>
        {expanded && (
          <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <pre className="p-3 rounded-lg text-[10px] leading-relaxed overflow-x-auto"
              style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-secondary))', fontFamily: 'JetBrains Mono, monospace' }}>
              {template.code}
            </pre>
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

function PluginDetail({ plugin, onClose }: { plugin: PluginMeta; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{plugin.icon}</span>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{plugin.name}</h3>
            <p className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>v{plugin.version} · {plugin.author}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-[10px] px-2 py-1 rounded" style={{ color: 'hsl(var(--text-tertiary))' }}>关闭</button>
      </div>
      <p className="text-xs mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>{plugin.description}</p>
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: '下载量', value: plugin.downloads.toLocaleString() },
          { label: '评分', value: `★ ${plugin.rating}` },
          { label: '评价', value: `${plugin.reviews}条` },
          { label: '更新', value: plugin.lastUpdated },
        ].map(item => (
          <div key={item.label} className="text-center p-2 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
            <span className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.label}</span>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: 'hsl(var(--text-primary))' }}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mb-3">
        <span className="text-[10px] font-semibold" style={{ color: 'hsl(var(--text-tertiary))' }}>所需权限</span>
        <div className="flex items-center gap-1.5 mt-1">
          {plugin.permissions.map(p => (
            <span key={p} className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded"
              style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-secondary))' }}>
              <Shield size={8} /> {PERMISSION_LABELS[p] || p}
            </span>
          ))}
        </div>
      </div>
      <div>
        <span className="text-[10px] font-semibold" style={{ color: 'hsl(var(--text-tertiary))' }}>安全评级</span>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded"
            style={{ background: '#10b98115', color: '#10b981' }}>
            <Lock size={8} /> 沙箱隔离
          </span>
          <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded"
            style={{ background: '#10b98115', color: '#10b981' }}>
            <CheckCircle size={8} /> 代码审计
          </span>
          <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded"
            style={{ background: '#10b98115', color: '#10b981' }}>
            <Shield size={8} /> 权限管控
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── 主页面 ──

export default function PluginSystemPage() {
  const [plugins, setPlugins] = useState(MOCK_PLUGINS);
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed' | 'sdk' | 'dev'>('marketplace');
  const [filterCategory, setFilterCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginMeta | null>(null);

  const filtered = useMemo(() => {
    return plugins
      .filter(p => {
        if (activeTab === 'installed') return p.status === 'installed' || p.status === 'update';
        if (activeTab === 'dev') return p.status === 'dev';
        return true;
      })
      .filter(p => filterCategory === '全部' || p.category === filterCategory)
      .filter(p => !searchQuery || p.name.includes(searchQuery) || p.description.includes(searchQuery));
  }, [plugins, activeTab, filterCategory, searchQuery]);

  const installedCount = plugins.filter(p => p.status === 'installed' || p.status === 'update').length;
  const enabledCount = plugins.filter(p => p.enabled).length;

  const installPlugin = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, status: 'installed' as const, enabled: true } : p));
  };
  const togglePlugin = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };
  const uninstallPlugin = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, status: 'available' as const, enabled: false } : p));
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto" style={{ color: 'hsl(var(--text-primary))' }}>
      {/* Header */}
      <div className="glass-card rounded-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'hsl(var(--swiss-accent))' }}>
              <Puzzle size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'hsl(var(--text-primary))' }}>插件系统</h1>
              <p className="text-xs" style={{ color: 'hsl(var(--text-tertiary))' }}>自定义指标SDK · 第三方插件市场</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>已安装</span>
              <p className="text-sm font-bold" style={{ color: 'hsl(var(--swiss-accent))' }}>{installedCount}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>已启用</span>
              <p className="text-sm font-bold" style={{ color: '#10b981' }}>{enabledCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        {([['marketplace', '插件市场', Store], ['installed', '已安装', Package], ['sdk', 'SDK文档', Code], ['dev', '开发者', Edit3]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium"
            style={{ background: activeTab === key ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: activeTab === key ? 'white' : 'hsl(var(--text-tertiary))' }}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Search + Filter */}
      {activeTab === 'marketplace' && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--text-tertiary))' }} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索插件..."
              className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-lg border-0 outline-none"
              style={{ background: 'hsl(var(--bg-secondary))', color: 'hsl(var(--text-primary))' }} />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.slice(0, 6).map(cat => (
              <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? '全部' : cat)}
                className="px-2 py-0.5 rounded text-[9px] font-medium"
                style={{ background: filterCategory === cat ? 'hsl(var(--swiss-accent))' : 'hsl(var(--bg-secondary))', color: filterCategory === cat ? 'white' : 'hsl(var(--text-tertiary))' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'sdk' ? (
        <div className="space-y-3">
          <div className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Code size={14} style={{ color: 'hsl(var(--swiss-accent))' }} />
              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>StockMate Plugin SDK v1.0</span>
            </div>
            <p className="text-[11px] mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>
              使用 StockMate Plugin SDK 构建自定义指标、数据源和可视化插件。插件运行在沙箱环境中，确保安全隔离。
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { title: '注册指标', desc: '自定义计算逻辑和参数', icon: BarChart3 },
                { title: '数据源', desc: '接入外部API数据', icon: ExternalLink },
                { title: '可视化', desc: '自定义图表渲染层', icon: Eye },
              ].map(item => (
                <div key={item.title} className="p-3 rounded-lg" style={{ background: 'hsl(var(--bg-secondary))' }}>
                  <item.icon size={14} style={{ color: 'hsl(var(--swiss-accent))' }} />
                  <p className="text-[10px] font-semibold mt-1" style={{ color: 'hsl(var(--text-primary))' }}>{item.title}</p>
                  <p className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          {PLUGIN_TEMPLATES.map(t => <SDKCodeBlock key={t.id} template={t} />)}
        </div>
      ) : activeTab === 'dev' ? (
        <div className="space-y-3">
          <div className="glass-card rounded-xl px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Edit3 size={14} style={{ color: 'hsl(var(--swiss-accent))' }} />
              <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>开发者中心</span>
            </div>
            <p className="text-[11px] mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>
              发布你的插件到市场，与其他用户分享你的指标和工具。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: '提交插件', desc: '审核通过后上架市场', icon: Upload },
                { title: '管理版本', desc: '发布更新和维护', icon: RefreshCw },
                { title: '查看统计', desc: '下载量和用户反馈', icon: Star },
                { title: '收入管理', desc: '付费插件收入提现', icon: Store },
              ].map(item => (
                <div key={item.title} className="p-3 rounded-lg cursor-pointer hover:bg-white/[0.02]"
                  style={{ background: 'hsl(var(--bg-secondary))' }}>
                  <item.icon size={14} style={{ color: 'hsl(var(--swiss-accent))' }} />
                  <p className="text-[10px] font-semibold mt-1" style={{ color: 'hsl(var(--text-primary))' }}>{item.title}</p>
                  <p className="text-[9px]" style={{ color: 'hsl(var(--text-tertiary))' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          {plugins.filter(p => p.status === 'dev').map(p => (
            <PluginCard key={p.id} plugin={p} onInstall={installPlugin} onToggle={togglePlugin}
              onUninstall={uninstallPlugin} onView={setSelectedPlugin} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PluginCard key={p.id} plugin={p} onInstall={installPlugin} onToggle={togglePlugin}
              onUninstall={uninstallPlugin} onView={setSelectedPlugin} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <Package size={32} style={{ color: 'hsl(var(--text-tertiary))', opacity: 0.3 }} />
              <p className="text-xs mt-2" style={{ color: 'hsl(var(--text-tertiary))' }}>
                {activeTab === 'installed' ? '暂无已安装插件' : '未找到匹配插件'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Plugin Detail Modal */}
      <AnimatePresence>
        {selectedPlugin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setSelectedPlugin(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="w-full max-w-lg">
              <PluginDetail plugin={selectedPlugin} onClose={() => setSelectedPlugin(null)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
