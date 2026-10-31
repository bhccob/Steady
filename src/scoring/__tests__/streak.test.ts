import { day, days } from '../../test-utils/doses';
import { steadyStreak, totalDaysMarked } from '../streak';

describe('steadyStreak', () => {
  it('counts consecutive days where every dose was taken', () => {
    expect(steadyStreak(days('2026-10-22', 3, 'taken_ontime'), '2026-10-24')).toBe(3);
  });

  it('skips a day with nothing scheduled without breaking or extending', () => {
    const doses = [...day('2026-10-21', 'taken_ontime'), ...days('2026-10-23', 2, 'taken_ontime')];
    expect(steadyStreak(doses, '2026-10-24')).toBe(3);
  });

  it('breaks on a day with a missed dose among taken ones', () => {
    const doses = [
      ...day('2026-10-21', 'taken_ontime'),
      ...day('2026-10-22', 'taken_ontime', 'missed'),
      ...days('2026-10-23', 2, 'taken_ontime'),
    ];
    expect(steadyStreak(doses, '2026-10-24')).toBe(2);
  });

  it('counts late and excused doses', () => {
    const doses = [...day('2026-10-23', 'taken_late'), ...day('2026-10-24', 'excused')];
    expect(steadyStreak(doses, '2026-10-24')).toBe(2);
  });

  it('does not break while today is still in progress', () => {
    const doses = [...day('2026-10-23', 'taken_ontime'), ...day('2026-10-24', 'taken_ontime', 'pending')];
    expect(steadyStreak(doses, '2026-10-24')).toBe(1);
  });

  it('pauses on a fully missed day, which becomes a rest day', () => {
    const doses = [
      ...day('2026-10-21', 'taken_ontime'),
      ...day('2026-10-22', 'missed', 'missed'),
      ...days('2026-10-23', 2, 'taken_ontime'),
    ];
    expect(steadyStreak(doses, '2026-10-24')).toBe(3);
  });

  it('gives at most one rest day in any 7 days', () => {
    const doses = [
      ...day('2026-10-17', 'taken_ontime'),
      ...day('2026-10-18', 'missed'),
      ...day('2026-10-19', 'taken_ontime'),
      ...day('2026-10-20', 'missed'),
      ...days('2026-10-21', 2, 'taken_ontime'),
    ];
    expect(steadyStreak(doses, '2026-10-22')).toBe(2);
  });

  it('does not give a second rest day 6 days after the first', () => {
    const doses = [
      ...day('2026-10-10', 'missed'),
      ...days('2026-10-11', 5, 'taken_ontime'),
      ...day('2026-10-16', 'missed'),
      ...day('2026-10-17', 'taken_ontime'),
    ];
    expect(steadyStreak(doses, '2026-10-17')).toBe(1);
  });

  it('gives a new rest day once 7 days have passed', () => {
    const doses = [
      ...day('2026-10-09', 'taken_ontime'),
      ...day('2026-10-10', 'missed'),
      ...days('2026-10-11', 6, 'taken_ontime'),
      ...day('2026-10-17', 'missed'),
      ...day('2026-10-18', 'taken_ontime'),
    ];
    expect(steadyStreak(doses, '2026-10-18')).toBe(8);
  });
});

describe('totalDaysMarked', () => {
  it('counts lifetime days with at least one taken dose', () => {
    const doses = [
      ...day('2026-10-01', 'taken_ontime'),
      ...day('2026-10-02', 'excused'),
      ...day('2026-10-03', 'missed', 'taken_late'),
      ...day('2026-10-04', 'pending'),
    ];
    expect(totalDaysMarked(doses)).toBe(2);
  });
});
