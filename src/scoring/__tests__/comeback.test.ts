import { dose } from '../../test-utils/doses';
import { isComeback } from '../comeback';

describe('isComeback', () => {
  it('fires when a missed dose falls in the 7 days before the mark', () => {
    const doses = [dose('2026-10-20T08:00:00.000Z', 'missed')];
    expect(isComeback({ markedAtUtc: '2026-10-22T08:00:00.000Z', doses, lastComebackAtUtc: null })).toBe(true);
  });

  it('does not fire without a recent missed dose', () => {
    const doses = [dose('2026-10-20T08:00:00.000Z', 'taken_ontime'), dose('2026-10-21T08:00:00.000Z', 'excused')];
    expect(isComeback({ markedAtUtc: '2026-10-22T08:00:00.000Z', doses, lastComebackAtUtc: null })).toBe(false);
  });

  it('looks back exactly 7 days', () => {
    const at = '2026-10-22T08:00:00.000Z';
    expect(isComeback({ markedAtUtc: at, doses: [dose('2026-10-15T08:00:00.000Z', 'missed')], lastComebackAtUtc: null })).toBe(true);
    expect(isComeback({ markedAtUtc: at, doses: [dose('2026-10-15T07:59:00.000Z', 'missed')], lastComebackAtUtc: null })).toBe(false);
  });

  it('fires once per miss, not on every mark after it', () => {
    const doses = [dose('2026-10-20T08:00:00.000Z', 'missed')];
    expect(isComeback({ markedAtUtc: '2026-10-21T09:00:00.000Z', doses, lastComebackAtUtc: null })).toBe(true);
    expect(
      isComeback({ markedAtUtc: '2026-10-21T20:00:00.000Z', doses, lastComebackAtUtc: '2026-10-21T09:00:00.000Z' }),
    ).toBe(false);
  });

  it('fires again after a new miss', () => {
    const doses = [dose('2026-10-20T08:00:00.000Z', 'missed'), dose('2026-10-22T08:00:00.000Z', 'missed')];
    expect(
      isComeback({ markedAtUtc: '2026-10-23T09:00:00.000Z', doses, lastComebackAtUtc: '2026-10-21T09:00:00.000Z' }),
    ).toBe(true);
  });

  it('treats a pending dose past its 24h window as missed, and one inside it as not yet', () => {
    const at = '2026-10-21T09:00:00.000Z';
    expect(isComeback({ markedAtUtc: at, doses: [dose('2026-10-20T08:00:00.000Z', 'pending')], lastComebackAtUtc: null })).toBe(true);
    expect(isComeback({ markedAtUtc: at, doses: [dose('2026-10-20T10:00:00.000Z', 'pending')], lastComebackAtUtc: null })).toBe(false);
  });
});
