import type { Schedule } from '../../db/dao/schedules';
import { planDoses } from '../plan';

const sched = (p: Partial<Schedule> = {}): Schedule => ({ id: 's1', medId: 'm1', times: ['08:00'], days: [], active: true, ...p });

describe('planDoses', () => {
  it('makes one dose per time per day, with UTC and the local date', () => {
    const got = planDoses({ schedules: [sched({ times: ['08:00', '20:00'] })], activeMedIds: new Set(['m1']), from: '2026-10-23', days: 2, timezone: 'Europe/Amsterdam' });
    expect(got).toEqual([
      { medId: 'm1', dueAtUtc: '2026-10-23T06:00:00.000Z', dueLocalDate: '2026-10-23' },
      { medId: 'm1', dueAtUtc: '2026-10-23T18:00:00.000Z', dueLocalDate: '2026-10-23' },
      { medId: 'm1', dueAtUtc: '2026-10-24T06:00:00.000Z', dueLocalDate: '2026-10-24' },
      { medId: 'm1', dueAtUtc: '2026-10-24T18:00:00.000Z', dueLocalDate: '2026-10-24' },
    ]);
  });

  it('follows the clock across the end of summer time', () => {
    const got = planDoses({ schedules: [sched()], activeMedIds: new Set(['m1']), from: '2026-10-25', days: 1, timezone: 'Europe/Amsterdam' });
    expect(got[0]!.dueAtUtc).toBe('2026-10-25T07:00:00.000Z');
  });

  it('only uses the chosen weekdays', () => {
    // Sat 24, Sun 25, Mon 26: weekdays only keeps Monday.
    const got = planDoses({ schedules: [sched({ days: [1, 2, 3, 4, 5] })], activeMedIds: new Set(['m1']), from: '2026-10-24', days: 3, timezone: 'UTC' });
    expect(got.map((d) => d.dueLocalDate)).toEqual(['2026-10-26']);
  });

  it('skips paused schedules and paused meds', () => {
    const got = planDoses({
      schedules: [sched({ active: false }), sched({ id: 's2', medId: 'm2' })],
      activeMedIds: new Set(['m1']),
      from: '2026-10-24',
      days: 1,
      timezone: 'UTC',
    });
    expect(got).toEqual([]);
  });
});
