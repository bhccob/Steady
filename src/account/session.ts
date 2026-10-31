import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { deviceIdFrom } from './ids';
import type { AccountSession } from './types';

// On the phone the session lives in the system's secure storage (Android Keystore), never in the
// app's database or its exported data. The web build uses session.web.ts instead.

const SESSION = 'steady.account';
const DEVICE = 'steady.device';

export async function loadSession(): Promise<AccountSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION);
    return raw ? (JSON.parse(raw) as AccountSession) : null;
  } catch {
    return null;
  }
}

export async function saveSession(s: AccountSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION, JSON.stringify(s));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION);
}

/** This device's id: made once, kept after signing out, so the server can tell a new device. */
export async function deviceId(): Promise<string> {
  const have = await SecureStore.getItemAsync(DEVICE);
  if (have) return have;
  const id = deviceIdFrom(randomUUID());
  await SecureStore.setItemAsync(DEVICE, id);
  return id;
}
