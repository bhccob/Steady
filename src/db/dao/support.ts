import { nowIso } from '../../lib/time';
import type { Severity } from '../schema';
import type { Db } from '../types';

/** What the user is working through. Local only; never leaves the phone except in their own export. */
export interface SupportCondition {
  name: string;
  severity: Severity;
}

export async function listConditions(db: Db): Promise<SupportCondition[]> {
  return db.getAllAsync<SupportCondition>('SELECT name, severity FROM support_conditions ORDER BY rowid', []);
}

/** Adds rows without opening a transaction, for callers that already hold one. */
export async function insertConditions(db: Db, conditions: readonly SupportCondition[]): Promise<void> {
  const at = nowIso();
  for (const c of conditions) {
    await db.runAsync('INSERT INTO support_conditions (name, severity, created_at) VALUES (?, ?, ?)', [c.name, c.severity, at]);
  }
}

/** Saves the full set: anything not in `conditions` is removed. */
export async function replaceConditions(db: Db, conditions: readonly SupportCondition[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM support_conditions', []);
    await insertConditions(db, conditions);
  });
}
