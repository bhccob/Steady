import { logEvent } from '../db/dao/events';
import { insertGuardian } from '../db/dao/guardians';
import { insertMed } from '../db/dao/meds';
import { createProfile } from '../db/dao/profile';
import { insertSchedule } from '../db/dao/schedules';
import { insertConditions } from '../db/dao/support';
import type { Db } from '../db/types';
import { formatHm } from '../lib/time';
import { suggestedLevel } from '../support/level';
import type { OnboardingDraft } from './draft';

/** Saves the whole onboarding draft atomically: all of it or none of it. */
export async function completeOnboarding(
  db: Db,
  d: OnboardingDraft,
  opts: { timezone: string; now: string },
): Promise<void> {
  if (!d.ageConfirmed) throw new Error('Onboarding cannot finish without the 18+ confirmation');

  const suggested = suggestedLevel(d.conditions);
  const level = d.chosenLevel ?? suggested;

  await db.withTransactionAsync(async () => {
    await createProfile(db, {
      displayName: d.name.trim(),
      timezone: opts.timezone,
      ageConfirmedAt: opts.now,
      disclaimerAcceptedAt: opts.now,
      supportLevel: level,
      supportLevelChosen: level !== suggested,
      ...(d.sleep
        ? { bedtimeMin: d.sleep.bedtimeMin, wakeMin: d.sleep.wakeMin, windDown: d.sleep.windDown, stillUp: d.sleep.stillUp }
        : {}),
    });

    for (const [i, m] of d.meds.entries()) {
      const med = await insertMed(db, {
        label: m.label.trim() || null,
        doseAmount: m.amount.trim() || null,
        form: m.form,
        color: m.color,
        sortOrder: i,
      });
      if (m.times.length) {
        await insertSchedule(db, { medId: med.id, times: [...m.times].sort((a, b) => a - b).map(formatHm), days: m.days });
      }
    }

    await insertConditions(db, d.conditions);

    if (d.guardian) {
      await insertGuardian(db, {
        displayName: d.guardian.name.trim(),
        relationship: d.guardian.relationship || null,
        channel: d.guardian.channel,
        contact: d.guardian.contact.trim() || null,
      });
    }

    // Counts only: what the user is working through never goes in the log.
    await logEvent(db, 'onboarding_completed', { meds: d.meds.length, guardian: d.guardian !== null });
  });
}
