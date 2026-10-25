import { newId } from '../../lib/id';
import { nowIso } from '../../lib/time';
import type { HarderTime } from '../../patterns/windows';
import type { Db } from '../types';

/** Spec §6.2a: up to three. */
export const MAX_HARDER_TIMES = 3;

export async function listHarderTimes(db: Db): Promise<HarderTime[]> {
  const rows = await db.getAllAsync<{ days_json: string; start_min: number; end_min: number }>(
    'SELECT days_json, start_min, end_min FROM harder_times ORDER BY rowid',
    [],
  );
  return rows.map((r) => ({ days: JSON.parse(r.days_json) as number[], startMin: r.start_min, endMin: r.end_min }));
}

/** Saves the full set: anything not in `times` is removed. */
export async function replaceHarderTimes(db: Db, times: readonly HarderTime[]): Promise<void> {
  if (times.length > MAX_HARDER_TIMES) throw new Error(`At most ${MAX_HARDER_TIMES} harder times`);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM harder_times', []);
    const at = nowIso();
    for (const t of times) {
      await db.runAsync('INSERT INTO harder_times (id, days_json, start_min, end_min, created_at) VALUES (?, ?, ?, ?, ?)', [newId(), JSON.stringify(t.days), t.startMin, t.endMin, at]);
    }
  });
}
