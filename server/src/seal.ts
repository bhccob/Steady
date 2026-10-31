// Seals a backup before it is stored: AES-GCM-256 with a key that lives only in the Worker's
// secrets, a fresh 12-byte IV each time, and the account id as additional data, so a sealed body
// only opens for the account it was made for. A copied database alone can't read it. The phone
// gzips the backup before sending it, so there is nothing to compress here.

export async function seal(key: string, accountId: string, bytes: Uint8Array<ArrayBuffer>): Promise<{ iv: string; body: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(accountId) }, await aesKey(key), bytes);
  return { iv: toBase64(iv), body: toBase64(new Uint8Array(sealed)) };
}

/** Throws when the body was sealed for another account, with another key, or has been changed. */
export async function open(key: string, accountId: string, sealed: { iv: string; body: string }): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: new TextEncoder().encode(accountId) },
    await aesKey(key),
    fromBase64(sealed.body),
  );
  return new Uint8Array(bytes);
}

// Imported once per Worker instance rather than on every request.
const aesKeys = new Map<string, CryptoKey>();

/** The key is base64url, as scripts/random-key.mjs writes it; plain base64 works too. */
async function aesKey(key: string): Promise<CryptoKey> {
  let k = aesKeys.get(key);
  if (!k) {
    k = await crypto.subtle.importKey('raw', fromBase64(key.replace(/-/g, '+').replace(/_/g, '/')).slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
    aesKeys.set(key, k);
  }
  return k;
}

// Cloudflare's runtime reads and writes base64 natively, which keeps a big backup inside the free
// plan's CPU time. Node, where the tests run, doesn't have it yet, so it gets the JS below.
const native = {
  from: (Uint8Array as unknown as { fromBase64?: (text: string) => Uint8Array<ArrayBuffer> }).fromBase64,
  to: (Uint8Array.prototype as unknown as { toBase64?: (this: Uint8Array) => string }).toBase64,
};

export function toBase64(bytes: Uint8Array): string {
  if (native.to) return native.to.call(bytes);
  // apply with small chunks: spreading big chunks into fromCharCode is much slower.
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x1000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x1000) as unknown as number[]);
  return btoa(s);
}

/** Reads base64, padded or not. */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  if (native.from) return native.from.call(Uint8Array, text);
  const bin = atob(text + '='.repeat((4 - (text.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
