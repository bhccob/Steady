import type { AccountStore } from './accountTypes';
import { hmac, sameHash, sha256 } from './core';
import type { Mailer } from './mail';
import type { Store } from './types';

// Optional accounts: sign in with an emailed 6-digit code, then keep one sealed backup
// (spec: docs/superpowers/specs/2026-10-30-email-account-backup-design.md). The email address is
// only ever held as a keyed hash; codes and tokens only as hashes.

export interface AccountDeps {
  store: AccountStore;
  /** The reminder server's hit counter: one per-address limit across all routes. */
  hits: Pick<Store, 'countHit'>;
  mailer: Mailer;
  now: number;
  allowedOrigin: string;
  ipKey: string;
  /** Secret: keys the email and code hashes. */
  accountKey: string;
  /** Secret: seals backups (32 bytes, base64url). */
  backupKey: string;
}

const MIN = 60 * 1000;
const CODE_LIFE_MS = 10 * MIN;
const CODE_TRIES = 5;
const RESEND_AFTER_MS = 30 * 1000;
const CODES_PER_HOUR = 5;
const REQUESTS_PER_IP = 120;

const DEVICE = /^[A-Za-z0-9_-]{22}$/;
const CODE = /^\d{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NEW_DEVICE_SUBJECT = 'New sign-in to Steady';
export const NEW_DEVICE_TEXT = "You signed in to Steady on a new device. If this wasn't you, open Steady on your phone and choose Sign out everywhere in Settings.";
const codeSubject = (code: string) => `Your Steady code: ${code}`;
const codeText = (code: string) => `Your Steady sign-in code is ${code}. It works for 10 minutes. If you didn't ask for it, you can ignore this email.`;

/** Trimmed and lowercased, or null when it isn't an email address. */
export function normaliseEmail(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const email = s.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export async function handleAccount(req: Request, deps: AccountDeps): Promise<Response> {
  const { store, hits, mailer, now, allowedOrigin, ipKey, accountKey } = deps;
  // The Android app sends no Origin; browsers always do, and only the web app's is welcome.
  const origin = req.headers.get('Origin');
  if (origin !== null && origin !== allowedOrigin) return new Response(null, { status: 403 });
  const cors: Record<string, string> = origin ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' } : {};
  const reply = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: body === undefined ? cors : { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' },
    });
  }

  const window = Math.floor(now / MIN) * MIN;
  const ip = await hmac(ipKey, `${window}|${req.headers.get('CF-Connecting-IP') ?? 'unknown'}`);
  if ((await hits.countHit(`ip:${ip}`, window)) > REQUESTS_PER_IP) return reply(429);

  const path = new URL(req.url).pathname;
  const emailHash = (email: string) => hmac(accountKey, `email|${email}`);
  const codeHash = (hash: string, code: string) => hmac(accountKey, `code|${hash}|${code}`);

  if (req.method === 'POST' && path === '/v1/account/code') {
    const body = await json(req);
    const email = normaliseEmail(body?.email);
    if (!email || body?.consent !== true) return reply(400);
    const hash = await emailHash(email);
    if ((await store.codesSentSince(hash, now - RESEND_AFTER_MS)) > 0) return reply(429);
    if ((await store.codesSentSince(hash, now - 60 * MIN)) >= CODES_PER_HOUR) return reply(429);
    const code = sixDigits();
    await store.putCode({ emailHash: hash, codeHash: await codeHash(hash, code), expiresAt: now + CODE_LIFE_MS, tries: 0, sentAt: now });
    await store.noteCodeSent(hash, now);
    if (!(await mailer.send(email, codeSubject(code), codeText(code)))) return reply(503);
    return reply(204);
  }

  if (req.method === 'POST' && path === '/v1/account/session') {
    const body = await json(req);
    const email = normaliseEmail(body?.email);
    const code = body?.code, deviceId = body?.deviceId;
    if (!email || typeof code !== 'string' || !CODE.test(code) || typeof deviceId !== 'string' || !DEVICE.test(deviceId)) return reply(400);
    const hash = await emailHash(email);
    const saved = await store.getCode(hash);
    if (!saved || saved.expiresAt <= now || saved.tries >= CODE_TRIES) {
      if (saved) await store.deleteCode(hash);
      return reply(401, { reason: 'code-expired' });
    }
    if (!sameHash(saved.codeHash, await codeHash(hash, code))) {
      if (saved.tries + 1 >= CODE_TRIES) await store.deleteCode(hash);
      else await store.bumpTries(hash);
      return reply(401, { reason: 'wrong-code' });
    }
    await store.deleteCode(hash);

    let account = await store.accountByEmail(hash);
    const isNew = account === null;
    if (!account) {
      account = { id: randomId(16), emailHash: hash, activeDevice: deviceId, createdAt: now };
      await store.createAccount(account);
    } else {
      if (!account.activeDevice) await store.setActiveDevice(account.id, deviceId);
      if (!(await store.knowsDevice(account.id, deviceId))) await mailer.send(email, NEW_DEVICE_SUBJECT, NEW_DEVICE_TEXT);
    }
    await store.noteDevice(account.id, deviceId);

    const token = randomId(32);
    await store.createSession({ tokenHash: await sha256(token), accountId: account.id, deviceId, createdAt: now, lastSeen: now });
    const latest = await store.getBackup(account.id, 0);
    return reply(200, { token, isNew, hasBackup: latest !== null, savedAt: latest?.savedAt ?? null });
  }

  return reply(404);
}

/** A uniform 6-digit code: rejection sampling, so no number is likelier than another. */
function sixDigits(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return String(buf[0]! % 1_000_000).padStart(6, '0');
  }
}

/** `bytes` random bytes as base64url, no padding. */
export function randomId(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function json(req: Request): Promise<Record<string, any> | null> {
  try {
    const value = await req.json();
    return value && typeof value === 'object' ? (value as Record<string, any>) : null;
  } catch {
    return null;
  }
}
