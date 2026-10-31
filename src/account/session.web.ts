import { randomUUID } from 'expo-crypto';

import { idbKv } from '../notify/web/kv';
import { deviceIdFrom } from './ids';
import type { AccountSession } from './types';

// On the web the session lives in IndexedDB, beside the web reminder data, and never in the app's
// database or its exported data.

const kv = idbKv();

export async function loadSession(): Promise<AccountSession | null> {
  try {
    return (await kv.get<AccountSession>('account')) ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(s: AccountSession): Promise<void> {
  await kv.set('account', s);
}

export async function clearSession(): Promise<void> {
  await kv.del('account');
}

/** This browser's id: made once, kept after signing out, so the server can tell a new device. */
export async function deviceId(): Promise<string> {
  const have = await kv.get<string>('device');
  if (have) return have;
  const id = deviceIdFrom(randomUUID());
  await kv.set('device', id);
  return id;
}
