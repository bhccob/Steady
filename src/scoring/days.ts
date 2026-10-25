import type { DoseStatus } from '../db/schema';
import { daysBetween, type LocalDate } from '../lib/time';
import type { ScoringDose } from './types';

/**
 * complete  every dose taken or excused
 * open      something still pending; neither extends nor breaks the streak yet
 * rest      every dose missed, covered by the rest-day budget; pauses the streak
 *           and leaves the score window
 * broken    a missed dose with no rest day to cover it
 */
export type DayKind = 'complete' | 'open' | 'rest' | 'broken';

export interface DaySummary {
  date: LocalDate;
  total: number;
  taken: number;
  excused: number;
  missed: number;
  pending: number;
  kind: DayKind;
}

/** One rest day per rolling 7 days: the next one needs a gap of at least 7. */
export const REST_DAY_GAP_DAYS = 7;

export function isTaken(status: DoseStatus): boolean {
  return status === 'taken_ontime' || status === 'taken_late';
}

/** Tallies per local date (days with no doses are absent), with rest days assigned oldest first. */
export function summarizeDays(doses: readonly ScoringDose[]): Map<LocalDate, DaySummary> {
  const byDate = new Map<LocalDate, DaySummary>();
  for (const d of doses) {
    let s = byDate.get(d.dueLocalDate);
    if (!s) {
      s = { date: d.dueLocalDate, total: 0, taken: 0, excused: 0, missed: 0, pending: 0, kind: 'open' };
      byDate.set(d.dueLocalDate, s);
    }
    s.total++;
    if (isTaken(d.status)) s.taken++;
    else if (d.status === 'excused') s.excused++;
    else if (d.status === 'missed') s.missed++;
    else s.pending++;
  }

  let lastRest: LocalDate | null = null;
  for (const date of [...byDate.keys()].sort()) {
    const s = byDate.get(date)!;
    if (s.pending > 0) {
      s.kind = 'open';
    } else if (s.missed === 0) {
      s.kind = 'complete';
    } else if (s.missed === s.total && (lastRest === null || daysBetween(lastRest, date) >= REST_DAY_GAP_DAYS)) {
      s.kind = 'rest';
      lastRest = date;
    } else {
      s.kind = 'broken';
    }
  }
  return byDate;
}

/** Calendar cell: filled, half, hollow (rest), a faint dot (mood only) or nothing. */
export type Ring = 'full' | 'half' | 'hollow' | 'dot' | 'empty';

function ringFor(s: DaySummary | undefined, hasMood: boolean): Ring {
  if (!s) return hasMood ? 'dot' : 'empty';
  if (s.kind === 'rest') return 'hollow';
  if (s.taken === s.total) return 'full';
  if (s.taken > 0) return 'half';
  return 'empty';
}

export function dayRings(
  doses: readonly ScoringDose[],
  moodDates: ReadonlySet<LocalDate>,
  dates: readonly LocalDate[],
): Record<LocalDate, Ring> {
  const days = summarizeDays(doses);
  return Object.fromEntries(dates.map((date) => [date, ringFor(days.get(date), moodDates.has(date))]));
}
