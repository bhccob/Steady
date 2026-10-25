import { addDays, weekdayOf, type LocalDate } from '../lib/time';

/** A week's trophy is ready from 20:00 on its Sunday. */
const READY_AT_MIN = 20 * 60;
const POINTS_PER_MARKED_DAY = 10;
const POINTS_PER_TROPHY = 50;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TrophyState = 'locked' | 'ready' | 'got';

/** Weeks run Monday to Sunday. */
export function weekStartOf(date: LocalDate): LocalDate {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** "19–25 Oct", or "28 Sep – 4 Oct" across months. */
export function weekLabel(weekStart: LocalDate): string {
  const end = addDays(weekStart, 6);
  const [, m1, d1] = weekStart.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  return m1 === m2 ? `${d1}–${d2} ${MONTHS[m1! - 1]}` : `${d1} ${MONTHS[m1! - 1]} – ${d2} ${MONTHS[m2! - 1]}`;
}

/** Every week ends with a trophy, however it went. */
export function trophyState(input: { weekStart: LocalDate; today: LocalDate; nowMinutes: number; collected: boolean }): TrophyState {
  if (input.collected) return 'got';
  const sunday = addDays(input.weekStart, 6);
  if (input.today > sunday || (input.today === sunday && input.nowMinutes >= READY_AT_MIN)) return 'ready';
  return 'locked';
}

/** Points only ever go up: marked days and collected trophies are never taken back. */
export function totalPoints(input: { markedDays: number; trophiesCollected: number }): number {
  return input.markedDays * POINTS_PER_MARKED_DAY + input.trophiesCollected * POINTS_PER_TROPHY;
}

export { POINTS_PER_TROPHY };
