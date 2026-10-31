import { legalDataNote, supportEditNote, supportStepNote } from '../copy';

const SAYS_ON_PHONE_ONLY = /stays on this phone|on this phone only/i;

describe('privacy sentences', () => {
  it('never tell a signed-in person their answers stay on the phone', () => {
    for (const line of [supportStepNote(true), supportEditNote(true), legalDataNote(true, false), legalDataNote(true, true)]) {
      expect(line).not.toMatch(SAYS_ON_PHONE_ONLY);
      expect(line).toMatch(/backup/);
    }
  });

  it('keep the old promise word for word for people without an account', () => {
    expect(supportStepNote(false)).toBe('Optional and private. Pick any that fit, or none. It stays on this phone and helps Steady know how closely to look out for you.');
    expect(supportEditNote(false)).toBe('Private, on this phone only. It helps Steady know how closely to look out for you.');
    expect(legalDataNote(false, false)).toBe('Everything stays on this phone. You can export it or delete it any time in Settings.');
    expect(legalDataNote(false, true)).toBe('Everything else stays on this phone. You can export it or delete it any time in Settings.');
  });
});
