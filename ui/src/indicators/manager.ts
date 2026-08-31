import type { SubIndicator, ParamDef, IndicatorCategory, IndicatorComplexity, IndicatorStrategy, SminFile } from './types';
import { registerIndicator, getIndicator, getAllIndicators } from './registry';
import { computeIndicator } from './compute';

const CUSTOM_PREFIX = 'custom_';
const STORAGE_KEY = 'stockmate_custom_indicators';

interface StoredIndicator {
  id: string;
  label: string;
  description: string;
  category: IndicatorCategory;
  complexity: IndicatorComplexity;
  tags: IndicatorStrategy[];
  params: ParamDef[];
  code: string;
  engine: 'sslang' | 'tdx' | 'custom';
  meta: {
    author: string;
    version: string;
    license: string;
    source: 'user' | 'marketplace';
    formula?: string;
    references?: string[];
    createdAt: string;
    updatedAt: string;
  };
}

function loadCustomIndicators(): StoredIndicator[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomIndicators(items: StoredIndicator[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function generateId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_|_$/g, '');
  return `${CUSTOM_PREFIX}${slug}_${Date.now()}`;
}

export function exportToSmin(indicator: SubIndicator): SminFile {
  const meta = indicator.meta;
  return {
    version: '1.0.0',
    meta: {
      id: indicator.id,
      label: indicator.label,
      description: indicator.description,
      category: indicator.category,
      complexity: indicator.complexity,
      tags: indicator.tags,
      author: meta?.author ?? 'Unknown',
      version: meta?.version ?? '1.0.0',
      license: meta?.license ?? 'MIT',
      source: meta?.source ?? 'user',
      formula: meta?.formula,
      references: meta?.references,
      createdAt: meta?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    params: indicator.params,
    code: meta?.formula ?? '',
    engine: 'sslang',
  };
}

export function importFromSmin(fileContent: string): { success: boolean; indicator?: StoredIndicator; error?: string } {
  try {
    const parsed = JSON.parse(fileContent) as SminFile;

    if (!parsed.version || !parsed.meta || !parsed.meta.id || !parsed.meta.label) {
      return { success: false, error: '无效的 .smin 文件格式：缺少必要字段' };
    }

    if (!['1'].includes(parsed.version.split('.')[0])) {
      return { success: false, error: `不支持的文件版本: ${parsed.version}` };
    }

    const validCategories: IndicatorCategory[] = ['trend', 'oscillator', 'volume', 'volatility', 'custom'];
    if (!validCategories.includes(parsed.meta.category)) {
      return { success: false, error: `无效的指标类别: ${parsed.meta.category}` };
    }

    const existing = getIndicator(parsed.meta.id);
    if (existing && !parsed.meta.id.startsWith(CUSTOM_PREFIX)) {
      return { success: false, error: `指标 "${parsed.meta.label}" 已存在，无法覆盖内置指标` };
    }

    const indicator: StoredIndicator = {
      id: parsed.meta.id.startsWith(CUSTOM_PREFIX) ? parsed.meta.id : generateId(parsed.meta.label),
      label: parsed.meta.label,
      description: parsed.meta.description || '',
      category: parsed.meta.category,
      complexity: parsed.meta.complexity ?? 'basic',
      tags: parsed.meta.tags ?? [],
      params: parsed.params ?? [],
      code: parsed.code ?? '',
      engine: parsed.engine ?? 'sslang',
      meta: {
        author: parsed.meta.author ?? 'Unknown',
        version: parsed.meta.version ?? '1.0.0',
        license: parsed.meta.license ?? 'MIT',
        source: 'user',
        formula: parsed.meta.formula,
        references: parsed.meta.references,
        createdAt: parsed.meta.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    return { success: true, indicator };
  } catch (e) {
    return { success: false, error: `文件解析失败: ${(e as Error).message}` };
  }
}

export function saveCustomIndicator(
  label: string,
  description: string,
  category: IndicatorCategory,
  complexity: IndicatorComplexity,
  tags: IndicatorStrategy[],
  params: ParamDef[],
  code: string,
  engine: 'sslang' | 'tdx' | 'custom',
  formula?: string,
): StoredIndicator {
  const id = generateId(label);
  const now = new Date().toISOString();

  const indicator: StoredIndicator = {
    id,
    label,
    description,
    category,
    complexity,
    tags,
    params,
    code,
    engine,
    meta: {
      author: 'User',
      version: '1.0.0',
      license: 'MIT',
      source: 'user',
      formula,
      createdAt: now,
      updatedAt: now,
    },
  };

  const items = loadCustomIndicators();
  items.push(indicator);
  saveCustomIndicators(items);

  return indicator;
}

export function deleteCustomIndicator(id: string): boolean {
  const items = loadCustomIndicators();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  saveCustomIndicators(items);
  return true;
}

export function updateCustomIndicator(
  id: string,
  updates: Partial<Pick<StoredIndicator, 'label' | 'description' | 'category' | 'complexity' | 'tags' | 'params' | 'code' | 'engine'>>,
): StoredIndicator | null {
  const items = loadCustomIndicators();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;

  items[idx] = {
    ...items[idx],
    ...updates,
    meta: {
      ...items[idx].meta,
      updatedAt: new Date().toISOString(),
    },
  };
  saveCustomIndicators(items);
  return items[idx];
}

export function getCustomIndicators(): StoredIndicator[] {
  return loadCustomIndicators();
}

export function getAllIndicatorsList(): Array<{
  id: string;
  label: string;
  description: string;
  category: IndicatorCategory;
  complexity?: IndicatorComplexity;
  tags?: IndicatorStrategy[];
  source: 'builtin' | 'user' | 'marketplace';
  author?: string;
  version?: string;
}> {
  const builtin = getAllIndicators().map(i => ({
    id: i.id,
    label: i.label,
    description: i.description,
    category: i.category,
    complexity: i.complexity,
    tags: i.tags,
    source: 'builtin' as const,
    author: i.meta?.author,
    version: i.meta?.version,
  }));

  const custom = loadCustomIndicators().map(i => ({
    id: i.id,
    label: i.label,
    description: i.description,
    category: i.category,
    complexity: i.complexity,
    tags: i.tags,
    source: i.meta.source as 'user' | 'marketplace',
    author: i.meta.author,
    version: i.meta.version,
  }));

  return [...builtin, ...custom];
}

export function sminToJson(indicator: SubIndicator): string {
  const smin = exportToSmin(indicator);
  return JSON.stringify(smin, null, 2);
}

export function jsonToSminIndicator(json: string): { success: boolean; id?: string; error?: string } {
  const result = importFromSmin(json);
  if (!result.success || !result.indicator) {
    return { success: false, error: result.error };
  }
  return { success: true, id: result.indicator.id };
}
