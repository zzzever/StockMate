import { vi, describe, it, expect, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ getByLabelResult: null as any, created: [] as any[] }));

vi.mock('@tauri-apps/api/webviewWindow', () => {
  class WebviewWindow {
    label: string;
    constructor(label: string, opts: any) { this.label = label; h.created.push({ label, opts }); }
    once() {}
    static getByLabel = vi.fn(async () => h.getByLabelResult);
  }
  return { WebviewWindow };
});

import { toggleMiniWindow, isMiniWindowOpen, MINI_LABEL } from '@/lib/miniWindow';

describe('miniWindow util', () => {
  beforeEach(() => {
    h.getByLabelResult = null;
    h.created.length = 0;
  });

  it('creates the mini window with the expected options when none exists', async () => {
    const result = await toggleMiniWindow();
    expect(result).toBe(true);
    expect(h.created).toHaveLength(1);
    expect(h.created[0].label).toBe(MINI_LABEL);
    expect(h.created[0].opts.url).toBe('index.html#/mini');
    expect(h.created[0].opts.alwaysOnTop).toBe(true);
    expect(h.created[0].opts.decorations).toBe(false);
    expect(h.created[0].opts.width).toBe(300);
    expect(h.created[0].opts.height).toBe(480);
  });

  it('closes the existing mini window instead of creating a new one', async () => {
    const close = vi.fn(async () => {});
    h.getByLabelResult = { close };
    const result = await toggleMiniWindow();
    expect(result).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    expect(h.created).toHaveLength(0);
  });

  it('reports open state via getByLabel', async () => {
    h.getByLabelResult = { close: vi.fn() };
    expect(await isMiniWindowOpen()).toBe(true);
    h.getByLabelResult = null;
    expect(await isMiniWindowOpen()).toBe(false);
  });
});
