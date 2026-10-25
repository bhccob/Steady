import { TABLES, type TableName } from '../db/schema';
import type { Db } from '../db/types';

export interface SteadyExport {
  app: 'Steady';
  schemaVersion: number;
  exportedAt: string;
  /** Every table, every row, exactly as stored. */
  tables: Record<TableName, Record<string, unknown>[]>;
}

/** Everything Steady keeps on this phone, for the user to save or share (spec §8.5). */
export async function exportData(db: Db, now: string): Promise<SteadyExport> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const tables = {} as SteadyExport['tables'];
  for (const t of TABLES) tables[t] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`, []);
  return { app: 'Steady', schemaVersion: version?.user_version ?? 0, exportedAt: now, tables };
}

/** Removes every row from every table, in one go. The caller also cancels reminders and removes export files. */
export async function deleteEverything(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`, []);
  });
}
