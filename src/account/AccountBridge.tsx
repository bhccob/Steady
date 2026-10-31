import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useApp } from '../state/app';
import { createAccountApi } from './api';
import { backupDue, runBackup, type BackupReason } from './autoBackup';
import { ACCOUNT_URL } from './config';
import { clearSession, loadSession, saveSession } from './session';

/** Changes settle for this long before a backup goes out. */
const SETTLE_MS = 30_000;

/**
 * Keeps a signed-in device's backup up to date by itself: 30 s after data changes, when the app
 * goes to the background, and on start once a day. Renders nothing. Not signed in, it does nothing.
 */
export function AccountBridge() {
  const db = useSQLiteContext();

  useEffect(() => {
    const api = createAccountApi(ACCOUNT_URL);
    let dirty = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (reason: BackupReason | 'now') => {
      if (busy) return;
      // Read fresh each time: signing in, out or claiming happens on other screens.
      const session = await loadSession();
      const { account, setAccount } = useApp.getState();
      if (!session) {
        if (account) setAccount(null);
        return;
      }
      if (!account) setAccount({ email: session.email, savedAt: session.savedAt, state: 'ok' });
      if (reason !== 'now') {
        if (useApp.getState().account?.state === 'elsewhere') return;
        if (!backupDue({ dirty, lastSavedAt: session.savedAt, now: Date.now(), reason })) return;
      }
      busy = true;
      try {
        const now = Date.now();
        const result = await runBackup({ db, api, session, now, save: saveSession });
        if (result === 'saved') {
          dirty = false;
          setAccount({ email: session.email, savedAt: now, state: 'ok' });
        } else if (result === 'elsewhere' || result === 'offline') {
          setAccount({ email: session.email, savedAt: session.savedAt, state: result });
        } else if (result === 'signed-out') {
          await clearSession();
          setAccount(null);
        }
      } finally {
        busy = false;
      }
    };

    useApp.setState({ backupNow: () => run('now') });
    run('start');

    const unsubscribe = useApp.subscribe((s, prev) => {
      if (s.dataVersion === prev.dataVersion) return;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => run('change'), SETTLE_MS);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') run('background');
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
      useApp.setState({ backupNow: async () => {} });
    };
  }, [db]);

  return null;
}
