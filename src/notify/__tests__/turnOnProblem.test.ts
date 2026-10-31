import { turnOnProblem } from '../turnOnProblem';

describe('turnOnProblem', () => {
  it('says where notifications were blocked: the browser on the web, the phone otherwise', () => {
    expect(turnOnProblem('denied', true)).toBe('Notifications are blocked for Steady in your browser settings.');
    expect(turnOnProblem('denied', false)).toBe("Notifications are off for Steady in your phone's settings.");
  });

  it('sends an iPhone to the Home Screen app first, and owns up to a browser that has no reminders', () => {
    expect(turnOnProblem('not-installed', true)).toBe('Add Steady to your Home Screen first, then turn reminders on there.');
    expect(turnOnProblem('unsupported', true)).toBe("This browser can't show Steady's reminders.");
  });
});
