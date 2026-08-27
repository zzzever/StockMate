import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { TDX_TEMPLATES, TDX_CATEGORIES, type TdxTemplate } from '../utils/tdxTemplates';
import { TDX_COLORS } from '../utils/tdxIndicator';

// ─── 语法高亮 ───
function highlightTdx(src: string): { html: string; errors: { line: number; msg: string }[] } {
  const lines = src.split('\n');
  const errors: { line: number; msg: string }[] = [];
  const htmlLines = lines.map((line) => {
    let h = escapeHtml(line);
    // 颜色关键字
    h = h.replace(/\b(COLOR[A-Z0-9]+)\b/gi, '<span style="color:#e879f9">$1</span>');
    // 注释
    h = h.replace(/(\/\*.+?\*\/|\/\/.*)/g, '<span style="color:#6b7280">$1</span>');
    h = h.replace(/(\{[^}]*\})/g, '<span style="color:#6b7280">$1</span>');
    // 关键字
    h = h.replace(/\b(STICKLINE|DRAWICON|DRAWTEXT)\b/gi, '<span style="color:#f59e0b">$1</span>');
    // 函数
    h = h.replace(/\b(MA|EMA|SMA|WMA|EXXMA|DMA|REF|CROSS|LLV|HHV|ABS|MAX|MIN|IF|COUNT|SUM|BARSLAST|AVEDEV|STD|FORCAST|RSI|OBV|ATR|CCI|WR|HHV|LOWEST|HIGHEST)\b/gi, '<span style="color:#38bdf8">$1</span>');
    // 字段
    h = h.replace(/\b(CLOSE|OPEN|HIGH|LOW|VOL|VOLUME|AMOUNT|C|O|H|L|V)\b/gi, '<span style="color:#22c55e">$1</span>');
    // 赋值符号
    h = h.replace(/(:=)/g, '<span style="color:#facc15">$1</span>');
    // 数字
    h = h.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#a78bfa">$1</span>');
    return h;
  });
  return { html: htmlLines.join('\n'), errors };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── 组件 ───
interface TdxEditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onApply: () => void;
  onCancel: () => void;
  error?: string | null;
}

export function TdxEditor({ value, onChange, onSave, onApply, onCancel, error }: TdxEditorProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [searchTerm, setSearchTerm] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  const filteredTemplates = useMemo(() => {
    return TDX_TEMPLATES.filter(t => {
      const catMatch = selectedCategory === '全部' || t.category === selectedCategory;
      const searchMatch = !searchTerm || t.name.includes(searchTerm) || t.description.includes(searchTerm) || t.code.includes(searchTerm);
      return catMatch && searchMatch;
    });
  }, [selectedCategory, searchTerm]);

  const { html, errors: hlErrors } = useMemo(() => highlightTdx(value), [value]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const insertTemplate = useCallback((tpl: TdxTemplate) => {
    onChange(tpl.code);
    setShowTemplates(false);
  }, [onChange]);

  const lineCount = useMemo(() => value.split('\n').length, [value]);

  return (
    <div className="w-full max-w-2xl rounded-xl p-5 space-y-3 shadow-2xl" style={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-subtle))' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-base font-bold" style={{ color: 'hsl(var(--text-primary))' }}>✎ 自定义通达信公式</span>
        <button onClick={onCancel} aria-label="关闭" className="text-sm font-bold hover:opacity-60" style={{ color: 'hsl(var(--text-tertiary))' }}>✕</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="px-2 py-1 text-[11px] font-bold rounded transition-colors"
          style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))', background: showTemplates ? 'hsl(var(--bg-input))' : 'transparent' }}
        >
          📋 模板库
        </button>
        <span className="text-[10px]" style={{ color: 'hsl(var(--text-tertiary))' }}>
          {lineCount} 行
        </span>
      </div>

      {/* Template Panel */}
      {showTemplates && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-subtle))' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('全部')}
              className="px-2 py-0.5 text-[10px] font-bold rounded"
              style={{
                color: selectedCategory === '全部' ? 'hsl(var(--bg-root))' : 'hsl(var(--text-secondary))',
                background: selectedCategory === '全部' ? 'hsl(var(--text-primary))' : 'transparent',
              }}
            >全部</button>
            {TDX_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className="px-2 py-0.5 text-[10px] font-bold rounded"
                style={{
                  color: selectedCategory === c ? 'hsl(var(--bg-root))' : 'hsl(var(--text-secondary))',
                  background: selectedCategory === c ? 'hsl(var(--text-primary))' : 'transparent',
                }}
              >{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {filteredTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => insertTemplate(tpl)}
                className="text-left p-2 rounded text-[11px] hover:opacity-80 transition-opacity"
                style={{ background: 'hsl(var(--bg-root))', border: '1px solid hsl(var(--border-subtle))' }}
              >
                <div className="font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{tpl.name}</div>
                <div style={{ color: 'hsl(var(--text-tertiary))' }}>{tpl.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor with syntax highlighting */}
      <div className="relative rounded" style={{ background: 'hsl(var(--bg-input))', border: '1px solid hsl(var(--border-subtle))' }}>
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-end pr-1 pt-2 text-[10px] font-mono select-none z-10" style={{ color: 'hsl(var(--text-tertiary))', borderRight: '1px solid hsl(var(--border-subtle))' }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="leading-[18px]">{i + 1}</div>
          ))}
        </div>
        {/* Highlight overlay */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 m-0 p-2 pl-9 font-mono text-[12px] leading-[18px] whitespace-pre overflow-auto pointer-events-none z-0"
          style={{ color: 'hsl(var(--text-primary))' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {/* Textarea (transparent text, visible cursor) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="w-full h-48 p-2 pl-9 rounded font-mono text-[12px] leading-[18px] resize-none outline-none relative z-10"
          style={{
            background: 'transparent',
            color: 'transparent',
            caretColor: '#38bdf8',
            WebkitTextFillColor: 'transparent',
          }}
          placeholder="输入通达信公式..."
        />
      </div>

      {/* Errors */}
      {(error || hlErrors.length > 0) && (
        <div className="space-y-1">
          {error && <div className="text-[11px] font-bold" style={{ color: '#ef4444' }}>公式错误：{error}</div>}
          {hlErrors.map((e, i) => (
            <div key={i} className="text-[11px]" style={{ color: '#ef4444' }}>第 {e.line} 行：{e.msg}</div>
          ))}
        </div>
      )}

      {/* Help */}
      <div className="text-[10px] space-y-1" style={{ color: 'hsl(var(--text-tertiary))' }}>
        <div>
          支持函数：MA/EMA/SMA/WMA/DMA/REF/CROSS/LLV/HHV/ABS/MAX/MIN/IF/COUNT/SUM/BARSLAST/AVEDEV/STD/FORCAST/RSI/OBV/ATR/CCI/WR
        </div>
        <div>
          字段：CLOSE(C)/OPEN(O)/HIGH(H)/LOW(L)/VOL(V) | 变量：名:=…; 输出：名:…,COLORxxx; 柱：STICKLINE(条件,价1,价2)
        </div>
        <div>
          颜色：COLORRED/GREEN/BLUE/YELLOW/WHITE/CYAN/MAGENTA/GRAY 或 COLORRRGGBB
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2">
        <button onClick={onSave} className="px-3 py-1.5 text-[12px] font-bold rounded transition-colors" style={{ color: 'hsl(var(--text-secondary))', border: '1px solid hsl(var(--border-subtle))' }}>暂存</button>
        <button onClick={onApply} className="px-3 py-1.5 text-[12px] font-bold rounded transition-colors" style={{ color: 'hsl(var(--bg-root))', background: 'hsl(var(--text-primary))' }}>保存并应用</button>
      </div>
    </div>
  );
}
