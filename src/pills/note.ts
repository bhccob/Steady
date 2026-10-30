import { daysBetween, weekdayOf } from '../lib/time';
import { localDateIn } from '../lib/tz';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The short note on Home after adding a pill: "Added Iron. First reminder tomorrow at 08:00." */
export function addedNote(opts: { name: string; firstDueUtc: string | null; nowIso: string; timeZone: string; clock: (iso: string) => string }): string {
  const added = `Added ${opts.name.trim() || 'my pill'}.`;
  if (!opts.firstDueUtc) return added;
  const today = localDateIn(new Date(opts.nowIso), opts.timeZone);
  const day = localDateIn(new Date(opts.firstDueUtc), opts.timeZone);
  const gap = daysBetween(today, day);
  const when = gap <= 0 ? 'today' : gap === 1 ? 'tomorrow' : `on ${WEEKDAY[weekdayOf(day)]}`;
  return `${added} First reminder ${when} at ${opts.clock(opts.firstDueUtc)}.`;
}

/** One plain colour for a pill's glow: a two-tone pill glows in its first colour. */
export function solidColour(colour: string): string {
  return colour.match(/#[0-9a-f]{3,8}/i)?.[0] ?? colour;
}

/** The pill's glow. A dark pill would glow like a shadow, so it glows in `warm` instead. */
export function glowColour(colour: string, warm: string): string {
  const solid = solidColour(colour);
  const hex = /^#([0-9a-f]{6})/i.exec(solid)?.[1];
  if (!hex) return solid;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! < 90 ? warm : solid;
}
