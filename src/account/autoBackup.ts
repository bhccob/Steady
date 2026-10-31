import { getProfile } from '../db/dao/profile';
import type { Db } from '../db/types';
import { exportData } from '../settings/data';
import { AccountError, type AccountApi } from './api';
import type { AccountSession } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupReason = 'change' | 'background' | 'start';
export type BackupResult = 'saved' | 'elsewhere' | 'offline' | 'skipped' | 'signed-out';

/** After a change or on leaving the app, only if something changed; on start, also once a day. */
export function backupDue({ dirty, lastSavedAt, now, reason }: { dirty: boolean; lastSavedAt: number | null; now: number; reason: BackupReason }): boolean {
  if (reason !== 'start') return dirty;
  return dirty || lastSavedAt === null || now - lastSavedAt > DAY_MS;
}

/**
 * Sends everything on this device as the account's backup. Nothing leaves before setup is done
 * (no profile yet means 18+ isn't confirmed).
 */
export async function runBackup(deps: { db: Db; api: AccountApi; session: AccountSession; now: number; save: (s: AccountSession) => Promise<void> }): Promise<BackupResult> {
  const { db, api, session, now, save } = deps;
  if (!(await getProfile(db))) return 'skipped';
  try {
    await api.putBackup(session.token, await exportData(db, new Date(now).toISOString()));
  } catch (e) {
    if (e instanceof AccountError && e.status === 409) return 'elsewhere';
    if (e instanceof AccountError && e.status === 401) return 'signed-out';
    return 'offline';
  }
  await save({ ...session, savedAt: now });
  return 'saved';
}
