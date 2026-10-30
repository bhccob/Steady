import type { Db } from '../db/types';
import { syncNotifications } from './scheduler';
import { createApi } from './web/api';
import { PUSH_URL, VAPID_PUBLIC_KEY } from './web/config';
import { forgetRemindersWith, retryForgetWith } from './web/forget';
import { idbKv } from './web/kv';
import { refreshRegistrationWith, reregisterWith, turnOnRemindersWith, withTimeout, type PushBrowser, type TurnOnResult } from './web/turnOn';
import { createWebPushPort } from './web/webPushPort';

// The web's reminders: the same planner and scheduler as on phones, through the web push port.

const kv = idbKv();
const api = createApi(PUSH_URL);

/** The service worker, or null if it isn't running within a few seconds (its install failed). */
const worker = async () => (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? withTimeout(navigator.serviceWorker.ready, 5000) : null);

const browser: PushBrowser = {
  support() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
    const nav = navigator as Navigator & { standalone?: boolean };
    const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
    return ios && !standalone ? 'not-installed' : 'ok';
  },
  permission: () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
  requestPermission: () => Notification.requestPermission(),
  pushManager: async () => (await worker())?.pushManager ?? null,
};

const deps = { kv, api, vapidPublicKey: VAPID_PUBLIC_KEY, browser };

export const activePort = createWebPushPort({
  kv,
  api,
  permitted: async () => typeof Notification !== 'undefined' && Notification.permission === 'granted' && (await kv.get('registered')) === true,
  notifications: async () => (await (await worker())?.getNotifications()) ?? [],
  reregister: () => reregisterWith(deps),
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

/** When Steady opens: finishes anything left from an offline moment, now and when the connection returns. */
export async function setupNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => {
    void retryForgetWith({ kv, api }).catch(() => {});
    void activePort.flush().catch(() => {});
  });
  await retryForgetWith({ kv, api }).catch(() => {});
  await refreshRegistrationWith(deps).catch(() => {});
  await activePort.flush().catch(() => {});
}

export function turnOnReminders(): Promise<TurnOnResult> {
  return turnOnRemindersWith({ ...deps, flush: () => activePort.flush() });
}

export async function remindersOn(): Promise<boolean> {
  return activePort.permitted();
}

export function forgetReminders(): Promise<void> {
  return forgetRemindersWith({
    kv,
    api,
    unsubscribe: async () => {
      await (await (await worker())?.pushManager.getSubscription())?.unsubscribe();
    },
  });
}
