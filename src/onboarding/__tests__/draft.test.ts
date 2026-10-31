import { DEFAULT_SLEEP, sleepToEdit } from '../draft';

const none = { bedtimeMin: null, wakeMin: null, windDown: true, stillUp: null };

describe('sleepToEdit', () => {
  it("suggests 23:00 to 07:00, on, when Home's setup list opens bedtime and nothing is saved", () => {
    expect(sleepToEdit(none, true)).toEqual(DEFAULT_SLEEP);
  });

  it('shows bedtime reminders off from Settings when nothing is saved', () => {
    expect(sleepToEdit(none, false)).toBeNull();
  });

  it('shows the saved times either way', () => {
    const saved = { bedtimeMin: 1380, wakeMin: 390, windDown: false, stillUp: 'once' as const };
    expect(sleepToEdit(saved, true)).toEqual(saved);
    expect(sleepToEdit(saved, false)).toEqual(saved);
  });
});
