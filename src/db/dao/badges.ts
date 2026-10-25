import { nowIso } from '../../lib/time';
import type { Db } from '../types';

/** Returns true only the first time a badge is earned. */
export async function awardBadge(db: Db, id: string): Promise<boolean> {
  const r = await db.runAsync('INSERT OR IGNORE INTO badges (id, earned_at) VALUES (?, ?)', [id, nowIso()]);
  return r.changes === 1;
}
