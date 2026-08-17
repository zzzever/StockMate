import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ChevronRight, ArrowLeft } from 'lucide-react';
import { WIKI_ENTRIES, WIKI_CATEGORIES, searchWiki, wikiByCategory, wikiById, type WikiCategory, type WikiEntry } from '@/data/wiki';

const CATEGORY_ICONS: Record<string, string> = {
  '术语': '📖',
  '技术指标': '📈',
  '基本面': '🏢',
  '指南': '🧭',
  '学习路径': '🗺️',
};

export default function WikiPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = (searchParams.get('cat') as WikiCategory) || null;
  const activeId = searchParams.get('id');
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => (query ? searchWiki(query) : []), [query]);
  const activeEntry = activeId ? wikiById(activeId) : undefined;
  const catEntries = useMemo(
    () => (activeCategory ? wikiByCategory(activeCategory) : WIKI_ENTRIES),
    [activeCategory]
  );

  // ── Entry detail view ──
  if (activeEntry) {
    return (
      <div className="h-full flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchParams({ cat: activeEntry.category })} className="btn-ghost text-data-sm">
            <ArrowLeft size={14} /> 返回{activeEntry.category}
          </button>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{CATEGORY_ICONS[activeEntry.category] || '📚'}</span>
            <h1 className="text-heading">{activeEntry.title}</h1>
          </div>
          <p className="text-data-sm mb-4 p-3 rounded-lg" style={{ background: 'hsl(var(--swiss-accent-ghost))', color: 'hsl(var(--swiss-accent))' }}>
            {activeEntry.short}
          </p>

          <div className="space-y-4">
            <Section label="详细解释" content={activeEntry.detail} />
            {activeEntry.formula && <Section label="公式" content={activeEntry.formula} mono />}
            {activeEntry.usage && <Section label="怎么用" content={activeEntry.usage} />}
            {activeEntry.buySell && <Section label="买卖信号" content={activeEntry.buySell} accent />}
            {activeEntry.caution && <Section label="⚠️ 注意事项" content={activeEntry.caution} warn />}
          </div>

          {activeEntry.related.length > 0 && (
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-data-xs font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>相关阅读</div>
              <div className="flex flex-wrap gap-2">
                {activeEntry.related.map(rid => {
                  const rel = wikiById(rid);
                  if (!rel) return null;
                  return (
                    <Link key={rid} to={`/wiki?id=${rid}`} className="px-2.5 py-1 text-data-xs rounded-full transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                      {rel.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-display">📚 股票知识库</h1>
          <p className="text-data-sm mt-1" style={{ color: 'hsl(var(--text-secondary))' }}>
            证券入门 · 术语 · 指标 · 操作指南 · 共 {WIKI_ENTRIES.length} 篇
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'hsl(var(--text-tertiary))' }} />
          <input
            type="text"
            placeholder="搜索术语、指标..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9 w-64"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button onClick={() => setSearchParams({})}
          className="px-3 py-1.5 text-data-sm rounded-full transition-colors"
          style={{ background: !activeCategory ? 'hsl(var(--swiss-accent-ghost))' : 'var(--bg-input)', color: !activeCategory ? 'hsl(var(--swiss-accent))' : 'var(--text-secondary)' }}>
          全部
        </button>
        {WIKI_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setSearchParams({ cat })}
            className="px-3 py-1.5 text-data-sm rounded-full transition-colors"
            style={{ background: activeCategory === cat ? 'hsl(var(--swiss-accent-ghost))' : 'var(--bg-input)', color: activeCategory === cat ? 'hsl(var(--swiss-accent))' : 'var(--text-secondary)' }}>
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {query ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {searchResults.map(entry => <WikiCard key={entry.id} entry={entry} />)}
            {searchResults.length === 0 && (
              <div className="col-span-full py-16 text-center text-data-sm" style={{ color: 'var(--text-tertiary)' }}>
                未找到相关内容，试试其他关键词
              </div>
            )}
          </div>
        ) : (
          <>
            {!activeCategory && (
              <div className="mb-4">
                <div className="text-data-xs font-bold mb-2" style={{ color: 'var(--text-tertiary)' }}>🧭 新手必读</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {WIKI_ENTRIES.filter(e => e.category === '指南').map(entry => <WikiCard key={entry.id} entry={entry} highlight />)}
                  {WIKI_ENTRIES.filter(e => e.id === 'learning-path').map(entry => <WikiCard key={entry.id} entry={entry} highlight />)}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(activeCategory ? catEntries : WIKI_ENTRIES.filter(e => e.category !== '指南' && e.id !== 'learning-path')).map(entry => (
                <WikiCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ label, content, mono, accent, warn }: { label: string; content: string; mono?: boolean; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <div className="text-data-xs font-bold mb-1" style={{
        color: warn ? 'hsl(var(--risk-warning))' : accent ? 'hsl(var(--price-up))' : 'var(--text-tertiary)'
      }}>{label}</div>
      <p className={`text-data-sm leading-relaxed ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--text-primary)' }}>
        {content}
      </p>
    </div>
  );
}

function WikiCard({ entry, highlight }: { entry: WikiEntry; highlight?: boolean }) {
  return (
    <Link to={`/wiki?id=${entry.id}`}
      className={`block p-4 rounded-xl border transition-all duration-200 hover:border-[hsl(var(--swiss-accent))] ${highlight ? 'glass-jp' : 'glass-card'}`}
      style={{ borderColor: highlight ? 'hsl(var(--swiss-accent) / 0.3)' : 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{CATEGORY_ICONS[entry.category] || '📚'}</span>
        <span className="text-data-sm font-bold" style={{ color: 'var(--text-primary)' }}>{entry.title}</span>
        <ChevronRight size={12} className="ml-auto" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <p className="text-data-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {entry.short}
      </p>
    </Link>
  );
}
