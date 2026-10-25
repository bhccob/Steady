import { upsertCheckin } from '../../db/dao/checkins';
import { logEvent } from '../../db/dao/events';
import { createProfile } from '../../db/dao/profile';
import { migrate } from '../../db/migrations';
import { TABLES } from '../../db/schema';
import { createTestDb } from '../../test-utils/sqlite';
import { deleteEverything, exportData } from '../data';
import { saveMed } from '../meds';

const NOW = '2026-10-25T10:00:00.000Z';

async function filledDb() {
  const db = createTestDb();
  await migrate(db);
  await createProfile(db, { displayName: 'sam', timezone: 'UTC' });
  await saveMed(db, { label: 'vitamin d', amount: '', form: 'pill', color: '#F5DA6B', times: [480], days: [] }, { now: NOW, timezone: 'UTC', notBefore: NOW });
  await upsertCheckin(db, '2026-10-25', 'okay');
  await logEvent(db, 'test', { at: NOW });
  return db;
}

const rowCount = (db: Awaited<ReturnType<typeof filledDb>>, table: string) =>
  db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`, []).then((r) => r?.n ?? 0);

describe('exportData', () => {
  it('includes every table, with its rows', async () => {
    const db = await filledDb();
    const out = await exportData(db, NOW);
    expect(Object.keys(out.tables).sort()).toEqual([...TABLES].sort());
    expect(out.tables.profile).toEqual([expect.objectContaining({ display_name: 'sam' })]);
    expect(out.tables.meds).toEqual([expect.objectContaining({ label: 'vitamin d' })]);
    expect(out.tables.doses.length).toBeGreaterThan(0);
    expect(out).toMatchObject({ app: 'Steady', exportedAt: NOW });
    expect(out.schemaVersion).toBeGreaterThan(0);
  });

  it('survives a trip through JSON unchanged', async () => {
    const db = await filledDb();
    const out = await exportData(db, NOW);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});

describe('deleteEverything', () => {
  it('leaves zero rows in every table', async () => {
    const db = await filledDb();
    await deleteEverything(db);
    for (const t of TABLES) expect(await rowCount(db, t)).toBe(0);
  });
});
