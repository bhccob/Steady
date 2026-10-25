/** Calendar date in the profile time zone, YYYY-MM-DD. Compares correctly as a string. */
export type LocalDate = string;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

function utcMidnight(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function addDays(date: LocalDate, n: number): LocalDate {
  return new Date(utcMidnight(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday, matching schedules.days_json. */
export function weekdayOf(date: LocalDate): number {
  return new Date(utcMidnight(date)).getUTCDay();
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 24 Oct". */
export function shortDate(date: LocalDate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(date)]} ${d} ${MONTHS[m! - 1]}`;
}

/** Whole calendar days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((utcMidnight(b) - utcMidnight(a)) / DAY_MS);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

const MINUTES_PER_DAY = 1440;

/** Minutes after local midnight as "HH:mm". */
export function formatHm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h! * 60 + m!;
}

/** Moves a clock time by `delta` minutes, wrapping around midnight. */
export function stepMinutes(min: number, delta: number): number {
  return (((min + delta) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
