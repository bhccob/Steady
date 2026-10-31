// What the server keeps for accounts (spec: docs/superpowers/specs/2026-10-30-email-account-backup-design.md).
// Never an email address: only a keyed hash of it. Codes and tokens are kept hashed too, and a
// backup body is sealed (AES-GCM over the gzip the phone sent) before it gets here.

export interface Account {
  id: string;
  /** HMAC of the normalised email address, hex. */
  emailHash: string;
  /** The one device whose backups are accepted; null until a device signs in. */
  activeDevice: string | null;
  createdAt: number;
}

export interface LoginCode {
  emailHash: string;
  codeHash: string;
  expiresAt: number;
  tries: number;
  sentAt: number;
}

export interface Session {
  /** SHA-256 of the session token, hex. The token itself is never stored. */
  tokenHash: string;
  accountId: string;
  deviceId: string;
  createdAt: number;
  lastSeen: number;
}

export interface StoredBackup {
  accountId: string;
  /** 0 is the latest backup, 1 the one before it. */
  slot: 0 | 1;
  deviceId: string;
  savedAt: number;
  schemaVersion: number;
  /** Base64 AES-GCM IV and sealed body. */
  iv: string;
  body: string;
}

export interface AccountStore {
  accountByEmail(emailHash: string): Promise<Account | null>;
  createAccount(a: Account): Promise<void>;
  setActiveDevice(accountId: string, deviceId: string): Promise<void>;
  /** Removes the account with its sessions, backups, known devices and codes. */
  deleteAccount(accountId: string): Promise<void>;

  putCode(c: LoginCode): Promise<void>;
  getCode(emailHash: string): Promise<LoginCode | null>;
  bumpTries(emailHash: string): Promise<void>;
  deleteCode(emailHash: string): Promise<void>;
  /** How many codes went to this address since `since` (ms). */
  codesSentSince(emailHash: string, since: number): Promise<number>;
  noteCodeSent(emailHash: string, at: number): Promise<void>;

  createSession(s: Session): Promise<void>;
  sessionByToken(tokenHash: string): Promise<(Session & { account: Account }) | null>;
  touchSession(tokenHash: string, at: number): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteSessions(accountId: string): Promise<void>;

  knowsDevice(accountId: string, deviceId: string): Promise<boolean>;
  noteDevice(accountId: string, deviceId: string): Promise<void>;

  /** Moves the latest backup to slot 1, then writes this one as slot 0. */
  putBackup(b: StoredBackup): Promise<void>;
  getBackup(accountId: string, slot: 0 | 1): Promise<StoredBackup | null>;
}
