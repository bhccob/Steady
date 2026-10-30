import type { PushSender, PushTarget } from './types';

// Web Push with nothing but Web Crypto: the payload is encrypted for the subscriber (RFC 8291,
// aes128gcm) and the request is signed as Steady's server (VAPID, RFC 8292).

/** Bytes backed by a plain ArrayBuffer, the kind Web Crypto accepts. */
type Bytes = Uint8Array<ArrayBuffer>;

const utf8 = (text: string): Bytes => new Uint8Array(new TextEncoder().encode(text));

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(text: string): Bytes {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const concat = (...parts: Uint8Array[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** The encrypted request body for one push: salt, record size, our public key, then the ciphertext. */
export async function encryptPayload(payload: string, p256dh: string, authSecret: string): Promise<Bytes> {
  const uaPublic = fromB64url(p256dh);
  const auth = fromB64url(authSecret);
  const ours = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', ours.publicKey)) as ArrayBuffer);
  const theirs = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, ours.privateKey, 256));

  const ikm = await hkdf(auth, ecdh, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(utf8(payload), new Uint8Array([2])); // one record, so the last-record delimiter
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));

  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export interface VapidKeys {
  /** The private key as a JWK (JSON), kept as a Worker secret. */
  privateJwk: string;
  /** The public key, raw and base64url: the web app subscribes with the same value. */
  publicKey: string;
  /** Who runs this server: the web app's address. */
  subject: string;
}

/** `vapid t=<signed token>, k=<public key>`: the push service checks the token against the key. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now: number): Promise<string> {
  const header = b64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })));
  const signingKey = await crypto.subtle.importKey('jwk', JSON.parse(keys.privateJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, utf8(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`;
}

export function webPushSender(keys: VapidKeys, now: () => number = Date.now): PushSender {
  return {
    async send(target: PushTarget, payload: string) {
      try {
        const res = await fetch(target.endpoint, {
          method: 'POST',
          headers: {
            Authorization: await vapidAuthorization(target.endpoint, keys, now()),
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '3600',
            Urgency: 'high',
          },
          body: await encryptPayload(payload, target.p256dh, target.auth),
        });
        if (res.status === 404 || res.status === 410) return 'gone';
        return res.ok ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    },
  };
}
