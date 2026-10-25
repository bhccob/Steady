// Spec §12.7: a private Sunday recap. Counts only; no ranking, no comparison, never shared.
import { weekdayOf, type LocalDate } from '../lib/time';
import { weekStartOf } from '../rewards/trophies';
import { isTaken, summarizeDays } from '../scoring/days';
import type { ScoringDose } from '../scoring/types';

const RECAP_FROM_MIN = 17 * 60;

export interface Recap {
  marks: number;
  comebacks: number;
  restDays: number;
}

/** Monday to today: doses marked, comebacks, rest days. */
export function weeklyRecap(input: { doses: readonly ScoringDose[]; today: LocalDate; comebacks: number }): Recap {
  const from = weekStartOf(input.today);
  const inWeek = (date: LocalDate) => date >= from && date <= input.today;
  const marks = input.doses.filter((d) => inWeek(d.dueLocalDate) && isTaken(d.status)).length;
  const restDays = [...summarizeDays(input.doses).values()].filter((s) => inWeek(s.date) && s.kind === 'rest').length;
  return { marks, comebacks: input.comebacks, restDays };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "This week: 12 marks, 2 comebacks, 1 rest day." Zeros are left out. */
export function recapLine(r: Recap): string {
  const parts = [
    r.marks > 0 ? count(r.marks, 'mark', 'marks') : null,
    r.comebacks > 0 ? count(r.comebacks, 'comeback', 'comebacks') : null,
    r.restDays > 0 ? count(r.restDays, 'rest day', 'rest days') : null,
  ].filter(Boolean);
  return parts.length ? `This week: ${parts.join(', ')}.` : 'A quiet week. A new one starts tomorrow.';
}

/** Sundays from 17:00, until the user has seen it. */
export function recapDue(input: { today: LocalDate; nowMinutes: number; seenThisWeek: boolean }): boolean {
  return weekdayOf(input.today) === 0 && input.nowMinutes >= RECAP_FROM_MIN && !input.seenThisWeek;
}
