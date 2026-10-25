import { addDays, weekdayOf, type LocalDate } from '../lib/time';
import { trophyState, weekLabel, weekStartOf, type TrophyState } from '../rewards/trophies';
import { summarizeDays } from '../scoring/days';
import type { ScoringDose } from '../scoring/types';

/**
 * done   at least one dose marked that day (one block per marked day)
 * rest   a rest day: the streak paused
 * today  today, nothing marked yet
 * past   an earlier day with nothing marked. Shown plainly, never as a failure.
 * ahead  a day still to come
 */
export type DayState = 'done' | 'rest' | 'today' | 'past' | 'ahead';

export type PathEntry =
  | { kind: 'day'; date: LocalDate; weekday: string; day: number; state: DayState; isToday: boolean }
  | { kind: 'trophy'; weekStart: LocalDate; label: string; state: TrophyState; daysMarked: number };

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AHEAD_DAYS = 3;

/** Last week (if the user was here), this week, a trophy after each Sunday, then a few days ahead. */
export function buildPath(input: {
  doses: readonly ScoringDose[];
  today: LocalDate;
  firstDay: LocalDate;
  collected: ReadonlySet<LocalDate>;
  nowMinutes: number;
}): PathEntry[] {
  const days = summarizeDays(input.doses);
  const thisWeek = weekStartOf(input.today);
  const lastWeek = addDays(thisWeek, -7);
  const firstWeek = weekStartOf(input.firstDay);
  const out: PathEntry[] = [];

  const dayEntry = (date: LocalDate): PathEntry => {
    const s = days.get(date);
    const isToday = date === input.today;
    const state: DayState =
      date > input.today ? 'ahead' : s && s.taken > 0 ? 'done' : isToday ? 'today' : s?.kind === 'rest' ? 'rest' : 'past';
    return { kind: 'day', date, weekday: WEEKDAY[weekdayOf(date)]!, day: Number(date.slice(8)), state, isToday };
  };

  for (const week of lastWeek >= firstWeek ? [lastWeek, thisWeek] : [thisWeek]) {
    let marked = 0;
    for (let i = 0; i < 7; i++) {
      const e = dayEntry(addDays(week, i));
      if (e.kind === 'day' && e.state === 'done') marked++;
      out.push(e);
    }
    out.push({
      kind: 'trophy',
      weekStart: week,
      label: weekLabel(week),
      state: trophyState({ weekStart: week, today: input.today, nowMinutes: input.nowMinutes, collected: input.collected.has(week) }),
      daysMarked: marked,
    });
  }
  for (let i = 0; i < AHEAD_DAYS; i++) out.push(dayEntry(addDays(thisWeek, 7 + i)));
  return out;
}

export function indexOfToday(entries: readonly PathEntry[]): number {
  return entries.findIndex((e) => e.kind === 'day' && e.isToday);
}
