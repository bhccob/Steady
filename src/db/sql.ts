import type { SQLiteBindValue } from 'expo-sqlite';

/** Booleans are stored as 0/1, undefined as NULL. */
export function toSql(value: unknown): SQLiteBindValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) return null;
  return value as SQLiteBindValue;
}

/** `col = ?` pairs for the defined keys of a camelCase patch. */
export function setClause<K extends string>(
  patch: Partial<Record<K, unknown>>,
  columns: Record<K, string>,
): { sql: string; values: SQLiteBindValue[] } {
  const keys = (Object.keys(patch) as K[]).filter((k) => patch[k] !== undefined);
  return {
    sql: keys.map((k) => `${columns[k]} = ?`).join(', '),
    values: keys.map((k) => toSql(patch[k])),
  };
}
