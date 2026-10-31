import { addDays, weekdayOf, type LocalDate } from '../lib/time';
import { summarizeDays, type DaySummary } from '../scoring/days';
import type { ScoringDose } from '../scoring/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "YYYY-MM" for the month a date falls in. */
export function monthOf(date: LocalDate): string {
  return date.slice(0, 7);
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y! * 12 + (m! - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** "October", or "December 2025" when it isn't this year. */
export function monthTitle(month: string, today: LocalDate): string {
  const name = MONTHS[Number(month.slice(5)) - 1]!;
  return month.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${month.slice(0, 4)}`;
}


/**
 * full      everything due was marked (an excused dose counts)
 * part      some of it was marked
 * rest      a rest day
 * unmarked  due, finished, and nothing marked
 * open      due, nothing marked yet, still in time (today, mostly)
 * empty     nothing was due
 * before    before the person started with Steady
 * ahead     still to come
 */
export type Tile = 'full' | 'part' | 'rest' | 'unmarked' | 'open' | 'empty' | 'before' | 'ahead';

export interface MonthCell {
  date: LocalDate;
  day: number;
  isToday: boolean;
  tile: Tile;
  /** How far the tile fills, 0 to 1: the share of the day's doses marked. */
  fill: number;
  marked: number;
  due: number;
}

function cellFor(date: LocalDate, day: number, today: LocalDate, firstDay: LocalDate, s: DaySummary | undefined): MonthCell {
  const base = { date, day, isToday: date === today };
  if (date > today) return { ...base, tile: 'ahead', fill: 0, marked: 0, due: 0 };
  if (date < firstDay && !s) return { ...base, tile: 'before', fill: 0, marked: 0, due: 0 };
  if (!s) return { ...base, tile: 'empty', fill: 0, marked: 0, due: 0 };
  const marked = s.taken + s.excused;
  const due = s.total;
  const tile: Tile = s.kind === 'rest' ? 'rest' : marked === due ? 'full' : marked > 0 ? 'part' : s.kind === 'open' ? 'open' : 'unmarked';
  return { ...base, tile, fill: tile === 'rest' ? 0 : marked / due, marked, due };
}

/** The month's days as tiles. `leading` is how many blank cells come before the 1st (weeks start Monday). */
export function monthCells(input: { month: string; today: LocalDate; firstDay?: LocalDate; doses: readonly ScoringDose[] }): { leading: number; cells: MonthCell[] } {
  const [y, m] = input.month.split('-').map(Number);
  const length = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const first = `${input.month}-01`;
  const days = summarizeDays(input.doses);
  const cells = Array.from({ length }, (_, i) => {
    const date = addDays(first, i);
    return cellFor(date, i + 1, input.today, input.firstDay ?? first, days.get(date));
  });
  return { leading: (weekdayOf(first) + 6) % 7, cells };
}

/** Finished days of the month by how they went. A day still in progress waits until all of it is marked. */
export function monthTally(cells: readonly MonthCell[]): { full: number; part: number; rest: number; unmarked: number } {
  const tally = { full: 0, part: 0, rest: 0, unmarked: 0 };
  for (const c of cells) {
    if (c.tile === 'full' || c.tile === 'rest' || c.tile === 'unmarked') tally[c.tile]++;
    else if (c.tile === 'part' && !c.isToday) tally.part++;
  }
  return tally;
}

/** "21 full days · 5 partly · 2 rest", leaving out what didn't happen; null before anything is marked. */
export function tallyWords(t: ReturnType<typeof monthTally>): string | null {
  const parts = [t.full ? `${t.full} full ${t.full === 1 ? 'day' : 'days'}` : '', t.part ? `${t.part} partly` : '', t.rest ? `${t.rest} rest` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
