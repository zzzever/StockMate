import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, X, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface LogEntry { type: 'log' | 'warn' | 'error'; msg: string; time: string; }

const logs: LogEntry[] = [];
let listeners: (() => void)[] = [];

/** Get current console error count — for external badges (e.g. title bar). */
export function getConsoleErrorCount(): number {
  return logs.filter((l) => l.type === 'error').length;
}

/** Subscribe to console log changes — returns unsubscribe function. */
export function onConsoleChange(fn: () => void): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

function notify() { listeners.forEach(fn => fn()); }

// Store original console methods so we can restore them on unmount
const origConsole = { log: console.log, warn: console.warn, error: console.error };
let consoleOverridden = false;

function installConsoleOverride() {
  if (consoleOverridden) return;
  consoleOverridden = true;
  const addLog = (type: LogEntry['type'], args: any[]) => {
    logs.push({ type, msg: args.map(String).join(' '), time: new Date().toLocaleTimeString() });
    while (logs.length > 1000) logs.shift();
    origConsole[type](...args);
    notify();
  };
  console.log = (...args: any[]) => addLog('log', args);
  console.warn = (...args: any[]) => addLog('warn', args);
  console.error = (...args: any[]) => addLog('error', args);
}

function restoreConsoleOverride() {
  if (!consoleOverridden) return;
  consoleOverridden = false;
  console.log = origConsole.log;
  console.warn = origConsole.warn;
  console.error = origConsole.error;
}

const windowErrorHandler = (e: ErrorEvent) => {
  logs.push({ type: 'error', msg: `${e.message} (${e.filename}:${e.lineno})`, time: new Date().toLocaleTimeString() });
  notify();
};
const windowRejectionHandler = (e: PromiseRejectionEvent) => {
  logs.push({ type: 'error', msg: `Promise rejected: ${e.reason}`, time: new Date().toLocaleTimeString() });
  notify();
};

export function ConsolePanel() {
  const [, setTick] = useState(0);
  const open = useAppStore((s) => s.debugOpen);
  const toggleOpen = useAppStore((s) => s.toggleDebug);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  }, []);

  // Manage console override and global error listeners lifecycle
  useEffect(() => {
    installConsoleOverride();
    window.addEventListener('error', windowErrorHandler);
    window.addEventListener('unhandledrejection', windowRejectionHandler);
    return () => {
      restoreConsoleOverride();
      window.removeEventListener('error', windowErrorHandler);
      window.removeEventListener('unhandledrejection', windowRejectionHandler);
    };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs.length, open]);

  const clear = () => { logs.length = 0; setTick(t => t + 1); };

  if (!open) return null;

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);
  const last50 = filtered.slice(-50);
  const errCount = logs.filter(l => l.type === 'error').length;
  const warnCount = logs.filter(l => l.type === 'warn').length;

  return (
    <div className="fixed bottom-3 right-3 z-50 w-96 max-h-96 bg-zinc-900 border border-zinc-700 flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-violet-400" />
          <span className="text-xs font-medium text-zinc-300">控制台</span>
          <span className="text-[10px] text-zinc-500">{logs.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === 'all' ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-500'}`}>全部</button>
          <button onClick={() => setFilter('error')} aria-pressed={filter === 'error'} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === 'error' ? 'bg-red-500/20 text-red-400' : 'text-zinc-500'}`}>{errCount} 错误</button>
          <button onClick={() => setFilter('warn')} aria-pressed={filter === 'warn'} className={`text-[10px] px-1.5 py-0.5 rounded ${filter === 'warn' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500'}`}>{warnCount} 警告</button>
          <button onClick={clear} title="清空"><Trash2 size={12} className="text-zinc-500 hover:text-zinc-300" /></button>
          <button onClick={toggleOpen} title="关闭"><X size={14} className="text-zinc-500 hover:text-zinc-300" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-0.5 font-mono text-[11px]" aria-live="polite" role="log">
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
