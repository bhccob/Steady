import type { DoseStatus } from '../../db/schema';
import { LEVEL_RULES } from '../../support/level';
import { COPY } from '../copy';
import { MAX_SCHEDULED, planNotifications, REMINDER_OFFSETS_MIN, type PlanInput, type Planned } from '../plan';

const DAY = '2026-10-25';
const NEXT = '2026-10-26';

function base(patch: Partial<PlanInput> = {}): PlanInput {
  return {
    now: `${DAY}T08:00:00.000Z`,
    timezone: 'UTC',
    name: 'sam',
    level: 'light',
    doses: [],
    quiet: { startMin: 22 * 60, endMin: 7 * 60 },
    snoozes: new Map(),
    sleep: null,
    goodnightAt: null,
    bedtimeSnoozedAt: null,
    ...patch,
  };
}

const dose = (id: string, due: string, status: DoseStatus = 'pending') => ({ id, dueAtUtc: due, status });
const times = (p: Planned[]) => p.map((n) => n.fireAt.slice(0, 16));
const doseOnly = (p: Planned[]) => p.filter((n) => n.data.kind !== 'bedtime');

describe('dose reminders', () => {
  it('sends three at Light: on time, 30 minutes later, and a last one at two hours', () => {
    const plan = planNotifications(base({ doses: [dose('a', `${DAY}T09:00:00.000Z`)] }));
    expect(times(plan)).toEqual([`${DAY}T09:00`, `${DAY}T09:30`, `${DAY}T11:00`]);
    expect(plan.map((n) => n.body)).toEqual(["sam, a small mark when you're ready.", 'still here.', "no rush. it's here when you are."]);
    expect(plan.map((n) => n.category)).toEqual(['dose', 'dose', 'dose_final']);
    expect(plan[0]!.data).toEqual({ kind: 'dose', doseIds: ['a'] });
  });

  it('sends as many as the support level allows, a little closer together at Close', () => {
    for (const level of ['light', 'steady', 'close'] as const) {
      expect(REMINDER_OFFSETS_MIN[level]).toHaveLength(LEVEL_RULES[level].remindersPerDose);
      expect(REMINDER_OFFSETS_MIN[level].at(-1)).toBe(120);
    }
    const plan = planNotifications(base({ level: 'close', doses: [dose('a', `${DAY}T09:00:00.000Z`)] }));
    expect(times(plan)).toEqual([`${DAY}T09:00`, `${DAY}T09:15`, `${DAY}T09:30`, `${DAY}T10:00`, `${DAY}T11:00`]);
  });

  it('shares one reminder between doses due at the same moment', () => {
    const plan = planNotifications(base({ doses: [dose('a', `${DAY}T09:00:00.000Z`), dose('b', `${DAY}T09:00:00.000Z`)] }));
    expect(plan).toHaveLength(3);
    expect(plan[0]!.data).toEqual({ kind: 'dose', doseIds: ['a', 'b'] });
  });

  it('says nothing about doses already marked, excused or locked', () => {
    const doses = (['taken_ontime', 'taken_late', 'excused', 'missed'] as const).map((s, i) => dose(`d${i}`, `${DAY}T09:00:00.000Z`, s));
    expect(planNotifications(base({ doses }))).toEqual([]);
  });

  it('leaves out reminders that have already gone off', () => {
    const plan = planNotifications(base({ now: `${DAY}T09:45:00.000Z`, doses: [dose('a', `${DAY}T09:00:00.000Z`)] }));
    expect(times(plan)).toEqual([`${DAY}T11:00`]);
    expect(plan[0]!.category).toBe('dose_final');
  });
});

describe('quiet hours', () => {
  it('moves a reminder that falls in quiet hours to when they end, and later ones with it', () => {
    const plan = planNotifications(base({ doses: [dose('a', `${DAY}T21:45:00.000Z`)] }));
    expect(times(plan)).toEqual([`${DAY}T21:45`, `${NEXT}T07:00`, `${NEXT}T08:30`]);
  });

  it('still reminds at the time the user set inside quiet hours, holding only the follow-ups', () => {
    const plan = planNotifications(base({ doses: [dose('a', `${DAY}T23:00:00.000Z`)] }));
    expect(times(plan)).toEqual([`${DAY}T23:00`, `${NEXT}T07:00`, `${NEXT}T08:30`]);
    expect(plan[0]!.body).toBe("sam, a small mark when you're ready.");
  });

  it('holds a snoozed reminder in quiet hours like any other follow-up', () => {
    const plan = planNotifications(
      base({ now: `${DAY}T23:01:00.000Z`, doses: [dose('a', `${DAY}T23:00:00.000Z`)], snoozes: new Map([['a', `${DAY}T23:00:30.000Z`]]) }),
    );
    expect(times(plan)[0]).toBe(`${NEXT}T07:00`);
  });

  it('never sends more than one in the first 30 minutes after quiet hours, folding the rest into one', () => {
    const plan = planNotifications(base({ doses: [dose('a', `${DAY}T23:00:00.000Z`), dose('b', `${DAY}T23:30:00.000Z`)] }));
    const early = plan.filter((n) => n.fireAt >= `${NEXT}T07:00` && n.fireAt < `${NEXT}T07:30`);
    expect(early).toEqual([expect.objectContaining({ body: COPY.collapsed, category: null, data: { kind: 'collapsed' } })]);
  });

  it('uses quiet hours in local time', () => {
    const plan = planNotifications(
      base({ timezone: 'Europe/Amsterdam', now: '2026-07-01T10:00:00.000Z', doses: [dose('a', '2026-07-01T21:30:00.000Z')] }), // 23:30 in Amsterdam
    );
    expect(plan[0]!.fireAt).toBe('2026-07-01T21:30:00.000Z'); // its own time
    expect(plan[1]!.fireAt).toBe('2026-07-02T05:00:00.000Z'); // the follow-up waits for 07:00 in Amsterdam
  });
});

describe('snooze', () => {
  it('brings the next reminder to 30 minutes after the snooze, without adding one', () => {
    const plan = planNotifications(
      base({ now: `${DAY}T09:06:00.000Z`, doses: [dose('a', `${DAY}T09:00:00.000Z`)], snoozes: new Map([['a', `${DAY}T09:05:00.000Z`]]) }),
    );
    expect(times(plan)).toEqual([`${DAY}T09:35`, `${DAY}T11:00`]);
    expect(plan.map((n) => n.body)).toEqual(['still here.', "no rush. it's here when you are."]);
  });
});

describe('bedtime', () => {
  const sleep = { bedtimeMin: 23 * 60, wakeMin: 7 * 60, windDown: true, stillUp: 'every30' as const };

  it('winds down 30 minutes before bed, then nudges if still up, tonight and tomorrow', () => {
    const plan = planNotifications(base({ now: `${DAY}T20:00:00.000Z`, sleep }));
    expect(times(plan)).toEqual([
      `${DAY}T22:30`,
      `${DAY}T23:30`,
      `${NEXT}T00:00`,
      `${NEXT}T00:30`,
      `${NEXT}T22:30`,
      `${NEXT}T23:30`,
      '2026-10-27T00:00',
      '2026-10-27T00:30',
    ]);
    expect(plan[0]).toMatchObject({ body: COPY.windDown('sam'), category: 'bedtime', data: { kind: 'bedtime' } });
    expect(plan[1]!.body).toBe(COPY.stillUp);
  });

  it('goes quiet for the night after Goodnight', () => {
    const plan = planNotifications(base({ now: `${DAY}T23:15:00.000Z`, sleep, goodnightAt: `${DAY}T23:10:00.000Z` }));
    expect(times(plan)[0]).toBe(`${NEXT}T22:30`);
  });

  it('holds dose reminders after Goodnight until wake-up time', () => {
    const plan = planNotifications(
      base({
        now: `${DAY}T23:15:00.000Z`,
        quiet: { startMin: 0, endMin: 6 * 60 },
        sleep,
        goodnightAt: `${DAY}T23:10:00.000Z`,
        doses: [dose('a', `${DAY}T23:30:00.000Z`)],
      }),
    );
    expect(times(doseOnly(plan))[0]).toBe(`${NEXT}T07:00`);
  });

  it('gives 15 more minutes before the next nudge', () => {
    const plan = planNotifications(base({ now: `${DAY}T23:21:00.000Z`, sleep, bedtimeSnoozedAt: `${DAY}T23:20:00.000Z` }));
    expect(times(plan).slice(0, 3)).toEqual([`${DAY}T23:35`, `${NEXT}T00:00`, `${NEXT}T00:30`]);
  });

  it('sends none without sleep set up, or with both nudges off', () => {
    expect(planNotifications(base({ now: `${DAY}T20:00:00.000Z` }))).toEqual([]);
    expect(planNotifications(base({ now: `${DAY}T20:00:00.000Z`, sleep: { ...sleep, windDown: false, stillUp: 'off' } }))).toEqual([]);
  });
});

describe('limits', () => {
  it(`keeps no more than ${MAX_SCHEDULED}, soonest first`, () => {
    const doses = Array.from({ length: 96 }, (_, h) => dose(`d${h}`, new Date(Date.parse(`${DAY}T08:30:00.000Z`) + h * 3_600_000).toISOString()));
    const plan = planNotifications(base({ level: 'close', doses, quiet: { startMin: 0, endMin: 0 } }));
    expect(plan).toHaveLength(MAX_SCHEDULED);
    expect([...plan].sort((x, y) => (x.fireAt < y.fireAt ? -1 : 1))).toEqual(plan);
  });

  it('gives every notification its own id', () => {
    const plan = planNotifications(base({ level: 'close', doses: [dose('a', `${DAY}T09:00:00.000Z`), dose('b', `${DAY}T10:00:00.000Z`)] }));
    expect(new Set(plan.map((n) => n.id)).size).toBe(plan.length);
  });
});
