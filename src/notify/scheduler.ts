import { listDosesBetween } from '../db/dao/doses';
import { eventsSince, latestEventTime } from '../db/dao/events';
import { getProfile } from '../db/dao/profile';
import type { Db } from '../db/types';
import { addDays, HOUR_MS } from '../lib/time';
import { localDateIn } from '../lib/tz';
import { stillUpFor } from '../support/level';
import { planNotifications, type PlanInput, type Planned } from './plan';

/** What the scheduler needs from the phone. The real one is in expoPort.ts; tests use a fake. */
export interface NotificationPort {
  permitted(): Promise<boolean>;
  scheduled(): Promise<{ id: string; fireAt: string; body: string }[]>;
  schedule(n: Planned): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Clears reminders for these doses that are already showing. */
  dismiss(doseIds: readonly string[]): Promise<void>;
}

/** A snooze only matters while its dose still has reminders left. */
const SNOOZE_LOOKBACK_MS = 6 * HOUR_MS;

/** What's scheduled but no longer planned (or planned differently), and what's planned but not yet scheduled. */
export function diffSchedule(
  existing: readonly { id: string; fireAt: string; body: string }[],
  plan: readonly Planned[],
): { cancel: string[]; schedule: Planned[] } {
  const wanted = new Map(plan.map((n) => [n.id, n]));
  const have = new Map(existing.map((n) => [n.id, n]));
  const same = (a: { fireAt: string; body: string }, b: { fireAt: string; body: string }) => a.fireAt === b.fireAt && a.body === b.body;
  return {
    cancel: existing.filter((e) => !wanted.has(e.id) || !same(e, wanted.get(e.id)!)).map((e) => e.id),
    schedule: plan.filter((n) => !have.has(n.id) || !same(have.get(n.id)!, n)),
  };
}

export async function loadPlanInput(db: Db, now: Date): Promise<PlanInput | null> {
  const profile = await getProfile(db);
  if (!profile) return null;
  const today = localDateIn(now, profile.timezone);
  const doses = (await listDosesBetween(db, addDays(today, -1), addDays(today, 4))).filter((d) => d.status === 'pending');

  const snoozes = new Map<string, string>();
  for (const p of await eventsSince(db, 'dose_snoozed', new Date(now.getTime() - SNOOZE_LOOKBACK_MS).toISOString())) {
    const { doseIds, at } = p as { doseIds?: string[]; at: string };
    for (const id of doseIds ?? []) snoozes.set(id, at);
  }

  const { bedtimeMin, wakeMin } = profile;
  return {
    now: now.toISOString(),
    timezone: profile.timezone,
    name: profile.displayName,
    level: profile.supportLevel,
    doses,
    quiet: { startMin: profile.quietStartMin, endMin: profile.quietEndMin },
    snoozes,
    sleep:
      bedtimeMin !== null && wakeMin !== null
        ? { bedtimeMin, wakeMin, windDown: profile.windDown, stillUp: stillUpFor(profile.supportLevel, profile.stillUp) }
        : null,
    goodnightAt: await latestEventTime(db, 'goodnight'),
    bedtimeSnoozedAt: await latestEventTime(db, 'bedtime_snoozed'),
  };
}

/** Brings the phone's scheduled notifications in line with the plan, touching only what changed. */
export async function syncNotifications(db: Db, port: NotificationPort, now: Date = new Date()): Promise<void> {
  if (!(await port.permitted())) return;
  const input = await loadPlanInput(db, now);
  if (!input) return;
  const { cancel, schedule } = diffSchedule(await port.scheduled(), planNotifications(input));
  for (const id of cancel) await port.cancel(id);
  for (const n of schedule) await port.schedule(n);
}
