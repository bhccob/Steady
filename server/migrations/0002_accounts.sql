-- Optional accounts with a backup (docs/superpowers/specs/2026-10-30-email-account-backup-design.md).
-- No email address is kept: only a keyed hash of it. Codes and session tokens are kept hashed, and
-- backup bodies arrive sealed (gzip, then AES-GCM with a key that lives only in Worker secrets).

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  active_device TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE login_codes (
  email_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  tries INTEGER NOT NULL,
  sent_at INTEGER NOT NULL
);

CREATE TABLE code_sends (
  email_hash TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);

CREATE INDEX code_sends_by_email ON code_sends (email_hash, sent_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE INDEX sessions_by_account ON sessions (account_id);

CREATE TABLE known_devices (
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  PRIMARY KEY (account_id, device_id)
);

CREATE TABLE backups (
  account_id TEXT NOT NULL,
  slot INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  schema_version INTEGER NOT NULL,
  iv TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (account_id, slot)
);
