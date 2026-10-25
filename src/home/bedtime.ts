import { addDays, formatHm, MINUTE_MS } from '../lib/time';
import { localDateIn, zonedTimeToUtc } from '../lib/tz';

/** Shown on Home from wind-down until wake-up. */
export type BedtimeCard = 'soon' | 'past' | null;

const SOON_MIN = 30;
const SNOOZE_MIN = 15;
/** A Goodnight or "15 more min" tap counts for a night from 3 hours before bedtime. */
const NIGHT_BEFORE_MIN = 180;

/** Whether Home shows the bedtime card right now, and which one. */
export function bedtimeCard(input: {
  now: string;
  timezone: string;
  sleep: { bedtimeMin: number; wakeMin: number } | null;
  goodnightAt: string | null;
  snoozedAt: string | null;
}): BedtimeCard {
  if (!input.sleep) return null;
  const { bedtimeMin, wakeMin } = input.sleep;
  const now = Date.parse(input.now);
  const at = (date: string, min: number) => Date.parse(zonedTimeToUtc(date, formatHm(min), input.timezone));
  const today = localDateIn(new Date(now), input.timezone);
  const tonight = (t: string | null, bed: number) => t !== null && Date.parse(t) >= bed - NIGHT_BEFORE_MIN * MINUTE_MS && Date.parse(t) <= now;

  for (const i of [-1, 0, 1]) {
    const date = addDays(today, i);
    const bed = at(date, bedtimeMin);
    const wake = at(wakeMin > bedtimeMin ? date : addDays(date, 1), wakeMin);
    if (now < bed - SOON_MIN * MINUTE_MS || now >= wake) continue;
    if (tonight(input.goodnightAt, bed)) return null;
    if (tonight(input.snoozedAt, bed) && now < Date.parse(input.snoozedAt!) + SNOOZE_MIN * MINUTE_MS) return null;
    return now < bed ? 'soon' : 'past';
  }
  return null;
}
