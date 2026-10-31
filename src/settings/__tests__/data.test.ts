import { upsertCheckin } from '../../db/dao/checkins';
import { logEvent } from '../../db/dao/events';
import { createProfile } from '../../db/dao/profile';
import { migrate } from '../../db/migrations';
import { TABLES } from '../../db/schema';
import { createTestDb } from '../../test-utils/sqlite';
import { deleteEverything, exportData, importData, NewerBackupError } from '../data';
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

describe('importData', () => {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  it('restores an export exactly', async () => {
    const db = await filledDb();
    const saved = await exportData(db, NOW);
    await saveMed(db, { label: 'iron', amount: '', form: 'capsule', color: '#2A2826', times: [1140], days: [] }, { now: NOW, timezone: 'UTC', notBefore: NOW });
    await upsertCheckin(db, '2026-10-26', 'rough');
    await importData(db, clone(saved));
    expect((await exportData(db, NOW)).tables).toEqual(saved.tables);
  });

  it('keeps the device data when a backup row is bad', async () => {
    const db = await filledDb();
    const before = await exportData(db, NOW);
    const bad = clone(before);
    bad.tables.meds = [];
    delete (bad.tables.doses[0] as Record<string, unknown>).med_id;
    await expect(importData(db, bad)).rejects.toThrow();
    expect((await exportData(db, NOW)).tables).toEqual(before.tables);
  });

  it('refuses a backup from a newer version of Steady', async () => {
    const db = await filledDb();
    const before = await exportData(db, NOW);
    await expect(importData(db, { ...clone(before), schemaVersion: 999, tables: { ...clone(before).tables, meds: [] } })).rejects.toBeInstanceOf(NewerBackupError);
    expect((await exportData(db, NOW)).tables).toEqual(before.tables);
  });

  it('restores an older backup that lacks a newer column', async () => {
    const db = await filledDb();
    const old = clone(await exportData(db, NOW));
    old.schemaVersion -= 1;
    for (const m of old.tables.meds) delete (m as Record<string, unknown>).sort_order;
    await importData(db, old);
    expect((await exportData(db, NOW)).tables.meds).toEqual([expect.objectContaining({ label: 'vitamin d', sort_order: 0 })]);
  });

  it('round-trips a year of doses', async () => {
    const db = await filledDb();
    const year = clone(await exportData(db, NOW));
    const dose = year.tables.doses[0]!;
    year.tables.doses = Array.from({ length: 2000 }, (_, i) => ({
      ...dose,
      id: `dose-${i}`,
      due_at_utc: new Date(Date.UTC(2025, 9, 25) + i * 4.38 * 3_600_000).toISOString(),
      status: i % 9 ? 'taken_ontime' : 'pending',
    }));
    await importData(db, year);
    expect((await exportData(db, NOW)).tables.doses).toEqual(year.tables.doses);
  });
});

describe('deleteEverything', () => {
  it('leaves zero rows in every table', async () => {
    const db = await filledDb();
    await deleteEverything(db);
    for (const t of TABLES) expect(await rowCount(db, t)).toBe(0);
  });
});
