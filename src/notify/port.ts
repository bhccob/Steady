import type { TurnOnResult } from './web/turnOn';

// The one place screens get the reminder port from: the phone's own notifications here, and on
// the web the version in port.web.ts. The web-only extras below do nothing on phones.
export { expoPort as activePort, setupNotifications, syncSoon } from './expoPort';

export async function turnOnReminders(): Promise<TurnOnResult> {
  return 'unsupported';
}

export async function remindersOn(): Promise<boolean> {
  return false;
}

export async function forgetReminders(): Promise<void> {}
