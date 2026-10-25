import { LOCK_GRACE_MS, shouldLock } from '../lock';

const NOW = 1_000_000;

describe('shouldLock', () => {
  it('never locks when the lock is off', () => {
    expect(shouldLock({ enabled: false, launching: true, backgroundedAt: null, now: NOW })).toBe(false);
    expect(shouldLock({ enabled: false, launching: false, backgroundedAt: NOW - 600_000, now: NOW })).toBe(false);
  });

  it('locks when the app starts', () => {
    expect(shouldLock({ enabled: true, launching: true, backgroundedAt: null, now: NOW })).toBe(true);
  });

  it('lets a quick switch to another app back in without asking again', () => {
    expect(shouldLock({ enabled: true, launching: false, backgroundedAt: NOW - (LOCK_GRACE_MS - 1), now: NOW })).toBe(false);
  });

  it('locks again after the app has been away a while', () => {
    expect(shouldLock({ enabled: true, launching: false, backgroundedAt: NOW - LOCK_GRACE_MS, now: NOW })).toBe(true);
  });

  it('does not lock on return when the app never left', () => {
    expect(shouldLock({ enabled: true, launching: false, backgroundedAt: null, now: NOW })).toBe(false);
  });
});
