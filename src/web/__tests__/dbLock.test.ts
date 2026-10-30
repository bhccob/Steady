import { holdDbLock, type DbLockState } from '../dbLock';

type Cb = (lock: unknown) => unknown;

/** A fake Web Locks manager: `free` decides whether the first, ifAvailable request gets the lock. */
function fakeLocks(free: boolean) {
  let waiter: Cb | null = null;
  return {
    request(_name: string, options: { ifAvailable?: boolean }, cb: Cb) {
      if (options.ifAvailable) cb(free ? {} : null);
      else waiter = cb;
      return Promise.resolve();
    },
    /** The other tab closes. */
    release() {
      waiter?.({});
    },
  };
}

describe('holdDbLock', () => {
  it('opens straight away when no other tab has Steady open', () => {
    const seen: DbLockState[] = [];
    holdDbLock(fakeLocks(true), (s) => seen.push(s));
    expect(seen).toEqual(['held']);
  });

  it('says so while another tab has it, then opens once that tab closes', () => {
    const seen: DbLockState[] = [];
    const locks = fakeLocks(false);
    holdDbLock(locks, (s) => seen.push(s));
    expect(seen).toEqual(['elsewhere']);
    locks.release();
    expect(seen).toEqual(['elsewhere', 'held']);
  });

  it('carries on as before where the browser has no Web Locks', () => {
    const seen: DbLockState[] = [];
    holdDbLock(undefined, (s) => seen.push(s));
    expect(seen).toEqual(['held']);
  });
});
