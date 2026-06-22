import { Database, Palette, Trash2, Wifi } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-zinc-100">设置</h1>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Wifi size={14} />
            数据源配置
          </h2>
          <div className="space-y-2 text-xs text-zinc-500">
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>主要数据源</span>
              <span className="text-zinc-300">Yahoo Finance</span>
            </div>
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>备用数据源</span>
              <span className="text-zinc-300">Kimi Finance</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Database size={14} />
            缓存管理
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">本地缓存大小</span>
            <button className="flex items-center gap-1 rounded-md bg-rose-600/20 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-600/30 transition-colors">
              <Trash2 size={12} />
              清理缓存
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Palette size={14} />
            外观设置
          </h2>
          <div className="space-y-2 text-xs text-zinc-500">
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>主题</span>
              <span className="text-zinc-300">暗色</span>
            </div>
            <div className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2">
              <span>语言</span>
              <span className="text-zinc-300">简体中文</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
