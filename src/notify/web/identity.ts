import type { Kv } from './kv';

/** This phone's anonymous place on the reminder server: made here, once, and never tied to anything. */
export interface Identity {
  id: string;
  secret: string;
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function getIdentity(kv: Kv): Promise<Identity> {
  const known = await kv.get<Identity>('identity');
  if (known) return known;
  const made = { id: b64url(crypto.getRandomValues(new Uint8Array(16))), secret: b64url(crypto.getRandomValues(new Uint8Array(32))) };
  await kv.set('identity', made);
  return made;
}
