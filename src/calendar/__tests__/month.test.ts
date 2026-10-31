import type { DoseStatus } from '../../db/schema';
import type { ScoringDose } from '../../scoring/types';
import { monthCells, monthOf, monthTally, monthTitle, shiftMonth, tallyWords } from '../month';

const TODAY = '2026-10-25'; // a Sunday

function dose(date: string, status: DoseStatus, hour = 8): ScoringDose {
  return { dueLocalDate: date, dueAtUtc: `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`, status };
}

const statuses = (date: string, list: DoseStatus[]) => list.map((s, i) => dose(date, s, 8 + i));

describe('monthCells', () => {
  it('lays the month out in weeks that start on Monday', () => {
    const { leading, cells } = monthCells({ month: '2026-10', today: TODAY, doses: [] });
    expect(leading).toBe(3); // 1 October 2026 is a Thursday
    expect(cells).toHaveLength(31);
    expect(cells[0]).toMatchObject({ date: '2026-10-01', day: 1 });
  });

  it('fills each day by how much of it was marked, an excused dose counting as marked', () => {
    const doses = [
      dose('2026-10-05', 'taken_ontime'),
      ...statuses('2026-10-06', ['taken_late', 'missed']),
      dose('2026-10-07', 'missed'),
      dose('2026-10-08', 'missed'),
      ...statuses('2026-10-09', ['excused', 'taken_ontime']),
      ...statuses('2026-10-11', ['taken_ontime', 'missed', 'missed']),
    ];
    const cells = monthCells({ month: '2026-10', today: TODAY, doses }).cells;
    const at = (d: number) => cells[d - 1]!;
    expect(at(5)).toMatchObject({ tile: 'full', fill: 1, marked: 1, due: 1 });
    expect(at(6)).toMatchObject({ tile: 'part', fill: 0.5, marked: 1, due: 2 });
    expect(at(7)).toMatchObject({ tile: 'rest', fill: 0 });
    expect(at(8)).toMatchObject({ tile: 'unmarked', fill: 0 }); // one rest day a week: the 8th is too soon after the 7th
    expect(at(9)).toMatchObject({ tile: 'full', fill: 1 });
    expect(at(10)).toMatchObject({ tile: 'empty', fill: 0, due: 0 });
    expect(at(11)).toMatchObject({ tile: 'part', marked: 1, due: 3 });
    expect(at(11).fill).toBeCloseTo(1 / 3);
  });

  it('shows today as open until something is marked, then fills it as far as it goes', () => {
    const open = monthCells({ month: '2026-10', today: TODAY, doses: statuses(TODAY, ['pending', 'pending']) }).cells[24]!;
    expect(open).toMatchObject({ date: TODAY, isToday: true, tile: 'open', fill: 0 });
    const half = monthCells({ month: '2026-10', today: TODAY, doses: statuses(TODAY, ['taken_ontime', 'pending']) }).cells[24]!;
    expect(half).toMatchObject({ tile: 'part', fill: 0.5 });
  });

  it('shows the days before someone started as before, not as days with nothing due', () => {
    const cells = monthCells({ month: '2026-10', today: TODAY, firstDay: '2026-10-11', doses: [dose('2026-10-11', 'taken_ontime')] }).cells;
    expect(cells.slice(0, 10).every((c) => c.tile === 'before')).toBe(true);
    expect(cells[10]!.tile).toBe('full');
    expect(cells[11]!.tile).toBe('empty');
  });

  it('leaves days still to come as ahead, whatever is planned for them', () => {
    const cells = monthCells({ month: '2026-10', today: TODAY, doses: [dose('2026-10-26', 'pending')] }).cells;
    expect(cells.slice(25).every((c) => c.tile === 'ahead' && !c.isToday)).toBe(true);
  });
});

describe('monthTally', () => {
  it('counts finished days only, so today waits until everything due is marked', () => {
    const doses = [
      dose('2026-10-05', 'taken_ontime'),
      dose('2026-10-06', 'taken_ontime'),
      ...statuses('2026-10-07', ['taken_ontime', 'missed']),
      dose('2026-10-12', 'missed'),
      dose('2026-10-13', 'missed'),
      ...statuses(TODAY, ['taken_ontime', 'pending']),
    ];
    expect(monthTally(monthCells({ month: '2026-10', today: TODAY, doses }).cells)).toEqual({ full: 2, part: 1, rest: 1, unmarked: 1 });
    const done = [...doses.slice(0, -2), ...statuses(TODAY, ['taken_ontime', 'taken_late'])];
    expect(monthTally(monthCells({ month: '2026-10', today: TODAY, doses: done }).cells).full).toBe(3);
  });
});

describe('tallyWords', () => {
  it('names only what happened, in the order full, partly, rest', () => {
    expect(tallyWords({ full: 21, part: 5, rest: 2, unmarked: 1 })).toBe('21 full days · 5 partly · 2 rest');
    expect(tallyWords({ full: 1, part: 0, rest: 1, unmarked: 0 })).toBe('1 full day · 1 rest');
    expect(tallyWords({ full: 0, part: 2, rest: 0, unmarked: 3 })).toBe('2 partly');
  });

  it('has nothing to say before anything is marked', () => {
    expect(tallyWords({ full: 0, part: 0, rest: 0, unmarked: 0 })).toBeNull();
    expect(tallyWords({ full: 0, part: 0, rest: 0, unmarked: 4 })).toBeNull();
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
