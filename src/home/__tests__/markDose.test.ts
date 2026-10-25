import { getDose, insertPendingDose, listDosesBetween, setDoseStatus } from '../../db/dao/doses';
import { listEvents } from '../../db/dao/events';
import { insertMed } from '../../db/dao/meds';
import { migrate } from '../../db/migrations';
import { createTestDb } from '../../test-utils/sqlite';
import { markDose } from '../markDose';

async function setup() {
  const db = createTestDb();
  await migrate(db);
  const med = await insertMed(db, { label: null });
  const add = async (dueAtUtc: string) => {
    await insertPendingDose(db, { medId: med.id, dueAtUtc, dueLocalDate: dueAtUtc.slice(0, 10) });
    const all = await listDosesBetween(db, '2000-01-01', '2100-01-01');
    return all.find((d) => d.dueAtUtc === dueAtUtc)!.id;
  };
  return { db, add };
}

describe('markDose', () => {
  it('marks a due dose on time and logs it', async () => {
    const { db, add } = await setup();
    const id = await add('2026-10-24T08:00:00.000Z');
    expect(await markDose(db, { doseId: id, nowUtc: '2026-10-24T08:05:00.000Z' })).toEqual({ status: 'taken_ontime', backfilled: false, comeback: false });
    expect(await getDose(db, id)).toMatchObject({ status: 'taken_ontime', takenAtUtc: '2026-10-24T08:05:00.000Z' });
    expect((await listEvents(db)).map((e) => e.type)).toContain('dose_marked');
  });

  it('does nothing for a dose that is already marked', async () => {
    const { db, add } = await setup();
    const id = await add('2026-10-24T08:00:00.000Z');
    await markDose(db, { doseId: id, nowUtc: '2026-10-24T08:05:00.000Z' });
    expect(await markDose(db, { doseId: id, nowUtc: '2026-10-24T09:00:00.000Z' })).toBeNull();
    expect((await getDose(db, id))?.takenAtUtc).toBe('2026-10-24T08:05:00.000Z');
  });

  it('flags a mark made after the grace window as added later', async () => {
    const { db, add } = await setup();
    const id = await add('2026-10-24T08:00:00.000Z');
    expect(await markDose(db, { doseId: id, nowUtc: '2026-10-24T14:00:00.000Z' })).toMatchObject({ status: 'taken_late', backfilled: true });
  });

  it('refuses a dose more than 24 hours past due', async () => {
    const { db, add } = await setup();
    const id = await add('2026-10-22T08:00:00.000Z');
    expect(await markDose(db, { doseId: id, nowUtc: '2026-10-24T08:00:00.000Z' })).toBeNull();
    expect((await getDose(db, id))?.status).toBe('pending');
  });

  it('celebrates a comeback once after a missed dose', async () => {
    const { db, add } = await setup();
    const missed = await add('2026-10-22T08:00:00.000Z');
    await setDoseStatus(db, missed, { status: 'missed' });
    const a = await add('2026-10-24T08:00:00.000Z');
    const b = await add('2026-10-24T20:00:00.000Z');
    expect((await markDose(db, { doseId: a, nowUtc: '2026-10-24T08:05:00.000Z' }))?.comeback).toBe(true);
    expect((await markDose(db, { doseId: b, nowUtc: '2026-10-24T20:05:00.000Z' }))?.comeback).toBe(false);
    expect((await listEvents(db)).filter((e) => e.type === 'comeback')).toHaveLength(1);
  });
});
