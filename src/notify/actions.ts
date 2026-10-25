import { logEvent } from '../db/dao/events';
import type { Db } from '../db/types';
import { markDose } from '../home/markDose';
import type { NotifData } from './plan';
import { syncNotifications, type NotificationPort } from './scheduler';

/** Notification buttons. No Skip: skipping needs intent, not a stray tap (spec §5.6). */
export const ACTIONS = { taken: 'taken', snooze: 'snooze', goodnight: 'goodnight', later: 'later' } as const;

function doseIdsOf(data: unknown): string[] {
  const d = data as Partial<Extract<NotifData, { kind: 'dose' }>> | null;
  return d?.kind === 'dose' && Array.isArray(d.doseIds) ? d.doseIds.filter((id): id is string => typeof id === 'string') : [];
}

/** After doses are marked by any path: clears their reminders from the tray and cancels the rest (spec §5.3). */
export async function afterDosesMarked(db: Db, port: NotificationPort, doseIds: readonly string[], now: Date = new Date()): Promise<void> {
  await port.dismiss(doseIds);
  await syncNotifications(db, port, now);
}

/** A tap on a notification button. Tapping the notification itself just opens the app. */
export async function handleResponse(db: Db, port: NotificationPort, response: { actionIdentifier: string; data: unknown }, now: Date): Promise<void> {
  const at = now.toISOString();
  switch (response.actionIdentifier) {
    case ACTIONS.taken: {
      const doseIds = doseIdsOf(response.data);
      if (!doseIds.length) return;
      for (const doseId of doseIds) await markDose(db, { doseId, nowUtc: at });
      await afterDosesMarked(db, port, doseIds, now);
      return;
    }
    case ACTIONS.snooze: {
      const doseIds = doseIdsOf(response.data);
      if (!doseIds.length) return;
      await logEvent(db, 'dose_snoozed', { doseIds, at });
      break;
    }
    case ACTIONS.goodnight:
      await logEvent(db, 'goodnight', { at });
      break;
    case ACTIONS.later:
      await logEvent(db, 'bedtime_snoozed', { at });
      break;
    default:
      return;
  }
  await syncNotifications(db, port, now);
}
