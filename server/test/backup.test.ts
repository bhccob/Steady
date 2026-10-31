import { beforeEach, describe, expect, it } from 'vitest';

import { handleAccount, type AccountDeps } from '../src/account';
import type { Mailer } from '../src/mail';
import { fromBase64, open, seal, toBase64 } from '../src/seal';
import { memoryAccountStore } from './memoryAccountStore';
import { memoryStore } from './memoryStore';

const ORIGIN = 'https://steady.example';
const KEY = 'q'.repeat(43);
const DEVICE_A = 'A'.repeat(22);
const DEVICE_B = 'B'.repeat(22);

let store: ReturnType<typeof memoryAccountStore>;
let mail: string[];
let now: number;
const mailer: Mailer = {
  async send(_to, _subject, text) {
    mail.push(text);
    return true;
  },
};
const deps = (): AccountDeps => ({ store, hits: memoryStore(), mailer, now, allowedOrigin: ORIGIN, ipKey: 'ip-key', accountKey: 'account-key', backupKey: KEY });

function req(method: string, path: string, body?: unknown, token?: string) {
  return new Request(`https://api.example${path}`, {
    method,
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const call = (method: string, path: string, body?: unknown, token?: string) => handleAccount(req(method, path, body, token), deps());

async function signIn(deviceId: string, email = 'sam@example.com'): Promise<string> {
  now += 31_000;
  await call('POST', '/v1/account/code', { email, consent: true });
  const code = /(\d{6})/.exec(mail.at(-1) ?? '')![1];
  const res = await call('POST', '/v1/account/session', { email, code, deviceId });
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

const exportOf = (extra: Record<string, unknown> = {}) => ({ app: 'Steady', schemaVersion: 7, exportedAt: '2026-11-01T08:00:00.000Z', tables: { profile: [{ display_name: 'robin' }], ...extra } });

/** What the phone sends: the export as JSON, gzipped, as base64. */
async function packed(data: unknown): Promise<string> {
  const stream = new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return toBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
}
const backupOf = async (extra: Record<string, unknown> = {}) => ({ schemaVersion: 7, gz: await packed(exportOf(extra)) });

beforeEach(() => {
  store = memoryAccountStore();
  mail = [];
  now = Date.parse('2026-11-01T08:00:00Z');
});

describe('backups', () => {
  it('stores a backup that a copied database cannot read, and gives back what the phone sent', async () => {
    const token = await signIn(DEVICE_A);
    const gz = await packed(exportOf({ meds: [{ label: 'robin-pill-marker' }] }));
    expect((await call('PUT', '/v1/account/backup', { schemaVersion: 7, gz }, token)).status).toBe(204);
    expect(JSON.stringify(store.dump())).not.toContain(gz.slice(0, 60));
    const got = await call('GET', '/v1/account/backup', undefined, token);
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual({ savedAt: now, schemaVersion: 7, gz });
  });

  it('answers 404 before the first backup, and reports status', async () => {
    const token = await signIn(DEVICE_A);
    expect((await call('GET', '/v1/account/backup', undefined, token)).status).toBe(404);
    expect(await (await call('GET', '/v1/account', undefined, token)).json()).toEqual({ active: true, savedAt: null });
  });

  it('round-trips a year of history', async () => {
    const token = await signIn(DEVICE_A);
    const doses = Array.from({ length: 2000 }, (_, i) => ({ id: `dose-${i}`, med_id: 'med-1', due_at_utc: new Date(Date.UTC(2026, 0, 1) + i * 4.38 * 3_600_000).toISOString(), status: i % 7 ? 'taken_ontime' : 'pending' }));
    const gz = await packed(exportOf({ doses }));
    expect((await call('PUT', '/v1/account/backup', { schemaVersion: 7, gz }, token)).status).toBe(204);
    expect(((await (await call('GET', '/v1/account/backup', undefined, token)).json()) as { gz: unknown }).gz).toBe(gz);
  });

  it('refuses a packed backup too big for a database row', async () => {
    const token = await signIn(DEVICE_A);
    expect((await call('PUT', '/v1/account/backup', { schemaVersion: 7, gz: 'H4sI' + 'A'.repeat(1_900_000) }, token)).status).toBe(413);
    expect(store.dump()).toMatchObject({ backups: [] });
  });

  it('refuses a body that is not a packed backup', async () => {
    const token = await signIn(DEVICE_A);
    for (const body of [{ schemaVersion: 7, data: exportOf() }, { schemaVersion: 7, gz: btoa('{"app":"Steady"}') }, { schemaVersion: 7, gz: 'H4sI!!' }, { schemaVersion: 7, gz: 'H4sIA' }, { gz: await packed(exportOf()) }, '{']) {
      expect((await call('PUT', '/v1/account/backup', body, token)).status).toBe(400);
    }
    expect(store.dump()).toMatchObject({ backups: [] });
  });

  it('refuses a backup from a device that is not the active one, until it claims', async () => {
    const a = await signIn(DEVICE_A);
    expect((await call('PUT', '/v1/account/backup', await backupOf(), a)).status).toBe(204);
    const b = await signIn(DEVICE_B);
    const refused = await call('PUT', '/v1/account/backup', await backupOf(), b);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ reason: 'other-device' });
    expect((await call('POST', '/v1/account/claim', undefined, b)).status).toBe(204);
    expect((await call('PUT', '/v1/account/backup', await backupOf(), b)).status).toBe(204);
    expect((await call('PUT', '/v1/account/backup', await backupOf(), a)).status).toBe(409);
    expect(await (await call('GET', '/v1/account', undefined, a)).json()).toMatchObject({ active: false });
  });

  it('lets a second device back up when the account has no backup yet', async () => {
    await signIn(DEVICE_A);
    const b = await signIn(DEVICE_B);
    expect((await call('PUT', '/v1/account/backup', await backupOf(), b)).status).toBe(204);
  });

  it('signs out one device, then every device', async () => {
    const a = await signIn(DEVICE_A);
    const b = await signIn(DEVICE_B);
    expect((await call('DELETE', '/v1/account/session', undefined, a)).status).toBe(204);
    expect((await call('GET', '/v1/account', undefined, a)).status).toBe(401);
    expect((await call('GET', '/v1/account', undefined, b)).status).toBe(200);
    const c = await signIn(DEVICE_A);
    expect((await call('DELETE', '/v1/account/sessions', undefined, c)).status).toBe(204);
    expect((await call('GET', '/v1/account', undefined, b)).status).toBe(401);
    expect((await call('GET', '/v1/account', undefined, c)).status).toBe(401);
  });

  it('deletes the account and its backups, and the old token stops working', async () => {
    const token = await signIn(DEVICE_A);
    await call('PUT', '/v1/account/backup', await backupOf(), token);
    expect((await call('DELETE', '/v1/account', undefined, token)).status).toBe(204);
    expect((await call('GET', '/v1/account/backup', undefined, token)).status).toBe(401);
    expect(store.dump()).toEqual({ accounts: [], codes: [], sends: expect.any(Array), sessions: [], devices: [], backups: [] });
  });

  it('refuses a missing or unknown token', async () => {
    expect((await call('GET', '/v1/account')).status).toBe(401);
    expect((await call('GET', '/v1/account', undefined, 'x'.repeat(43))).status).toBe(401);
  });

  it('cannot open a backup sealed for another account', async () => {
    const bytes = fromBase64(await packed({ a: 1 }));
    const sealed = await seal(KEY, 'account-1', bytes);
    expect(await open(KEY, 'account-1', sealed)).toEqual(bytes);
    await expect(open(KEY, 'account-2', sealed)).rejects.toThrow();
    await expect(open(KEY, 'account-1', { ...sealed, body: sealed.body.slice(0, -4) + 'AAAA' })).rejects.toThrow();
  });
});
