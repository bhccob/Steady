import { scheduleSummary } from '../summary';

describe('scheduleSummary', () => {
  it('reads "daily" when every day is on', () => {
    expect(scheduleSummary(['08:00'], [])).toBe('08:00 daily');
    expect(scheduleSummary(['08:00', '20:00'], [0, 1, 2, 3, 4, 5, 6])).toBe('08:00, 20:00 daily');
  });

  it('says weekdays and weekends when that is what it is', () => {
    expect(scheduleSummary(['08:00'], [1, 2, 3, 4, 5])).toBe('08:00 weekdays');
    expect(scheduleSummary(['10:00'], [0, 6])).toBe('10:00 weekends');
  });

  it('lists other days from Monday', () => {
    expect(scheduleSummary(['08:00'], [5, 1, 3])).toBe('08:00 · Mon, Wed, Fri');
    expect(scheduleSummary(['08:00'], [0, 1])).toBe('08:00 · Mon, Sun');
  });

  it('says when there are no times', () => {
    expect(scheduleSummary([], [])).toBe('no times set');
  });
});
