import { awardBadge } from '../db/dao/badges';
import { getDose, listDosesBetween, setDoseStatus } from '../db/dao/doses';
import { lastEventAt, logEvent } from '../db/dao/events';
import type { Db } from '../db/types';
import { isComeback } from '../scoring/comeback';
import { classifyMark, type MarkResult } from '../scoring/status';

export interface MarkOutcome extends MarkResult {
  /** A mark after a missed dose: the most celebrated moment in the app. */
  comeback: boolean;
}

/** Marks a pending dose taken. Null when it is already marked or locked (more than 24h past due). */
export async function markDose(db: Db, input: { doseId: string; nowUtc: string }): Promise<MarkOutcome | null> {
  const dose = await getDose(db, input.doseId);
  if (!dose || dose.status !== 'pending') return null;
  const result = classifyMark(dose.dueAtUtc, input.nowUtc);
  if (!result) return null;

  await setDoseStatus(db, dose.id, { status: result.status, takenAtUtc: input.nowUtc, backfilled: result.backfilled });
  await logEvent(db, 'dose_marked', { doseId: dose.id });

  const doses = await listDosesBetween(db, '0000-01-01', '9999-12-31');
  const comeback = isComeback({ markedAtUtc: input.nowUtc, doses, lastComebackAtUtc: await lastEventAt(db, 'comeback') });
  if (comeback) {
    await logEvent(db, 'comeback');
    await awardBadge(db, 'comeback_1');
  }
  return { ...result, comeback };
}
