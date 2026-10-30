import { WEB_COPY } from '../../copy';
import type { Planned } from '../../plan';
import { memoryKv, type Kv } from '../kv';
import { createWebPushPort } from '../webPushPort';

type Sent = { id: string; dueAt: string; kind: string };

function fakeApi() {
  const calls: { name: string; args: unknown[] }[] = [];
  let failing = false;
  return {
    calls,
    fail(on: boolean) {
      failing = on;
    },
    lastList: () => [...calls].reverse().find((c) => c.name === 'putReminders')?.args[1] as Sent[] | undefined,
    async putInstall(...args: unknown[]) {
      calls.push({ name: 'putInstall', args });
    },
    async putReminders(...args: unknown[]) {
      if (failing) throw new Error('offline');
      calls.push({ name: 'putReminders', args });
    },
    async deleteInstall(...args: unknown[]) {
      calls.push({ name: 'deleteInstall', args });
    },
  };
}

const planned = (over: Partial<Planned> = {}): Planned => ({
  id: 'dose:2026-11-01T08:00:00.000Z:0',
  fireAt: '2026-11-01T08:00:00.000Z',
  body: "robin, a small mark when you're ready.",
  category: 'dose',
  data: { kind: 'dose', doseIds: ['d-1'] },
  ...over,
});

let kv: Kv;
let api: ReturnType<typeof fakeApi>;
let port: ReturnType<typeof createWebPushPort>;

beforeEach(async () => {
  kv = memoryKv();
  api = fakeApi();
  port = createWebPushPort({ kv, api, permitted: async () => true });
  await kv.set('registered', true);
});

describe('webPushPort', () => {
  it('keeps the words on the phone and sends the server only an opaque id, time and kind', async () => {
    await port.schedule(planned());
    await port.flush();
    const list = api.lastList()!;
    const dose = list.find((r) => r.kind === 'dose')!;
    expect(dose.id).not.toBe(planned().id);
    expect(dose.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(dose.dueAt).toBe('2026-11-01T08:00:00.000Z');
    const everything = JSON.stringify(api.calls);
    for (const secret of ['robin', planned().id, 'd-1', 'small mark']) expect(everything).not.toContain(secret);
  });

  it('answers scheduled() with what diffSchedule expects', async () => {
    await port.schedule(planned());
    expect(await port.scheduled()).toEqual([{ id: planned().id, fireAt: planned().fireAt, body: planned().body }]);
  });

  it('remembers a cancelled reminder for the service worker', async () => {
    await port.schedule(planned());
    await port.flush();
    const oid = api.lastList()!.find((r) => r.kind === 'dose')!.id;
    await port.cancel(planned().id);
    await port.flush();
    expect(await kv.get(`tomb:${oid}`)).toBeDefined();
    expect(await kv.get(`rem:${oid}`)).toBeUndefined();
    expect(api.lastList()!.some((r) => r.id === oid)).toBe(false);
  });

  it("keeps changes pending when the server can't be reached, and sends them later", async () => {
    api.fail(true);
    await port.schedule(planned());
    await port.flush();
    expect(await kv.get('pending')).toBe(true);
    api.fail(false);
    await port.flush();
    expect(await kv.get('pending')).toBe(false);
    expect(api.lastList()!.some((r) => r.kind === 'dose')).toBe(true);
  });

  it('adds one keep-coming notice an hour after the last reminder', async () => {
    await port.schedule(planned({ id: 'a', fireAt: '2026-11-01T08:00:00.000Z' }));
    await port.schedule(planned({ id: 'b', fireAt: '2026-11-01T20:00:00.000Z' }));
    await port.flush();
    let keeps = api.lastList()!.filter((r) => r.kind === 'keep');
    expect(keeps.map((k) => k.dueAt)).toEqual(['2026-11-01T21:00:00.000Z']);
    const keepRec = await kv.get<{ body: string }>(`rem:${keeps[0]!.id}`);
    expect(keepRec?.body).toBe(WEB_COPY.keepComing);

    await port.schedule(planned({ id: 'c', fireAt: '2026-11-01T22:00:00.000Z' }));
    await port.flush();
    keeps = api.lastList()!.filter((r) => r.kind === 'keep');
    expect(keeps.map((k) => k.dueAt)).toEqual(['2026-11-01T23:00:00.000Z']);
  });

  it('never sends the server more than 60, the notice included', async () => {
    for (let i = 0; i < 60; i++) await port.schedule(planned({ id: `p${i}`, fireAt: new Date(Date.parse('2026-11-01T08:00:00Z') + i * 60_000).toISOString() }));
    await port.flush();
    const list = api.lastList()!;
    expect(list.length).toBe(60);
    expect(list.filter((r) => r.kind === 'keep').length).toBe(1);
  });

  it('waits to send anything until reminders are turned on', async () => {
    await kv.del('registered');
    await port.schedule(planned());
    await port.flush();
    expect(api.calls).toEqual([]);
    expect(await kv.get('pending')).toBe(true);
  });
});
