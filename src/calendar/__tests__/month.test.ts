import type { DoseStatus } from '../../db/schema';
import type { ScoringDose } from '../../scoring/types';
import { densityCells, monthCells, monthOf, monthTitle, shiftMonth } from '../month';

const TODAY = '2026-10-25'; // a Sunday

function dose(date: string, status: DoseStatus, hour = 8): ScoringDose {
  return { dueLocalDate: date, dueAtUtc: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`, status };
}

describe('monthCells', () => {
  const none = new Set<string>();

  it('lays the month out in weeks that start on Monday', () => {
    const { leading, cells } = monthCells({ month: '2026-10', today: TODAY, doses: [], moodDates: none });
    expect(leading).toBe(3); // 1 October 2026 is a Thursday
    expect(cells).toHaveLength(31);
    expect(cells[0]).toMatchObject({ date: '2026-10-01', day: 1 });
  });

  it('rings each day by how much was marked', () => {
    const doses = [
      dose('2026-10-05', 'taken_ontime'),
      dose('2026-10-06', 'taken_late'),
      dose('2026-10-06', 'missed', 20),
      dose('2026-10-07', 'missed'),
    ];
    const cells = monthCells({ month: '2026-10', today: TODAY, doses, moodDates: new Set(['2026-10-08']) }).cells;
    const ring = (d: number) => cells[d - 1]!.ring;
    expect(ring(5)).toBe('full');
    expect(ring(6)).toBe('half');
    expect(ring(7)).toBe('hollow');
    expect(ring(8)).toBe('dot');
    expect(ring(9)).toBe('empty');
  });

  it('shows today as open while its doses are still to come, and leaves days ahead blank', () => {
    const doses = [dose(TODAY, 'pending'), dose('2026-10-26', 'pending')];
    const cells = monthCells({ month: '2026-10', today: TODAY, doses, moodDates: new Set() }).cells;
    expect(cells[24]).toMatchObject({ date: TODAY, ring: 'open', isToday: true });
    expect(cells[25]!.ring).toBe('empty');
  });

  it('marks the days of this week', () => {
    const cells = monthCells({ month: '2026-10', today: TODAY, doses: [], moodDates: new Set() }).cells;
    expect(cells.filter((c) => c.thisWeek).map((c) => c.day)).toEqual([19, 20, 21, 22, 23, 24, 25]);
  });
});

describe('month helpers', () => {
  it('moves between months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthOf(TODAY)).toBe('2026-10');
  });

  it('names the month, adding the year only when it is not this year', () => {
    expect(monthTitle('2026-10', TODAY)).toBe('October');
    expect(monthTitle('2025-12', TODAY)).toBe('December 2025');
  });
});

describe('densityCells', () => {
  it('covers the last N days, oldest first, ending today', () => {
    const cells = densityCells({ doses: [], today: TODAY, span: 14 });
    expect(cells).toHaveLength(14);
    expect(cells[0]!.date).toBe('2026-10-12');
    expect(cells[13]!.date).toBe(TODAY);
  });

  it('shades a day by how much of it was marked', () => {
    const doses = [
      ...['taken_ontime', 'taken_late', 'taken_ontime'].map((s, i) => dose('2026-10-20', s as DoseStatus, 8 + i)),
      ...['taken_ontime', 'taken_ontime', 'missed'].map((s, i) => dose('2026-10-21', s as DoseStatus, 8 + i)),
      ...['taken_ontime', 'missed', 'missed'].map((s, i) => dose('2026-10-22', s as DoseStatus, 8 + i)),
      dose('2026-10-23', 'missed'),
      dose('2026-10-24', 'missed'),
    ];
    const byDate = Object.fromEntries(densityCells({ doses, today: TODAY, span: 7 }).map((c) => [c.date, c]));
    expect(byDate['2026-10-20']).toMatchObject({ level: 3, rest: false });
    expect(byDate['2026-10-21']).toMatchObject({ level: 2 });
    expect(byDate['2026-10-22']).toMatchObject({ level: 1 });
    expect(byDate['2026-10-23']).toMatchObject({ level: 0, rest: true });
    expect(byDate['2026-10-24']).toMatchObject({ level: 0, rest: false });
  });

  it('leaves days with nothing due, and today while it is still open, unshaded', () => {
    const cells = densityCells({ doses: [dose(TODAY, 'pending')], today: TODAY, span: 3 });
    expect(cells.map((c) => c.level)).toEqual([null, null, null]);
  });
});
