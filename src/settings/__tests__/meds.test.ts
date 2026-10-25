import { listDosesBetween, setDoseStatus } from '../../db/dao/doses';
import { listMeds } from '../../db/dao/meds';
import { createProfile } from '../../db/dao/profile';
import { listSchedules } from '../../db/dao/schedules';
import { migrate } from '../../db/migrations';
import { createTestDb } from '../../test-utils/sqlite';
import { archiveMed, saveMed, type MedInput } from '../meds';

const NOW = '2026-10-25T10:00:00.000Z';
const OPTS = { now: NOW, timezone: 'UTC', notBefore: '2026-10-01T00:00:00.000Z' };
const PILL: MedInput = { label: 'vitamin d', amount: '1 tablet', form: 'pill', color: '#F5DA6B', times: [20 * 60], days: [] };

async function freshDb() {
  const db = createTestDb();
  await migrate(db);
  await createProfile(db, { displayName: 'sam', timezone: 'UTC' });
  return db;
}

const dosesOf = async (db: Awaited<ReturnType<typeof freshDb>>, medId: string) =>
  (await listDosesBetween(db, '2026-10-01', '2026-12-31')).filter((d) => d.medId === medId);

describe('saveMed', () => {
  it('adds a med with its schedule and creates its upcoming doses', async () => {
    const db = await freshDb();
    const id = await saveMed(db, PILL, OPTS);
    expect(await listMeds(db)).toEqual([expect.objectContaining({ id, label: 'vitamin d', doseAmount: '1 tablet', color: '#F5DA6B' })]);
    expect(await listSchedules(db)).toEqual([expect.objectContaining({ medId: id, times: ['20:00'], days: [] })]);
    const doses = await dosesOf(db, id);
    expect(doses.length).toBeGreaterThan(0);
    expect(doses[0]!.dueAtUtc).toBe('2026-10-25T20:00:00.000Z');
  });

  it('saves a blank name as "my pill"', async () => {
    const db = await freshDb();
    const id = await saveMed(db, { ...PILL, label: '   ' }, OPTS);
    expect((await listMeds(db)).find((m) => m.id === id)?.label).toBeNull();
  });

  it('moves future doses to the new time when the time changes', async () => {
    const db = await freshDb();
    const id = await saveMed(db, PILL, OPTS);
    await saveMed(db, { ...PILL, id, times: [9 * 60, 21 * 60] }, OPTS);
    const upcoming = (await dosesOf(db, id)).filter((d) => d.dueAtUtc > NOW && d.dueLocalDate <= '2026-10-26').map((d) => d.dueAtUtc);
    expect(upcoming.sort()).toEqual(['2026-10-25T21:00:00.000Z', '2026-10-26T09:00:00.000Z', '2026-10-26T21:00:00.000Z']);
    expect(await listSchedules(db)).toHaveLength(1);
  });

  it('never touches doses already marked', async () => {
    const db = await freshDb();
    const id = await saveMed(db, PILL, { ...OPTS, now: '2026-10-24T10:00:00.000Z' });
    const marked = (await dosesOf(db, id)).find((d) => d.dueLocalDate === '2026-10-24')!;
    await setDoseStatus(db, marked.id, { status: 'taken_ontime', takenAtUtc: '2026-10-24T20:05:00.000Z' });
    await saveMed(db, { ...PILL, id, times: [8 * 60] }, OPTS);
    expect((await dosesOf(db, id)).find((d) => d.id === marked.id)).toMatchObject({ status: 'taken_ontime' });
  });

  it('keeps names and other details when editing', async () => {
    const db = await freshDb();
    const id = await saveMed(db, PILL, OPTS);
    await saveMed(db, { ...PILL, id, label: 'vit d', form: 'capsule' }, OPTS);
    expect(await listMeds(db)).toEqual([expect.objectContaining({ id, label: 'vit d', form: 'capsule' })]);
  });
});

describe('archiveMed', () => {
  it('hides the med and its unmarked doses but keeps its history', async () => {
    const db = await freshDb();
    const id = await saveMed(db, PILL, { ...OPTS, now: '2026-10-24T10:00:00.000Z' });
    const marked = (await dosesOf(db, id)).find((d) => d.dueLocalDate === '2026-10-24')!;
    await setDoseStatus(db, marked.id, { status: 'taken_ontime', takenAtUtc: '2026-10-24T20:05:00.000Z' });
    await archiveMed(db, id);
    expect(await listMeds(db)).toEqual([]);
    expect((await dosesOf(db, id)).map((d) => d.id)).toEqual([marked.id]);
  });
});
