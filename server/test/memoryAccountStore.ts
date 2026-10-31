import type { Account, AccountStore, LoginCode, Session, StoredBackup } from '../src/accountTypes';

/** The AccountStore in memory, for tests. `dump()` shows everything it holds. */
export function memoryAccountStore(): AccountStore & { dump(): unknown } {
  const accounts = new Map<string, Account>();
  const codes = new Map<string, LoginCode>();
  let sends: { emailHash: string; at: number }[] = [];
  const sessions = new Map<string, Session>();
  const devices = new Set<string>();
  const backups = new Map<string, StoredBackup>();
  const deviceKey = (a: string, d: string) => `${a}|${d}`;
  const backupKey = (a: string, slot: 0 | 1) => `${a}|${slot}`;

  return {
    async accountByEmail(emailHash) {
      return [...accounts.values()].find((a) => a.emailHash === emailHash) ?? null;
    },
    async createAccount(a) {
      accounts.set(a.id, { ...a });
    },
    async setActiveDevice(accountId, deviceId) {
      const a = accounts.get(accountId);
      if (a) a.activeDevice = deviceId;
    },
    async deleteAccount(accountId) {
      const a = accounts.get(accountId);
      accounts.delete(accountId);
      if (a) codes.delete(a.emailHash);
      for (const [k, s] of sessions) if (s.accountId === accountId) sessions.delete(k);
      for (const k of devices) if (k.startsWith(`${accountId}|`)) devices.delete(k);
      backups.delete(backupKey(accountId, 0));
      backups.delete(backupKey(accountId, 1));
    },
    async putCode(c) {
      codes.set(c.emailHash, { ...c });
    },
    async getCode(emailHash) {
      const c = codes.get(emailHash);
      return c ? { ...c } : null;
    },
    async bumpTries(emailHash) {
      const c = codes.get(emailHash);
      if (c) c.tries += 1;
    },
    async deleteCode(emailHash) {
      codes.delete(emailHash);
    },
    async codesSentSince(emailHash, since) {
      return sends.filter((s) => s.emailHash === emailHash && s.at >= since).length;
    },
    async noteCodeSent(emailHash, at) {
      sends = [...sends, { emailHash, at }];
    },
    async createSession(s) {
      sessions.set(s.tokenHash, { ...s });
    },
    async sessionByToken(tokenHash) {
      const s = sessions.get(tokenHash);
      const account = s && accounts.get(s.accountId);
      return s && account ? { ...s, account: { ...account } } : null;
    },
    async touchSession(tokenHash, at) {
      const s = sessions.get(tokenHash);
      if (s) s.lastSeen = at;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },
    async deleteSessions(accountId) {
      for (const [k, s] of sessions) if (s.accountId === accountId) sessions.delete(k);
    },
    async knowsDevice(accountId, deviceId) {
      return devices.has(deviceKey(accountId, deviceId));
    },
    async noteDevice(accountId, deviceId) {
      devices.add(deviceKey(accountId, deviceId));
    },
    async backupSavedAt(accountId) {
      return backups.get(backupKey(accountId, 0))?.savedAt ?? null;
    },
    async putBackup(b) {
      const latest = backups.get(backupKey(b.accountId, 0));
      if (latest) backups.set(backupKey(b.accountId, 1), { ...latest, slot: 1 });
      backups.set(backupKey(b.accountId, 0), { ...b, slot: 0 });
    },
    async getBackup(accountId, slot) {
      const b = backups.get(backupKey(accountId, slot));
      return b ? { ...b } : null;
    },
    dump() {
      return {
        accounts: [...accounts.values()],
        codes: [...codes.values()],
        sends,
        sessions: [...sessions.values()],
        devices: [...devices],
        backups: [...backups.values()],
      };
    },
  };
}
