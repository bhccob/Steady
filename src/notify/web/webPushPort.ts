import { WEB_COPY } from '../copy';
import type { Category, Planned } from '../plan';
import type { NotificationPort } from '../scheduler';
import { ServerError, type ReminderApi, type ServerReminder } from './api';
import { getIdentity } from './identity';
import { opaqueId } from './ids';
import type { Kv } from './kv';

// The web's reminder port. The planner and scheduler are the same as on Android; this keeps each
// reminder's words on the phone (IndexedDB, read by the service worker) under an opaque id, and
// sends the server only that id, the time and the kind (spec: "What the server may know").

type Kind = 'dose' | 'dose_final' | 'bedtime' | 'other' | 'keep';

/** What the phone keeps per reminder, at `rem:<opaque id>`. */
export interface LocalReminder {
  plannedId: string;
  body: string;
  fireAt: string;
  kind: Kind;
  doseIds: string[];
}

/** A cancelled reminder, at `tomb:<opaque id>`, for a push that still arrives. */
export interface Tomb {
  at: number;
  /** Cancelled because its doses were marked: the push may say "you're all marked." */
  marked: boolean;
}

/** Registering this phone again: 'impossible' when push is gone for good (Settings then shows Off). */
export type RegisterResult = 'ok' | 'impossible' | 'failed';

const SERVER_MAX = 60;
const KEEP_AFTER_MS = 60 * 60 * 1000;
const TOMB_MS = 24 * 60 * 60 * 1000;

const kindOf = (category: Category | null): Kind => category ?? 'other';

/** Counts a change the server hasn't been sent yet. */
export async function noteChange(kv: Kv): Promise<void> {
  await kv.set('changes', ((await kv.get<number>('changes')) ?? 0) + 1);
}

export interface WebPushPortDeps {
  kv: Kv;
  api: ReminderApi;
  /** Notification permission granted and a push subscription saved. */
  permitted: () => Promise<boolean>;
  /** The reminders showing now (service worker registration). */
  notifications?: () => Promise<{ data?: unknown; close(): void }[]>;
  /** The server no longer knows this phone: register it again. */
  reregister?: () => Promise<RegisterResult>;
  now?: () => number;
}

export function createWebPushPort({ kv, api, permitted, notifications, reregister, now = Date.now }: WebPushPortDeps): NotificationPort & { flush(): Promise<void>; pending(): Promise<boolean> } {
  const idFor = async (plannedId: string) => opaqueId((await getIdentity(kv)).secret, plannedId);
  const changes = async () => [(await kv.get<number>('changes')) ?? 0, (await kv.get<number>('sent')) ?? 0] as const;

  const reminders = async () => {
    const out: { oid: string; rec: LocalReminder }[] = [];
    for (const key of await kv.keys('rem:')) {
      const rec = await kv.get<LocalReminder>(key);
      if (rec) out.push({ oid: key.slice(4), rec });
    }
    return out;
  };

  const prune = async (prefix: string, at: (value: unknown) => number | undefined) => {
    for (const key of await kv.keys(prefix)) {
      const t = at(await kv.get(key));
      if (t === undefined || now() - t > TOMB_MS) await kv.del(key);
    }
  };

  const send = async () => {
    const [changed, sent] = await changes();
    if (changed === sent || !(await kv.get('registered'))) return;
    await prune('tomb:', (v) => (v as Tomb | undefined)?.at);
    await prune('marked:', (v) => v as number | undefined);

    // Reminders run out a few days ahead, until Steady is opened again: one quiet notice an
    // hour after the last says so. It's rebuilt on every flush, so there's only ever one.
    const all = await reminders();
    for (const { oid, rec } of all) if (rec.kind === 'keep') await kv.del(`rem:${oid}`);
    const planned = all.filter(({ rec }) => rec.kind !== 'keep' && Date.parse(rec.fireAt) > now()).sort((a, b) => a.rec.fireAt.localeCompare(b.rec.fireAt));
    // Leave room for the notice within the server's cap; the furthest one is planned again later.
    const kept = planned.slice(0, SERVER_MAX - 1);
    const list: ServerReminder[] = kept.map(({ oid, rec }) => ({ id: oid, dueAt: rec.fireAt, kind: rec.kind }));
    const last = kept.at(-1);
    if (last) {
      const fireAt = new Date(Date.parse(last.rec.fireAt) + KEEP_AFTER_MS).toISOString();
      const plannedId = `keep:${fireAt}`;
      const oid = await idFor(plannedId);
      await kv.set(`rem:${oid}`, { plannedId, body: WEB_COPY.keepComing, fireAt, kind: 'keep', doseIds: [] } satisfies LocalReminder);
      list.push({ id: oid, dueAt: fireAt, kind: 'keep' });
    }

    const me = await getIdentity(kv);
    try {
      await api.putReminders(me, list);
    } catch (e) {
      // Anything else: still pending, sent on the next sync or when the connection comes back.
      if (!(e instanceof ServerError && e.status === 401) || !reregister) return;
      const again = await reregister();
      if (again === 'impossible') await kv.del('registered');
      if (again !== 'ok') return;
      try {
        await api.putReminders(me, list);
      } catch {
        return;
      }
    }
    // Only what this list covered: a change made while it was on its way is still pending.
    await kv.set('sent', changed);
  };

  // One at a time, so an older list can never land after a newer one.
  let queue: Promise<void> = Promise.resolve();

  return {
    permitted,

    async scheduled() {
      return (await reminders()).filter(({ rec }) => rec.kind !== 'keep').map(({ rec }) => ({ id: rec.plannedId, fireAt: rec.fireAt, body: rec.body }));
    },

    async schedule(n: Planned) {
      const oid = await idFor(n.id);
      const rec: LocalReminder = { plannedId: n.id, body: n.body, fireAt: n.fireAt, kind: kindOf(n.category), doseIds: n.data.kind === 'dose' ? [...n.data.doseIds] : [] };
      await kv.set(`rem:${oid}`, rec);
      await kv.del(`tomb:${oid}`);
      await noteChange(kv);
    },

    async cancel(plannedId: string) {
      const oid = await idFor(plannedId);
      const rec = await kv.get<LocalReminder>(`rem:${oid}`);
      const doseIds = rec?.doseIds ?? [];
      let marked = doseIds.length > 0;
      for (const id of doseIds) if ((await kv.get(`marked:${id}`)) === undefined) marked = false;
      await kv.del(`rem:${oid}`);
      await kv.set(`tomb:${oid}`, { at: now(), marked } satisfies Tomb);
      await noteChange(kv);
    },

    async dismiss(doseIds: readonly string[]) {
      // Marked: the scheduler cancels these doses' reminders next, as marked.
      for (const id of doseIds) await kv.set(`marked:${id}`, now());
      for (const shown of (await notifications?.()) ?? []) {
        const ids = (shown.data as { doseIds?: unknown } | undefined)?.doseIds;
        if (Array.isArray(ids) && ids.some((id) => doseIds.includes(id as string))) shown.close();
      }
    },

    /** Sends the server the whole upcoming list, if anything changed and reminders are turned on. */
    flush() {
      const run = queue.then(send);
      queue = run.catch(() => {});
      return run;
    },

    /** Changes the server hasn't been sent yet. */
    async pending() {
      const [changed, sent] = await changes();
      return changed !== sent;
    },
  };
}
