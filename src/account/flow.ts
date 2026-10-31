import { getProfile } from '../db/dao/profile';
import type { Db } from '../db/types';
import { reconcileDoses } from '../doses/reconcile';
import { importData } from '../settings/data';
import { useApp } from '../state/app';
import type { AccountApi } from './api';

/** This device has finished setup, so it has something of its own to keep or back up. */
export async function hasLocalData(db: Db): Promise<boolean> {
  return (await getProfile(db)) !== null;
}

/**
 * Brings the account's backup onto this device, all or nothing, then makes this device the one
 * that backs up and rebuilds the coming doses. The caller syncs reminders and refreshes screens.
 */
export async function restoreFromBackup({ db, api, token }: { db: Db; api: AccountApi; token: string }): Promise<{ name: string }> {
  const backup = await api.getBackup(token);
  if (!backup) throw new Error('No backup was found for this account.');
  await importData(db, backup.data);
  await api.claim(token);
  const profile = await getProfile(db);
  if (profile) await reconcileDoses(db, { now: new Date().toISOString(), timezone: profile.timezone, notBefore: profile.createdAt });
  return { name: profile?.displayName.trim() ?? '' };
}

export type RestoreStep = 'working' | 'done' | 'newer' | 'problem';
export type RestoreChoice = 'retry' | 'set-up-without' | 'reminders' | 'not-now';

/** What the restore screen offers at each step. A failed or too-new backup always has a way out. */
export function restoreChoices(step: RestoreStep): RestoreChoice[] {
  if (step === 'problem') return ['retry', 'set-up-without'];
  if (step === 'newer') return ['set-up-without'];
  if (step === 'done') return ['reminders', 'not-now'];
  return [];
}

/**
 * Signs this device out without touching the server, before a fresh start: a device set up fresh
 * while still signed in could later be told to replace the real backup with that fresh start.
 */
export async function forgetAccountHere(clear: () => Promise<void>): Promise<void> {
  await clear();
  useApp.getState().setAccount(null);
}
