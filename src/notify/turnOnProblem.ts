import type { TurnOnResult } from './web/turnOn';

/** What to tell someone when reminders didn't turn on (Settings and Home's Get set up list). */
export function turnOnProblem(result: Exclude<TurnOnResult, 'on'>, web: boolean): string {
  if (result === 'denied') return web ? 'Notifications are blocked for Steady in your browser settings.' : "Notifications are off for Steady in your phone's settings.";
  if (result === 'not-installed') return 'Add Steady to your Home Screen first, then turn reminders on there.';
  return "This browser can't show Steady's reminders.";
}
