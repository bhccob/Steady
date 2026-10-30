import { newId } from '../../lib/id';
import { nowIso } from '../../lib/time';
import type { MedForm } from '../schema';
import type { Db } from '../types';

export interface Med {
  id: string;
  /** Null is valid and shown as "my pill". */
  label: string | null;
  doseAmount: string | null;
  form: MedForm;
  color: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

interface MedRow {
  id: string;
  label: string | null;
  dose_amount: string | null;
  form: MedForm | null;
  color: string | null;
  active: number;
  sort_order: number;
  created_at: string;
}

function fromRow(r: MedRow): Med {
  return {
    id: r.id,
    label: r.label,
    doseAmount: r.dose_amount,
    form: r.form ?? 'pill',
    color: r.color,
    active: r.active === 1,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}

export async function getMed(db: Db, id: string): Promise<Med | null> {
  const row = await db.getFirstAsync<MedRow>('SELECT * FROM meds WHERE id = ?', [id]);
  return row ? fromRow(row) : null;
}

export async function listMeds(db: Db, opts: { includeInactive?: boolean } = {}): Promise<Med[]> {
  const where = opts.includeInactive ? '' : 'WHERE active = 1';
  const rows = await db.getAllAsync<MedRow>(`SELECT * FROM meds ${where} ORDER BY sort_order, created_at, rowid`, []);
  return rows.map(fromRow);
}

export async function insertMed(
  db: Db,
  input: { label: string | null; doseAmount?: string | null; form?: MedForm; color?: string | null; sortOrder?: number; createdAt?: string },
): Promise<Med> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO meds (id, label, dose_amount, form, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, input.label, input.doseAmount ?? null, input.form ?? 'pill', input.color ?? null, input.sortOrder ?? 0, input.createdAt ?? nowIso()],
  );
  return (await getMed(db, id))!;
}

export async function updateMed(db: Db, id: string, input: { label: string | null; doseAmount: string | null; form: MedForm; color: string | null }): Promise<void> {
  await db.runAsync('UPDATE meds SET label = ?, dose_amount = ?, form = ?, color = ? WHERE id = ?', [input.label, input.doseAmount, input.form, input.color, id]);
}

/** Hidden from lists and schedules; its marked history stays. */
export async function archiveMedRow(db: Db, id: string): Promise<void> {
  await db.runAsync('UPDATE meds SET active = 0 WHERE id = ?', [id]);
}

/** Cascades to the med's schedules and doses. */
export async function deleteMed(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM meds WHERE id = ?', [id]);
}
