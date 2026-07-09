import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export const MINI_LABEL = 'mini';

/** Whether the mini watchlist window currently exists. */
export async function isMiniWindowOpen(): Promise<boolean> {
  try {
    return (await WebviewWindow.getByLabel(MINI_LABEL)) != null;
  } catch (e) {
    console.warn('[mini] getByLabel failed:', e);
    return false;
  }
}

/**
 * Toggle the mini watchlist window: close it if open, otherwise create it.
 * Returns the resulting open-state (true = now open, false = now closed).
 */
export async function toggleMiniWindow(): Promise<boolean> {
  const existing = await WebviewWindow.getByLabel(MINI_LABEL).catch(() => null);
  if (existing) {
    try { await existing.close(); } catch (e) { console.warn('[mini] close failed:', e); }
    return false;
  }
  try {
    const win = new WebviewWindow(MINI_LABEL, {
      // HashRouter target — resolved against the app base in both dev and dist builds.
      url: 'index.html#/mini',
      title: '自选股',
      width: 300,
      height: 480,
      minWidth: 260,
      minHeight: 320,
      resizable: false,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
    });
    win.once('tauri://error', (e) => console.error('[mini] window create error:', e));
    return true;
  } catch (e) {
    console.warn('[mini] create failed:', e);
    return false;
  }
}
