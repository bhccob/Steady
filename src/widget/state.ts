// What the home-screen widget shows. Pure, so it's tested without a phone. Like reminders,
// it shows times and counts only, never a med's name: the home screen is visible to others.
import { formatHm, HOUR_MS, type LocalDate } from '../lib/time';
import { localMinutesIn } from '../lib/tz';
import { isTaken } from '../scoring/days';
import { classifyMark } from '../scoring/status';
import { steadyStreak } from '../scoring/streak';
import type { DoseStatus } from '../db/schema';

export interface WidgetState {
  streak: number;
  markedToday: number;
  dueToday: number;
  /** The earliest open time today, with every dose due then; null once everything is marked. */
  next: { time: string; doseIds: string[]; markable: boolean } | null;
}

/** Marking opens an hour before the dose, as on Home. */
const EARLY_MS = HOUR_MS;

export function widgetState(input: {
  doses: readonly { id: string; dueLocalDate: LocalDate; dueAtUtc: string; status: DoseStatus }[];
  today: LocalDate;
  nowMs: number;
  timezone: string;
}): WidgetState {
  const todays = input.doses.filter((d) => d.dueLocalDate === input.today);
  const open = todays.filter((d) => d.status === 'pending').sort((a, b) => (a.dueAtUtc < b.dueAtUtc ? -1 : 1));
  const first = open[0];
  const nowIso = new Date(input.nowMs).toISOString();
  return {
    streak: steadyStreak(input.doses, input.today),
    markedToday: todays.filter((d) => isTaken(d.status)).length,
    dueToday: todays.length,
    next: first
      ? {
          time: formatHm(localMinutesIn(new Date(first.dueAtUtc), input.timezone)),
          doseIds: open.filter((d) => d.dueAtUtc === first.dueAtUtc).map((d) => d.id),
          markable: input.nowMs >= Date.parse(first.dueAtUtc) - EARLY_MS && classifyMark(first.dueAtUtc, nowIso) !== null,
        }
      : null,
  };
}
