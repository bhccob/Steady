import type { D1Database } from '@cloudflare/workers-types';

import type { DueReminder, Install, Kind, Store } from './types';

// The Store on Cloudflare D1 (tables in migrations/0001_init.sql).

interface InstallRow {
  id: string;
  secret_hash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  touched_at: number;
}

interface ReminderRow {
  install_id: string;
  rid: string;
  due_at: number;
  kind: string;
}

const toInstall = (r: InstallRow): Install => ({ id: r.id, secretHash: r.secret_hash, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, touchedAt: r.touched_at });

export function d1Store(db: D1Database): Store {
  return {
    async getInstall(id) {
      const row = await db.prepare('SELECT * FROM installs WHERE id = ?').bind(id).first<InstallRow>();
      return row ? toInstall(row) : null;
    },
    async putInstall(i) {
      await db
        .prepare(
          'INSERT INTO installs (id, secret_hash, endpoint, p256dh, auth, touched_at) VALUES (?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT(id) DO UPDATE SET secret_hash = excluded.secret_hash, endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, touched_at = excluded.touched_at',
        )
        .bind(i.id, i.secretHash, i.endpoint, i.p256dh, i.auth, i.touchedAt)
        .run();
    },
    async replaceReminders(installId, list) {
      await db.batch([
        db.prepare('DELETE FROM reminders WHERE install_id = ?').bind(installId),
        ...list.map((r) => db.prepare('INSERT OR REPLACE INTO reminders (install_id, rid, due_at, kind) VALUES (?, ?, ?, ?)').bind(installId, r.rid, r.dueAt, r.kind)),
      ]);
    },
    async deleteInstall(id) {
      await db.batch([db.prepare('DELETE FROM reminders WHERE install_id = ?').bind(id), db.prepare('DELETE FROM installs WHERE id = ?').bind(id)]);
    },
    async due(now, limit) {
      const { results } = await db.prepare('SELECT * FROM reminders WHERE due_at <= ? ORDER BY due_at LIMIT ?').bind(now, limit).all<ReminderRow>();
      return results.map((r): DueReminder => ({ installId: r.install_id, rid: r.rid, dueAt: r.due_at, kind: r.kind as Kind }));
    },
    async deleteReminder(installId, rid) {
      await db.prepare('DELETE FROM reminders WHERE install_id = ? AND rid = ?').bind(installId, rid).run();
    },
    async staleInstalls(before) {
      const { results } = await db
        .prepare('SELECT id FROM installs WHERE touched_at < ? AND NOT EXISTS (SELECT 1 FROM reminders WHERE reminders.install_id = installs.id)')
        .bind(before)
        .all<{ id: string }>();
      return results.map((r) => r.id);
    },
    async countHit(key, windowStart) {
      const row = await db
        .prepare('INSERT INTO hits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count')
        .bind(key, windowStart)
        .first<{ count: number }>();
      return row?.count ?? 1;
    },
  };
}

/** Rate-limit counters only matter for their window: an hour at most, or a day for `day:` keys. */
export async function pruneHits(db: D1Database, now: number): Promise<void> {
  await db
    .prepare("DELETE FROM hits WHERE (key LIKE 'day:%' AND window_start < ?) OR (key NOT LIKE 'day:%' AND window_start < ?)")
    .bind(now - 2 * 24 * 60 * 60 * 1000, now - 2 * 60 * 60 * 1000)
    .run();
}
