import { insertPendingDose, lockExpiredDoses } from '../db/dao/doses';
import { listMeds } from '../db/dao/meds';
import { listSchedules } from '../db/dao/schedules';
import type { Db } from '../db/types';
import { localDateIn } from '../lib/tz';
import { planDoses } from './plan';

/**
 * Spec §5.1: on launch and after schedule changes, make sure every dose for the next
 * `days` days exists (idempotent), and lock anything more than 24h past due.
 * Doses due before `notBefore` (when the user started) are never created.
 * Returns how many new doses were created.
 */
export async function reconcileDoses(db: Db, opts: { now: string; timezone: string; notBefore: string; days?: number }): Promise<number> {
  await lockExpiredDoses(db, opts.now);
  const meds = await listMeds(db);
  const schedules = await listSchedules(db);
  const planned = planDoses({
    schedules,
    activeMedIds: new Set(meds.map((m) => m.id)),
    from: localDateIn(new Date(opts.now), opts.timezone),
    days: opts.days ?? 21,
    timezone: opts.timezone,
  });

  let created = 0;
  for (const p of planned) {
    if (p.dueAtUtc < opts.notBefore) continue;
    if (await insertPendingDose(db, p)) created++;
  }
  return created;
}
