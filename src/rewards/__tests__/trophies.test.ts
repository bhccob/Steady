import { totalPoints, trophyState, weekLabel, weekStartOf } from '../trophies';

describe('weekStartOf', () => {
  it.each([
    ['2026-10-19', '2026-10-19'],
    ['2026-10-24', '2026-10-19'],
    ['2026-10-25', '2026-10-19'],
    ['2026-10-26', '2026-10-26'],
  ])('the week of %s starts on Monday %s', (d, want) => {
    expect(weekStartOf(d)).toBe(want);
  });
});

describe('weekLabel', () => {
  it('names a week inside one month briefly', () => {
    expect(weekLabel('2026-10-19')).toBe('19–25 Oct');
  });

  it('names both months when a week crosses them', () => {
    expect(weekLabel('2026-09-28')).toBe('28 Sep – 4 Oct');
  });
});

describe('trophyState', () => {
  const week = '2026-10-19';

  it('stays locked during the week', () => {
    expect(trophyState({ weekStart: week, today: '2026-10-24', nowMinutes: 22 * 60, collected: false })).toBe('locked');
  });

  it('is ready on Sunday night', () => {
    expect(trophyState({ weekStart: week, today: '2026-10-25', nowMinutes: 19 * 60 + 59, collected: false })).toBe('locked');
    expect(trophyState({ weekStart: week, today: '2026-10-25', nowMinutes: 20 * 60, collected: false })).toBe('ready');
  });

  it('stays ready after the week until collected', () => {
    expect(trophyState({ weekStart: week, today: '2026-11-02', nowMinutes: 9 * 60, collected: false })).toBe('ready');
    expect(trophyState({ weekStart: week, today: '2026-11-02', nowMinutes: 9 * 60, collected: true })).toBe('got');
  });
});

describe('totalPoints', () => {
  it('gives 10 per marked day and 50 per collected trophy', () => {
    expect(totalPoints({ markedDays: 41, trophiesCollected: 0 })).toBe(410);
    expect(totalPoints({ markedDays: 43, trophiesCollected: 1 })).toBe(480);
  });
});
