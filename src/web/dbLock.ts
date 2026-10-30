import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// On the web, Steady's SQLite file can be open in only one tab: a second open hangs. Each tab
// takes the "steady-db" Web Lock for its whole life first; a second tab says Steady is open
// elsewhere, and opens by itself once the first tab closes.

export type DbLockState = 'waiting' | 'held' | 'elsewhere';

const LOCK = 'steady-db';

interface LockManagerLike {
  request(name: string, options: { ifAvailable?: boolean }, callback: (lock: unknown) => unknown): Promise<unknown>;
}

/** Takes the lock (or waits for it), reporting each step; once held, it's kept until the page closes. */
export function holdDbLock(locks: LockManagerLike | undefined, onChange: (state: DbLockState) => void): void {
  if (!locks) {
    onChange('held');
    return;
  }
  const keep = () => new Promise(() => {});
  void locks.request(LOCK, { ifAvailable: true }, (lock) => {
    if (lock) {
      onChange('held');
      return keep();
    }
    onChange('elsewhere');
    void locks.request(LOCK, {}, () => {
      onChange('held');
      return keep();
    });
    return undefined;
  });
}

/** 'held' right away on phones; on the web, once this tab may open the database. Asks only when `enabled`. */
export function useDbLock(enabled: boolean): DbLockState {
  const [state, setState] = useState<DbLockState>(Platform.OS === 'web' ? 'waiting' : 'held');
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    holdDbLock((navigator as Navigator & { locks?: LockManagerLike }).locks, setState);
  }, [enabled]);
  return state;
}
