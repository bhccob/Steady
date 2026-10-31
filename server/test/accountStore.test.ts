import { describe, expect, it } from 'vitest';

import type { StoredBackup } from '../src/accountTypes';
import { memoryAccountStore } from './memoryAccountStore';

const backup = (accountId: string, savedAt: number): StoredBackup => ({ accountId, slot: 0, deviceId: 'D'.repeat(22), savedAt, schemaVersion: 7, iv: 'aXY=', body: `body-${savedAt}` });

describe('account store', () => {
  it('keeps the latest backup in slot 0 and the one before in slot 1', async () => {
    const store = memoryAccountStore();
    await store.createAccount({ id: 'acct-a', emailHash: 'hash-a', activeDevice: null, createdAt: 0 });
    for (const t of [1, 2, 3]) await store.putBackup(backup('acct-a', t));
    expect((await store.getBackup('acct-a', 0))?.savedAt).toBe(3);
    expect((await store.getBackup('acct-a', 1))?.savedAt).toBe(2);
  });

  it('deleting an account removes its sessions, backups, devices and nothing else', async () => {
    const store = memoryAccountStore();
    for (const id of ['acct-a', 'acct-b']) {
      await store.createAccount({ id, emailHash: `hash-${id}`, activeDevice: null, createdAt: 0 });
      await store.createSession({ tokenHash: `token-${id}`, accountId: id, deviceId: 'D'.repeat(22), createdAt: 0, lastSeen: 0 });
      await store.noteDevice(id, 'D'.repeat(22));
      await store.putBackup(backup(id, 1));
    }
    await store.deleteAccount('acct-a');
    expect(await store.sessionByToken('token-acct-b')).toMatchObject({ accountId: 'acct-b', account: { id: 'acct-b' } });
    expect(await store.getBackup('acct-b', 0)).not.toBeNull();
    expect(await store.sessionByToken('token-acct-a')).toBeNull();
    expect(JSON.stringify(store.dump())).not.toContain('acct-a');
  });
});
