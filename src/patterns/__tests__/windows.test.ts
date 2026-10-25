import type { DoseStatus } from '../../db/schema';
import { activeWindow, steadyHandDue, windowsFor, type HarderTime } from '../windows';

const TODAY = '2026-10-25'; // a Sunday
const FIRST_DAY = '2026-09-01';

function base(patch: Partial<Parameters<typeof windowsFor>[0]> = {}): Parameters<typeof windowsFor>[0] {
  return { date: TODAY, today: TODAY, firstDay: FIRST_DAY, timezone: 'UTC', harderTimes: [], roughMoods: [], doses: [], ...patch };
}

const dose = (date: string, hour: number, status: DoseStatus) => ({ dueLocalDate: date, dueAtUtc: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`, status });

describe('windowsFor', () => {
  it('includes the harder times the user set for this weekday', () => {
    const harderTimes: HarderTime[] = [
      { days: [0], startMin: 20 * 60, endMin: 22 * 60 }, // Sundays
      { days: [1], startMin: 9 * 60, endMin: 10 * 60 }, // Mondays only
      { days: [], startMin: 13 * 60, endMin: 13 * 60 + 30 }, // every day
    ];
    expect(windowsFor(base({ harderTimes })).map((w) => [w.startMin, w.endMin, w.source])).toEqual([
      [13 * 60, 13 * 60 + 30, 'yours'],
      [20 * 60, 22 * 60, 'yours'],
    ]);
  });

  it('adds a two-hour block with three or more rough moods in the last 21 days', () => {
    const roughMoods = [
      { date: '2026-10-20', minutes: 8 * 60 + 10 },
      { date: '2026-10-22', minutes: 9 * 60 + 40 },
      { date: '2026-10-24', minutes: 8 * 60 + 55 },
      { date: '2026-09-01', minutes: 8 * 60 }, // too long ago
    ];
    expect(windowsFor(base({ roughMoods })).map((w) => [w.startMin, w.endMin, w.source])).toEqual([[8 * 60, 10 * 60, 'moods']]);
    expect(windowsFor(base({ roughMoods: roughMoods.slice(1) }))).toEqual([]);
  });

  it('adds an hour either side of today\'s doses when this weekday often runs late', () => {
    const doses = [dose('2026-10-11', 20, 'missed'), dose('2026-10-18', 20, 'taken_late'), dose(TODAY, 20, 'pending')];
    expect(windowsFor(base({ doses })).map((w) => [w.startMin, w.endMin, w.source])).toEqual([[19 * 60, 21 * 60, 'doses']]);
  });

  it('only uses dose patterns after 14 days of history', () => {
    const doses = [dose('2026-10-11', 20, 'missed'), dose('2026-10-18', 20, 'taken_late'), dose(TODAY, 20, 'pending')];
    expect(windowsFor(base({ doses, firstDay: '2026-10-15' }))).toEqual([]);
  });

  it('merges windows that overlap', () => {
    const harderTimes: HarderTime[] = [
      { days: [], startMin: 19 * 60, endMin: 20 * 60 },
      { days: [], startMin: 19 * 60 + 30, endMin: 21 * 60 },
    ];
    expect(windowsFor(base({ harderTimes })).map((w) => [w.startMin, w.endMin])).toEqual([[19 * 60, 21 * 60]]);
  });
});

describe('activeWindow', () => {
  const windows = [{ key: '1200-1260', startMin: 1200, endMin: 1260, source: 'yours' as const }];

  it('finds the window around now', () => {
    expect(activeWindow(windows, 1230)?.key).toBe('1200-1260');
    expect(activeWindow(windows, 1260)).toBeNull();
    expect(activeWindow(windows, 1199)).toBeNull();
  });
});

describe('steadyHandDue', () => {
  const windows = [{ key: '1200-1320', startMin: 1200, endMin: 1320, source: 'yours' as const }];
  const due = (patch: Partial<Parameters<typeof steadyHandDue>[0]> = {}) =>
    steadyHandDue({
      enabled: true,
      windows,
      nowMinutes: 1260,
      overdueMin: 75,
      inQuiet: false,
      minutesSinceMark: null,
      shownToday: new Set(),
      dismissalsThisWeek: 0,
      ...patch,
    });

  it('shows in a harder time when a dose is an hour or more overdue', () => {
    expect(due()?.key).toBe('1200-1320');
  });

  it('stays off unless the user opted in', () => {
    expect(due({ enabled: false })).toBeNull();
  });

  it('needs a dose at least an hour overdue', () => {
    expect(due({ overdueMin: 59 })).toBeNull();
    expect(due({ overdueMin: null })).toBeNull();
  });

  it('only shows inside a window', () => {
    expect(due({ nowMinutes: 1100 })).toBeNull();
  });

  it('shows once per window per day', () => {
    expect(due({ shownToday: new Set(['1200-1320']) })).toBeNull();
  });

  it('holds back in quiet hours, right after a mark, and after two dismissals this week', () => {
    expect(due({ inQuiet: true })).toBeNull();
    expect(due({ minutesSinceMark: 20 })).toBeNull();
    expect(due({ minutesSinceMark: 31 })?.key).toBe('1200-1320');
    expect(due({ dismissalsThisWeek: 2 })).toBeNull();
  });
});
