import type { LocalDate } from './time';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClock(instant: Date, timeZone: string) {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year!, m: out.month!, d: out.day!, h: out.hour!, mi: out.minute!, s: out.second! };
}

/** Milliseconds the zone is ahead of UTC at `instant`. */
function offsetMs(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDateIn(instant: Date, timeZone: string): LocalDate {
  const w = wallClock(instant, timeZone);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`;
}

/** Minutes after local midnight at `instant`. */
export function localMinutesIn(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  return w.h * 60 + w.mi;
}

/**
 * The UTC instant (ISO, Z) for a wall-clock time in `timeZone`.
 * A time skipped by spring-forward lands just after the gap.
 */
export function zonedTimeToUtc(date: LocalDate, hhmm: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, h!, mi!);
  const first = wall - offsetMs(new Date(wall), timeZone);
  const second = wall - offsetMs(new Date(first), timeZone);
  return new Date(second).toISOString();
}
