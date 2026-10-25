import { nowIso, type LocalDate } from '../../lib/time';
import type { Db } from '../types';

export interface CollectedTrophy {
  /** Monday of the week, local date. */
  weekStart: LocalDate;
  daysMarked: number;
  collectedAt: string;
}

export async function listTrophies(db: Db): Promise<CollectedTrophy[]> {
  const rows = await db.getAllAsync<{ week_start: string; days_marked: number; collected_at: string }>(
    'SELECT * FROM trophies ORDER BY week_start',
    [],
  );
  return rows.map((r) => ({ weekStart: r.week_start, daysMarked: r.days_marked, collectedAt: r.collected_at }));
}

/** Returns true only the first time a week's trophy is collected. */
export async function collectTrophy(db: Db, weekStart: LocalDate, daysMarked: number): Promise<boolean> {
  const r = await db.runAsync('INSERT OR IGNORE INTO trophies (week_start, days_marked, collected_at) VALUES (?, ?, ?)', [
    weekStart,
    daysMarked,
    nowIso(),
  ]);
  return r.changes === 1;
}
