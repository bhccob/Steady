import { HOUR_MS, MINUTE_MS } from '../lib/time';

/** Up to 30 min after due reads "on track" (waiting bar copy), so it counts as on time. */
export const ON_TIME_WINDOW_MS = 30 * MINUTE_MS;
/** taken_late without the backfill flag. */
export const GRACE_MS = 4 * HOUR_MS;
/** After this the dose is locked as missed. */
export const BACKFILL_WINDOW_MS = 24 * HOUR_MS;

export interface MarkResult {
  status: 'taken_ontime' | 'taken_late';
  backfilled: boolean;
}

/** Status for a dose marked taken at `markedAtUtc`, or null when it is locked. */
export function classifyMark(dueAtUtc: string, markedAtUtc: string): MarkResult | null {
  const late = Date.parse(markedAtUtc) - Date.parse(dueAtUtc);
  if (late > BACKFILL_WINDOW_MS) return null;
  if (late <= ON_TIME_WINDOW_MS) return { status: 'taken_ontime', backfilled: false };
  return { status: 'taken_late', backfilled: late > GRACE_MS };
}

export function isLocked(dueAtUtc: string, nowUtc: string): boolean {
  return Date.parse(nowUtc) - Date.parse(dueAtUtc) > BACKFILL_WINDOW_MS;
}
