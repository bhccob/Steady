import { DAY_MS } from '../lib/time';
import { BACKFILL_WINDOW_MS, isLocked } from './status';
import type { ScoringDose } from './types';

export const COMEBACK_LOOKBACK_MS = 7 * DAY_MS;

/**
 * True when this mark is a Comeback: a dose was missed in the 7 days before it,
 * and that miss happened after the last Comeback. A miss "happens" when the dose
 * locks, 24h after due, so one missed stretch earns exactly one Comeback.
 */
export function isComeback(input: {
  markedAtUtc: string;
  doses: readonly ScoringDose[];
  lastComebackAtUtc: string | null;
}): boolean {
  const at = Date.parse(input.markedAtUtc);
  const since = input.lastComebackAtUtc === null ? -Infinity : Date.parse(input.lastComebackAtUtc);

  return input.doses.some((d) => {
    const due = Date.parse(d.dueAtUtc);
    const missed = d.status === 'missed' || (d.status === 'pending' && isLocked(d.dueAtUtc, input.markedAtUtc));
    return missed && due >= at - COMEBACK_LOOKBACK_MS && due < at && due + BACKFILL_WINDOW_MS > since;
  });
}
