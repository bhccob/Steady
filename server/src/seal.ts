// Seals a backup before it is stored: gzip, then AES-GCM-256 with a key that lives only in the
// Worker's secrets, a fresh 12-byte IV each time, and the account id as additional data, so a
// sealed body only opens for the account it was made for. A copied database alone can't read it.

export async function seal(key: string, accountId: string, json: string): Promise<{ iv: string; body: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await squeeze(new TextEncoder().encode(json), new CompressionStream('gzip'));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(accountId) }, await aesKey(key), packed);
  return { iv: toBase64(iv), body: toBase64(new Uint8Array(sealed)) };
}

/** Throws when the body was sealed for another account, with another key, or has been changed. */
export async function open(key: string, accountId: string, sealed: { iv: string; body: string }): Promise<string> {
  const packed = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: new TextEncoder().encode(accountId) },
    await aesKey(key),
    fromBase64(sealed.body),
  );
  return new TextDecoder().decode(await squeeze(new Uint8Array(packed), new DecompressionStream('gzip')));
}

function aesKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(key).slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function squeeze(bytes: Uint8Array<ArrayBuffer>, through: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(through as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Reads base64 or base64url, padded or not. */
function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
