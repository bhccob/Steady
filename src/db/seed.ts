// Dev-only sample data: three weeks of history with a rest day, a late mark,
// an excused dose and a partly missed day. Today's doses stay pending.
import { addDays, addMs, daysBetween, MINUTE_MS, type LocalDate } from '../lib/time';
import { zonedTimeToUtc } from '../lib/tz';
import { upsertCheckin } from './dao/checkins';
import { insertPendingDose, listDosesBetween, setDoseStatus } from './dao/doses';
import { insertMed } from './dao/meds';
import { createProfile } from './dao/profile';
import { insertSchedule } from './dao/schedules';
import type { DoseStatus, Mood } from './schema';
import type { Db } from './types';

const HISTORY_DAYS = 20;

function statusFor(daysAgo: number, slot: number): DoseStatus {
  if (daysAgo === 9) return 'missed';
  if (daysAgo === 4 && slot === 1) return 'missed';
  if (daysAgo === 6 && slot === 0) return 'taken_late';
  if (daysAgo === 12 && slot === 1) return 'excused';
  return 'taken_ontime';
}

const MOODS: Mood[] = ['okay', 'happy', 'okay', 'rough', 'okay', 'happy'];

export async function seedDev(db: Db, opts: { today: LocalDate; timezone: string }): Promise<void> {
  await createProfile(db, { displayName: 'sam', timezone: opts.timezone, ageConfirmedAt: new Date().toISOString() });

  const slots = [
    { med: await insertMed(db, { label: null }), time: '08:00' },
    { med: await insertMed(db, { label: 'vitamin d', sortOrder: 1 }), time: '20:00' },
  ];
  for (const s of slots) await insertSchedule(db, { medId: s.med.id, times: [s.time], days: [] });

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 0; daysAgo--) {
    const date = addDays(opts.today, -daysAgo);
    for (const s of slots) {
      await insertPendingDose(db, { medId: s.med.id, dueAtUtc: zonedTimeToUtc(date, s.time, opts.timezone), dueLocalDate: date });
    }
    if (daysAgo % 2 === 0) await upsertCheckin(db, date, MOODS[daysAgo % MOODS.length]!);
  }

  const past = await listDosesBetween(db, addDays(opts.today, -HISTORY_DAYS), addDays(opts.today, -1));
  for (const dose of past) {
    const slot = slots.findIndex((s) => s.med.id === dose.medId);
    const status = statusFor(daysBetween(dose.dueLocalDate, opts.today), slot);
    const takenAtUtc =
      status === 'taken_ontime'
        ? addMs(dose.dueAtUtc, 5 * MINUTE_MS)
        : status === 'taken_late'
          ? addMs(dose.dueAtUtc, 90 * MINUTE_MS)
          : null;
    await setDoseStatus(db, dose.id, { status, takenAtUtc });
  }
}
