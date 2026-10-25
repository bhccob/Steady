// The numbers behind Insights: the user's own patterns, shown back to them. Never shared.
import type { Mood } from '../db/schema';
import { addDays, MINUTE_MS, type LocalDate } from '../lib/time';
import { trophyState, weekStartOf, type TrophyState } from '../rewards/trophies';
import { summarizeDays } from '../scoring/days';
import { steadyScore } from '../scoring/score';
import type { ScoringDose } from '../scoring/types';

/** What Insights needs from a dose. A DAO `Dose` satisfies it. */
export interface HistoryDose extends ScoringDose {
  takenAtUtc: string | null;
}

export interface Breakdown {
  /** Every dose marked, all on time. */
  ontime: number;
  /** Every dose marked, some a bit later. */
  later: number;
  /** Some doses marked, some not. */
  partial: number;
  rest: number;
  notMarked: number;
  /** Share of days with at least one mark; null before anything was due. */
  percentMarked: number | null;
}

/** How each of the last `days` days went. Days still open are left out. */
export function breakdown(doses: readonly ScoringDose[], today: LocalDate, days: number): Breakdown {
  const from = addDays(today, -(days - 1));
  const late = new Set(doses.filter((d) => d.status === 'taken_late').map((d) => d.dueLocalDate));
  const out: Breakdown = { ontime: 0, later: 0, partial: 0, rest: 0, notMarked: 0, percentMarked: null };
  for (const s of summarizeDays(doses).values()) {
    if (s.date < from || s.date > today || s.kind === 'open') continue;
    if (s.kind === 'rest') out.rest++;
    else if (s.taken === 0 && s.missed === 0) continue;
    else if (s.taken === 0) out.notMarked++;
    else if (s.missed > 0) out.partial++;
    else if (late.has(s.date)) out.later++;
    else out.ontime++;
  }
  const counted = out.ontime + out.later + out.partial + out.rest + out.notMarked;
  out.percentMarked = counted ? Math.round((100 * (out.ontime + out.later + out.partial)) / counted) : null;
  return out;
}

export interface WeekBar {
  date: LocalDate;
  letter: string;
  ontime: number;
  later: number;
  total: number;
  state: 'past' | 'rest' | 'today' | 'ahead' | 'none';
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday to Sunday of the current week. */
export function weekBars(doses: readonly ScoringDose[], today: LocalDate): WeekBar[] {
  const days = summarizeDays(doses);
  const start = weekStartOf(today);
  return LETTERS.map((letter, i): WeekBar => {
    const date = addDays(start, i);
    const own = doses.filter((d) => d.dueLocalDate === date);
    const s = days.get(date);
    const state = date > today ? 'ahead' : date === today ? 'today' : s?.kind === 'rest' ? 'rest' : own.length ? 'past' : 'none';
    return {
      date,
      letter,
      ontime: own.filter((d) => d.status === 'taken_ontime').length,
      later: own.filter((d) => d.status === 'taken_late').length,
      total: own.length,
      state,
    };
  });
}

/** Steady score at the end of each of the last `days` days, from the first day with doses. */
export function scoreSeries(doses: readonly ScoringDose[], today: LocalDate, days: number): { date: LocalDate; score: number }[] {
  if (!doses.length) return [];
  const firstDose = doses.reduce((min, d) => (d.dueLocalDate < min ? d.dueLocalDate : min), doses[0]!.dueLocalDate);
  const windowStart = addDays(today, -(days - 1));
  const out: { date: LocalDate; score: number }[] = [];
  for (let date = firstDose > windowStart ? firstDose : windowStart; date <= today; date = addDays(date, 1)) {
    out.push({ date, score: steadyScore(doses, date) });
  }
  return out;
}

/** Minutes between the set time and the mark, for doses marked in the last `days` days, smallest first. */
export function markOffsets(doses: readonly HistoryDose[], today: LocalDate, days: number): number[] {
  const from = addDays(today, -(days - 1));
  return doses
    .filter((d) => d.takenAtUtc && d.dueLocalDate >= from && d.dueLocalDate <= today)
    .map((d) => Math.round((Date.parse(d.takenAtUtc!) - Date.parse(d.dueAtUtc)) / MINUTE_MS))
    .sort((a, b) => a - b);
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/** The middle half of marks, rounded to five minutes. Null with fewer than three marks. */
export function usualRange(offsets: readonly number[]): { from: number; to: number } | null {
  if (offsets.length < 3) return null;
  const at = (q: number) => offsets[Math.floor((offsets.length - 1) * q)]!;
  return { from: round5(at(0.25)), to: round5(at(0.75)) };
}

/** "Usually 5 to 20 minutes after the set time." */
export function describeRange({ from, to }: { from: number; to: number }): string {
  if (from === 0 && to === 0) return 'Usually right at the set time.';
  if (to < 0) return from === to ? `Usually about ${-from} minutes early.` : `Usually ${-to} to ${-from} minutes early.`;
  if (from < 0) return `Usually between ${-from} minutes early and ${to} minutes after.`;
  if (from === to) return `Usually about ${from} minutes after the set time.`;
  if (from === 0) return `Usually within ${to} minutes of the set time.`;
  return `Usually ${from} to ${to} minutes after the set time.`;
}

/** Each of the last `days` days, oldest first, with its mood and how many doses were marked. */
export function moodMarks(
  doses: readonly ScoringDose[],
  checkins: readonly { dateLocal: LocalDate; mood: Mood }[],
  today: LocalDate,
  days: number,
): { date: LocalDate; mood: Mood | null; taken: number }[] {
  const moods = new Map(checkins.map((c) => [c.dateLocal, c.mood]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    const taken = doses.filter((d) => d.dueLocalDate === date && (d.status === 'taken_ontime' || d.status === 'taken_late')).length;
    return { date, mood: moods.get(date) ?? null, taken };
  });
}

/** One trophy per week since the user's first, newest last, keeping the most recent `max`. */
export function trophyShelf(input: {
  firstDay: LocalDate;
  today: LocalDate;
  nowMinutes: number;
  collected: ReadonlySet<LocalDate>;
  max?: number;
}): { weekStart: LocalDate; state: TrophyState }[] {
  const out: { weekStart: LocalDate; state: TrophyState }[] = [];
  for (let week = weekStartOf(input.firstDay); week <= weekStartOf(input.today); week = addDays(week, 7)) {
    out.push({ weekStart: week, state: trophyState({ weekStart: week, today: input.today, nowMinutes: input.nowMinutes, collected: input.collected.has(week) }) });
  }
  return out.slice(-(input.max ?? 8));
}
