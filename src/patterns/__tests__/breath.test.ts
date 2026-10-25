import { inQuietHours } from '../../lib/time';
import { BREATH_TOTAL_MS, breathAt } from '../breath';

describe('breathAt (4-7-8 for a minute)', () => {
  it('breathes in for 4 seconds, holds for 7, breathes out for 8', () => {
    expect(breathAt(0)).toMatchObject({ phase: 'in', secondsLeft: 4 });
    expect(breathAt(3_500)).toMatchObject({ phase: 'in', secondsLeft: 1 });
    expect(breathAt(4_000)).toMatchObject({ phase: 'hold', secondsLeft: 7 });
    expect(breathAt(11_000)).toMatchObject({ phase: 'out', secondsLeft: 8 });
    expect(breathAt(19_000)).toMatchObject({ phase: 'in', cycle: 2 });
  });

  it('reports how far through each phase it is, for the circle', () => {
    expect(breathAt(2_000).progress).toBeCloseTo(0.5);
    expect(breathAt(15_000).progress).toBeCloseTo(0.5);
  });

  it('lasts about a minute: three full breaths, then done', () => {
    expect(BREATH_TOTAL_MS).toBe(57_000);
    expect(breathAt(56_999).phase).toBe('out');
    expect(breathAt(57_000).phase).toBe('done');
  });
});

describe('inQuietHours', () => {
  it('handles quiet hours across midnight', () => {
    expect(inQuietHours(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(6 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(inQuietHours(12 * 60, 22 * 60, 7 * 60)).toBe(false);
  });

  it('handles daytime quiet hours and none at all', () => {
    expect(inQuietHours(13 * 60, 12 * 60, 14 * 60)).toBe(true);
    expect(inQuietHours(15 * 60, 12 * 60, 14 * 60)).toBe(false);
    expect(inQuietHours(15 * 60, 0, 0)).toBe(false);
  });
});
