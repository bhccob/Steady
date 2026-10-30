import type { Med } from '../../db/dao/meds';
import { hasPills } from '../active';

const med = (id: string, active: boolean): Med => ({ id, label: null, doseAmount: null, form: 'pill', color: null, active, sortOrder: 0, createdAt: '2026-10-01T00:00:00.000Z' });

describe('hasPills', () => {
  it('is true while any pill is still taken', () => {
    expect(hasPills(new Map([['a', med('a', false)], ['b', med('b', true)]]))).toBe(true);
  });

  it('ignores stopped pills, which Home keeps only for their names in history', () => {
    expect(hasPills(new Map([['a', med('a', false)]]))).toBe(false);
  });

  it('is false with no pills at all', () => {
    expect(hasPills(new Map())).toBe(false);
  });
});
