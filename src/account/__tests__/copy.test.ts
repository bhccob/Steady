import { legalDataNote, supportEditNote } from '../copy';

const SAYS_ON_PHONE_ONLY = /stays on this phone|on this phone only/i;

describe('privacy sentences', () => {
  it('never tell a signed-in person their answers stay on the phone', () => {
    for (const line of [supportEditNote(true), legalDataNote(true, false), legalDataNote(true, true)]) {
      expect(line).not.toMatch(SAYS_ON_PHONE_ONLY);
      expect(line).toMatch(/backup/);
    }
  });

  it('keep the old promise word for word for people without an account', () => {
    expect(supportEditNote(false)).toBe('Private, on this phone only. It helps Steady know how closely to look out for you.');
    expect(legalDataNote(false, false)).toBe('Everything stays on this phone. You can export it or delete it any time in Settings.');
  });

  it('say on the web what "everything else" leaves out, now that no reminders step comes before it', () => {
    expect(legalDataNote(false, true)).toBe(
      "Your reminder times go to Steady's server once you turn reminders on. Everything else stays on this phone. You can export it or delete it any time in Settings.",
    );
  });
});
