import type { ReminderApi } from './api';
import { fromB64url } from './bytes';
import { getIdentity } from './identity';
import type { Kv } from './kv';
import { noteChange, type RegisterResult } from './webPushPort';

export type TurnOnResult = 'on' | 'denied' | 'unsupported' | 'not-installed';

interface Subscription {
  endpoint: string;
  toJSON(): PushSubscriptionJSON;
}

/** What turning reminders on needs from the browser (src/notify/port.web.ts; fakes in tests). */
export interface PushBrowser {
  /** 'not-installed': an iPhone outside the Home Screen app, where push isn't offered. */
  support(): 'ok' | 'unsupported' | 'not-installed';
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  /** The service worker's push manager, or null when the worker isn't running within a few seconds. */
  pushManager(): Promise<{ getSubscription(): Promise<Subscription | null>; subscribe(options: PushSubscriptionOptionsInit): Promise<Subscription> } | null>;
}

interface Deps {
  kv: Kv;
  api: ReminderApi;
  vapidPublicKey: string;
  browser: PushBrowser;
}

/** The value, or null once `ms` pass first: a service worker that failed to install never gets ready. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms)));
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}

async function register({ kv, api }: Deps, subscription: Subscription): Promise<void> {
  await api.putInstall(await getIdentity(kv), subscription.toJSON());
  await kv.set('endpoint', subscription.endpoint);
}

const subscribe = (manager: NonNullable<Awaited<ReturnType<PushBrowser['pushManager']>>>, vapidPublicKey: string) =>
  manager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(vapidPublicKey) });

/**
 * Asks for notifications and registers this phone with the reminder server. Must run from a tap
 * (iPhone insists), and on iPhone only works once Steady is on the Home Screen.
 */
export async function turnOnRemindersWith(deps: Deps & { flush: () => Promise<void> }): Promise<TurnOnResult> {
  const { kv, vapidPublicKey, browser, flush } = deps;
  const support = browser.support();
  if (support !== 'ok' || !vapidPublicKey) return support === 'not-installed' ? 'not-installed' : 'unsupported';

  if ((await browser.requestPermission()) !== 'granted') return 'denied';
  const manager = await browser.pushManager();
  if (!manager) return 'unsupported';
  await register(deps, (await manager.getSubscription()) ?? (await subscribe(manager, vapidPublicKey)));
  await kv.set('registered', true);
  await noteChange(kv);
  await flush();
  return 'on';
}

/** The server no longer knows this phone (it forgets after 30 quiet days, or an expired address). */
export async function reregisterWith(deps: Deps): Promise<RegisterResult> {
  const { browser, vapidPublicKey } = deps;
  if (browser.permission() !== 'granted') return 'impossible';
  const manager = await browser.pushManager();
  if (!manager) return 'failed';
  let subscription: Subscription;
  try {
    subscription = (await manager.getSubscription()) ?? (await subscribe(manager, vapidPublicKey));
  } catch {
    return 'impossible'; // e.g. iPhone wants a tap first: Settings shows Off, and a tap turns it back on.
  }
  try {
    await register(deps, subscription);
  } catch {
    return 'failed';
  }
  return 'ok';
}

/** When Steady opens: a push address the browser renewed, or lost, is sent again (or shown as Off). */
export async function refreshRegistrationWith(deps: Deps): Promise<void> {
  const { kv, browser } = deps;
  if ((await kv.get('registered')) !== true) return;
  const current = await (await browser.pushManager())?.getSubscription();
  if (current && current.endpoint === (await kv.get('endpoint'))) return;
  if ((await reregisterWith(deps)) === 'impossible') await kv.del('registered');
}
