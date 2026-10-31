import { listEvents } from '../../db/dao/events';
import { listGuardians } from '../../db/dao/guardians';
import { listMeds } from '../../db/dao/meds';
import { getProfile } from '../../db/dao/profile';
import { listSchedules } from '../../db/dao/schedules';
import { listConditions } from '../../db/dao/support';
import { migrate } from '../../db/migrations';
import { createTestDb } from '../../test-utils/sqlite';
import { completeOnboarding } from '../complete';
import { DEFAULT_SLEEP, emptyDraft, newDraftMed, type OnboardingDraft } from '../draft';

const NOW = '2026-10-25T09:00:00.000Z';

async function freshDb() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

function draft(patch: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return { ...emptyDraft(), name: 'sam', ageConfirmed: true, meds: [newDraftMed()], ...patch };
}

describe('completeOnboarding', () => {
  it('saves a start with no pills, no name and bedtime reminders off: setup asks only 18+ and the safety note', async () => {
    const db = await freshDb();
    await completeOnboarding(db, { ...emptyDraft(), ageConfirmed: true }, { timezone: 'UTC', now: NOW });
    expect(await listMeds(db)).toEqual([]);
    expect(await getProfile(db)).toMatchObject({ displayName: '', bedtimeMin: null, wakeMin: null, supportLevel: 'light', setupHiddenAt: null });
  });

  it('saves the profile with consent timestamps and a level suggested from conditions', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ conditions: [{ name: 'Psychosis', severity: 2 }] }), { timezone: 'Europe/Amsterdam', now: NOW });
    expect(await getProfile(db)).toMatchObject({
      displayName: 'sam',
      timezone: 'Europe/Amsterdam',
      ageConfirmedAt: NOW,
      disclaimerAcceptedAt: NOW,
      supportLevel: 'close',
      supportLevelChosen: false,
    });
  });

  it('keeps a level the user picked over the suggestion, and remembers they picked it', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ conditions: [{ name: 'Psychosis', severity: 2 }], chosenLevel: 'light' }), { timezone: 'UTC', now: NOW });
    expect(await getProfile(db)).toMatchObject({ supportLevel: 'light', supportLevelChosen: true });
  });

  it('does not flag a pick that matches the suggestion', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ chosenLevel: 'light' }), { timezone: 'UTC', now: NOW });
    expect((await getProfile(db))?.supportLevelChosen).toBe(false);
  });

  it('saves meds with "my pill" as a null label and their schedules as HH:mm', async () => {
    const db = await freshDb();
    const med = { ...newDraftMed(), label: '  ', amount: '1 tablet', form: 'capsule' as const, color: '#F5DA6B', times: [480, 1200], days: [1, 3, 5] };
    await completeOnboarding(db, draft({ meds: [med] }), { timezone: 'UTC', now: NOW });
    const [saved] = await listMeds(db);
    expect(saved).toMatchObject({ label: null, doseAmount: '1 tablet', form: 'capsule', color: '#F5DA6B' });
    expect(await listSchedules(db)).toEqual([expect.objectContaining({ medId: saved!.id, times: ['08:00', '20:00'], days: [1, 3, 5] })]);
  });

  it('saves what the user is working through', async () => {
    const db = await freshDb();
    const conditions = [{ name: 'Psychosis', severity: 2 as const }, { name: 'Cocaine use', severity: 1 as const }];
    await completeOnboarding(db, draft({ conditions }), { timezone: 'UTC', now: NOW });
    expect(await listConditions(db)).toEqual(conditions);
  });

  it('saves sleep settings when they were set', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ sleep: { bedtimeMin: 1380, wakeMin: 420, windDown: true, stillUp: null } }), { timezone: 'UTC', now: NOW });
    expect(await getProfile(db)).toMatchObject({ bedtimeMin: 1380, wakeMin: 420, windDown: true, stillUp: null });
  });

  it('saves a guardian as an invite that is still pending', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ guardian: { name: 'Jo', relationship: 'Friend', channel: 'wechat', contact: ' jo_w ' } }), { timezone: 'UTC', now: NOW });
    expect(await listGuardians(db)).toEqual([expect.objectContaining({ displayName: 'Jo', relationship: 'Friend', channel: 'wechat', contact: 'jo_w', consentedAt: null })]);
  });

  it('saves bedtime reminders at 23:00 and 07:00 when the draft has them', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ sleep: { ...DEFAULT_SLEEP } }), { timezone: 'UTC', now: NOW });
    expect(await getProfile(db)).toMatchObject({ bedtimeMin: 1380, wakeMin: 420, windDown: true, stillUp: null });
  });

  it('leaves out what was left empty or turned off', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ meds: [], sleep: null }), { timezone: 'UTC', now: NOW });
    expect(await listGuardians(db)).toEqual([]);
    expect(await listMeds(db)).toEqual([]);
    expect((await getProfile(db))?.bedtimeMin).toBeNull();
  });

  it('refuses to finish without the 18+ confirmation and saves nothing', async () => {
    const db = await freshDb();
    await expect(completeOnboarding(db, draft({ ageConfirmed: false }), { timezone: 'UTC', now: NOW })).rejects.toThrow();
    expect(await getProfile(db)).toBeNull();
  });

  it('rolls back everything if any part fails', async () => {
    const db = await freshDb();
    const bad = draft({ conditions: [{ name: 'Anxiety', severity: 5 as 0 }] });
    await expect(completeOnboarding(db, bad, { timezone: 'UTC', now: NOW })).rejects.toThrow();
    expect(await getProfile(db)).toBeNull();
    expect(await listMeds(db)).toEqual([]);
  });

  it('keeps condition names out of the event log', async () => {
    const db = await freshDb();
    await completeOnboarding(db, draft({ conditions: [{ name: 'Cocaine use', severity: 1 }] }), { timezone: 'UTC', now: NOW });
    expect(JSON.stringify(await listEvents(db))).not.toMatch(/cocaine/i);
  });
});
