import { Platform } from 'react-native';

import type { Db } from '../db/types';
import {
  AndroidImportance,
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  getPresentedNotificationsAsync,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationCategoryAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from '../lib/notifications';
import { ACTIONS } from './actions';
import { ACTION_LABELS } from './copy';
import { handlesButtonsInBackground } from './platform';
import { syncNotifications, type NotificationPort } from './scheduler';

const CHANNEL = 'reminders';

/** The phone's real notification system behind the scheduler's port. */
export const expoPort: NotificationPort = {
  async permitted() {
    const p = await getPermissionsAsync();
    return p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
  },
  async scheduled() {
    return (await getAllScheduledNotificationsAsync()).map((r) => ({
      id: r.identifier,
      fireAt: typeof r.content.data?.fireAt === 'string' ? r.content.data.fireAt : '',
      body: r.content.body ?? '',
    }));
  },
  async schedule(n) {
    await scheduleNotificationAsync({
      identifier: n.id,
      content: { body: n.body, data: { ...n.data, fireAt: n.fireAt }, categoryIdentifier: n.category ?? undefined, sound: true },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(n.fireAt), channelId: CHANNEL },
    });
  },
  async cancel(id) {
    await cancelScheduledNotificationAsync(id);
  },
  async dismiss(doseIds) {
    for (const shown of await getPresentedNotificationsAsync()) {
      const ids = shown.request.content.data?.doseIds;
      if (Array.isArray(ids) && ids.some((id) => doseIds.includes(id as string))) await dismissNotificationAsync(shown.request.identifier);
    }
  },
};

/**
 * Registers how reminders look and which buttons they carry. On Android development and store
 * builds every button is handled in the background (backgroundTask.ts): marking from the lock
 * screen without opening Steady. Elsewhere "Taken" and "Goodnight" open the app so they always
 * register, because a button that leaves a fully closed app closed is never delivered to it.
 * Snooze and "15 more min" always stay in the background; if one is lost, the next reminder
 * simply comes on its usual schedule.
 */
export async function setupNotifications(): Promise<void> {
  const opensApp = !handlesButtonsInBackground();
  setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: AndroidImportance.HIGH, vibrationPattern: [0, 200] });
  }
  const taken = { identifier: ACTIONS.taken, buttonTitle: ACTION_LABELS.taken, options: { opensAppToForeground: opensApp } };
  await setNotificationCategoryAsync('dose', [taken, { identifier: ACTIONS.snooze, buttonTitle: ACTION_LABELS.snooze, options: { opensAppToForeground: false } }]);
  await setNotificationCategoryAsync('dose_final', [taken]);
  await setNotificationCategoryAsync('bedtime', [
    { identifier: ACTIONS.goodnight, buttonTitle: ACTION_LABELS.goodnight, options: { opensAppToForeground: opensApp } },
    { identifier: ACTIONS.later, buttonTitle: ACTION_LABELS.later, options: { opensAppToForeground: false } },
  ]);
}

let running: Promise<void> | null = null;
let again = false;

/** Syncs reminders now, or right after a sync already in progress. Failures stay quiet; the next sync retries. */
export function syncSoon(db: Db): void {
  if (running) {
    again = true;
    return;
  }
  running = (async () => {
    do {
      again = false;
      await syncNotifications(db, expoPort);
    } while (again);
  })()
    .catch(() => {})
    .finally(() => {
      running = null;
    });
}
