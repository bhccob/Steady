import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { addNotificationResponseReceivedListener, clearLastNotificationResponseAsync, getLastNotificationResponseAsync } from '../lib/notifications';
import { useApp } from '../state/app';
import { handleResponse } from './actions';
import { expoPort, setupNotifications } from './expoPort';

/**
 * Sets up reminders and handles their buttons, including one tapped while the app was closed.
 * Renders nothing. Home keeps the schedule in sync on launch and on every return to the app.
 */
export function NotificationBridge() {
  const db = useSQLiteContext();

  useEffect(() => {
    const respond = async (actionIdentifier: string, data: unknown) => {
      await handleResponse(db, expoPort, { actionIdentifier, data }, new Date());
      useApp.getState().bumpData();
    };

    setupNotifications()
      .then(async () => {
        const last = await getLastNotificationResponseAsync();
        if (!last) return;
        await clearLastNotificationResponseAsync();
        await respond(last.actionIdentifier, last.notification.request.content.data);
      })
      .catch(() => {});

    const sub = addNotificationResponseReceivedListener((r) => {
      respond(r.actionIdentifier, r.notification.request.content.data).catch(() => {});
    });
    return () => sub.remove();
  }, [db]);

  return null;
}
