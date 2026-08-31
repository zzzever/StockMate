import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportToSmin,
  importFromSmin,
  saveCustomIndicator,
  deleteCustomIndicator,
  updateCustomIndicator,
  getCustomIndicators,
  getAllIndicatorsList,
  sminToJson,
  jsonToSminIndicator,
} from '@/indicators/manager';
import { getIndicator, getAllIndicators } from '@/indicators/registry';
import '@/indicators';

describe('indicator manager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('exportToSmin', () => {
    it('exports a builtin indicator to .smin format', () => {
      const macd = getIndicator('macd');
      expect(macd).toBeDefined();

      const smin = exportToSmin(macd!);
      expect(smin.version).toBe('1.0.0');
      expect(smin.meta.id).toBe('macd');
      expect(smin.meta.label).toBe('MACD');
      expect(smin.meta.author).toBe('StockMate');
      expect(smin.meta.source).toBe('builtin');
      expect(smin.params.length).toBe(3);
      expect(smin.engine).toBe('sslang');
    });

    it('includes formula in exported smin', () => {
      const rsi = getIndicator('rsi');
      const smin = exportToSmin(rsi!);
      expect(smin.meta.formula).toContain('RS');
    });
  });

  describe('importFromSmin', () => {
    it('imports a valid .smin file', () => {
      const smin = {
        version: '1.0.0',
        meta: {
          id: 'custom_test',
          label: 'Test Indicator',
          description: 'A test indicator',
          category: 'oscillator',
          author: 'TestUser',
          version: '1.0.0',
          license: 'MIT',
          source: 'user',
        },
        params: [
          { key: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100, step: 1 },
        ],
        code: 'rsi(close, period)',
        engine: 'sslang',
      };

      const result = importFromSmin(JSON.stringify(smin));
      expect(result.success).toBe(true);
      expect(result.indicator).toBeDefined();
      expect(result.indicator!.label).toBe('Test Indicator');
      expect(result.indicator!.category).toBe('oscillator');
    });

    it('rejects invalid JSON', () => {
      const result = importFromSmin('{ invalid json');
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件解析失败');
    });

    it('rejects missing required fields', () => {
      const result = importFromSmin(JSON.stringify({ version: '1.0.0' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('缺少必要字段');
    });

    it('rejects unsupported version', () => {
      const smin = {
        version: '99.0.0',
        meta: { id: 'x', label: 'X', category: 'trend', author: 'A', version: '1', license: 'MIT', source: 'user' },
        params: [],
        code: '',
        engine: 'sslang',
      };
      const result = importFromSmin(JSON.stringify(smin));
      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持的文件版本');
    });

    it('rejects invalid category', () => {
      const smin = {
        version: '1.0.0',
        meta: { id: 'x', label: 'X', category: 'invalid', author: 'A', version: '1', license: 'MIT', source: 'user' },
        params: [],
        code: '',
        engine: 'sslang',
      };
      const result = importFromSmin(JSON.stringify(smin));
      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的指标类别');
    });
  });

  describe('saveCustomIndicator', () => {
    it('saves and retrieves a custom indicator', () => {
      const saved = saveCustomIndicator(
        'My RSI',
        'Custom RSI',
        'oscillator',
        'basic',
        ['reversal'],
        [{ key: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100, step: 1 }],
        'rsi(close, period)',
        'sslang',
      );

      expect(saved.id).toContain('custom_');
      expect(saved.label).toBe('My RSI');

      const items = getCustomIndicators();
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(saved.id);
    });
  });

  describe('deleteCustomIndicator', () => {
    it('deletes a custom indicator', () => {
      const saved = saveCustomIndicator('Test', 'desc', 'trend', 'basic', [], [], '', 'sslang');
      expect(getCustomIndicators().length).toBe(1);

      const ok = deleteCustomIndicator(saved.id);
      expect(ok).toBe(true);
      expect(getCustomIndicators().length).toBe(0);
    });

    it('returns false for non-existent id', () => {
      expect(deleteCustomIndicator('nonexistent')).toBe(false);
    });
  });

  describe('updateCustomIndicator', () => {
    it('updates a custom indicator', () => {
      const saved = saveCustomIndicator('Old Name', 'desc', 'trend', 'basic', [], [], '', 'sslang');
      const updated = updateCustomIndicator(saved.id, { label: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.label).toBe('New Name');
    });

    it('returns null for non-existent id', () => {
      expect(updateCustomIndicator('nonexistent', { label: 'X' })).toBeNull();
    });
  });

  describe('getAllIndicatorsList', () => {
    it('returns both builtin and custom indicators', () => {
      const builtinCount = getAllIndicators().length;
      saveCustomIndicator('Custom1', 'desc', 'custom', 'basic', [], [], '', 'sslang');

      const list = getAllIndicatorsList();
      expect(list.length).toBe(builtinCount + 1);
      expect(list.some(i => i.source === 'builtin')).toBe(true);
      expect(list.some(i => i.source === 'user')).toBe(true);
    });
  });

  describe('sminToJson / jsonToSminIndicator', () => {
    it('roundtrips a builtin indicator through JSON', () => {
      const macd = getIndicator('macd')!;
      const json = sminToJson(macd);
      const parsed = JSON.parse(json);
      expect(parsed.meta.id).toBe('macd');
      expect(parsed.meta.label).toBe('MACD');
    });
  });
});

describe('builtin indicator metadata', () => {
  const builtinIds = [
    'macd', 'kdj', 'rsi', 'cci', 'atr', 'obv', 'wr', 'dmi', 'sar', 'brar', 'gr',
  ];

  for (const id of builtinIds) {
    it(`${id} has complete metadata`, () => {
      const ind = getIndicator(id);
      expect(ind).toBeDefined();
      expect(ind!.meta).toBeDefined();
      expect(ind!.meta!.author).toBeTruthy();
      expect(ind!.meta!.version).toBeTruthy();
      expect(ind!.meta!.license).toBeTruthy();
      expect(ind!.meta!.source).toBe('builtin');
    });
  }
});
