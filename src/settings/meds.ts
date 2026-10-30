import { deletePendingDoses, nextPendingDue } from '../db/dao/doses';
import { archiveMedRow, insertMed, listMeds, updateMed } from '../db/dao/meds';
import { deleteSchedulesFor, insertSchedule } from '../db/dao/schedules';
import type { MedForm } from '../db/schema';
import type { Db } from '../db/types';
import { reconcileDoses } from '../doses/reconcile';
import { formatHm } from '../lib/time';

export interface MedInput {
  /** Blank means "my pill". */
  label: string;
  amount: string;
  form: MedForm;
  color: string;
  /** Minutes after local midnight. */
  times: number[];
  /** 0 = Sunday. Empty means every day. */
  days: number[];
}

/**
 * Adds a med, or saves changes to one, with its schedule. Upcoming unmarked doses are
 * rebuilt from the new schedule; marked doses and anything already due stay as they are.
 * Returns the med's id.
 */
export async function saveMed(db: Db, input: MedInput & { id?: string }, opts: { now: string; timezone: string; notBefore: string }): Promise<string> {
  let id = input.id ?? '';
  const fields = { label: input.label.trim() || null, doseAmount: input.amount.trim() || null, form: input.form, color: input.color };
  await db.withTransactionAsync(async () => {
    if (input.id) {
      await updateMed(db, input.id, fields);
      await deleteSchedulesFor(db, input.id);
      await deletePendingDoses(db, input.id, opts.now);
    } else {
      const sortOrder = Math.max(-1, ...(await listMeds(db, { includeInactive: true })).map((m) => m.sortOrder)) + 1;
      id = (await insertMed(db, { ...fields, sortOrder, createdAt: opts.now })).id;
    }
    if (input.times.length) {
      await insertSchedule(db, { medId: id, times: [...new Set(input.times)].sort((a, b) => a - b).map(formatHm), days: input.days });
    }
  });
  await reconcileDoses(db, opts);
  return id;
}

/** When a just-saved med's first reminder comes: its next unmarked dose from now on. */
export function firstReminderOf(db: Db, medId: string, now: string): Promise<string | null> {
  return nextPendingDue(db, medId, now);
}

/** Stops a med: no more doses or reminders. Its marked history stays in Calendar and Insights. */
export async function archiveMed(db: Db, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await archiveMedRow(db, id);
    await deleteSchedulesFor(db, id);
    await deletePendingDoses(db, id);
  });
}
