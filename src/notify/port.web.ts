import type { Db } from '../db/types';
import { syncNotifications } from './scheduler';
import { createApi } from './web/api';
import { PUSH_URL, VAPID_PUBLIC_KEY } from './web/config';
import { forgetRemindersWith } from './web/forget';
import { idbKv } from './web/kv';
import { turnOnRemindersWith, type TurnOnResult } from './web/turnOn';
import { createWebPushPort } from './web/webPushPort';

// The web's reminders: the same planner and scheduler as on phones, through the web push port.

const kv = idbKv();
const api = createApi(PUSH_URL);

export const activePort = createWebPushPort({
  kv,
  api,
  permitted: async () => typeof Notification !== 'undefined' && Notification.permission === 'granted' && (await kv.get('registered')) === true,
  notifications: async () => (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? (await navigator.serviceWorker.ready).getNotifications() : []),
});

let running: Promise<void> | null = null;
let again = false;

/** Syncs reminders now, or right after a sync already in progress, then tells the server. */
export function syncSoon(db: Db): void {
  if (running) {
    again = true;
    return;
  }
  running = (async () => {
    do {
      again = false;
      await syncNotifications(db, activePort);
      await activePort.flush();
    } while (again);
  })()
    .catch(() => {})
    .finally(() => {
      running = null;
    });
}

/** Sends anything left over from an offline moment, now and whenever the connection returns. */
export async function setupNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => void activePort.flush().catch(() => {}));
  await activePort.flush().catch(() => {});
}

export function turnOnReminders(): Promise<TurnOnResult> {
  return turnOnRemindersWith({ kv, api, vapidPublicKey: VAPID_PUBLIC_KEY, flush: () => activePort.flush() });
}

export async function remindersOn(): Promise<boolean> {
  return activePort.permitted();
}

export function forgetReminders(): Promise<void> {
  return forgetRemindersWith({ kv, api });
}
