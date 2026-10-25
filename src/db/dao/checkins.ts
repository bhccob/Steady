import { newId } from '../../lib/id';
import { nowIso, type LocalDate } from '../../lib/time';
import type { Mood } from '../schema';
import type { Db } from '../types';

export interface Checkin {
  id: string;
  dateLocal: LocalDate;
  mood: Mood;
  createdAt: string;
}

interface CheckinRow {
  id: string;
  date_local: string;
  mood: Mood;
  created_at: string;
}

function fromRow(r: CheckinRow): Checkin {
  return { id: r.id, dateLocal: r.date_local, mood: r.mood, createdAt: r.created_at };
}

export async function getCheckin(db: Db, date: LocalDate): Promise<Checkin | null> {
  const r = await db.getFirstAsync<CheckinRow>('SELECT * FROM checkins WHERE date_local = ?', [date]);
  return r ? fromRow(r) : null;
}

/** Every day's mood, oldest first. One row per day, so this stays small. */
export async function listCheckins(db: Db): Promise<Checkin[]> {
  return (await db.getAllAsync<CheckinRow>('SELECT * FROM checkins ORDER BY date_local')).map(fromRow);
}

/** Close's evening check-in: one per day, kept apart from the morning mood. */
export async function getEveningCheckin(db: Db, date: LocalDate): Promise<Checkin | null> {
  const r = await db.getFirstAsync<CheckinRow>('SELECT * FROM evening_checkins WHERE date_local = ?', [date]);
  return r ? fromRow(r) : null;
}

export async function upsertEveningCheckin(db: Db, date: LocalDate, mood: Mood): Promise<void> {
  await db.runAsync(
    `INSERT INTO evening_checkins (id, date_local, mood, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (date_local) DO UPDATE SET mood = excluded.mood`,
    [newId(), date, mood, nowIso()],
  );
}

/** One mood per local day; tapping again changes it. */
export async function upsertCheckin(db: Db, date: LocalDate, mood: Mood): Promise<void> {
  await db.runAsync(
    `INSERT INTO checkins (id, date_local, mood, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (date_local) DO UPDATE SET mood = excluded.mood`,
    [newId(), date, mood, nowIso()],
  );
}
