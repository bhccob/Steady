import { createProfile } from '../../db/dao/profile';
import { listDosesBetween } from '../../db/dao/doses';
import { migrate } from '../../db/migrations';
import { exportData } from '../../settings/data';
import { saveMed } from '../../settings/meds';
import { createTestDb } from '../../test-utils/sqlite';
import type { AccountApi } from '../api';
import { hasLocalData, restoreFromBackup } from '../flow';

const NOW = '2026-10-25T10:00:00.000Z';

async function backupOfSam() {
  const db = createTestDb();
  await migrate(db);
  await createProfile(db, { displayName: 'sam ', timezone: 'UTC' });
  await saveMed(db, { label: 'iron', amount: '', form: 'pill', color: '#F5DA6B', times: [480], days: [] }, { now: NOW, timezone: 'UTC', notBefore: NOW });
  return exportData(db, NOW);
}

describe('restoreFromBackup', () => {
  it('brings the backup onto an empty device, takes the backup over, and says who is back', async () => {
    const data = await backupOfSam();
    const db = createTestDb();
    await migrate(db);
    expect(await hasLocalData(db)).toBe(false);
    const calls: string[] = [];
    const api = {
      getBackup: async () => ({ savedAt: 1, schemaVersion: data.schemaVersion, data }),
      claim: async () => void calls.push('claim'),
    } as unknown as AccountApi;
    expect(await restoreFromBackup({ db, api, token: 't'.repeat(43) })).toEqual({ name: 'sam' });
    expect(calls).toEqual(['claim']);
    expect(await hasLocalData(db)).toBe(true);
    expect((await listDosesBetween(db, '2026-10-26', '2026-10-26')).length).toBeGreaterThan(0);
  });

  it('leaves the device alone and does not take over when there is no backup', async () => {
    const db = createTestDb();
    await migrate(db);
    const calls: string[] = [];
    const api = { getBackup: async () => null, claim: async () => void calls.push('claim') } as unknown as AccountApi;
    await expect(restoreFromBackup({ db, api, token: 't'.repeat(43) })).rejects.toThrow('No backup');
    expect(calls).toEqual([]);
    expect(await hasLocalData(db)).toBe(false);
  });
});
