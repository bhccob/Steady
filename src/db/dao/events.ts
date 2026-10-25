import { newId } from '../../lib/id';
import { nowIso } from '../../lib/time';
import type { Db } from '../types';

/** Local audit log. Never leaves the device except in a user-requested export. */
export interface AppEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

interface EventRow {
  id: string;
  type: string;
  payload_json: string | null;
  created_at: string;
}

export async function logEvent(db: Db, type: string, payload?: unknown): Promise<void> {
  await db.runAsync('INSERT INTO events (id, type, payload_json, created_at) VALUES (?, ?, ?, ?)', [
    newId(),
    type,
    payload === undefined ? null : JSON.stringify(payload),
    nowIso(),
  ]);
}

/** When the latest event of `type` was logged, or null. */
export async function lastEventAt(db: Db, type: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ created_at: string }>('SELECT created_at FROM events WHERE type = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', [type]);
  return r?.created_at ?? null;
}

/** Whether an event of `type` was logged with payload { date }. */
export async function hasEventForDate(db: Db, type: string, date: string): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM events WHERE type = ? AND json_extract(payload_json, '$.date') = ?", [type, date]);
  return (r?.n ?? 0) > 0;
}

/** Payloads of `type` events whose `at` is at or after `since`, oldest first. */
export async function eventsSince(db: Db, type: string, since: string): Promise<unknown[]> {
  const rows = await db.getAllAsync<{ payload_json: string }>(
    "SELECT payload_json FROM events WHERE type = ? AND json_extract(payload_json, '$.at') >= ? ORDER BY json_extract(payload_json, '$.at')",
    [type, since],
  );
  return rows.map((r) => JSON.parse(r.payload_json) as unknown);
}

/** The latest `at` among `type` events, or null. */
export async function latestEventTime(db: Db, type: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ at: string | null }>("SELECT max(json_extract(payload_json, '$.at')) AS at FROM events WHERE type = ?", [type]);
  return r?.at ?? null;
}

export async function listEvents(db: Db): Promise<AppEvent[]> {
  const rows = await db.getAllAsync<EventRow>('SELECT * FROM events ORDER BY created_at, rowid', []);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: r.payload_json === null ? null : (JSON.parse(r.payload_json) as unknown),
    createdAt: r.created_at,
  }));
}
