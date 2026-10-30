import type { ReminderApi } from './api';
import { fromB64url } from './bytes';
import { getIdentity } from './identity';
import type { Kv } from './kv';

export type TurnOnResult = 'on' | 'denied' | 'unsupported' | 'not-installed';

/**
 * Asks for notifications and registers this phone with the reminder server. Must run from a tap
 * (iPhone insists), and on iPhone only works once Steady is on the Home Screen.
 */
export async function turnOnRemindersWith({ kv, api, vapidPublicKey, flush }: { kv: Kv; api: ReminderApi; vapidPublicKey: string; flush: () => Promise<void> }): Promise<TurnOnResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !vapidPublicKey) return 'unsupported';
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
  if (ios && !standalone) return 'not-installed';

  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(vapidPublicKey) }));
  await api.putInstall(await getIdentity(kv), subscription.toJSON());
  await kv.set('registered', true);
  await kv.set('pending', true);
  await flush();
  return 'on';
}
