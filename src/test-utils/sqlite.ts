// In-memory SQLite for tests, exposing the slice of expo-sqlite's async API the DAO uses.
// Real SQL engine, so constraints, cascades and ON CONFLICT behave as on device.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db } from '../db/types';

type Params = SQLInputValue[];

function toParams(args: unknown[]): Params {
  if (args.length === 1 && Array.isArray(args[0])) return args[0] as Params;
  return args as Params;
}

export function createTestDb(): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');

  const db = {
    raw,
    async execAsync(source: string) {
      raw.exec(source);
    },
    async runAsync(source: string, ...args: unknown[]) {
      const r = raw.prepare(source).run(...toParams(args));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync(source: string, ...args: unknown[]) {
      return (raw.prepare(source).get(...toParams(args)) as unknown) ?? null;
    },
    async getAllAsync(source: string, ...args: unknown[]) {
      return raw.prepare(source).all(...toParams(args)) as unknown[];
    },
    async withTransactionAsync(task: () => Promise<void>) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };

  return db as unknown as Db & { raw: DatabaseSync };
}
