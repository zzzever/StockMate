import html2canvas from 'html2canvas';

const STORAGE_KEY = 'stockmate_indicator_screenshots';
const MAX_SCREENSHOTS = 50;

export interface IndicatorScreenshot {
  id: string;
  indicatorId: string;
  dataUrl: string;
  capturedAt: string;
  width: number;
  height: number;
}

function getAll(): IndicatorScreenshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAll(screenshots: IndicatorScreenshot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(screenshots));
  } catch {
    // localStorage full — prune oldest and retry
    const pruned = screenshots.slice(-MAX_SCREENSHOTS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      // give up silently
    }
  }
}

export function getIndicatorScreenshot(indicatorId: string): IndicatorScreenshot | undefined {
  return getAll().find(s => s.indicatorId === indicatorId);
}

export function deleteIndicatorScreenshot(indicatorId: string): void {
  saveAll(getAll().filter(s => s.indicatorId !== indicatorId));
}

export async function captureIndicatorScreenshot(
  element: HTMLElement,
  indicatorId: string,
): Promise<IndicatorScreenshot | null> {
  if (!element) return null;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: null, // transparent
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');

    const screenshot: IndicatorScreenshot = {
      id: `screenshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      indicatorId,
      dataUrl,
      capturedAt: new Date().toISOString(),
      width: canvas.width,
      height: canvas.height,
    };

    // Deduplicate: replace existing screenshot for same indicator
    const all = getAll().filter(s => s.indicatorId !== indicatorId);
    all.push(screenshot);
    saveAll(all);

    return screenshot;
  } catch (err) {
    console.warn('[indicator screenshot] capture failed:', err);
    return null;
  }
}
