import { b64url } from './identity';

/**
 * The id the server sees for a reminder: an HMAC of the planned id under this phone's secret, so
 * it says nothing about the dose, the time or the med, and can't be matched across phones.
 */
export async function opaqueId(secret: string, plannedId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(plannedId)))).slice(0, 22);
}
