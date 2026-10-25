import type { Schedule } from '../db/dao/schedules';
import { addDays, weekdayOf, type LocalDate } from '../lib/time';
import { zonedTimeToUtc } from '../lib/tz';

export interface PlannedDose {
  medId: string;
  dueAtUtc: string;
  /** Local date in the profile time zone at planning time. Never rewritten later. */
  dueLocalDate: LocalDate;
}

/** Every dose the active schedules call for over `days` local days starting at `from`. */
export function planDoses(input: {
  schedules: readonly Schedule[];
  activeMedIds: ReadonlySet<string>;
  from: LocalDate;
  days: number;
  timezone: string;
}): PlannedDose[] {
  const live = input.schedules.filter((s) => s.active && input.activeMedIds.has(s.medId));
  const out: PlannedDose[] = [];
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.from, i);
    const wd = weekdayOf(date);
    for (const s of live) {
      if (s.days.length && s.days.length < 7 && !s.days.includes(wd)) continue;
      for (const t of s.times) out.push({ medId: s.medId, dueAtUtc: zonedTimeToUtc(date, t, input.timezone), dueLocalDate: date });
    }
  }
  return out;
}
