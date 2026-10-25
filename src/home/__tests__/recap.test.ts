import type { DoseStatus } from '../../db/schema';
import { recapDue, recapLine, weeklyRecap } from '../recap';

const SUNDAY = '2026-10-25';
const dose = (date: string, status: DoseStatus, hour = 8) => ({ dueLocalDate: date, dueAtUtc: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`, status });

describe('weeklyRecap', () => {
  it('counts this week\'s marks and rest days, Monday to today', () => {
    const doses = [
      dose('2026-10-18', 'taken_ontime'), // last week
      dose('2026-10-19', 'taken_ontime'),
      dose('2026-10-19', 'taken_late', 20),
      dose('2026-10-20', 'missed'), // a rest day
      dose('2026-10-21', 'taken_ontime'),
      dose(SUNDAY, 'pending'),
    ];
    expect(weeklyRecap({ doses, today: SUNDAY, comebacks: 1 })).toEqual({ marks: 3, comebacks: 1, restDays: 1 });
  });
});

describe('recapLine', () => {
  it('reads like the spec, leaving out what is zero', () => {
    expect(recapLine({ marks: 12, comebacks: 2, restDays: 1 })).toBe('This week: 12 marks, 2 comebacks, 1 rest day.');
    expect(recapLine({ marks: 1, comebacks: 0, restDays: 0 })).toBe('This week: 1 mark.');
  });

  it('stays kind about a quiet week', () => {
    expect(recapLine({ marks: 0, comebacks: 0, restDays: 0 })).toBe('A quiet week. A new one starts tomorrow.');
  });

  it('never ranks or compares', () => {
    for (const r of [{ marks: 12, comebacks: 2, restDays: 1 }, { marks: 0, comebacks: 0, restDays: 2 }]) {
      expect(recapLine(r)).not.toMatch(/\b(best|worst|better|worse|than|rank|missed)\b/i);
    }
  });
});

describe('recapDue', () => {
  it('shows on Sunday from 17:00, once', () => {
    expect(recapDue({ today: SUNDAY, nowMinutes: 17 * 60, seenThisWeek: false })).toBe(true);
    expect(recapDue({ today: SUNDAY, nowMinutes: 16 * 60, seenThisWeek: false })).toBe(false);
    expect(recapDue({ today: SUNDAY, nowMinutes: 20 * 60, seenThisWeek: true })).toBe(false);
    expect(recapDue({ today: '2026-10-24', nowMinutes: 20 * 60, seenThisWeek: false })).toBe(false);
  });
});
