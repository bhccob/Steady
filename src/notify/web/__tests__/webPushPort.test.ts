import { WEB_COPY } from '../../copy';
import type { Planned } from '../../plan';
import { ServerError } from '../api';
import { memoryKv, type Kv } from '../kv';
import { createWebPushPort, type RegisterResult } from '../webPushPort';

type Sent = { id: string; dueAt: string; kind: string };

const NOW = Date.parse('2026-10-31T12:00:00.000Z');
const tick = () => new Promise((r) => setTimeout(r, 0));

function fakeApi() {
  const calls: { name: string; args: unknown[] }[] = [];
  let failing: number | 'offline' | null = null;
  let failures = Infinity;
  let holdNext = false;
  let release: (() => void) | null = null;
  return {
    calls,
    /** Every putReminders fails (offline, or with this status), `times` times. */
    fail(on: number | 'offline' | null, times = Infinity) {
      failing = on;
      failures = times;
    },
    /** The next putReminders waits until released: a list still on its way. */
    hold() {
      holdNext = true;
      return { release: () => release?.() };
    },
    lastList: () => [...calls].reverse().find((c) => c.name === 'putReminders')?.args[1] as Sent[] | undefined,
    async putInstall(...args: unknown[]) {
      calls.push({ name: 'putInstall', args });
    },
    async putReminders(...args: unknown[]) {
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((r) => (release = r));
      }
      if (failing !== null && failures > 0) {
        failures--;
        throw failing === 'offline' ? new Error('offline') : new ServerError(failing);
      }
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
let reregister: jest.Mock<Promise<RegisterResult>, []>;
let port: ReturnType<typeof createWebPushPort>;

beforeEach(async () => {
  kv = memoryKv();
  api = fakeApi();
  reregister = jest.fn(async () => 'ok' as const);
  port = createWebPushPort({ kv, api, permitted: async () => true, now: () => NOW, reregister: () => reregister() });
  await kv.set('registered', true);
});

const doses = () => api.lastList()!.filter((r) => r.kind === 'dose');
const onlyTomb = async () => kv.get<{ at: number; marked?: boolean }>((await kv.keys('tomb:'))[0]!);

describe('webPushPort', () => {
  it('keeps the words on the phone and sends the server only an opaque id, time and kind', async () => {
    await port.schedule(planned());
    await port.flush();
    const dose = doses()[0]!;
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
    const oid = doses()[0]!.id;
    await port.cancel(planned().id);
    await port.flush();
    expect(await kv.get(`tomb:${oid}`)).toBeDefined();
    expect(await kv.get(`rem:${oid}`)).toBeUndefined();
    expect(api.lastList()!.some((r) => r.id === oid)).toBe(false);
  });

  it('says "all marked" only for a reminder cancelled because its dose was marked', async () => {
    await port.schedule(planned());
    await port.dismiss(['d-1']);
    await port.cancel(planned().id);
    expect(await onlyTomb()).toMatchObject({ marked: true });
  });

  it("doesn't claim a dose was marked when its reminder was cancelled for another reason (a snooze, a new time)", async () => {
    await port.schedule(planned());
    await port.cancel(planned().id);
    expect(await onlyTomb()).toMatchObject({ marked: false });
  });

  it("keeps changes pending when the server can't be reached, and sends them later", async () => {
    api.fail('offline');
    await port.schedule(planned());
    await port.flush();
    expect(await port.pending()).toBe(true);
    api.fail(null);
    await port.flush();
    expect(await port.pending()).toBe(false);
    expect(doses().length).toBe(1);
  });

  it("doesn't send reminders that have already fired", async () => {
    await port.schedule(planned({ id: 'gone-by', fireAt: '2026-10-31T11:30:00.000Z' }));
    await port.schedule(planned());
    await port.flush();
    expect(doses().map((r) => r.dueAt)).toEqual(['2026-11-01T08:00:00.000Z']);
  });

  it('still sends a change made while the list was on its way', async () => {
    const held = api.hold();
    await port.schedule(planned({ id: 'a' }));
    const first = port.flush();
    await tick();
    await port.schedule(planned({ id: 'b', fireAt: '2026-11-01T09:00:00.000Z' }));
    const second = port.flush();
    await tick();
    held.release();
    await Promise.all([first, second]);
    expect(doses().length).toBe(2);
    expect(await port.pending()).toBe(false);
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
    expect(await port.pending()).toBe(true);
  });
});

describe('when the server has forgotten this phone (30 quiet days, or its push address expired)', () => {
  it('registers again and sends the list', async () => {
    api.fail(401, 1);
    await port.schedule(planned());
    await port.flush();
    expect(reregister).toHaveBeenCalledTimes(1);
    expect(doses().length).toBe(1);
    expect(await port.pending()).toBe(false);
  });

  it("turns reminders off when it can't register again, so Settings shows Off", async () => {
    reregister.mockResolvedValue('impossible');
    api.fail(401);
    await port.schedule(planned());
    await port.flush();
    expect(await kv.get('registered')).toBeUndefined();
    expect(await port.pending()).toBe(true);
  });

  it('tries again later when registering fails for now', async () => {
    reregister.mockResolvedValue('failed');
    api.fail(401);
    await port.schedule(planned());
    await port.flush();
    expect(await kv.get('registered')).toBe(true);
    expect(await port.pending()).toBe(true);
  });
});
