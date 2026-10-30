import { describe, expect, it } from 'vitest';

import { b64url, encryptPayload, fromB64url, vapidAuthorization } from '../src/webPush';

// The browser's side of RFC 8291, to check that what we encrypt opens with the subscriber's keys.
type Bytes = Uint8Array<ArrayBuffer>;
const utf8 = (text: string): Bytes => new Uint8Array(new TextEncoder().encode(text));

async function decrypt(body: Bytes, uaPrivate: CryptoKey, uaPublic: Bytes, authSecret: Bytes): Promise<string> {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrivate, 256));
  const hkdf = async (s: Bytes, ikm: Bytes, info: Bytes, bytes: number) =>
    new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), bytes * 8));
  const keyInfo = new Uint8Array([...utf8('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  expect(plain.at(-1)).toBe(2); // last-record delimiter
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe('web push', () => {
  it('encrypts a payload only the subscriber can read (RFC 8291, aes128gcm)', async () => {
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const uaPublic = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer);
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const body = await encryptPayload('{"id":"abc"}', b64url(uaPublic), b64url(authSecret));
    expect(await decrypt(body, ua.privateKey, uaPublic, authSecret)).toBe('{"id":"abc"}');
  });

  it('signs a VAPID token for the push service, verifiable with the public key', async () => {
    const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', keys.privateKey);
    const publicRaw = b64url(new Uint8Array((await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer));
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/xyz', { privateJwk: JSON.stringify(jwk), publicKey: publicRaw, subject: 'https://steady.example' }, Date.parse('2026-11-01T08:00:00Z'));
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(publicRaw);
    const [h, c, sig] = token!.split('.');
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(c!)));
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toBe('https://steady.example');
    expect(claims.exp).toBe(Date.parse('2026-11-01T08:00:00Z') / 1000 + 12 * 3600);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.publicKey, fromB64url(sig!), utf8(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});
