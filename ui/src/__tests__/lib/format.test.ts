import { describe, it, expect } from 'vitest';
import { fmtPrice, fmtPct, fmtVolume } from '@/lib/format';

describe('format utilities', () => {
  describe('fmtPrice', () => {
    it('formats positive numbers', () => {
      expect(fmtPrice(100)).toBe('100.00');
      expect(fmtPrice(100.5)).toBe('100.50');
    });
    it('formats zero', () => { expect(fmtPrice(0)).toBe('0.00'); });
    it('handles NaN', () => { expect(fmtPrice(NaN)).toBe('--'); });
    it('handles null', () => { expect(fmtPrice(null as any)).toBe('0.00'); });
    it('handles undefined', () => { expect(fmtPrice(undefined as any)).toBe('--'); });
  });

  describe('fmtPct', () => {
    it('formats positive percentages', () => { expect(fmtPct(10.5)).toBe('10.50'); });
    it('formats zero', () => { expect(fmtPct(0)).toBe('0.00'); });
    it('formats negative', () => { expect(fmtPct(-5.123)).toBe('-5.12'); });
  });

  describe('fmtVolume', () => {
    it('formats thousands', () => { expect(fmtVolume(1000)).toBe('1,000'); });
    it('formats millions', () => { expect(fmtVolume(1000000)).toBe('100.0万'); });
    it('formats zero', () => { expect(fmtVolume(0)).toBe('0'); });
  });
});
