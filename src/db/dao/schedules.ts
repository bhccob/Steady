import { newId } from '../../lib/id';
import type { Db } from '../types';

export interface Schedule {
  id: string;
  medId: string;
  /** Local "HH:mm" times. */
  times: string[];
  /** 0 = Sunday. Empty or all seven means daily. */
  days: number[];
  active: boolean;
}

interface ScheduleRow {
  id: string;
  med_id: string;
  times_json: string;
  days_json: string;
  active: number;
}

function fromRow(r: ScheduleRow): Schedule {
  return {
    id: r.id,
    medId: r.med_id,
    times: JSON.parse(r.times_json) as string[],
    days: JSON.parse(r.days_json) as number[],
    active: r.active === 1,
  };
}

export async function listSchedules(db: Db): Promise<Schedule[]> {
  const rows = await db.getAllAsync<ScheduleRow>('SELECT * FROM schedules ORDER BY rowid', []);
  return rows.map(fromRow);
}

export async function deleteSchedulesFor(db: Db, medId: string): Promise<void> {
  await db.runAsync('DELETE FROM schedules WHERE med_id = ?', [medId]);
}

export async function insertSchedule(
  db: Db,
  input: { medId: string; times: string[]; days: number[] },
): Promise<string> {
  const id = newId();
  await db.runAsync('INSERT INTO schedules (id, med_id, times_json, days_json) VALUES (?, ?, ?, ?)', [
    id,
    input.medId,
    JSON.stringify(input.times),
    JSON.stringify(input.days),
  ]);
  return id;
}
