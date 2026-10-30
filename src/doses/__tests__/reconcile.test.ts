import { insertPendingDose, listDosesBetween } from '../../db/dao/doses';
import { insertMed } from '../../db/dao/meds';
import { insertSchedule } from '../../db/dao/schedules';
import { migrate } from '../../db/migrations';
import { createTestDb } from '../../test-utils/sqlite';
import { reconcileDoses } from '../reconcile';

async function setup() {
  const db = createTestDb();
  await migrate(db);
  // Taken since the start of the month, so the pill itself never limits which doses exist.
  const med = await insertMed(db, { label: null, createdAt: '2026-10-01T00:00:00.000Z' });
  await insertSchedule(db, { medId: med.id, times: ['08:00', '20:00'], days: [] });
  return { db, med };
}

describe('reconcileDoses', () => {
  it('creates pending doses for the coming days, once', async () => {
    const { db } = await setup();
    const opts = { now: '2026-10-24T05:00:00.000Z', timezone: 'UTC', days: 3, notBefore: '2026-10-01T00:00:00.000Z' };
    expect(await reconcileDoses(db, opts)).toBe(6);
    expect(await reconcileDoses(db, opts)).toBe(0);
    expect((await listDosesBetween(db, '2026-10-24', '2026-10-26')).length).toBe(6);
  });

  it('starts a pill added later from when it was added', async () => {
    const db = createTestDb();
    await migrate(db);
    const med = await insertMed(db, { label: null, createdAt: '2026-10-24T10:00:00.000Z' });
    await insertSchedule(db, { medId: med.id, times: ['08:00', '20:00'], days: [] });
    await reconcileDoses(db, { now: '2026-10-24T11:00:00.000Z', timezone: 'UTC', days: 1, notBefore: '2026-10-01T00:00:00.000Z' });
    expect((await listDosesBetween(db, '2026-10-24', '2026-10-24')).map((d) => d.dueAtUtc)).toEqual(['2026-10-24T20:00:00.000Z']);
  });

  it('does not create doses from before the user started', async () => {
    const { db } = await setup();
    await reconcileDoses(db, { now: '2026-10-24T10:00:00.000Z', timezone: 'UTC', days: 1, notBefore: '2026-10-24T09:30:00.000Z' });
    expect((await listDosesBetween(db, '2026-10-24', '2026-10-24')).map((d) => d.dueAtUtc)).toEqual(['2026-10-24T20:00:00.000Z']);
  });

  it('locks doses more than 24 hours past due', async () => {
    const { db, med } = await setup();
    await insertPendingDose(db, { medId: med.id, dueAtUtc: '2026-10-22T08:00:00.000Z', dueLocalDate: '2026-10-22' });
    await reconcileDoses(db, { now: '2026-10-24T05:00:00.000Z', timezone: 'UTC', days: 1, notBefore: '2026-10-01T00:00:00.000Z' });
    const [old] = await listDosesBetween(db, '2026-10-22', '2026-10-22');
    expect(old!.status).toBe('missed');
  });
});
