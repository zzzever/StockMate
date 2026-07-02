import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, X, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface LogEntry { type: 'log' | 'warn' | 'error'; msg: string; time: string; }

const logs: LogEntry[] = [];
let listeners: (() => void)[] = [];

function notify() { listeners.forEach(fn => fn()); }

// Intercept console methods
const orig = { log: console.log, warn: console.warn, error: console.error };
console.log = (...args: any[]) => { logs.push({ type: 'log', msg: args.map(String).join(' '), time: new Date().toLocaleTimeString() }); orig.log(...args); notify(); };
console.warn = (...args: any[]) => { logs.push({ type: 'warn', msg: args.map(String).join(' '), time: new Date().toLocaleTimeString() }); orig.warn(...args); notify(); };
console.error = (...args: any[]) => { logs.push({ type: 'error', msg: args.map(String).join(' '), time: new Date().toLocaleTimeString() }); orig.error(...args); notify(); };

// Also catch unhandled errors
window.addEventListener('error', (e) => {
  logs.push({ type: 'error', msg: `${e.message} (${e.filename}:${e.lineno})`, time: new Date().toLocaleTimeString() });
  notify();
});
window.addEventListener('unhandledrejection', (e) => {
  logs.push({ type: 'error', msg: `Promise rejected: ${e.reason}`, time: new Date().toLocaleTimeString() });
  notify();
});

export function ConsolePanel() {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs.length, open]);

  const clear = () => { logs.length = 0; setTick(t => t + 1); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed bottom-3 right-3 z-50 bg-zinc-900/90 text-violet-400 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-violet-500 flex items-center gap-1.5">
        <Terminal size={14} />
        <span>控制台</span>
        {logs.filter(l => l.type === 'error').length > 0 && (
          <span className="bg-red-500 text-white text-[10px] px-1 rounded">{logs.filter(l => l.type === 'error').length}</span>
        )}
      </button>
    );
  }

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);
  const last50 = filtered.slice(-50);
  const errCount = logs.filter(l => l.type === 'error').length;
  const warnCount = logs.filter(l => l.type === 'warn').length;

  return (
    <div className="fixed bottom-3 right-3 z-50 w-96 max-h-96 bg-zinc-900/95 rounded-lg border border-zinc-700 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-violet-400" />
          <span className="text-xs font-medium text-zinc-300">控制台</span>
          <span className="text-[10px] text-zinc-500">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFilter('all')} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === 'all' ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-500'}`}>全部</button>
          <button onClick={() => setFilter('error')} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === 'error' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500'}`}>{errCount} 错误</button>
          <button onClick={() => setFilter('warn')} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === 'warn' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'}`}>{warnCount} 警告</button>
          <button onClick={clear} title="清空"><Trash2 size={12} className="text-zinc-500 hover:text-zinc-300" /></button>
          <button onClick={() => setOpen(false)} title="关闭"><X size={14} className="text-zinc-500 hover:text-zinc-300" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-0.5 font-mono text-[11px]">
        {last50.length === 0 && <div className="text-zinc-600 text-center py-4">无日志</div>}
        {last50.map((l, i) => (
          <div key={i} className={`leading-relaxed ${l.type === 'error' ? 'text-red-400' : l.type === 'warn' ? 'text-amber-400' : 'text-zinc-400'}`}>
            <span className="text-zinc-600 mr-1">{l.time}</span>
            {l.msg}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
