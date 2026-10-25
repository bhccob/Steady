import { eveningCheckinDue } from '../evening';

const due = (patch: Partial<Parameters<typeof eveningCheckinDue>[0]> = {}) =>
  eveningCheckinDue({ level: 'close', nowMinutes: 19 * 60, morningShowing: false, eveningDone: false, dismissed: false, ...patch });

describe('eveningCheckinDue', () => {
  it('asks in the evening at Close', () => {
    expect(due()).toBe(true);
  });

  it('only asks at Close, the level with morning and evening check-ins', () => {
    expect(due({ level: 'steady' })).toBe(false);
    expect(due({ level: 'light' })).toBe(false);
  });

  it('waits until 18:00', () => {
    expect(due({ nowMinutes: 17 * 60 + 59 })).toBe(false);
    expect(due({ nowMinutes: 18 * 60 })).toBe(true);
  });

  it('never stacks on the morning question', () => {
    expect(due({ morningShowing: true })).toBe(false);
  });

  it('asks once: not after an answer or a "Not now"', () => {
    expect(due({ eveningDone: true })).toBe(false);
    expect(due({ dismissed: true })).toBe(false);
  });
});
