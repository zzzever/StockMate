/** Format a number or string to price with 2 decimal places. */
export function fmtPrice(v: unknown): string {
  if (typeof v === 'string' && v.trim() === '') return '--';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '--';
}

/** Format a change percentage. Input can be already in % (e.g. 1.37) or decimal (0.0137). */
export function fmtPct(v: unknown, fixed: number = 2): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  // If value looks like it's already in percent form (>1 for most stocks), use as-is
  return n.toFixed(fixed);
}

/** Format volume to human-readable string. */
export function fmtVolume(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toLocaleString();
}

/** Format amount to human-readable string. */
export function fmtAmount(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '--';
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toFixed(0);
}
