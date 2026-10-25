import { addDays, weekdayOf, type LocalDate } from '../lib/time';
import { weekStartOf } from '../rewards/trophies';
import { dayRings, summarizeDays, type Ring } from '../scoring/days';
import type { ScoringDose } from '../scoring/types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A calendar ring, plus "open" for today while its doses are still to come. */
export type CalendarRing = Ring | 'open';

export interface MonthCell {
  date: LocalDate;
  day: number;
  ring: CalendarRing;
  isToday: boolean;
  thisWeek: boolean;
}

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

/** The month's days with their rings. `leading` is how many blank cells come before the 1st (weeks start Monday). */
export function monthCells(input: {
  month: string;
  today: LocalDate;
  doses: readonly ScoringDose[];
  moodDates: ReadonlySet<LocalDate>;
}): { leading: number; cells: MonthCell[] } {
  const [y, m] = input.month.split('-').map(Number);
  const length = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const first = `${input.month}-01`;
  const dates = Array.from({ length }, (_, i) => addDays(first, i));
  const rings = dayRings(input.doses, input.moodDates, dates);
  const weekStart = weekStartOf(input.today);
  const weekEnd = addDays(weekStart, 6);
  const todayOpen = input.doses.some((d) => d.dueLocalDate === input.today && d.status === 'pending');

  const cells = dates.map((date, i): MonthCell => {
    const isToday = date === input.today;
    const ring = rings[date]!;
    return {
      date,
      day: i + 1,
      ring: isToday && ring === 'empty' && todayOpen ? 'open' : ring,
      isToday,
      thisWeek: date >= weekStart && date <= weekEnd,
    };
  });
  return { leading: (weekdayOf(first) + 6) % 7, cells };
}

export interface DensityCell {
  date: LocalDate;
  /** 0 nothing marked, 1 some, 2 most, 3 all. Null when nothing was due or the day is still open. */
  level: 0 | 1 | 2 | 3 | null;
  rest: boolean;
}

/** The last `span` days, oldest first, for the 14/30/90-day view. */
export function densityCells(input: { doses: readonly ScoringDose[]; today: LocalDate; span: number }): DensityCell[] {
  const days = summarizeDays(input.doses);
  return Array.from({ length: input.span }, (_, i): DensityCell => {
    const date = addDays(input.today, i - input.span + 1);
    const s = days.get(date);
    if (!s || s.kind === 'open') return { date, level: null, rest: false };
    if (s.kind === 'rest') return { date, level: 0, rest: true };
    const share = (s.taken + s.excused) / s.total;
    return { date, level: share >= 1 ? 3 : share >= 0.5 ? 2 : share > 0 ? 1 : 0, rest: false };
  });
}
