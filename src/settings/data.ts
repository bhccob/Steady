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

/** A backup made by a newer Steady, whose tables this version may not understand. */
export class NewerBackupError extends Error {
  constructor() {
    super('This backup is from a newer Steady.');
    this.name = 'NewerBackupError';
  }
}

/**
 * Replaces everything on this device with a backup, all or nothing: if any row fails, the device
 * keeps what it had. An older backup still fits (columns it lacks get their defaults); a newer one
 * is refused. The caller then rebuilds doses and reminders.
 */
export async function importData(db: Db, backup: SteadyExport): Promise<void> {
  if (!backup || typeof backup !== 'object' || !backup.tables || typeof backup.tables !== 'object') throw new Error('Not a Steady backup');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  if (backup.schemaVersion > (version?.user_version ?? 0)) throw new NewerBackupError();

  const columns = new Map<TableName, Set<string>>();
  for (const t of TABLES) columns.set(t, new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`, [])).map((c) => c.name)));

  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`, []);
    for (const t of TABLES) {
      const rows = backup.tables[t] ?? [];
      if (!Array.isArray(rows)) throw new Error(`Not a Steady backup: ${t}`);
      for (const row of rows) {
        // Only this device's own column names reach the SQL, so a backup can't inject any.
        const keys = Object.keys(row).filter((k) => columns.get(t)!.has(k));
        if (!keys.length) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k] as string | number | null),
        );
      }
    }
  });
}

/** Removes every row from every table, in one go. The caller also cancels reminders and removes export files. */
export async function deleteEverything(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`, []);
  });
}
