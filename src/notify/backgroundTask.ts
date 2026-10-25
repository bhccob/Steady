// Lock-screen marking on Android (spec §5.6, acceptance: "no app launch"). In a development
// build, notification buttons run here, in the background, without opening Steady.
import { defineTask } from 'expo-task-manager';

import { openSteadyDb } from '../db/open';
import { refreshWidget } from '../widget/refresh';
import { handleResponse } from './actions';
import { expoPort } from './expoPort';
import { handlesButtonsInBackground } from './platform';

export const NOTIFICATION_TASK = 'steady-notification-response';

// Must be defined when the bundle first loads (index.ts imports this before the app), so a
// tap on a closed app's notification finds it.
defineTask<{ actionIdentifier?: string; notification?: { request?: { content?: { data?: unknown } } } }>(NOTIFICATION_TASK, async ({ data, error }) => {
  if (error || !data?.actionIdentifier) return;
  const db = await openSteadyDb();
  await handleResponse(db, expoPort, { actionIdentifier: data.actionIdentifier, data: data.notification?.request?.content?.data }, new Date());
  await refreshWidget(db);
});

/** Asks expo-notifications to run the task for button taps. Loaded lazily: Expo Go lacks the native side. */
export async function registerNotificationTask(): Promise<void> {
  if (!handlesButtonsInBackground()) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerTaskAsync } = require('expo-notifications/build/registerTaskAsync') as typeof import('expo-notifications/build/registerTaskAsync');
  await registerTaskAsync(NOTIFICATION_TASK);
}
