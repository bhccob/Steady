import { beforeEach, describe, expect, it } from 'vitest';

import { handleAccount, type AccountDeps } from '../src/account';
import { handle } from '../src/core';
import type { Mailer } from '../src/mail';
import { memoryAccountStore } from './memoryAccountStore';
import { memoryStore } from './memoryStore';

const ORIGIN = 'https://steady.example';
const START = Date.parse('2026-11-01T08:00:00Z');
const DEVICE_A = 'A'.repeat(22);
const DEVICE_B = 'B'.repeat(22);

let store: ReturnType<typeof memoryAccountStore>;
let hits: ReturnType<typeof memoryStore>;
let mail: { to: string; subject: string; text: string }[];
let now: number;

const mailer: Mailer = {
  async send(to, subject, text) {
    mail.push({ to, subject, text });
    return true;
  },
};

const deps = (): AccountDeps => ({ store, hits, mailer, now, allowedOrigin: ORIGIN, ipKey: 'ip-key', accountKey: 'account-key', backupKey: 'k'.repeat(43) });

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = { Origin: ORIGIN }, ip = '203.0.113.7') {
  return new Request(`https://api.example${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const askCode = (email = 'sam@example.com') => handleAccount(req('POST', '/v1/account/code', { email, consent: true }), deps());
const lastCode = () => /(\d{6})/.exec(mail.filter((m) => m.subject.startsWith('Your Steady code')).at(-1)?.text ?? '')?.[1] ?? '';
const signIn = (code: string, email = 'sam@example.com', deviceId = DEVICE_A) => handleAccount(req('POST', '/v1/account/session', { email, code, deviceId }), deps());

async function signInFresh(email = 'sam@example.com', deviceId = DEVICE_A) {
  expect((await askCode(email)).status).toBe(204);
  const res = await signIn(lastCode(), email, deviceId);
  now += 31_000;
  return res;
}

beforeEach(() => {
  store = memoryAccountStore();
  hits = memoryStore();
  mail = [];
  now = START;
});

describe('codes and signing in', () => {
  it('sends a 6-digit code and answers the same for new and known emails', async () => {
    const first = await askCode();
    expect(first.status).toBe(204);
    expect(mail[0]).toMatchObject({ to: 'sam@example.com', subject: expect.stringMatching(/^Your Steady code: \d{6}$/) });
    expect(mail[0]!.text).toMatch(/^Your Steady sign-in code is \d{6}\. It works for 10 minutes\./);
    await signIn(lastCode());
    now += 31_000;
    const known = await askCode();
    expect(known.status).toBe(first.status);
    expect(await known.text()).toBe('');
  });

  it('treats " Sam@Example.com " and "sam@example.com" as one account', async () => {
    expect((await signInFresh(' Sam@Example.com ')).status).toBe(200);
    expect((await signInFresh('sam@example.com')).status).toBe(200);
    expect((store.dump() as { accounts: unknown[] }).accounts).toHaveLength(1);
  });

  it('never stores the email address', async () => {
    await signInFresh(' Sam@Example.com ');
    const all = JSON.stringify(store.dump()) + JSON.stringify(hits.dump());
    expect(all.toLowerCase()).not.toContain('sam@example.com');
  });

  it('refuses a second code within 30 s and a sixth within the hour', async () => {
    expect((await askCode()).status).toBe(204);
    now += 10_000;
    expect((await askCode()).status).toBe(429);
    for (let i = 0; i < 4; i++) {
      now += 31_000;
      expect((await askCode()).status).toBe(204);
    }
    now += 31_000;
    expect((await askCode()).status).toBe(429);
  });

  it('refuses a bad email or a missing yes to the backup', async () => {
    expect((await handleAccount(req('POST', '/v1/account/code', { email: 'sam@', consent: true }), deps())).status).toBe(400);
    expect((await handleAccount(req('POST', '/v1/account/code', { email: 'sam@example.com' }), deps())).status).toBe(400);
    expect(mail).toHaveLength(0);
  });

  it('signs in with the right code once, and refuses it after 5 wrong tries or after 10 minutes', async () => {
    await askCode();
    const code = lastCode();
    const ok = await signIn(code);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), isNew: true, hasBackup: false, savedAt: null });
    expect((await signIn(code)).status).toBe(401);

    now += 31_000;
    await askCode();
    const second = lastCode();
    const wrong = second === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) expect((await signIn(wrong)).status).toBe(401);
    expect((await signIn(second)).status).toBe(401);

    now += 31_000;
    await askCode();
    const third = lastCode();
    now += 10 * 60_000;
    const late = await signIn(third);
    expect(late.status).toBe(401);
    expect(await late.json()).toEqual({ reason: 'code-expired' });
  });

  it('emails about a new device only for an account that already had one', async () => {
    await signInFresh('sam@example.com', DEVICE_A);
    expect(mail.filter((m) => m.subject === 'New sign-in to Steady')).toHaveLength(0);
    await signInFresh('sam@example.com', DEVICE_B);
    const alerts = mail.filter((m) => m.subject === 'New sign-in to Steady');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.text).toBe('You signed in to Steady on a new device. If this wasn\'t you, open Steady on your phone and choose Sign out everywhere in Settings.');
    await signInFresh('sam@example.com', DEVICE_B);
    expect(mail.filter((m) => m.subject === 'New sign-in to Steady')).toHaveLength(1);
  });

  it('serves the Android app (no Origin) and the web app, and refuses other origins', async () => {
    const body = { email: 'sam@example.com', consent: true };
    expect((await handleAccount(req('POST', '/v1/account/code', body, {}), deps())).status).toBe(204);
    now += 31_000;
    const web = await handleAccount(req('POST', '/v1/account/code', body), deps());
    expect(web.status).toBe(204);
    expect(web.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    now += 31_000;
    expect((await handleAccount(req('POST', '/v1/account/code', body, { Origin: 'https://evil.example' }), deps())).status).toBe(403);
    const install = await handle(req('PUT', '/v1/install', { id: 'A'.repeat(22), secret: 'S'.repeat(43) }, {}), { store: hits, now, allowedOrigin: ORIGIN, ipKey: 'ip-key' });
    expect(install.status).toBe(403);
  });

  it('serves the web app at each of its addresses', async () => {
    const both = { ...deps(), allowedOrigin: `https://steadyapp.example,${ORIGIN}` };
    const res = await handleAccount(req('POST', '/v1/account/code', { email: 'sam@example.com', consent: true }, { Origin: 'https://steadyapp.example' }), both);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://steadyapp.example');
    expect((await handleAccount(req('GET', '/v1/account', undefined, { Origin: 'https://other.example' }), both)).status).toBe(403);
  });

  it('keeps health words out of every email', async () => {
    await signInFresh('sam@example.com', DEVICE_A);
    await signInFresh('sam@example.com', DEVICE_B);
    expect(mail.length).toBeGreaterThan(2);
    for (const m of mail) for (const word of ['pill', 'mood', 'med']) expect(`${m.subject} ${m.text}`.toLowerCase()).not.toContain(word);
  });

  it('lets one address ask for at most 10 codes an hour, whatever the emails', async () => {
    for (let i = 0; i < 10; i++) expect((await askCode(`p${i}@example.com`)).status).toBe(204);
    expect((await askCode('p10@example.com')).status).toBe(429);
    now += 60 * 60_000;
    expect((await askCode('p11@example.com')).status).toBe(204);
  });

  it("stops sending sign-in emails before the email service's daily limit", async () => {
    for (let i = 0; i < 90; i++) {
      const res = await handleAccount(req('POST', '/v1/account/code', { email: `d${i}@example.com`, consent: true }, { Origin: ORIGIN }, `198.51.100.${i}`), deps());
      expect(res.status).toBe(204);
    }
    const over = await handleAccount(req('POST', '/v1/account/code', { email: 'late@example.com', consent: true }, { Origin: ORIGIN }, '192.0.2.1'), deps());
    expect(over.status).toBe(429);
    expect(mail).toHaveLength(90);
  });

  it('rate-limits account requests per address', async () => {
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await handleAccount(req('POST', '/v1/account/code', { email: `p${i}@example.com`, consent: true }), deps())).status;
    expect(last).toBe(429);
  });
});
