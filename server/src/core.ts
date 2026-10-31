import { KINDS, type Kind, type Reminder, type Store } from './types';

// The reminder server's routes. An install (one phone's installed web app) registers its push
// address, then replaces its whole list of upcoming reminders whenever the app syncs. Only ids,
// due times and kinds are kept; anything else in a request is ignored.

export const MAX_REMINDERS = 60;
const PAST_MS = 60 * 60 * 1000;
const AHEAD_MS = 14 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 60 * 1000;
const WRITES_PER_INSTALL = 30;
const REQUESTS_PER_IP = 120;

const ID = /^[A-Za-z0-9_-]{22}$/;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const KEY = /^[A-Za-z0-9_-]{1,200}$/;

export interface Deps {
  store: Store;
  now: number;
  /** The web app's addresses, comma-separated (it is served at more than one). */
  allowedOrigin: string;
  /** Secret: rate limits count a keyed hash of each address, never the address. */
  ipKey: string;
}

/** True when `origin` is one of the comma-separated `allowed` addresses, exactly. */
export function allowsOrigin(allowed: string, origin: string | null): origin is string {
  return origin !== null && allowed.split(',').some((a) => a.trim() === origin);
}

export async function handle(req: Request, { store, now, allowedOrigin, ipKey }: Deps): Promise<Response> {
  const origin = req.headers.get('Origin');
  if (!allowsOrigin(allowedOrigin, origin)) return new Response(null, { status: 403 });
  const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  const reply = (status: number) => new Response(null, { status, headers: cors });

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' },
    });
  }

  const window = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  // Hashed with the minute, so one address's rows can't be linked from minute to minute.
  const ip = await hmac(ipKey, `${window}|${req.headers.get('CF-Connecting-IP') ?? 'unknown'}`);
  if ((await store.countHit(`ip:${ip}`, window)) > REQUESTS_PER_IP) return reply(429);

  const path = new URL(req.url).pathname;

  if (req.method === 'PUT' && path === '/v1/install') {
    const body = await json(req);
    const id = body?.id, secret = body?.secret, sub = body?.subscription;
    if (typeof id !== 'string' || !ID.test(id) || typeof secret !== 'string' || !SECRET.test(secret)) return reply(400);
    if (!isSubscription(sub)) return reply(400);
    const secretHash = await sha256(secret);
    const existing = await store.getInstall(id);
    if (existing && !sameHash(existing.secretHash, secretHash)) return reply(403);
    if ((await store.countHit(`i:${id}`, window)) > WRITES_PER_INSTALL) return reply(429);
    await store.putInstall({ id, secretHash, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, touchedAt: now });
    return reply(204);
  }

  if (path === '/v1/install/reminders' || path === '/v1/install') {
    const install = await authorise(req, store);
    if (!install) return reply(401);
    if ((await store.countHit(`i:${install.id}`, window)) > WRITES_PER_INSTALL) return reply(429);

    if (req.method === 'DELETE' && path === '/v1/install') {
      await store.deleteInstall(install.id);
      return reply(204);
    }
    if (req.method === 'PUT' && path === '/v1/install/reminders') {
      const list = (await json(req))?.reminders;
      if (!Array.isArray(list)) return reply(400);
      if (list.length > MAX_REMINDERS) return reply(413);
      const reminders: Reminder[] = [];
      for (const r of list) {
        const rid = r?.id, kind = r?.kind, dueAt = typeof r?.dueAt === 'string' ? Date.parse(r.dueAt) : NaN;
        if (typeof rid !== 'string' || !ID.test(rid) || !KINDS.includes(kind as Kind)) return reply(400);
        if (!Number.isFinite(dueAt) || dueAt < now - PAST_MS || dueAt > now + AHEAD_MS) return reply(400);
        reminders.push({ rid, dueAt, kind: kind as Kind });
      }
      await store.replaceReminders(install.id, reminders);
      await store.putInstall({ ...install, touchedAt: now });
      return reply(204);
    }
  }

  return reply(404);
}

async function authorise(req: Request, store: Store) {
  const match = /^Bearer ([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(req.headers.get('Authorization') ?? '');
  if (!match) return null;
  const install = await store.getInstall(match[1]!);
  if (!install || !sameHash(install.secretHash, await sha256(match[2]!))) return null;
  return install;
}

function isSubscription(sub: unknown): sub is { endpoint: string; keys: { p256dh: string; auth: string } } {
  const s = sub as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  if (typeof s?.endpoint !== 'string' || s.endpoint.length > 2048) return false;
  try {
    if (new URL(s.endpoint).protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return typeof s.keys?.p256dh === 'string' && KEY.test(s.keys.p256dh) && typeof s.keys.auth === 'string' && KEY.test(s.keys.auth);
}

async function json(req: Request): Promise<Record<string, any> | null> {
  try {
    const value = await req.json();
    return value && typeof value === 'object' ? (value as Record<string, any>) : null;
  } catch {
    return null;
  }
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Imported once per Worker instance rather than on every request.
const hmacKeys = new Map<string, CryptoKey>();

/** Keyed hash, first 16 bytes as hex. */
export async function hmac(key: string, text: string): Promise<string> {
  const enc = new TextEncoder();
  let k = hmacKeys.get(key);
  if (!k) {
    k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    hmacKeys.set(key, k);
  }
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
  return [...mac.subarray(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two hashes in time that doesn't depend on where they differ. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
