import { stepMinutes } from '../lib/time';
import type { IconName } from '../ui/Icon';

/** The quick picks on the "Add a pill" sheet. Any other time is set with a stepper. */
export const TIME_TILES: readonly { label: string; minutes: number; icon: IconName }[] = [
  { label: 'Morning', minutes: 480, icon: 'sunrise' },
  { label: 'Midday', minutes: 780, icon: 'sun' },
  { label: 'Evening', minutes: 1140, icon: 'sunset' },
];

const TILE_MINUTES = new Set(TIME_TILES.map((t) => t.minutes));

/** Turns a tile's time on or off. The last time stays, so a pill always has one. */
export function toggleTile(times: readonly number[], minutes: number): number[] {
  if (!times.includes(minutes)) return [...times, minutes].sort((a, b) => a - b);
  return times.length > 1 ? times.filter((t) => t !== minutes) : [...times];
}

/** Times that aren't on a tile: each gets its own stepper row. */
export function otherTimes(times: readonly number[]): number[] {
  return times.filter((t) => !TILE_MINUTES.has(t));
}

/** "Other time" starts at 21:00, or the next free quarter hour after it. */
export function addOtherTime(times: readonly number[]): number[] {
  let t = 1260;
  while (times.includes(t)) t = stepMinutes(t, 15);
  return [...times, t];
}
