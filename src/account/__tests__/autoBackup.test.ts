import { createProfile } from '../../db/dao/profile';
import { migrate } from '../../db/migrations';
import { createTestDb } from '../../test-utils/sqlite';
import { AccountError, type AccountApi } from '../api';
import { backupDue, runBackup } from '../autoBackup';
import type { AccountSession } from '../types';

const NOW = Date.parse('2026-11-01T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('backupDue', () => {
  it('backs up after a change or on leaving the app only when something changed', () => {
    for (const reason of ['change', 'background'] as const) {
      expect(backupDue({ dirty: true, lastSavedAt: NOW, now: NOW, reason })).toBe(true);
      expect(backupDue({ dirty: false, lastSavedAt: null, now: NOW, reason })).toBe(false);
    }
  });

  it('backs up on start when something changed, nothing is saved yet, or the last save is over a day old', () => {
    expect(backupDue({ dirty: true, lastSavedAt: NOW, now: NOW, reason: 'start' })).toBe(true);
    expect(backupDue({ dirty: false, lastSavedAt: null, now: NOW, reason: 'start' })).toBe(true);
    expect(backupDue({ dirty: false, lastSavedAt: NOW - DAY, now: NOW, reason: 'start' })).toBe(false);
    expect(backupDue({ dirty: false, lastSavedAt: NOW - DAY - 1, now: NOW, reason: 'start' })).toBe(true);
  });
});

describe('runBackup', () => {
  const session: AccountSession = { token: 't'.repeat(43), email: 'sam@example.com', savedAt: null };

  async function setup(put: AccountApi['putBackup'], withProfile = true) {
    const db = createTestDb();
    await migrate(db);
    if (withProfile) await createProfile(db, { displayName: 'sam', timezone: 'UTC' });
    const puts: unknown[] = [];
    const api = {
      putBackup: async (token: string, backup: unknown) => {
        puts.push(backup);
        return put(token, backup as never);
      },
    } as unknown as AccountApi;
    const saved: AccountSession[] = [];
    const run = () => runBackup({ db, api, session, now: NOW, save: async (s) => void saved.push(s) });
    return { run, puts, saved };
  }

  it('skips a device that has not finished setup, without asking the server', async () => {
    const { run, puts } = await setup(async () => {}, false);
    expect(await run()).toBe('skipped');
    expect(puts).toHaveLength(0);
  });

  it('saves the whole export and remembers when', async () => {
    const { run, puts, saved } = await setup(async () => {});
    expect(await run()).toBe('saved');
    expect(puts[0]).toMatchObject({ app: 'Steady', tables: { profile: [expect.objectContaining({ display_name: 'sam' })] } });
    expect(saved).toEqual([{ ...session, savedAt: NOW }]);
  });

  it('stops when another device holds the backup', async () => {
    const { run, saved } = await setup(async () => {
      throw new AccountError(409, 'other-device');
    });
    expect(await run()).toBe('elsewhere');
    expect(saved).toHaveLength(0);
  });

  it('signs this device out when the server no longer knows it', async () => {
    const { run } = await setup(async () => {
      throw new AccountError(401);
    });
    expect(await run()).toBe('signed-out');
  });

  it('waits for the next chance when offline or the server fails', async () => {
    expect(await (await setup(async () => Promise.reject(new TypeError('Network request failed')))).run()).toBe('offline');
    expect(await (await setup(async () => Promise.reject(new AccountError(503)))).run()).toBe('offline');
  });
});
