import { createTestDb } from '../../test-utils/sqlite';
import { awardBadge } from '../dao/badges';
import { getCheckin, listCheckins, upsertCheckin } from '../dao/checkins';
import { getDose, insertPendingDose, listDosesBetween, lockExpiredDoses, setDoseStatus } from '../dao/doses';
import { eventsSince, hasEventForDate, lastEventAt, latestEventTime, listEvents, logEvent } from '../dao/events';
import { collectTrophy, listTrophies } from '../dao/trophies';
import { insertGuardian, listGuardians, markGuardianAgreed, revokeGuardian } from '../dao/guardians';
import { deleteMed, insertMed, listMeds } from '../dao/meds';
import { createProfile, getProfile, updateProfile } from '../dao/profile';
import { insertSchedule, listSchedules } from '../dao/schedules';
import { listConditions, replaceConditions } from '../dao/support';
import { migrate } from '../migrations';
import { SCHEMA_V1, SCHEMA_V2, TABLES } from '../schema';
import { seedDev } from '../seed';

async function freshDb() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

function count(db: Awaited<ReturnType<typeof freshDb>>, table: string): number {
  return (db.raw.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe('migrate', () => {
  it('creates every table in the data model', async () => {
    const db = await freshDb();
    const names = (db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map((r) => r.name)
      .sort();
    expect(names).toEqual(
      ['badges', 'checkins', 'doses', 'events', 'guardians', 'meds', 'profile', 'schedules', 'support_conditions', 'trophies'],
    );
    expect([...TABLES].sort()).toEqual(names);
  });

  it('upgrades a database from before the mascot was dropped and keeps its data', async () => {
    const db = createTestDb();
    db.raw.exec(SCHEMA_V1 + SCHEMA_V2 + 'PRAGMA user_version = 2;');
    db.raw.exec("INSERT INTO profile (id, display_name, mascot_name, timezone, created_at) VALUES (1, 'sam', 'Pip', 'UTC', '2026-10-01T00:00:00.000Z')");
    await migrate(db);
    const cols = (db.raw.prepare('PRAGMA table_info(profile)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).not.toContain('mascot_name');
    expect(cols).not.toContain('scarf_id');
    expect(await getProfile(db)).toMatchObject({ displayName: 'sam', supportLevel: 'light' });
  });

  it('can run again on an existing database without changing it', async () => {
    const db = await freshDb();
    await insertMed(db, { label: null });
    await migrate(db);
    expect(count(db, 'meds')).toBe(1);
  });

  it('turns foreign keys on, so deleting a med removes its schedules and doses', async () => {
    const db = await freshDb();
    const med = await insertMed(db, { label: 'a' });
    await insertSchedule(db, { medId: med.id, times: ['08:00'], days: [] });
    await insertPendingDose(db, { medId: med.id, dueAtUtc: '2026-10-20T08:00:00.000Z', dueLocalDate: '2026-10-20' });
    await deleteMed(db, med.id);
    expect(count(db, 'schedules')).toBe(0);
    expect(count(db, 'doses')).toBe(0);
  });
});

describe('profile', () => {
  it('is null until onboarding creates it', async () => {
    const db = await freshDb();
    expect(await getProfile(db)).toBeNull();
  });

  it('fills defaults and reads back camelCase fields', async () => {
    const db = await freshDb();
    await createProfile(db, { displayName: 'sam', timezone: 'Europe/Amsterdam' });
    const p = await getProfile(db);
    expect(p).toMatchObject({
      displayName: 'sam',
      timezone: 'Europe/Amsterdam',
      quietStartMin: 1320,
      quietEndMin: 420,
      cravingWindowsEnabled: false,
      biometricLock: false,
      bedtimeMin: null,
      wakeMin: null,
      windDown: true,
      stillUp: null,
      supportLevel: 'light',
      supportLevelChosen: false,
    });
  });

  it('stores sleep and support settings given at creation', async () => {
    const db = await freshDb();
    await createProfile(db, { displayName: 'sam', timezone: 'UTC', bedtimeMin: 1380, wakeMin: 420, stillUp: 'every15', supportLevel: 'close' });
    expect(await getProfile(db)).toMatchObject({ bedtimeMin: 1380, wakeMin: 420, stillUp: 'every15', supportLevel: 'close' });
  });

  it('updates only the fields it is given', async () => {
    const db = await freshDb();
    await createProfile(db, { displayName: 'sam', timezone: 'UTC' });
    await updateProfile(db, { supportLevel: 'steady', supportLevelChosen: true, biometricLock: true });
    const p = await getProfile(db);
    expect(p?.supportLevel).toBe('steady');
    expect(p?.supportLevelChosen).toBe(true);
    expect(p?.biometricLock).toBe(true);
    expect(p?.displayName).toBe('sam');
  });
});

describe('meds and schedules', () => {
  it('keeps a med with no label, which the app shows as "my pill"', async () => {
    const db = await freshDb();
    await insertMed(db, { label: null });
    const [med] = await listMeds(db);
    expect(med?.label).toBeNull();
    expect(med?.form).toBe('pill');
    expect(med?.active).toBe(true);
  });

  it('round-trips schedule times and days as arrays', async () => {
    const db = await freshDb();
    const med = await insertMed(db, { label: null });
    await insertSchedule(db, { medId: med.id, times: ['08:00', '20:00'], days: [1, 3, 5] });
    const [s] = await listSchedules(db);
    expect(s?.times).toEqual(['08:00', '20:00']);
    expect(s?.days).toEqual([1, 3, 5]);
  });
});

describe('doses', () => {
  it('inserts a pending dose once per med and due time', async () => {
    const db = await freshDb();
    const med = await insertMed(db, { label: null });
    const input = { medId: med.id, dueAtUtc: '2026-10-20T08:00:00.000Z', dueLocalDate: '2026-10-20' };
    expect(await insertPendingDose(db, input)).toBe(true);
    expect(await insertPendingDose(db, input)).toBe(false);
    expect(count(db, 'doses')).toBe(1);
  });

  it('records a mark with its time and backfill flag', async () => {
    const db = await freshDb();
    const med = await insertMed(db, { label: null });
    await insertPendingDose(db, { medId: med.id, dueAtUtc: '2026-10-20T08:00:00.000Z', dueLocalDate: '2026-10-20' });
    const [dose] = await listDosesBetween(db, '2026-10-20', '2026-10-20');
    await setDoseStatus(db, dose!.id, { status: 'taken_late', takenAtUtc: '2026-10-20T14:00:00.000Z', backfilled: true });
    expect(await getDose(db, dose!.id)).toMatchObject({
      status: 'taken_late',
      takenAtUtc: '2026-10-20T14:00:00.000Z',
      backfilled: true,
    });
  });

  it('lists doses by stored local date, inclusive', async () => {
    const db = await freshDb();
    const med = await insertMed(db, { label: null });
    for (const d of ['19', '20', '21', '22']) {
      await insertPendingDose(db, { medId: med.id, dueAtUtc: `2026-10-${d}T08:00:00.000Z`, dueLocalDate: `2026-10-${d}` });
    }
    const got = await listDosesBetween(db, '2026-10-20', '2026-10-21');
    expect(got.map((d) => d.dueLocalDate)).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('locks pending doses as missed only after 24 hours', async () => {
    const db = await freshDb();
    const med = await insertMed(db, { label: null });
    await insertPendingDose(db, { medId: med.id, dueAtUtc: '2026-10-20T08:00:00.000Z', dueLocalDate: '2026-10-20' });
    await insertPendingDose(db, { medId: med.id, dueAtUtc: '2026-10-20T20:00:00.000Z', dueLocalDate: '2026-10-20' });

    const locked = await lockExpiredDoses(db, '2026-10-21T09:00:00.000Z');

    expect(locked).toBe(1);
    const statuses = (await listDosesBetween(db, '2026-10-20', '2026-10-20')).map((d) => d.status);
    expect(statuses).toEqual(['missed', 'pending']);
  });
});

describe('checkins', () => {
  it('keeps one mood per day and lets it change', async () => {
    const db = await freshDb();
    await upsertCheckin(db, '2026-10-20', 'rough');
    await upsertCheckin(db, '2026-10-20', 'okay');
    expect(count(db, 'checkins')).toBe(1);
    expect((await getCheckin(db, '2026-10-20'))?.mood).toBe('okay');
  });

  it('lists every mood, oldest day first', async () => {
    const db = await freshDb();
    await upsertCheckin(db, '2026-10-22', 'happy');
    await upsertCheckin(db, '2026-10-20', 'rough');
    expect((await listCheckins(db)).map((c) => [c.dateLocal, c.mood])).toEqual([
      ['2026-10-20', 'rough'],
      ['2026-10-22', 'happy'],
    ]);
  });
});

describe('timed events', () => {
  it('lists events of a type that happened since a moment, oldest first', async () => {
    const db = await freshDb();
    await logEvent(db, 'dose_snoozed', { doseIds: ['a'], at: '2026-10-25T09:00:00.000Z' });
    await logEvent(db, 'dose_snoozed', { doseIds: ['b'], at: '2026-10-25T07:00:00.000Z' });
    await logEvent(db, 'dose_snoozed', { doseIds: ['c'], at: '2026-10-25T08:30:00.000Z' });
    await logEvent(db, 'goodnight', { at: '2026-10-25T09:30:00.000Z' });
    expect(await eventsSince(db, 'dose_snoozed', '2026-10-25T08:00:00.000Z')).toEqual([
      { doseIds: ['c'], at: '2026-10-25T08:30:00.000Z' },
      { doseIds: ['a'], at: '2026-10-25T09:00:00.000Z' },
    ]);
  });

  it('finds when an event last happened, or null', async () => {
    const db = await freshDb();
    expect(await latestEventTime(db, 'goodnight')).toBeNull();
    await logEvent(db, 'goodnight', { at: '2026-10-25T23:10:00.000Z' });
    await logEvent(db, 'goodnight', { at: '2026-10-24T23:00:00.000Z' });
    expect(await latestEventTime(db, 'goodnight')).toBe('2026-10-25T23:10:00.000Z');
  });
});

describe('crisis region', () => {
  it('starts unset and keeps the region the user picks', async () => {
    const db = await freshDb();
    await createProfile(db, { displayName: 'sam', timezone: 'UTC' });
    expect((await getProfile(db))?.crisisRegion).toBeNull();
    await updateProfile(db, { crisisRegion: 'NL' });
    expect((await getProfile(db))?.crisisRegion).toBe('NL');
  });
});

describe('guardians', () => {
  it('marks a guardian as having said yes', async () => {
    const db = await freshDb();
    const g = await insertGuardian(db, { displayName: 'Alex', channel: 'whatsapp', contact: '+31600000000' });
    await markGuardianAgreed(db, g.id);
    expect((await listGuardians(db))[0]?.consentedAt).not.toBeNull();
  });

  it('drops a revoked guardian from the list', async () => {
    const db = await freshDb();
    const g = await insertGuardian(db, { displayName: 'Alex', channel: 'whatsapp', contact: '+31600000000' });
    await insertGuardian(db, { displayName: 'Jo', channel: 'sms', contact: '+31600000001' });
    await revokeGuardian(db, g.id);
    expect((await listGuardians(db)).map((x) => x.displayName)).toEqual(['Jo']);
  });

  it('defaults to not sharing med names and not consented', async () => {
    const db = await freshDb();
    await insertGuardian(db, { displayName: 'Alex', channel: 'inapp', contact: null });
    const [g] = await listGuardians(db);
    expect(g?.shareMedNames).toBe(false);
    expect(g?.consentedAt).toBeNull();
  });
});

describe('badges and events', () => {
  it('awards a badge only the first time', async () => {
    const db = await freshDb();
    expect(await awardBadge(db, 'comeback_1')).toBe(true);
    expect(await awardBadge(db, 'comeback_1')).toBe(false);
  });

  it('stores event payloads as JSON', async () => {
    const db = await freshDb();
    await logEvent(db, 'dose_marked', { doseId: 'x' });
    const [e] = await listEvents(db);
    expect(e?.type).toBe('dose_marked');
    expect(e?.payload).toEqual({ doseId: 'x' });
  });
});

describe('support conditions', () => {
  it('replaces the whole set each time it is saved', async () => {
    const db = await freshDb();
    await replaceConditions(db, [{ name: 'Psychosis', severity: 2 }, { name: 'Cocaine use', severity: 1 }]);
    await replaceConditions(db, [{ name: 'Cocaine use', severity: 0 }]);
    expect(await listConditions(db)).toEqual([{ name: 'Cocaine use', severity: 0 }]);
  });

  it('refuses a severity outside mild to severe', async () => {
    const db = await freshDb();
    await expect(replaceConditions(db, [{ name: 'Anxiety', severity: 3 as 0 }])).rejects.toThrow();
  });
});

describe('trophies', () => {
  it('collects a week trophy only once', async () => {
    const db = await freshDb();
    expect(await collectTrophy(db, '2026-10-19', 6)).toBe(true);
    expect(await collectTrophy(db, '2026-10-19', 6)).toBe(false);
    expect(await listTrophies(db)).toEqual([expect.objectContaining({ weekStart: '2026-10-19', daysMarked: 6 })]);
  });
});

describe('event lookups', () => {
  it('finds the most recent event of a type', async () => {
    const db = await freshDb();
    expect(await lastEventAt(db, 'comeback')).toBeNull();
    await logEvent(db, 'comeback');
    expect(await lastEventAt(db, 'comeback')).toEqual(expect.any(String));
  });

  it('checks for an event recorded for a given local date', async () => {
    const db = await freshDb();
    await logEvent(db, 'mood_prompt_dismissed', { date: '2026-10-24' });
    expect(await hasEventForDate(db, 'mood_prompt_dismissed', '2026-10-24')).toBe(true);
    expect(await hasEventForDate(db, 'mood_prompt_dismissed', '2026-10-25')).toBe(false);
  });
});

describe('dev seed', () => {
  it('fills a fresh database without violating constraints', async () => {
    const db = await freshDb();
    await seedDev(db, { today: '2026-10-24', timezone: 'Europe/Amsterdam' });
    expect(await getProfile(db)).not.toBeNull();
    expect(count(db, 'meds')).toBeGreaterThan(0);
    expect(count(db, 'doses')).toBeGreaterThan(0);
  });
});
