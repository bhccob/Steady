import type { D1Database } from '@cloudflare/workers-types';

import type { Account, AccountStore, LoginCode, StoredBackup } from './accountTypes';

// The AccountStore on Cloudflare D1 (tables in migrations/0002_accounts.sql).

interface AccountRow {
  id: string;
  email_hash: string;
  active_device: string | null;
  created_at: number;
}

interface CodeRow {
  email_hash: string;
  code_hash: string;
  expires_at: number;
  tries: number;
  sent_at: number;
}

interface SessionRow {
  token_hash: string;
  account_id: string;
  device_id: string;
  created_at: number;
  last_seen: number;
}

interface BackupRow {
  account_id: string;
  slot: number;
  device_id: string;
  saved_at: number;
  schema_version: number;
  iv: string;
  body: string;
}

const toAccount = (r: AccountRow): Account => ({ id: r.id, emailHash: r.email_hash, activeDevice: r.active_device, createdAt: r.created_at });
const toCode = (r: CodeRow): LoginCode => ({ emailHash: r.email_hash, codeHash: r.code_hash, expiresAt: r.expires_at, tries: r.tries, sentAt: r.sent_at });
const toBackup = (r: BackupRow): StoredBackup => ({
  accountId: r.account_id,
  slot: r.slot === 1 ? 1 : 0,
  deviceId: r.device_id,
  savedAt: r.saved_at,
  schemaVersion: r.schema_version,
  iv: r.iv,
  body: r.body,
});

export function d1AccountStore(db: D1Database): AccountStore {
  return {
    async accountByEmail(emailHash) {
      const row = await db.prepare('SELECT * FROM accounts WHERE email_hash = ?').bind(emailHash).first<AccountRow>();
      return row ? toAccount(row) : null;
    },
    async createAccount(a) {
      await db.prepare('INSERT INTO accounts (id, email_hash, active_device, created_at) VALUES (?, ?, ?, ?)').bind(a.id, a.emailHash, a.activeDevice, a.createdAt).run();
    },
    async setActiveDevice(accountId, deviceId) {
      await db.prepare('UPDATE accounts SET active_device = ? WHERE id = ?').bind(deviceId, accountId).run();
    },
    async deleteAccount(accountId) {
      await db.batch([
        db.prepare('DELETE FROM login_codes WHERE email_hash = (SELECT email_hash FROM accounts WHERE id = ?)').bind(accountId),
        db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId),
        db.prepare('DELETE FROM known_devices WHERE account_id = ?').bind(accountId),
        db.prepare('DELETE FROM backups WHERE account_id = ?').bind(accountId),
        db.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
      ]);
    },
    async putCode(c) {
      await db
        .prepare(
          'INSERT INTO login_codes (email_hash, code_hash, expires_at, tries, sent_at) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT(email_hash) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, tries = excluded.tries, sent_at = excluded.sent_at',
        )
        .bind(c.emailHash, c.codeHash, c.expiresAt, c.tries, c.sentAt)
        .run();
    },
    async getCode(emailHash) {
      const row = await db.prepare('SELECT * FROM login_codes WHERE email_hash = ?').bind(emailHash).first<CodeRow>();
      return row ? toCode(row) : null;
    },
    async bumpTries(emailHash) {
      await db.prepare('UPDATE login_codes SET tries = tries + 1 WHERE email_hash = ?').bind(emailHash).run();
    },
    async deleteCode(emailHash) {
      await db.prepare('DELETE FROM login_codes WHERE email_hash = ?').bind(emailHash).run();
    },
    async codesSentSince(emailHash, since) {
      const row = await db.prepare('SELECT COUNT(*) AS n FROM code_sends WHERE email_hash = ? AND sent_at >= ?').bind(emailHash, since).first<{ n: number }>();
      return row?.n ?? 0;
    },
    async noteCodeSent(emailHash, at) {
      await db.prepare('INSERT INTO code_sends (email_hash, sent_at) VALUES (?, ?)').bind(emailHash, at).run();
    },
    async createSession(s) {
      await db
        .prepare('INSERT INTO sessions (token_hash, account_id, device_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
        .bind(s.tokenHash, s.accountId, s.deviceId, s.createdAt, s.lastSeen)
        .run();
    },
    async sessionByToken(tokenHash) {
      const row = await db
        .prepare(
          'SELECT s.*, a.email_hash, a.active_device, a.created_at AS account_created_at FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?',
        )
        .bind(tokenHash)
        .first<SessionRow & { email_hash: string; active_device: string | null; account_created_at: number }>();
      if (!row) return null;
      return {
        tokenHash: row.token_hash,
        accountId: row.account_id,
        deviceId: row.device_id,
        createdAt: row.created_at,
        lastSeen: row.last_seen,
        account: { id: row.account_id, emailHash: row.email_hash, activeDevice: row.active_device, createdAt: row.account_created_at },
      };
    },
    async touchSession(tokenHash, at) {
      await db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').bind(at, tokenHash).run();
    },
    async deleteSession(tokenHash) {
      await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    },
    async deleteSessions(accountId) {
      await db.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId).run();
    },
    async knowsDevice(accountId, deviceId) {
      const row = await db.prepare('SELECT 1 AS yes FROM known_devices WHERE account_id = ? AND device_id = ?').bind(accountId, deviceId).first<{ yes: number }>();
      return row !== null;
    },
    async noteDevice(accountId, deviceId) {
      await db.prepare('INSERT OR IGNORE INTO known_devices (account_id, device_id) VALUES (?, ?)').bind(accountId, deviceId).run();
    },
    async putBackup(b) {
      await db.batch([
        db.prepare('DELETE FROM backups WHERE account_id = ? AND slot = 1').bind(b.accountId),
        db.prepare('UPDATE backups SET slot = 1 WHERE account_id = ? AND slot = 0').bind(b.accountId),
        db
          .prepare('INSERT INTO backups (account_id, slot, device_id, saved_at, schema_version, iv, body) VALUES (?, 0, ?, ?, ?, ?, ?)')
          .bind(b.accountId, b.deviceId, b.savedAt, b.schemaVersion, b.iv, b.body),
      ]);
    },
    async getBackup(accountId, slot) {
      const row = await db.prepare('SELECT * FROM backups WHERE account_id = ? AND slot = ?').bind(accountId, slot).first<BackupRow>();
      return row ? toBackup(row) : null;
    },
  };
}
