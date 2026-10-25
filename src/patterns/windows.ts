// "Harder times": the user's own patterns, surfaced back to them (spec §6). Never a
// prediction, never "relapse", never a push notification: only an in-app card.
import type { DoseStatus } from '../db/schema';
import { addDays, daysBetween, weekdayOf, type LocalDate } from '../lib/time';
import { localMinutesIn } from '../lib/tz';

/** A harder time the user set. `days`: 0 = Sunday; empty means every day. Minutes after local midnight. */
export interface HarderTime {
  days: number[];
  startMin: number;
  endMin: number;
}

export interface Window {
  /** "start-end", unique within a day. */
  key: string;
  startMin: number;
  endMin: number;
  /** Where it came from: times the user set, rough moods, or doses that often run late. */
  source: 'yours' | 'moods' | 'doses';
}

const LOOKBACK_DAYS = 21;
const MOOD_BLOCK_MIN = 120;
const MIN_ROUGH_IN_BLOCK = 3;
const MIN_LATE_ON_WEEKDAY = 2;
const DOSE_MARGIN_MIN = 60;
/** Dose patterns need this much history before they count. */
const MIN_HISTORY_DAYS = 14;
const DAY_MIN = 24 * 60;

const OVERDUE_MIN = 60;
const AFTER_MARK_MIN = 30;
const MAX_DISMISSALS_PER_WEEK = 2;

/** The harder-time windows for `date`, from all three sources, overlaps merged. */
export function windowsFor(input: {
  date: LocalDate;
  today: LocalDate;
  firstDay: LocalDate;
  timezone: string;
  harderTimes: readonly HarderTime[];
  /** Local date and time of each rough mood check-in. */
  roughMoods: readonly { date: LocalDate; minutes: number }[];
  doses: readonly { dueLocalDate: LocalDate; dueAtUtc: string; status: DoseStatus }[];
}): Window[] {
  const weekday = weekdayOf(input.date);
  const from = addDays(input.today, -(LOOKBACK_DAYS - 1));
  const raw: Omit<Window, 'key'>[] = [];

  for (const h of input.harderTimes) {
    if (h.days.length === 0 || h.days.includes(weekday)) raw.push({ startMin: h.startMin, endMin: h.endMin, source: 'yours' });
  }

  const blocks = new Map<number, number>();
  for (const m of input.roughMoods) {
    if (m.date < from || m.date > input.today) continue;
    const b = Math.floor(m.minutes / MOOD_BLOCK_MIN);
    blocks.set(b, (blocks.get(b) ?? 0) + 1);
  }
  for (const [b, n] of blocks) {
    if (n >= MIN_ROUGH_IN_BLOCK) raw.push({ startMin: b * MOOD_BLOCK_MIN, endMin: (b + 1) * MOOD_BLOCK_MIN, source: 'moods' });
  }

  if (daysBetween(input.firstDay, input.today) >= MIN_HISTORY_DAYS) {
    const lateOnWeekday = input.doses.filter(
      (d) => d.dueLocalDate >= from && d.dueLocalDate < input.today && weekdayOf(d.dueLocalDate) === weekday && (d.status === 'missed' || d.status === 'taken_late'),
    ).length;
    if (lateOnWeekday >= MIN_LATE_ON_WEEKDAY) {
      for (const d of input.doses) {
        if (d.dueLocalDate !== input.date) continue;
        const t = localMinutesIn(new Date(d.dueAtUtc), input.timezone);
        raw.push({ startMin: Math.max(0, t - DOSE_MARGIN_MIN), endMin: Math.min(DAY_MIN, t + DOSE_MARGIN_MIN), source: 'doses' });
      }
    }
  }

  const merged: Omit<Window, 'key'>[] = [];
  for (const w of [...raw].sort((a, b) => a.startMin - b.startMin)) {
    const last = merged[merged.length - 1];
    if (last && w.startMin <= last.endMin) last.endMin = Math.max(last.endMin, w.endMin);
    else merged.push({ ...w });
  }
  return merged.map((w) => ({ ...w, key: `${w.startMin}-${w.endMin}` }));
}

export function activeWindow(windows: readonly Window[], nowMinutes: number): Window | null {
  return windows.find((w) => nowMinutes >= w.startMin && nowMinutes < w.endMin) ?? null;
}

/** The window to show the Steady Hand card for right now, or null (spec §6.3, §6.5). */
export function steadyHandDue(input: {
  enabled: boolean;
  windows: readonly Window[];
  nowMinutes: number;
  /** How overdue the most overdue open dose today is, or null if none. */
  overdueMin: number | null;
  inQuiet: boolean;
  minutesSinceMark: number | null;
  shownToday: ReadonlySet<string>;
  dismissalsThisWeek: number;
}): Window | null {
  if (!input.enabled || input.inQuiet) return null;
  if (input.overdueMin === null || input.overdueMin < OVERDUE_MIN) return null;
  if (input.minutesSinceMark !== null && input.minutesSinceMark < AFTER_MARK_MIN) return null;
  if (input.dismissalsThisWeek >= MAX_DISMISSALS_PER_WEEK) return null;
  const w = activeWindow(input.windows, input.nowMinutes);
  return w && !input.shownToday.has(w.key) ? w : null;
}
