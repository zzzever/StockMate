import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Thermometer } from 'lucide-react';
import MarketThermometer, { useMarketTemp } from '@/components/MarketThermometer';

/**
 * 标题栏市场温度按钮：紧凑占位（图标 + 温度数字），点击弹出完整温度计面板。
 */
export default function ThermometerButton() {
  const [open, setOpen] = useState(false);
  // 仅在弹出面板时拉取/轮询市场温度，标题栏关闭时零后端请求
  const { temp } = useMarketTemp(open);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative h-full">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? '关闭市场温度' : '市场温度'}
        aria-expanded={open}
        aria-controls="market-temp-popover"
        title={`市场温度${temp ? `：${Math.round(temp.temperature)}° ${temp.zone}` : ''}`}
        className="h-full px-2 flex items-center gap-1 hover:bg-[var(--bg-hover)] transition-colors duration-[var(--transition-fast)]"
        style={{ color: temp ? temp.color : 'hsl(var(--text-tertiary))' }}
      >
        <Thermometer size={13} />
        {temp && <span className="text-[10px] font-mono-nums font-bold leading-none">{Math.round(temp.temperature)}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="market-temp-popover"
            role="dialog"
            aria-label="市场温度"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-1 z-50 w-[520px] max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl"
            style={{ background: 'hsl(var(--bg-card))' }}
          >
            {temp ? (
              <MarketThermometer />
            ) : (
              <div className="p-4 text-data-sm" style={{ color: 'var(--text-tertiary)' }}>
                正在获取市场温度...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
