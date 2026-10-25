import { bedtimeCard } from '../bedtime';

const D = '2026-10-25';
const N = '2026-10-26';
const sleep = { bedtimeMin: 23 * 60, wakeMin: 7 * 60 };
const at = (iso: string, extra: Partial<Parameters<typeof bedtimeCard>[0]> = {}) =>
  bedtimeCard({ now: iso, timezone: 'UTC', sleep, goodnightAt: null, snoozedAt: null, ...extra });

describe('bedtimeCard', () => {
  it('stays away during the day and evening', () => {
    expect(at(`${D}T22:00:00.000Z`)).toBeNull();
    expect(at(`${N}T07:10:00.000Z`)).toBeNull();
  });

  it('says bedtime is soon in the 30 minutes before bed', () => {
    expect(at(`${D}T22:40:00.000Z`)).toBe('soon');
  });

  it('says it is past bedtime until wake-up', () => {
    expect(at(`${D}T23:20:00.000Z`)).toBe('past');
    expect(at(`${N}T02:00:00.000Z`)).toBe('past');
  });

  it('goes away after Goodnight, for that night only', () => {
    expect(at(`${D}T23:20:00.000Z`, { goodnightAt: `${D}T23:05:00.000Z` })).toBeNull();
    expect(at(`${D}T23:20:00.000Z`, { goodnightAt: '2026-10-24T23:05:00.000Z' })).toBe('past');
  });

  it('waits 15 minutes after "15 more min"', () => {
    expect(at(`${D}T23:20:00.000Z`, { snoozedAt: `${D}T23:10:00.000Z` })).toBeNull();
    expect(at(`${D}T23:26:00.000Z`, { snoozedAt: `${D}T23:10:00.000Z` })).toBe('past');
  });

  it('works with a bedtime after midnight', () => {
    const late = { bedtimeMin: 30, wakeMin: 8 * 60 };
    expect(at(`${N}T00:10:00.000Z`, { sleep: late })).toBe('soon');
    expect(at(`${N}T01:00:00.000Z`, { sleep: late })).toBe('past');
    expect(at(`${D}T23:00:00.000Z`, { sleep: late })).toBeNull();
  });

  it('never shows without sleep set up', () => {
    expect(at(`${D}T23:20:00.000Z`, { sleep: null })).toBeNull();
  });
});
