import { savedAgo } from '../savedAgo';

const NOW = Date.parse('2026-11-01T08:00:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('savedAgo', () => {
  it('says how long ago the backup saved, in plain words', () => {
    expect(savedAgo(null, NOW)).toBe('not yet');
    expect(savedAgo(NOW - 30_000, NOW)).toBe('just now');
    expect(savedAgo(NOW - 2 * MIN, NOW)).toBe('2 min ago');
    expect(savedAgo(NOW - 3 * HOUR, NOW)).toBe('3 h ago');
    expect(savedAgo(NOW - 26 * HOUR, NOW)).toBe('yesterday');
    expect(savedAgo(NOW - 4 * 24 * HOUR, NOW)).toBe('4 days ago');
  });

  it('never says a time in the future', () => {
    expect(savedAgo(NOW + 5 * MIN, NOW)).toBe('just now');
  });
});
