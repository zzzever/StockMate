import { describe, it, expect, afterEach } from 'vitest';
import { getChartTheme, getChartChrome, hslTripleToRgb } from '@/config/chartThemes';

describe('chartThemes chrome adapts to light/dark mode', () => {
  it('getChartChrome returns light-visible (dark-ink) colors in light mode', () => {
    const light = getChartChrome(false);
    // grid / crosshair / text must be dark ink so they are visible on a light background
    expect(light.gridVertColor).toMatch(/rgba\(0,\s*0,\s*0/);
    expect(light.gridHorzColor).toMatch(/rgba\(0,\s*0,\s*0/);
    expect(light.crosshairColor).toMatch(/rgba\(0,\s*0,\s*0/);
    expect(light.textColor).toBe('#4b5563');
  });

  it('getChartChrome returns dark-visible (light-ink) colors in dark mode', () => {
    const dark = getChartChrome(true);
    expect(dark.gridVertColor).toMatch(/rgba\(255,\s*255,\s*255/);
    expect(dark.crosshairColor).toMatch(/rgba\(255,\s*255,\s*255/);
    expect(dark.textColor).toBe('#c9d1d9');
  });

  it('getChartTheme keeps data colors per style but swaps chrome by mode', () => {
    const lightClassic = getChartTheme('classic', false);
    const darkClassic = getChartTheme('classic', true);
    // Data colors (A-share red-up / green-down) are identical regardless of mode
    expect(lightClassic.upColor).toBe(darkClassic.upColor);
    expect(lightClassic.upColor).toBe('#d0314e');
    expect(lightClassic.downColor).toBe('#1a8a4a');
    // Chrome differs between light and dark
    expect(lightClassic.crosshairColor).not.toBe(darkClassic.crosshairColor);
    expect(lightClassic.gridHorzColor).not.toBe(darkClassic.gridHorzColor);
  });

  it('unknown style falls back to classic but still applies mode chrome', () => {
    // @ts-expect-error intentional invalid style
    const t = getChartTheme('nope', false);
    expect(t.upColor).toBe('#d0314e'); // classic fallback data color
    expect(t.crosshairColor).toMatch(/rgba\(0,\s*0,\s*0/); // light chrome
  });
});

describe('hslTripleToRgb converts CSS HSL triples to rgb', () => {
  it('converts the app --price-up / --price-down light values', () => {
    expect(hslTripleToRgb('350 75% 38%')).toEqual([170, 24, 48]);
    expect(hslTripleToRgb('145 55% 30%')).toEqual([34, 119, 69]);
  });
  it('returns null for malformed input', () => {
    expect(hslTripleToRgb('not-a-color')).toBeNull();
    expect(hslTripleToRgb('#d0314e')).toBeNull();
  });
});

describe('classic style unifies red/green with app CSS vars (single source of truth)', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--price-up');
    document.documentElement.style.removeProperty('--price-down');
  });

  it('classic up/down/support/resistance resolve from --price-up/--price-down when defined', () => {
    document.documentElement.style.setProperty('--price-up', '350 75% 38%');
    document.documentElement.style.setProperty('--price-down', '145 55% 30%');
    const t = getChartTheme('classic', false);
    expect(t.upColor).toBe('rgb(170, 24, 48)');
    expect(t.downColor).toBe('rgb(34, 119, 69)');
    expect(t.resistanceColor).toBe('rgb(170, 24, 48)'); // resistance uses up color
    expect(t.supportColor).toBe('rgb(34, 119, 69)');    // support uses down color
    expect(t.wickUpColor).toBe('rgba(170, 24, 48, 0.45)');
    expect(t.volumeDownColor).toBe('rgba(34, 119, 69, 0.5)');
  });

  it('non-classic styles are NOT overridden by price vars', () => {
    document.documentElement.style.setProperty('--price-up', '350 75% 38%');
    document.documentElement.style.setProperty('--price-down', '145 55% 30%');
    const t = getChartTheme('colorblind', false);
    expect(t.upColor).toBe('#2563eb'); // colorblind blue stays
    expect(t.downColor).toBe('#f59e0b'); // colorblind orange stays
  });

  it('classic keeps static hex fallback when vars are absent', () => {
    const t = getChartTheme('classic', false);
    expect(t.upColor).toBe('#d0314e');
    expect(t.downColor).toBe('#1a8a4a');
  });
});
