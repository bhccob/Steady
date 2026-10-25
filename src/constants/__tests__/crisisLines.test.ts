import { CRISIS_REGIONS, crisisLineFor } from '../crisisLines';

describe('crisisLineFor', () => {
  it('uses the region the user chose over the phone\'s own', () => {
    expect(crisisLineFor('NL', 'US')).toEqual({ country: 'Netherlands', number: '113' });
  });

  it('falls back to the phone\'s region', () => {
    expect(crisisLineFor(null, 'GB')).toEqual({ country: 'United Kingdom', number: '116 123' });
    expect(crisisLineFor(null, 'DE')).toEqual({ country: 'Europe', number: '116 123' });
  });

  it('knows Europe as a choice of its own', () => {
    expect(crisisLineFor('EU', 'US')?.country).toBe('Europe');
  });

  it('returns null when neither is known, so every line is shown', () => {
    expect(crisisLineFor(null, 'BR')).toBeNull();
    expect(crisisLineFor(null, undefined)).toBeNull();
  });
});

describe('CRISIS_REGIONS', () => {
  it('offers every line as a choice, each resolving to its line', () => {
    expect(CRISIS_REGIONS.length).toBeGreaterThanOrEqual(6);
    for (const r of CRISIS_REGIONS) expect(crisisLineFor(r.value, null)?.country).toBe(r.label);
  });
});
