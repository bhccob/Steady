import { beforeEach, describe, expect, it } from 'vitest';

import { handle } from '../src/core';
import { memoryStore } from './memoryStore';

const ORIGIN = 'https://steady.example';
const NOW = Date.parse('2026-11-01T08:00:00Z');
const ID = 'AAAAAAAAAAAAAAAAAAAAAA'; // 22 base64url characters
const SECRET = 'S'.repeat(43);
const SUB = { endpoint: 'https://push.example/abc', keys: { p256dh: 'B'.repeat(87), auth: 'C'.repeat(22) } };

let store: ReturnType<typeof memoryStore>;
const deps = () => ({ store, now: NOW, allowedOrigin: ORIGIN, ipKey: 'test-ip-key' });

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://reminders.example${path}`, {
    method,
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const auth = (secret = SECRET) => ({ Authorization: `Bearer ${ID}.${secret}` });
const register = () => handle(req('PUT', '/v1/install', { id: ID, secret: SECRET, subscription: SUB }), deps());
const reminder = (over: Record<string, unknown> = {}) => ({ id: 'r'.repeat(22), dueAt: '2026-11-01T09:00:00.000Z', kind: 'dose', ...over });

beforeEach(() => {
  store = memoryStore();
});

describe('routes', () => {
  it('registers an install and refuses the same id with another secret', async () => {
    expect((await register()).status).toBe(204);
    const other = await handle(req('PUT', '/v1/install', { id: ID, secret: 'X'.repeat(43), subscription: SUB }), deps());
    expect(other.status).toBe(403);
  });

  it('replaces reminders and keeps only id, due time and kind', async () => {
    await register();
    const body = { reminders: [reminder({ body: "robin, a small mark when you're ready.", doseIds: ['d-1'] })] };
    const res = await handle(req('PUT', '/v1/install/reminders', body, auth()), deps());
    expect(res.status).toBe(204);
    expect((store.dump() as { reminders: Record<string, unknown> }).reminders[ID]).toEqual([{ rid: 'r'.repeat(22), dueAt: Date.parse('2026-11-01T09:00:00.000Z'), kind: 'dose' }]);
    expect(JSON.stringify(store.dump())).not.toContain('robin');
    expect(JSON.stringify(store.dump())).not.toContain('d-1');
  });

  it('refuses more than 60 reminders', async () => {
    await register();
    const many = Array.from({ length: 61 }, (_, i) => reminder({ id: `${String(i).padStart(2, '0')}${'r'.repeat(20)}` }));
    expect((await handle(req('PUT', '/v1/install/reminders', { reminders: many }, auth()), deps())).status).toBe(413);
  });

  it('refuses unknown kinds and due times outside 1 h ago to 14 days ahead', async () => {
    await register();
    const put = (r: object) => handle(req('PUT', '/v1/install/reminders', { reminders: [r] }, auth()), deps());
    expect((await put(reminder({ kind: 'medication' }))).status).toBe(400);
    expect((await put(reminder({ dueAt: '2026-11-01T06:30:00.000Z' }))).status).toBe(400);
    expect((await put(reminder({ dueAt: '2026-11-16T08:00:00.000Z' }))).status).toBe(400);
    expect((await put(reminder({ id: 'not an id' }))).status).toBe(400);
  });

  it('needs the right bearer', async () => {
    await register();
    expect((await handle(req('PUT', '/v1/install/reminders', { reminders: [] }), deps())).status).toBe(401);
    expect((await handle(req('PUT', '/v1/install/reminders', { reminders: [] }, auth('W'.repeat(43))), deps())).status).toBe(401);
  });

  it("answers only the Steady web app's origin", async () => {
    const other = await handle(req('PUT', '/v1/install', { id: ID, secret: SECRET, subscription: SUB }, { Origin: 'https://evil.example' }), deps());
    expect(other.status).toBe(403);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const preflight = await handle(req('OPTIONS', '/v1/install'), deps());
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('answers the web app at each of its addresses, and names the one that asked', async () => {
    const both = { ...deps(), allowedOrigin: `https://steadyapp.example, ${ORIGIN}` };
    for (const origin of ['https://steadyapp.example', ORIGIN]) {
      const preflight = await handle(req('OPTIONS', '/v1/install', undefined, { Origin: origin }), both);
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
    expect((await handle(req('OPTIONS', '/v1/install', undefined, { Origin: 'https://steadyapp.example.evil' }), both)).status).toBe(403);
  });

  it('rate-limits writes', async () => {
    await register();
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await handle(req('PUT', '/v1/install/reminders', { reminders: [] }, auth()), deps())).status;
    expect(last).toBe(429);
  });

  it('rate-limits each address without keeping the address', async () => {
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await handle(req('PUT', '/v1/install/reminders', { reminders: [] }), deps())).status;
    expect(last).toBe(429);
    const other = await handle(req('PUT', '/v1/install/reminders', { reminders: [] }, { 'CF-Connecting-IP': '198.51.100.1' }), deps());
    expect(other.status).toBe(401);
    expect(JSON.stringify(store.dump())).not.toContain('203.0.113.7');
  });

  it('deletes an install and its reminders', async () => {
    await register();
    await handle(req('PUT', '/v1/install/reminders', { reminders: [reminder()] }, auth()), deps());
    expect((await handle(req('DELETE', '/v1/install', undefined, auth()), deps())).status).toBe(204);
    expect(await store.getInstall(ID)).toBeNull();
    expect(await store.due(NOW + 86_400_000, 10)).toEqual([]);
  });
});
