// Which notifications should be waiting on the phone right now (spec §5, plus the
// support level and sleep settings). Pure: the scheduler compares this plan with what
// is already scheduled and only changes the difference.
import type { DoseStatus, StillUp, SupportLevel } from '../db/schema';
import { addDays, formatHm, MINUTE_MS, type LocalDate } from '../lib/time';
import { localDateIn, localMinutesIn, zonedTimeToUtc } from '../lib/tz';
import { COPY, doseBody } from './copy';

/** Minutes after a dose is due for each reminder. Always ends at two hours, then silence. */
export const REMINDER_OFFSETS_MIN: Record<SupportLevel, readonly number[]> = {
  light: [0, 30, 120],
  steady: [0, 30, 60, 120],
  close: [0, 15, 30, 60, 120],
};

/** "If you're still up" nudges, in minutes after bedtime. */
const STILL_UP_OFFSETS_MIN: Record<StillUp, readonly number[]> = {
  off: [],
  once: [30],
  every30: [30, 60, 90],
  every15: [15, 30, 45, 60],
};

/** iOS keeps at most 64 scheduled notifications per app; leave a little room. */
export const MAX_SCHEDULED = 60;
const WIND_DOWN_MIN = 30;
const SNOOZE_MIN = 30;
const BEDTIME_SNOOZE_MIN = 15;
/** Only one notification may fire this soon after quiet hours end (spec §5.4). */
const COLLAPSE_WINDOW_MIN = 30;
/** A Goodnight or "15 more min" tap belongs to a night from 3 hours before bedtime to 12 hours after. */
const NIGHT_BEFORE_MIN = 180;
const NIGHT_AFTER_MIN = 720;

export type Category = 'dose' | 'dose_final' | 'bedtime';
export type NotifData = { kind: 'dose'; doseIds: string[] } | { kind: 'collapsed' } | { kind: 'bedtime' };

export interface Planned {
  id: string;
  fireAt: string;
  body: string;
  category: Category | null;
  data: NotifData;
}

export interface PlanInput {
  now: string;
  timezone: string;
  name: string;
  level: SupportLevel;
  doses: readonly { id: string; dueAtUtc: string; status: DoseStatus }[];
  quiet: { startMin: number; endMin: number };
  /** Dose id to when Snooze 30 was last tapped for it. */
  snoozes: ReadonlyMap<string, string>;
  /** Null when sleep isn't set up. `stillUp` is already resolved from the support level. */
  sleep: { bedtimeMin: number; wakeMin: number; windDown: boolean; stillUp: StillUp } | null;
  goodnightAt: string | null;
  bedtimeSnoozedAt: string | null;
}

const iso = (ms: number) => new Date(ms).toISOString();

export function planNotifications(input: PlanInput): Planned[] {
  const tz = input.timezone;
  const now = Date.parse(input.now);
  const today = localDateIn(new Date(now), tz);
  const at = (date: LocalDate, min: number) => Date.parse(zonedTimeToUtc(date, formatHm(min), tz));
  const { startMin, endMin } = input.quiet;
  const hasQuiet = startMin !== endMin;

  // Goodnight keeps everything quiet until the next wake-up time.
  let goodnight: { from: number; to: number } | null = null;
  if (input.goodnightAt && input.sleep) {
    const from = Date.parse(input.goodnightAt);
    const date = localDateIn(new Date(from), tz);
    let to = at(date, input.sleep.wakeMin);
    if (to <= from) to = at(addDays(date, 1), input.sleep.wakeMin);
    if (to > now) goodnight = { from, to };
  }

  /** When the quiet stretch around `t` ends, or null if `t` isn't in one. `goodnightOnly` ignores quiet hours. */
  const quietEnd = (t: number, goodnightOnly = false): number | null => {
    if (goodnight && t >= goodnight.from && t < goodnight.to) return goodnight.to;
    if (!hasQuiet || goodnightOnly) return null;
    const m = localMinutesIn(new Date(t), tz);
    const date = localDateIn(new Date(t), tz);
    if (startMin < endMin) return m >= startMin && m < endMin ? at(date, endMin) : null;
    if (m >= startMin) return at(addDays(date, 1), endMin);
    return m < endMin ? at(date, endMin) : null;
  };

  const out: Planned[] = [];

  // Dose reminders, one series per due time.
  const slots = new Map<string, string[]>();
  for (const d of input.doses) {
    if (d.status !== 'pending') continue;
    slots.set(d.dueAtUtc, [...(slots.get(d.dueAtUtc) ?? []), d.id]);
  }
  const offsets = REMINDER_OFFSETS_MIN[input.level];
  for (const [due, doseIds] of slots) {
    const dueMs = Date.parse(due);
    let series = offsets.map((o, k) => ({ k, t: dueMs + o * MINUTE_MS }));

    const snoozedAt = doseIds.map((id) => input.snoozes.get(id)).filter((s): s is string => !!s).sort().at(-1);
    if (snoozedAt) {
      const s = Date.parse(snoozedAt);
      const next = series.find((r) => r.t > s);
      if (next) {
        const t = s + SNOOZE_MIN * MINUTE_MS;
        series = series.filter((r) => r.t <= s || r.t > t || r === next).map((r) => (r === next ? { k: r.k, t } : r));
      }
    }

    // A follow-up in quiet hours moves to their end; the ones after it move by the same amount.
    // The first reminder keeps the time the user set, even inside quiet hours (their call,
    // overriding spec §5.4). Only Goodnight holds it.
    let shift = 0;
    for (const r of series) {
      let t = r.t + shift;
      const ownTime = r.k === 0;
      for (let end = quietEnd(t, ownTime); end !== null; end = quietEnd(t, ownTime)) {
        shift += end - t;
        t = end;
      }
      r.t = t;
    }

    for (const r of series) {
      if (r.t <= now) continue;
      const final = r.k === offsets.length - 1;
      out.push({
        id: `dose:${due}:${r.k}`,
        fireAt: iso(r.t),
        body: doseBody(input.name, r.k, offsets.length),
        category: final ? 'dose_final' : 'dose',
        data: { kind: 'dose', doseIds },
      });
    }
  }

  // Right after quiet hours end, several reminders fold into one.
  const ends = new Set<number>();
  if (hasQuiet) for (let i = -1; i <= 5; i++) ends.add(at(addDays(today, i), endMin));
  if (goodnight) ends.add(goodnight.to);
  for (const end of [...ends].sort((a, b) => a - b)) {
    const inWindow = (n: Planned) => n.data.kind === 'dose' && Date.parse(n.fireAt) >= end && Date.parse(n.fireAt) < end + COLLAPSE_WINDOW_MIN * MINUTE_MS;
    if (out.filter(inWindow).length < 2) continue;
    const kept = out.filter((n) => !inWindow(n));
    out.length = 0;
    out.push(...kept, { id: `collapsed:${iso(end)}`, fireAt: iso(end), body: COPY.collapsed, category: null, data: { kind: 'collapsed' } });
  }

  // Bedtime: a wind-down nudge, then "still up" nudges, for last night, tonight and tomorrow.
  if (input.sleep) {
    const { bedtimeMin, windDown, stillUp } = input.sleep;
    const tapped = (tap: string | null, bed: number) => {
      if (!tap) return null;
      const t = Date.parse(tap);
      return t >= bed - NIGHT_BEFORE_MIN * MINUTE_MS && t < bed + NIGHT_AFTER_MIN * MINUTE_MS ? t : null;
    };
    for (let i = -1; i <= 1; i++) {
      const date = addDays(today, i);
      const bed = at(date, bedtimeMin);
      if (tapped(input.goodnightAt, bed) !== null) continue;
      let nudges = [
        ...(windDown ? [{ key: 'wind', t: bed - WIND_DOWN_MIN * MINUTE_MS, body: COPY.windDown(input.name) }] : []),
        ...STILL_UP_OFFSETS_MIN[stillUp].map((o, k) => ({ key: `up${k}`, t: bed + o * MINUTE_MS, body: COPY.stillUp })),
      ];
      const snoozed = tapped(input.bedtimeSnoozedAt, bed);
      if (snoozed !== null && nudges.some((n) => n.t > snoozed)) {
        const t = snoozed + BEDTIME_SNOOZE_MIN * MINUTE_MS;
        nudges = [{ key: 'later', t, body: COPY.stillUp }, ...nudges.filter((n) => n.t > t)];
      }
      for (const n of nudges) {
        if (n.t > now) out.push({ id: `bed:${date}:${n.key}`, fireAt: iso(n.t), body: n.body, category: 'bedtime', data: { kind: 'bedtime' } });
      }
    }
  }

  return out.sort((a, b) => (a.fireAt < b.fireAt ? -1 : a.fireAt > b.fireAt ? 1 : 0)).slice(0, MAX_SCHEDULED);
}
