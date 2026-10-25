import type { LocalDate } from '../lib/time';
import { isTaken, summarizeDays } from './days';
import type { ScoringDose } from './types';

/**
 * Consecutive complete days up to `today`. Days with nothing scheduled, rest days
 * and days still in progress are skipped: they neither extend nor break it.
 * Always shown next to totalDaysMarked, never alone.
 */
export function steadyStreak(doses: readonly ScoringDose[], today: LocalDate): number {
  const days = summarizeDays(doses);
  const dates = [...days.keys()].filter((d) => d <= today).sort().reverse();

  let streak = 0;
  for (const date of dates) {
    const kind = days.get(date)!.kind;
    if (kind === 'complete') streak++;
    else if (kind === 'broken') break;
  }
  return streak;
}

/** Lifetime count of local days with at least one taken dose. */
export function totalDaysMarked(doses: readonly ScoringDose[]): number {
  return new Set(doses.filter((d) => isTaken(d.status)).map((d) => d.dueLocalDate)).size;
}
