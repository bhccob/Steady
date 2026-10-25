import { getDose, insertPendingDose, listDosesBetween } from '../../db/dao/doses';
import { insertMed } from '../../db/dao/meds';
import { createProfile, type ProfilePatch } from '../../db/dao/profile';
import { migrate } from '../../db/migrations';
import { createTestDb } from '../../test-utils/sqlite';
import { handleResponse } from '../actions';
import type { Planned } from '../plan';
import { diffSchedule, syncNotifications, type NotificationPort } from '../scheduler';

const NOW = new Date('2026-10-25T08:00:00.000Z');
const DUE = '2026-10-25T09:00:00.000Z';

function fakePhone(permitted = true) {
  const scheduled = new Map<string, Planned>();
  const log = { scheduled: 0, cancelled: 0, dismissed: [] as string[][] };
  const port: NotificationPort = {
    permitted: async () => permitted,
    scheduled: async () => [...scheduled.values()].map((n) => ({ id: n.id, fireAt: n.fireAt, body: n.body })),
    schedule: async (n) => {
      log.scheduled++;
      scheduled.set(n.id, n);
    },
    cancel: async (id) => {
      log.cancelled++;
      scheduled.delete(id);
    },
    dismiss: async (doseIds) => {
      log.dismissed.push([...doseIds]);
    },
  };
  return { port, scheduled, log };
}

async function setup(profile: ProfilePatch = {}) {
  const db = createTestDb();
  await migrate(db);
  await createProfile(db, { displayName: 'sam', timezone: 'UTC', quietStartMin: 0, quietEndMin: 0, ...profile });
  const med = await insertMed(db, { label: 'Sertraline' });
  await insertPendingDose(db, { medId: med.id, dueAtUtc: DUE, dueLocalDate: DUE.slice(0, 10) });
  const [dose] = await listDosesBetween(db, '2026-10-25', '2026-10-25');
  return { db, doseId: dose!.id };
}

const doseTimes = (scheduled: Map<string, Planned>) =>
  [...scheduled.values()]
    .filter((n) => n.data.kind === 'dose')
    .map((n) => n.fireAt.slice(11, 16))
    .sort();

describe('diffSchedule', () => {
  const planned = (id: string, fireAt: string, body = 'still here.'): Planned => ({ id, fireAt, body, category: 'dose', data: { kind: 'collapsed' } });

  it('only touches what changed', () => {
    const existing = [
      { id: 'same', fireAt: '2026-10-25T09:00:00.000Z', body: 'still here.' },
      { id: 'moved', fireAt: '2026-10-25T09:30:00.000Z', body: 'still here.' },
      { id: 'gone', fireAt: '2026-10-25T10:00:00.000Z', body: 'still here.' },
    ];
    const plan = [planned('same', '2026-10-25T09:00:00.000Z'), planned('moved', '2026-10-25T09:35:00.000Z'), planned('new', '2026-10-25T11:00:00.000Z')];
    const diff = diffSchedule(existing, plan);
    expect(diff.cancel.sort()).toEqual(['gone', 'moved']);
    expect(diff.schedule.map((n) => n.id).sort()).toEqual(['moved', 'new']);
  });
});

describe('syncNotifications', () => {
  it('schedules reminders for doses still to come', async () => {
    const { db } = await setup();
    const phone = fakePhone();
    await syncNotifications(db, phone.port, NOW);
    expect(doseTimes(phone.scheduled)).toEqual(['09:00', '09:30', '11:00']);
  });

  it('never puts the med name in a notification', async () => {
    const { db } = await setup();
    const phone = fakePhone();
    await syncNotifications(db, phone.port, NOW);
    for (const n of phone.scheduled.values()) expect(n.body).not.toMatch(/sertraline/i);
  });

  it('changes nothing when run again with nothing new', async () => {
    const { db } = await setup();
    const phone = fakePhone();
    await syncNotifications(db, phone.port, NOW);
    const before = { ...phone.log };
    await syncNotifications(db, phone.port, NOW);
    expect(phone.log.scheduled).toBe(before.scheduled);
    expect(phone.log.cancelled).toBe(before.cancelled);
  });

  it('schedules nothing without notification permission', async () => {
    const { db } = await setup();
    const phone = fakePhone(false);
    await syncNotifications(db, phone.port, NOW);
    expect(phone.scheduled.size).toBe(0);
  });

  it('follows the support level', async () => {
    const { db } = await setup({ supportLevel: 'close' });
    const phone = fakePhone();
    await syncNotifications(db, phone.port, NOW);
    expect(doseTimes(phone.scheduled)).toEqual(['09:00', '09:15', '09:30', '10:00', '11:00']);
  });

  it('schedules bedtime nudges when sleep is set up', async () => {
    const { db } = await setup({ bedtimeMin: 23 * 60, wakeMin: 7 * 60, windDown: true, stillUp: 'once' });
    const phone = fakePhone();
    await syncNotifications(db, phone.port, NOW);
    expect([...phone.scheduled.values()].filter((n) => n.data.kind === 'bedtime').map((n) => n.fireAt.slice(0, 16))).toEqual([
      '2026-10-25T22:30',
      '2026-10-25T23:30',
      '2026-10-26T22:30',
      '2026-10-26T23:30',
    ]);
  });
});

describe('handleResponse', () => {
  const tap = (actionIdentifier: string, data: unknown) => ({ actionIdentifier, data });

  it('marks every dose in the reminder from "Taken", clears it from the tray, and cancels what is left', async () => {
    const { db, doseId } = await setup();
    const phone = fakePhone();
    await syncNotifications(db, phone.port, NOW);
    await handleResponse(db, phone.port, tap('taken', { kind: 'dose', doseIds: [doseId] }), new Date('2026-10-25T09:02:00.000Z'));
    expect((await getDose(db, doseId))?.status).toBe('taken_ontime');
    expect(phone.log.dismissed).toEqual([[doseId]]);
    expect(doseTimes(phone.scheduled)).toEqual([]);
  });

  it('moves the next reminder to 30 minutes after "Snooze 30"', async () => {
    const { db, doseId } = await setup();
    const phone = fakePhone();
    await handleResponse(db, phone.port, tap('snooze', { kind: 'dose', doseIds: [doseId] }), new Date('2026-10-25T09:05:00.000Z'));
    expect(doseTimes(phone.scheduled)).toEqual(['09:35', '11:00']);
  });

  it('stops tonight\'s nudges after "Goodnight"', async () => {
    const { db } = await setup({ bedtimeMin: 23 * 60, wakeMin: 7 * 60, windDown: true, stillUp: 'every30' });
    const phone = fakePhone();
    await handleResponse(db, phone.port, tap('goodnight', { kind: 'bedtime' }), new Date('2026-10-25T23:05:00.000Z'));
    const nudges = [...phone.scheduled.values()].filter((n) => n.data.kind === 'bedtime');
    expect(nudges.every((n) => n.fireAt >= '2026-10-26T12:00')).toBe(true);
  });

  it('waits 15 minutes after "15 more min"', async () => {
    const { db } = await setup({ bedtimeMin: 23 * 60, wakeMin: 7 * 60, windDown: true, stillUp: 'every30' });
    const phone = fakePhone();
    await handleResponse(db, phone.port, tap('later', { kind: 'bedtime' }), new Date('2026-10-25T23:20:00.000Z'));
    const first = [...phone.scheduled.values()].filter((n) => n.data.kind === 'bedtime').sort((a, b) => (a.fireAt < b.fireAt ? -1 : 1))[0];
    expect(first?.fireAt.slice(0, 16)).toBe('2026-10-25T23:35');
  });

  it('changes nothing when the notification itself is tapped', async () => {
    const { db, doseId } = await setup();
    const phone = fakePhone();
    await handleResponse(db, phone.port, tap('expo.modules.notifications.actions.DEFAULT', { kind: 'dose', doseIds: [doseId] }), NOW);
    expect((await getDose(db, doseId))?.status).toBe('pending');
  });

  it('ignores a reminder with no doses in it', async () => {
    const { db, doseId } = await setup();
    const phone = fakePhone();
    await handleResponse(db, phone.port, tap('taken', { kind: 'dose' }), NOW);
    expect((await getDose(db, doseId))?.status).toBe('pending');
  });
});
