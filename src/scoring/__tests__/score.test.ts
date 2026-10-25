import { day, days } from '../../test-utils/doses';
import { steadyScore } from '../score';

describe('steadyScore', () => {
  it('is 100 when nothing is scheduled, so an empty window never punishes', () => {
    expect(steadyScore([], '2026-10-24')).toBe(100);
  });

  it('weights on time 1.0, late 0.8, missed 0', () => {
    const doses = [...day('2026-10-22', 'taken_ontime', 'missed'), ...day('2026-10-23', 'taken_ontime', 'taken_late')];
    // (1 + 0 + 1 + 0.8) / 4
    expect(steadyScore(doses, '2026-10-24')).toBe(70);
  });

  it('leaves pending doses out of both sides', () => {
    expect(steadyScore(day('2026-10-24', 'taken_ontime', 'pending'), '2026-10-24')).toBe(100);
  });

  it('counts the 14 local days ending today and nothing older', () => {
    const recent = days('2026-10-12', 13, 'taken_ontime');
    expect(steadyScore([...day('2026-10-10', 'taken_ontime', 'missed'), ...recent], '2026-10-24')).toBe(100);
    // 10-11 is the first day of the window: (1 + 0 + 13) / 15
    expect(steadyScore([...day('2026-10-11', 'taken_ontime', 'missed'), ...recent], '2026-10-24')).toBe(93);
  });

  it('goes from 0 to 100 after 14 perfect days', () => {
    const lost = days('2026-10-01', 14, 'missed');
    // 10-01 and 10-08 become rest days; the other 12 days are missed.
    expect(steadyScore(lost, '2026-10-14')).toBe(0);
    const back = [...lost, ...days('2026-10-15', 14, 'taken_ontime')];
    expect(steadyScore(back, '2026-10-28')).toBe(100);
  });

  it('costs at most about a point for one fully missed day on a healthy score', () => {
    const doses = [
      ...days('2026-10-01', 19, 'taken_ontime', 2),
      ...day('2026-10-20', 'missed', 'missed'),
      ...days('2026-10-21', 10, 'taken_ontime', 2),
    ];
    expect(steadyScore(doses, '2026-10-30')).toBeGreaterThanOrEqual(99);
  });

  it('counts a second fully missed day in the same week, since only one rest day fits', () => {
    const doses = [
      ...days('2026-10-01', 19, 'taken_ontime'),
      ...day('2026-10-20', 'missed'),
      ...days('2026-10-21', 2, 'taken_ontime'),
      ...day('2026-10-23', 'missed'),
      ...days('2026-10-24', 7, 'taken_ontime'),
    ];
    // Window 10-17..10-30, rest day 10-20 left out: 12 of 13
    expect(steadyScore(doses, '2026-10-30')).toBe(92);
  });

  it('never lets an excused dose pull the score below the day before', () => {
    const doses = [...days('2026-10-11', 13, 'taken_ontime'), ...day('2026-10-24', 'excused')];
    expect(steadyScore(doses, '2026-10-23')).toBe(100);
    expect(steadyScore(doses, '2026-10-24')).toBe(100);
    expect(steadyScore([...doses, ...day('2026-10-25', 'taken_ontime')], '2026-10-25')).toBe(100);
  });

  it('lets an excused dose lift a low score at 0.6', () => {
    const doses = [...day('2026-10-21', 'taken_ontime', 'missed', 'missed'), ...day('2026-10-22', 'excused')];
    // (1 + 0 + 0 + 0.6) / 4 beats 1 / 3
    expect(steadyScore(doses, '2026-10-22')).toBe(40);
  });
});
