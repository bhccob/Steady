import { newId } from '../../lib/id';
import { addMs, DAY_MS, nowIso, type LocalDate } from '../../lib/time';
import type { DoseStatus } from '../schema';
import type { Db } from '../types';

export interface Dose {
  id: string;
  medId: string;
  dueAtUtc: string;
  /** Local date in the profile time zone when the dose was created. Never rewritten. */
  dueLocalDate: LocalDate;
  status: DoseStatus;
  takenAtUtc: string | null;
  backfilled: boolean;
  createdAt: string;
}

interface DoseRow {
  id: string;
  med_id: string;
  due_at_utc: string;
  due_local_date: string;
  status: DoseStatus;
  taken_at_utc: string | null;
  backfilled: number;
  created_at: string;
}

function fromRow(r: DoseRow): Dose {
  return {
    id: r.id,
    medId: r.med_id,
    dueAtUtc: r.due_at_utc,
    dueLocalDate: r.due_local_date,
    status: r.status,
    takenAtUtc: r.taken_at_utc,
    backfilled: r.backfilled === 1,
    createdAt: r.created_at,
  };
}

/** Idempotent by (med_id, due_at_utc). Returns true when a row was created. */
export async function insertPendingDose(
  db: Db,
  input: { medId: string; dueAtUtc: string; dueLocalDate: LocalDate },
): Promise<boolean> {
  const r = await db.runAsync(
    `INSERT INTO doses (id, med_id, due_at_utc, due_local_date, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (med_id, due_at_utc) DO NOTHING`,
    [newId(), input.medId, input.dueAtUtc, input.dueLocalDate, nowIso()],
  );
  return r.changes === 1;
}

export async function getDose(db: Db, id: string): Promise<Dose | null> {
  const row = await db.getFirstAsync<DoseRow>('SELECT * FROM doses WHERE id = ?', [id]);
  return row ? fromRow(row) : null;
}

/** Doses whose stored local date is in [from, to], in due order. */
export async function listDosesBetween(db: Db, from: LocalDate, to: LocalDate): Promise<Dose[]> {
  const rows = await db.getAllAsync<DoseRow>(
    'SELECT * FROM doses WHERE due_local_date BETWEEN ? AND ? ORDER BY due_at_utc, rowid',
    [from, to],
  );
  return rows.map(fromRow);
}

/** Removes a med's doses that were never marked, optionally only those due after `after`. Marked history stays. */
export async function deletePendingDoses(db: Db, medId: string, after?: string): Promise<void> {
  if (after) await db.runAsync("DELETE FROM doses WHERE med_id = ? AND status = 'pending' AND due_at_utc > ?", [medId, after]);
  else await db.runAsync("DELETE FROM doses WHERE med_id = ? AND status = 'pending'", [medId]);
}

export async function setDoseStatus(
  db: Db,
  id: string,
  next: { status: DoseStatus; takenAtUtc?: string | null; backfilled?: boolean },
): Promise<void> {
  await db.runAsync('UPDATE doses SET status = ?, taken_at_utc = ?, backfilled = ? WHERE id = ?', [
    next.status,
    next.takenAtUtc ?? null,
    next.backfilled ? 1 : 0,
    id,
  ]);
}

/** Pending doses more than 24h past due can no longer be marked. Returns how many were locked. */
export async function lockExpiredDoses(db: Db, nowUtc: string): Promise<number> {
  const cutoff = addMs(nowUtc, -DAY_MS);
  const r = await db.runAsync("UPDATE doses SET status = 'missed' WHERE status = 'pending' AND due_at_utc < ?", [cutoff]);
  return r.changes;
}
