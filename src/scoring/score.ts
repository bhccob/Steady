import type { DoseStatus } from '../db/schema';
import { addDays, type LocalDate } from '../lib/time';
import { summarizeDays } from './days';
import type { ScoringDose } from './types';

export const SCORE_WINDOW_DAYS = 14;

const WEIGHT: Record<Exclude<DoseStatus, 'pending' | 'excused'>, number> = {
  taken_ontime: 1,
  taken_late: 0.8,
  missed: 0,
};
const EXCUSED_WEIGHT = 0.6;

const ratio = (earned: number, possible: number) => (possible === 0 ? 1 : earned / possible);

/**
 * Steady Score for the 14 local days ending `today`, 0..100.
 * Pending doses and rest days are left out entirely; an empty window is 100.
 *
 * Excused doses count at 0.6 only when that helps. Scoring them both ways and
 * keeping the higher means an excused dose can never pull the score down, so it
 * can never pull it below the prior day's score either.
 */
export function steadyScore(doses: readonly ScoringDose[], today: LocalDate): number {
  const days = summarizeDays(doses);
  const from = addDays(today, -(SCORE_WINDOW_DAYS - 1));

  let earned = 0;
  let possible = 0;
  let excused = 0;
  for (const d of doses) {
    if (d.dueLocalDate < from || d.dueLocalDate > today) continue;
    if (d.status === 'pending' || days.get(d.dueLocalDate)?.kind === 'rest') continue;
    if (d.status === 'excused') {
      excused++;
      continue;
    }
    earned += WEIGHT[d.status];
    possible += 1;
  }

  const best = Math.max(ratio(earned + EXCUSED_WEIGHT * excused, possible + excused), ratio(earned, possible));
  return Math.round(100 * best);
}
